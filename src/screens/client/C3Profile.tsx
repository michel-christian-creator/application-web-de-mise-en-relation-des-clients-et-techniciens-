import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import { useI18n } from "../../i18n"
import type { Artisan } from "./C2Home"
import LocationMarker from "../../components/LocationMarker"
import { resolvePhotoUrl } from "../../utils/photoUrl"
import { API_BASE_URL } from "../../config"
import {
  ATTESTATION_LEVELS,
  attestationLevelMeta,
  type AttestationLevel,
} from "../../hooks/useAttestation"
import {
  sanitizeText,
  sanitizeMultiline,
  sanitizeLetters,
  sanitizeUsername,
  isValidName,
  isValidUsername,
  hasSqlInjectionPattern,
  validateFields,
  MAX_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_MULTILINE_LENGTH,
} from "../../utils/validation"
import "./C3Profile.css"

function formatResponseTime(seconds: number, t: (key: string) => string): string {
  if (!seconds || seconds <= 0) return "—"
  if (seconds < 300) return t("< 5 min")
  if (seconds < 3600) return `${Math.round(seconds / 60)} ${t("min")}`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.round((seconds % 3600) / 60)
  return mins > 0 ? `${hours} ${t("h")} ${mins} ${t("min")}` : `${hours} ${t("h")}`
}

type Recommendation = {
  id: number
  recommenderName: string
  recommenderUserId: number | null
  comment: string
  rating?: number | null
  verified: boolean
  createdAt?: string
}

interface Props {
  artisan: Artisan | null
  profile?: {
    username: string
    firstName: string
    lastName: string
    role: "client" | "technician" | "admin"
    domain: string
    city: string
    location: string
    photoUrl?: string
  } | null
  onBack: () => void
  onRequest: () => void
  onUpdateProfile?: (profile: {
    username: string
    firstName: string
    lastName: string
    role: "client" | "technician" | "admin"
    domain: string
    city: string
    location: string
    photoUrl?: string
  }) => void
}

type PortfolioItem = {
  id: number
  label: string
  beforeUrl?: string | null
  afterUrl?: string | null
}

type TechAttestation = {
  id: number
  attestationNumber: string
  level: AttestationLevel
  interventionCount: number
  avgRating: number
  generatedAt: string | null
}

function highestLevel(list: TechAttestation[]): AttestationLevel | null {
  let best: AttestationLevel | null = null
  for (const a of list) {
    if (
      best === null ||
      ATTESTATION_LEVELS.findIndex((l) => l.key === a.level) >
        ATTESTATION_LEVELS.findIndex((l) => l.key === best)
    ) {
      best = a.level
    }
  }
  return best
}

function getInitials(name?: string): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0][0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : ""
  return (first + last).toUpperCase()
}

function formatReviewDate(value: string | undefined, locale: string): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

type ClientRequest = {
  id: number
  status?: string
  technicianId?: number | string | null
  technicianName?: string | null
}

function isCompletedStatus(status?: string): boolean {
  const s = (status || "").toLowerCase().trim()
  return s === "completed" || s === "done" || s === "terminé" || s === "terminée"
}

function normalizeName(name?: string | null): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function hasCompletedIntervention(list: ClientRequest[], artisan: Artisan): boolean {
  const artisanName = normalizeName(artisan.fullname)
  return list.some((request) => {
    if (!isCompletedStatus(request.status)) return false
    if (request.technicianId != null && Number(request.technicianId) === Number(artisan.id)) {
      return true
    }
    const techName = normalizeName(request.technicianName)
    if (techName && artisanName) {
      return (
        techName === artisanName || techName.includes(artisanName) || artisanName.includes(techName)
      )
    }
    return false
  })
}

export default function C3Profile({ artisan, profile, onBack, onRequest, onUpdateProfile }: Props) {
  const { t, locale } = useI18n()
  const [selected, setSelected] = useState<number | null>(null)
  const [slidePos, setSlidePos] = useState(50)
  const [editing, setEditing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>(profile?.photoUrl || "")
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [attestations, setAttestations] = useState<TechAttestation[]>([])
  const [viewingAttestation, setViewingAttestation] = useState<TechAttestation | null>(null)
  const [ratingInput, setRatingInput] = useState(0)
  const [reviewerName, setReviewerName] = useState("")
  const [reviewComment, setReviewComment] = useState("")
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null)
  const [reviewEligibility, setReviewEligibility] = useState<"checking" | "eligible" | "blocked">(
    "checking",
  )
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const [form, setForm] = useState({
    username: profile?.username || "",
    firstName: profile?.firstName || "",
    lastName: profile?.lastName || "",
    role: profile?.role || "client",
    domain: profile?.domain || "",
    city: profile?.city || "",
    location: profile?.location || "",
    photoUrl: profile?.photoUrl || "",
  })

  useEffect(() => {
    setForm({
      username: profile?.username || "",
      firstName: profile?.firstName || "",
      lastName: profile?.lastName || "",
      role: profile?.role || "client",
      domain: profile?.domain || "",
      city: profile?.city || "",
      location: profile?.location || "",
      photoUrl: profile?.photoUrl || "",
    })
    setPhotoPreview(profile?.photoUrl || "")
    setPhotoFile(null)
    const defaultName = profile
      ? `${profile.firstName} ${profile.lastName}`.trim() || profile.username
      : ""
    setReviewerName((prev) => prev || defaultName)
  }, [profile])

  const fetchRecommendations = useCallback(async () => {
    if (!artisan) return
    setLoadingRecommendations(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/technicians/${artisan.id}/recommendations`)
      if (!response.ok) throw new Error("Erreur lors du chargement des recommandations")
      const data = (await response.json()) as unknown
      setRecommendations(Array.isArray(data) ? (data as Recommendation[]) : [])
    } catch (error) {
      console.error(error)
      setRecommendations([])
    } finally {
      setLoadingRecommendations(false)
    }
  }, [artisan])

  useEffect(() => {
    if (!artisan) return
    fetchRecommendations()

    const es = new EventSource(`${API_BASE_URL}/api/technicians/stream`)
    const refresh = () => fetchRecommendations()
    es.addEventListener("recommendation", refresh)
    es.addEventListener("connected", refresh)
    es.onmessage = refresh
    es.onerror = () => {}
    return () => es.close()
  }, [artisan, fetchRecommendations])

  useEffect(() => {
    if (!artisan) return
    fetch(`${API_BASE_URL}/api/technicians/${artisan.id}/portfolio`)
      .then((res) => (res.ok ? res.json() : []))
      .then((items) => setPortfolio(Array.isArray(items) ? items : []))
      .catch(() => setPortfolio([]))
  }, [artisan])

  useEffect(() => {
    if (!artisan) return
    fetch(`${API_BASE_URL}/api/technicians/${artisan.id}/attestations`)
      .then((res) => (res.ok ? res.json() : []))
      .then((items) => setAttestations(Array.isArray(items) ? (items as TechAttestation[]) : []))
      .catch(() => setAttestations([]))
  }, [artisan])

  useEffect(() => {
    if (!artisan) return
    let cancelled = false
    setReviewEligibility("checking")

    const verify = async () => {
      try {
        const token = localStorage.getItem("mboaTechToken")
        if (!token) {
          if (!cancelled) setReviewEligibility("blocked")
          return
        }
        const response = await fetch(`${API_BASE_URL}/api/chat/requests/client`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error(`Erreur (${response.status})`)
        const data = (await response.json()) as unknown
        const list = Array.isArray(data) ? (data as ClientRequest[]) : []
        if (!cancelled) {
          setReviewEligibility(hasCompletedIntervention(list, artisan) ? "eligible" : "blocked")
        }
      } catch (error) {
        console.error(error)
        if (!cancelled) setReviewEligibility("blocked")
      }
    }

    verify()
    return () => {
      cancelled = true
    }
  }, [artisan])

  const handleChange = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    uploadPhoto(file)
  }

  const handlePickPhoto = () => {
    photoInputRef.current?.click()
  }

  const uploadPhoto = async (file: File) => {
    setUploadingPhoto(true)
    setSaveError(null)
    const payload = new FormData()
    payload.append("firstName", sanitizeText(form.firstName, MAX_NAME_LENGTH))
    payload.append("lastName", sanitizeText(form.lastName, MAX_NAME_LENGTH))
    payload.append("role", form.role)
    payload.append("domain", sanitizeText(form.domain, MAX_TEXT_LENGTH))
    payload.append("city", sanitizeText(form.city, MAX_TEXT_LENGTH))
    payload.append("location", sanitizeText(form.location, MAX_TEXT_LENGTH))
    payload.append("photo", file)
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: "PUT",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: payload,
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || t("Impossible d'enregistrer la photo de profil"))
      }
      const updated = await response.json()
      const newPhotoUrl = updated.photoUrl || ""
      setForm((prev) => ({ ...prev, photoUrl: newPhotoUrl }))
      if (newPhotoUrl) setPhotoPreview(newPhotoUrl)
      setPhotoFile(null)
      if (onUpdateProfile) {
        onUpdateProfile({
          username: updated.username || form.username,
          firstName: updated.firstName || form.firstName,
          lastName: updated.lastName || form.lastName,
          role: (updated.role as "client" | "technician" | "admin") || form.role,
          domain: updated.domain || form.domain,
          city: updated.city || form.city,
          location: updated.location || form.location,
          photoUrl: newPhotoUrl,
        })
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("Erreur lors de l'enregistrement de la photo de profil.")
      setSaveError(message)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSave = async () => {
    setEditing(false)
    setSaveError(null)

    const firstName = sanitizeText(form.firstName, MAX_NAME_LENGTH)
    const lastName = sanitizeText(form.lastName, MAX_NAME_LENGTH)
    const domain = sanitizeText(form.domain, MAX_TEXT_LENGTH)
    const city = sanitizeText(form.city, MAX_TEXT_LENGTH)
    const location = sanitizeText(form.location, MAX_TEXT_LENGTH)

    if (!firstName || !lastName) {
      setEditing(true)
      setSaveError(t("Veuillez renseigner votre prénom et votre nom."))
      return
    }
    if (!isValidName(firstName) || !isValidName(lastName)) {
      setEditing(true)
      setSaveError(t("Le prénom et le nom ne doivent contenir que des lettres."))
      return
    }
    if (!isValidUsername(form.username)) {
      setEditing(true)
      setSaveError(
        t(
          "Nom d'utilisateur invalide : 3 à 30 caractères (lettres, chiffres, point, tiret, underscore).",
        ),
      )
      return
    }

    const fieldsValidation = validateFields([
      {
        key: "username",
        label: t("nom d'utilisateur"),
        value: form.username,
        maxLength: MAX_NAME_LENGTH,
      },
      {
        key: "firstName",
        label: t("prénom"),
        value: form.firstName,
        maxLength: MAX_NAME_LENGTH,
      },
      {
        key: "lastName",
        label: t("nom"),
        value: form.lastName,
        maxLength: MAX_NAME_LENGTH,
      },
      {
        key: "domain",
        label: t("domaine"),
        value: form.domain,
        maxLength: MAX_TEXT_LENGTH,
      },
      {
        key: "city",
        label: t("ville"),
        value: form.city,
        maxLength: MAX_TEXT_LENGTH,
      },
      {
        key: "location",
        label: t("quartier"),
        value: form.location,
        maxLength: MAX_TEXT_LENGTH,
      },
    ])
    if (!fieldsValidation.valid) {
      setEditing(true)
      setSaveError(fieldsValidation.message ?? t("Des caractères non autorisés ont été détectés."))
      return
    }

    const payload = new FormData()
    payload.append("firstName", firstName)
    payload.append("lastName", lastName)
    payload.append("role", form.role)
    payload.append("domain", domain)
    payload.append("city", city)
    payload.append("location", location)
    if (photoFile) {
      payload.append("photo", photoFile)
    } else if (form.photoUrl) {
      payload.append("photoUrl", form.photoUrl)
    }

    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: "PUT",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: payload,
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || t("Impossible d'enregistrer le profil"))
      }
      const updated = await response.json()
      const nextProfile = {
        username: updated.username || sanitizeText(form.username, MAX_NAME_LENGTH),
        firstName: updated.firstName || form.firstName,
        lastName: updated.lastName || form.lastName,
        role: (updated.role as "client" | "technician" | "admin") || form.role,
        domain: updated.domain || form.domain,
        city: updated.city || form.city,
        location: updated.location || form.location,
        photoUrl: updated.photoUrl || photoPreview || form.photoUrl,
      }
      setForm(nextProfile)
      setPhotoPreview(nextProfile.photoUrl || "")
      if (onUpdateProfile) onUpdateProfile(nextProfile)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("Erreur lors de l'enregistrement du profil.")
      setSaveError(message)
    }
  }

  const handleCancel = () => {
    setEditing(false)
    if (profile) {
      setForm({
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: profile.role,
        domain: profile.domain,
        city: profile.city,
        location: profile.location,
        photoUrl: profile.photoUrl || "",
      })
      setPhotoPreview(profile.photoUrl || "")
      setPhotoFile(null)
    }
  }

  if (!artisan) {
    return (
      <div className="min-h-full p-4 sm:p-6 profile-page">
        <div className="mx-auto flex max-w-4xl flex-col gap-5">
          <div className="rounded-3xl border border-white/10 p-7 profile-card">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full overflow-hidden border border-white/10 bg-[#0F172A]">
                    {photoPreview ? (
                      <img
                        src={resolvePhotoUrl(photoPreview)}
                        alt={t("Photo de profil")}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.15em] profile-avatar-empty">
                        {t("Photo")}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editing) setEditing(true)
                      handlePickPhoto()
                    }}
                    className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#2563EB] text-xs text-white shadow-lg profile-edit-shadow"
                  >
                    ✎
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium profile-text">{t("Mon profil")}</p>
                  <h1 className="mt-1 text-2xl font-bold profile-title">
                    {profile
                      ? `${profile.firstName} ${profile.lastName}`.trim() || profile.username
                      : t("Profil personnel")}
                  </h1>
                  <p className="mt-2 text-sm profile-subtitle">
                    {profile
                      ? `${
                          profile.role === "technician"
                            ? t("Technicien")
                            : profile.role === "admin"
                              ? t("Administrateur")
                              : t("Client")
                        } · ${profile.city || t("Ville non renseignée")}`
                      : t("Ajoutez vos informations pour compléter votre profil.")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={onBack}
                  className="rounded-xl px-4 py-2 text-sm font-medium profile-btn"
                >
                  {t("Retour à l'accueil")}
                </button>
                {profile && !editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="rounded-xl px-4 py-2 text-sm font-medium profile-btn-primary"
                  >
                    {t("Modifier")}
                  </button>
                )}
                {editing && (
                  <>
                    <button
                      onClick={handleSave}
                      className="rounded-xl px-4 py-2 text-sm font-medium profile-btn-save"
                    >
                      {t("Enregistrer")}
                    </button>
                    <button
                      onClick={handleCancel}
                      className="rounded-xl px-4 py-2 text-sm font-medium profile-btn"
                    >
                      {t("Annuler")}
                    </button>
                  </>
                )}
              </div>
              <div className="mt-2">
                {uploadingPhoto && (
                  <p className="text-xs profile-text-light">
                    {t("Enregistrement de la photo de profil...")}
                  </p>
                )}
                {saveError && !uploadingPhoto && (
                  <p className="text-xs profile-text-error">{saveError}</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 p-5 profile-card">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] profile-text">
                {t("Informations personnelles")}
              </h2>
              <div className="mt-4 space-y-3 text-sm profile-info-row">
                <div className="flex justify-between gap-4">
                  <span>{t("Nom d'utilisateur")}</span>
                  <span className="profile-label">
                    {editing ? (
                      <input
                        value={form.username}
                        onChange={(e) => handleChange("username", sanitizeUsername(e.target.value))}
                        className="rounded-xl px-3 py-2 profile-input text-white"
                      />
                    ) : (
                      profile?.username || "—"
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{t("Ville")}</span>
                  <span className="profile-label">
                    {editing ? (
                      <input
                        value={form.city}
                        onChange={(e) => handleChange("city", sanitizeLetters(e.target.value))}
                        className="rounded-xl px-3 py-2 profile-input text-white"
                      />
                    ) : (
                      profile?.city || "—"
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{t("Quartier")}</span>
                  <span className="profile-label">
                    {editing ? (
                      <input
                        value={form.location}
                        onChange={(e) => handleChange("location", sanitizeLetters(e.target.value))}
                        className="rounded-xl px-3 py-2 profile-input text-white"
                      />
                    ) : (
                      profile?.location || "—"
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{t("Type de compte")}</span>
                  <span className="profile-label">
                    {editing ? (
                      <input
                        value={form.domain}
                        onChange={(e) => handleChange("domain", sanitizeLetters(e.target.value))}
                        className="rounded-xl px-3 py-2 profile-input text-white"
                      />
                    ) : profile?.role === "technician" ? (
                      t("Technicien")
                    ) : profile?.role === "admin" ? (
                      t("Administrateur")
                    ) : (
                      t("Client")
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 p-5 profile-card">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] profile-text">
                {t("Activité récente")}
              </h2>
              <div className="mt-4 space-y-3 text-sm profile-info-row">
                <div className="rounded-xl p-3 profile-section">
                  <p className="font-medium profile-label">{t("Profil complété")}</p>
                  <p className="mt-1">
                    {Math.min(
                      100,
                      Math.round(
                        ([
                          profile?.firstName,
                          profile?.lastName,
                          profile?.city,
                          profile?.location,
                          profile?.photoUrl,
                        ].filter(Boolean).length /
                          5) *
                          100,
                      ),
                    )}
                    %
                  </p>
                </div>
                <div className="rounded-xl p-3 profile-section">
                  <p className="font-medium profile-label">{t("Compte")}</p>
                  <p className="mt-1">
                    {profile?.role === "technician"
                      ? t("Technicien")
                      : profile?.role === "admin"
                        ? t("Administrateur")
                        : t("Client")}{" "}
                    · {t("Actif")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const reviews = recommendations.filter((r) => r.rating != null)
  const endorsements = recommendations.filter((r) => r.rating == null)
  const topAttestationLevel = highestLevel(attestations)
  const topAttestationMeta = attestationLevelMeta(topAttestationLevel)

  const computedNote =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length) * 10) /
        10
      : artisan.note
  const computedMissions = reviews.length > 0 ? reviews.length : artisan.missions

  const handleSubmitReview = async () => {
    if (reviewEligibility !== "eligible") {
      setReviewError(
        t("Seuls les clients ayant terminé une intervention avec ce technicien peuvent le noter."),
      )
      setReviewSuccess(null)
      return
    }
    if (!Number.isInteger(ratingInput) || ratingInput < 1 || ratingInput > 5) {
      setReviewError(t("Choisissez une note entre 1 et 5 étoiles."))
      setReviewSuccess(null)
      return
    }
    const nameCleaned = sanitizeText(reviewerName, MAX_NAME_LENGTH)
    if (!isValidName(reviewerName)) {
      setReviewError(
        t("Votre nom ne doit contenir que des lettres (espaces et apostrophes autorisés)."),
      )
      setReviewSuccess(null)
      return
    }
    const commentCleaned = sanitizeMultiline(reviewComment, 500)
    if (hasSqlInjectionPattern(nameCleaned) || hasSqlInjectionPattern(commentCleaned)) {
      setReviewError(t("Votre avis contient des caractères ou expressions non autorisés."))
      setReviewSuccess(null)
      return
    }
    setSubmittingReview(true)
    setReviewError(null)
    setReviewSuccess(null)
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(
        `${API_BASE_URL}/api/technicians/${artisan.id}/recommendations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            recommenderName: nameCleaned || "Client",
            comment: commentCleaned,
            rating: ratingInput,
          }),
        },
      )
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || t("Impossible d'envoyer votre avis."))
      }
      setReviewSuccess(t("Merci ! Votre avis a bien été publié."))
      setRatingInput(0)
      setReviewComment("")
      await fetchRecommendations()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("Erreur lors de l'envoi de l'avis.")
      setReviewError(message)
    } finally {
      setSubmittingReview(false)
    }
  }

  return (
    <div className="min-h-full p-4 sm:p-6 profile-page">
      <div className="mx-auto max-w-[min(1400px,95%)]">
        <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <img
              src={resolvePhotoUrl(artisan.image)}
              alt={artisan.fullname}
              className="h-20 w-20 flex-shrink-0 rounded-2xl object-cover profile-img"
            />
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                <h1 className="text-2xl font-bold profile-title">{artisan.fullname}</h1>
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: artisan.dispo ? "rgba(5,150,105,0.15)" : "rgba(148,163,184,0.15)",
                    color: artisan.dispo ? "#059669" : "#94A3B8",
                    border: `1px solid rgba(${artisan.dispo ? "5,150,105" : "148,163,184"},0.3)`,
                  }}
                >
                  {artisan.dispo ? t("✓ Disponible maintenant") : t("○ Occupé")}
                </span>
                {topAttestationMeta && (
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      background: `${topAttestationMeta.color}22`,
                      color: topAttestationMeta.color,
                      border: `1px solid ${topAttestationMeta.color}55`,
                    }}
                  >
                    {topAttestationMeta.icon} {t("Certifié")} {topAttestationMeta.label}
                  </span>
                )}
              </div>
              <p className="text-sm mb-2 profile-text">
                {artisan.metier} · {artisan.experience}
              </p>
              <p className="text-sm mb-2 profile-subtitle">{artisan.description}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="profile-text-star">⭐ {computedNote}</span>
                <span className="text-sm profile-text">
                  {computedMissions} {t("missions réalisées")}
                </span>
                <LocationMarker className="h-4 w-4 text-slate-300" />
                <span className="text-sm profile-text">{artisan.quartier}</span>
                <span className="text-sm profile-status-available">
                  {artisan.dispo ? t("● Disponible") : t("○ Occupé")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onBack}
              className="rounded-xl px-4 py-3 text-sm font-medium profile-btn"
            >
              {t("← Retour à la liste")}
            </button>
            <button
              onClick={onRequest}
              className="self-center px-8 py-4 rounded-xl font-bold text-base text-white profile-btn-action"
            >
              {t("Demander une intervention")}
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <div className="p-5 rounded-2xl profile-card-section">
              <h2 className="text-xs font-semibold mb-4 profile-section-header">
                {t("Profil de")} {artisan.fullname}
              </h2>
              {loadingRecommendations ? (
                <p className="text-sm profile-subtitle">{t("Chargement des recommandations...")}</p>
              ) : endorsements.length > 0 ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex">
                      {endorsements.slice(0, 5).map((r, i) => (
                        <div
                          key={r.id}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold -ml-2 first:ml-0 uppercase profile-tag"
                        >
                          {getInitials(r.recommenderName)}
                        </div>
                      ))}
                    </div>
                    <p className="text-sm profile-subtitle">
                      {endorsements.length === 1
                        ? t("1 artisan senior")
                        : `${endorsements.length} ${t("artisans seniors")}`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {endorsements.slice(0, 3).map((r) => (
                      <div key={r.id} className="p-3 rounded-xl profile-section">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold profile-label">
                            {r.recommenderName ||
                              (r.recommenderUserId
                                ? `${t("Artisan")} #${r.recommenderUserId}`
                                : t("Artisan senior"))}
                          </span>
                          {r.verified && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full profile-badge">
                              {t("✓ Certifié")}
                            </span>
                          )}
                        </div>
                        {r.comment && (
                          <p className="text-xs leading-relaxed profile-subtitle">{r.comment}</p>
                        )}
                      </div>
                    ))}
                    {endorsements.length > 3 && (
                      <p className="text-xs profile-text">
                        + {endorsements.length - 3}{" "}
                        {endorsements.length - 3 > 1 ? t("autres") : t("autre")}{" "}
                        {endorsements.length - 3 > 1 ? t("recommandations") : t("recommandation")}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm profile-subtitle">
                  {t(
                    "Aucune recommandation pour le moment. Ce technicien n'a pas encore été recommandé par un artisan senior.",
                  )}
                </p>
              )}
            </div>

            {attestations.length > 0 && (
              <div className="p-5 rounded-2xl profile-card-section">
                <h2 className="text-xs font-semibold mb-4 profile-section-header">
                  {t("Certifications MboaTech")}
                </h2>
                <div className="flex flex-col gap-3">
                  {attestations.map((a) => {
                    const meta = attestationLevelMeta(a.level)
                    if (!meta) return null
                    return (
                      <div
                        key={a.id}
                        className="p-3 rounded-xl profile-section flex items-center gap-3"
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                          style={{
                            background: `${meta.color}22`,
                            border: `1px solid ${meta.color}55`,
                          }}
                        >
                          {meta.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold" style={{ color: meta.color }}>
                            {t("Attestation")} {meta.label}
                          </p>
                          <p className="text-xs profile-subtitle truncate">
                            {a.attestationNumber} ·{" "}
                            {formatReviewDate(a.generatedAt ?? undefined, locale)}
                          </p>
                          <p className="text-xs profile-subtitle">
                            {a.interventionCount} {t("interventions")} · ⭐ {a.avgRating}/5
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewingAttestation(a)}
                          className="cert-view-btn text-xs px-3 py-1.5 rounded-lg font-semibold flex-shrink-0"
                        >
                          {t("Consulter")}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="p-5 rounded-2xl profile-card-section">
              <h2 className="text-xs font-semibold mb-4 profile-section-header">
                {t("Statistiques")}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { label: t("Missions"), value: computedMissions.toString() },
                  { label: t("Note moy."), value: `${computedNote}/5` },
                  {
                    label: t("Taux succès"),
                    value: artisan.successRate > 0 ? `${artisan.successRate}%` : "—",
                  },
                  {
                    label: t("Réponse"),
                    value: formatResponseTime(artisan.avgResponseTimeSec, t),
                  },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-xl profile-section">
                    <p className="text-lg font-bold font-mono profile-label">{s.value}</p>
                    <p className="text-xs profile-text">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl profile-card-section">
              <h2 className="text-xs font-semibold mb-4 profile-section-header">
                {t("Derniers avis")}
              </h2>
              {loadingRecommendations ? (
                <p className="text-sm profile-subtitle">{t("Chargement des avis...")}</p>
              ) : reviews.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {reviews.slice(0, 6).map((r) => (
                    <div key={r.id} className="pb-4 profile-review-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium profile-subtitle">
                          {r.recommenderName ||
                            (r.recommenderUserId
                              ? `${t("Client")} #${r.recommenderUserId}`
                              : t("Client"))}
                        </span>
                        <span className="text-xs profile-text-star">
                          {"⭐".repeat(r.rating ?? 0)}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="text-xs leading-relaxed profile-text">{r.comment}</p>
                      )}
                      <p className="text-xs mt-1 profile-text-mono">
                        {formatReviewDate(r.createdAt, locale)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm mb-4 profile-subtitle">
                  {t(
                    "Aucun avis pour le moment. Les avis sont publiés par les clients après une intervention terminée.",
                  )}
                </p>
              )}

              <div className="mt-4 p-4 rounded-xl profile-review-form">
                {reviewEligibility === "checking" ? (
                  <p className="text-sm profile-subtitle">
                    {t("Vérification de vos interventions avec ce technicien…")}
                  </p>
                ) : reviewEligibility === "blocked" ? (
                  <div className="text-center py-2">
                    <p className="text-sm font-semibold profile-label">{t("Notation réservée")}</p>
                    <p className="text-xs mt-1 leading-relaxed profile-subtitle">
                      {t(
                        "Pour éviter la fraude, vous pouvez noter ce technicien uniquement après une intervention terminée avec lui.",
                      )}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold mb-3 profile-label">
                      {t("Donner votre avis")}
                    </p>
                    <div className="flex items-center gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRatingInput(star)}
                          aria-label={`${star} ${t("étoile")}${star > 1 ? "s" : ""}`}
                          className="text-2xl leading-none transition-transform"
                          style={{
                            color: star <= ratingInput ? "#F59E0B" : "rgba(255,255,255,0.15)",
                            transform: star <= ratingInput ? "scale(1.1)" : "scale(1)",
                          }}
                        >
                          ★
                        </button>
                      ))}
                      <span
                        className="ml-2 text-xs"
                        style={{
                          color: ratingInput > 0 ? "#F59E0B" : "#64748B",
                        }}
                      >
                        {ratingInput > 0 ? `${ratingInput}/5` : t("Choisir une note")}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={reviewerName}
                      onChange={(e) => setReviewerName(sanitizeLetters(e.target.value))}
                      placeholder={t("Votre nom")}
                      className="w-full mb-2 rounded-lg px-3 py-2 text-sm text-white outline-none profile-input"
                    />
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder={t("Votre avis sur la qualité du travail...")}
                      rows={3}
                      className="w-full mb-3 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none profile-input"
                    />
                    {reviewError && (
                      <p className="text-xs mb-2 profile-text-error">{reviewError}</p>
                    )}
                    {reviewSuccess && (
                      <p className="text-xs mb-2 profile-text-success">{reviewSuccess}</p>
                    )}
                    <button
                      type="button"
                      onClick={handleSubmitReview}
                      disabled={submittingReview}
                      className="w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white"
                      style={{
                        background: "linear-gradient(135deg, #059669, #047857)",
                        opacity: submittingReview ? 0.6 : 1,
                      }}
                    >
                      {submittingReview ? t("Envoi en cours...") : t("Publier mon avis")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="p-5 rounded-2xl profile-card-section">
              <h2 className="text-xs font-semibold mb-4 profile-section-header">
                {t("Catalogue Avant / Après — Cliquez pour comparer")}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {portfolio.length === 0 ? (
                  <div className="rounded-xl p-8 text-center sm:col-span-2 profile-gallery-empty">
                    <p className="text-sm font-medium profile-label">
                      {t("Aucune réalisation publiée")}
                    </p>
                    <p className="text-xs mt-1 profile-text">
                      {t(
                        "Les photos avant / après des chantiers de ce technicien apparaîtront ici.",
                      )}
                    </p>
                  </div>
                ) : (
                  portfolio.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelected(i)
                        setSlidePos(50)
                      }}
                      className="rounded-xl overflow-hidden relative text-left profile-gallery-item"
                    >
                      <img
                        src={resolvePhotoUrl(p.afterUrl || p.beforeUrl)}
                        alt={p.label}
                        className="w-full object-cover profile-gallery-img"
                      />
                      <div className="absolute inset-0 flex items-end p-3 opacity-0 hover:opacity-100 profile-gallery-overlay">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs text-white font-medium">{p.label}</span>
                          <span className="text-xs px-2 py-0.5 rounded profile-gallery-compare">
                            {t("Comparer →")}
                          </span>
                        </div>
                      </div>
                      <div
                        className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background:
                            p.beforeUrl && p.afterUrl
                              ? "rgba(5,150,105,0.8)"
                              : "rgba(37,99,235,0.8)",
                          color: "white",
                        }}
                      >
                        {p.beforeUrl && p.afterUrl ? t("APRÈS") : t("PHOTO")}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {selected !== null && portfolio[selected] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center profile-modal-overlay"
          onClick={() => setSelected(null)}
        >
          <div
            className="rounded-2xl overflow-hidden profile-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative overflow-hidden profile-modal-height">
              <img
                src={resolvePhotoUrl(portfolio[selected].afterUrl || portfolio[selected].beforeUrl)}
                alt={t("Après")}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - slidePos}% 0 0)` }}
              >
                <img
                  src={resolvePhotoUrl(
                    portfolio[selected].beforeUrl || portfolio[selected].afterUrl,
                  )}
                  alt={t("Avant")}
                  className="w-full h-full object-cover"
                />
              </div>
              <div
                className="absolute top-0 bottom-0"
                style={{
                  left: `${slidePos}%`,
                }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg">
                  <span className="profile-range">↔</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={slidePos}
                onChange={(e) => setSlidePos(+e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
              />
              {portfolio[selected].beforeUrl && (
                <span className="absolute top-4 left-4 text-xs font-bold text-white px-3 py-1.5 rounded-lg profile-modal-label">
                  {t("AVANT")}
                </span>
              )}
              {portfolio[selected].afterUrl && (
                <span className="absolute top-4 right-4 text-xs font-bold text-white px-3 py-1.5 rounded-lg profile-modal-label-after">
                  {t("APRÈS")}
                </span>
              )}
            </div>
            <div className="p-4 flex items-center justify-between">
              <p className="text-sm font-medium profile-label">{portfolio[selected].label}</p>
              <button
                onClick={() => setSelected(null)}
                className="text-xs px-4 py-2 rounded-lg profile-modal-close"
              >
                {t("Fermer")}
              </button>
            </div>
          </div>
        </div>
      )}
      {viewingAttestation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 profile-modal-overlay"
          onClick={() => setViewingAttestation(null)}
        >
          <div
            className="rounded-2xl overflow-hidden w-full max-w-3xl cert-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const meta = attestationLevelMeta(viewingAttestation.level)
              return (
                <>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg flex-shrink-0">{meta?.icon}</span>
                      <p className="text-sm font-semibold profile-label truncate">
                        {t("Attestation")} {meta?.label} · {viewingAttestation.attestationNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewingAttestation(null)}
                        className="text-xs px-4 py-2 rounded-lg profile-modal-close"
                      >
                        {t("Fermer")}
                      </button>
                    </div>
                  </div>
                  <iframe
                    src={`${API_BASE_URL}/api/attestation/${viewingAttestation.id}/download#toolbar=0&navpanes=0&view=FitH`}
                    title={t("Aperçu de l'attestation")}
                    className="w-full h-[70vh] bg-white cert-pdf-frame"
                  />
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
