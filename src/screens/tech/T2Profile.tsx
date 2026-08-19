import { useEffect, useRef, useState, type ChangeEvent } from "react"
import "./T2Profile.css"
import { resolvePhotoUrl } from "../../utils/photoUrl"
import { API_BASE_URL } from "../../config"
import {
  sanitizeText,
  sanitizeMultiline,
  sanitizeLetters,
  sanitizeDigits,
  isValidPhone,
  isValidName,
  hasSqlInjectionPattern,
  MAX_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_MULTILINE_LENGTH,
} from "../../utils/validation"
import { useI18n } from "../../i18n"

interface Profile {
  username: string
  userId?: number
  email?: string
  firstName: string
  lastName: string
  role: "client" | "technician" | "admin"
  domain: string
  city: string
  location: string
  photoUrl?: string
  phone?: string
  specialties?: string
  bio?: string
  verified?: boolean
  technicianId?: number
  hourlyRate?: number
  experienceYears?: number
}

interface Props {
  profile?: Profile | null
  onUpdateProfile?: (profile: Profile) => void
}

function Field({
  label,
  value,
  onChange,
  mono,
  filter,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  mono?: boolean
  filter?: "letters" | "digits"
}) {
  return (
    <div>
      <p className="text-xs font-medium mb-1.5 t2-label">
        {label}
      </p>
      <input
        value={value}
        onChange={(e) => {
          let next = e.target.value
          if (filter === "digits") next = sanitizeDigits(next)
          else if (filter === "letters") next = sanitizeLetters(next)
          onChange(next)
        }}
        className="w-full rounded-xl px-4 py-3.5 text-sm outline-none t2-input"
        style={mono ? { fontFamily: "JetBrains Mono, monospace" } : undefined}
      />
    </div>
  )
}

export default function T2Profile({ profile, onUpdateProfile }: Props) {
  const { t, locale } = useI18n()
  const [nom, setNom] = useState(profile?.lastName || "")
  const [prenom, setPrenom] = useState(profile?.firstName || "")
  const [phone, setPhone] = useState(profile?.phone || "")
  const [ville, setVille] = useState(profile?.city || "")
  const [quartier, setQuartier] = useState(profile?.location || "")
  const [bio, setBio] = useState(profile?.bio || "")
  const [specs, setSpecs] = useState(profile?.specialties || "")
  const [hourlyRate, setHourlyRate] = useState(profile?.hourlyRate ? String(profile.hourlyRate) : "")
  const [experienceYears, setExperienceYears] = useState(
    profile?.experienceYears ? String(profile.experienceYears) : "",
  )
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>(profile?.photoUrl || "")
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const edited = useRef(false)

  const markEdited = () => {
    edited.current = true
  }

  const appendRateFields = (payload: FormData) => {
    const hr = hourlyRate.trim()
    const ey = experienceYears.trim()
    if (hr !== "" && !isNaN(Number(hr)) && Number(hr) >= 0) {
      payload.append("hourlyRate", String(Math.floor(Number(hr))))
    }
    if (ey !== "" && !isNaN(Number(ey)) && Number(ey) >= 0) {
      payload.append("experienceYears", String(Math.floor(Number(ey))))
    }
  }

  interface PortfolioItem {
    id: number
    label: string
    beforeUrl?: string | null
    afterUrl?: string | null
  }

  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [recCount, setRecCount] = useState(0)
  const [pfLabel, setPfLabel] = useState("")
  const [beforeFile, setBeforeFile] = useState<File | null>(null)
  const [afterFile, setAfterFile] = useState<File | null>(null)
  const [beforePreview, setBeforePreview] = useState("")
  const [afterPreview, setAfterPreview] = useState("")
  const [portfolioBusy, setPortfolioBusy] = useState(false)
  const [portfolioError, setPortfolioError] = useState<string | null>(null)
  const beforeInputRef = useRef<HTMLInputElement | null>(null)
  const afterInputRef = useRef<HTMLInputElement | null>(null)

  interface KycDoc {
    id: number
    docType: string
    fileUrl?: string
    status: string
    createdAt?: number
  }

  const [kycDocs, setKycDocs] = useState<KycDoc[]>([])
  const [kycBusy, setKycBusy] = useState<string | null>(null)
  const [kycError, setKycError] = useState<string | null>(null)
  const letterInputRef = useRef<HTMLInputElement | null>(null)

  const getDoc = (docType: string) => kycDocs.find((d) => d.docType === docType)
  const letters = kycDocs.filter((d) => d.docType === "recommendation_letter")

  useEffect(() => {
    if (edited.current) return
    setPhotoPreview(profile?.photoUrl || "")
    setPhotoFile(null)
    setNom(profile?.lastName || "")
    setPrenom(profile?.firstName || "")
    setPhone(profile?.phone || "")
    setVille(profile?.city || "")
    setQuartier(profile?.location || "")
    setBio(profile?.bio || "")
    setSpecs(profile?.specialties || "")
    setHourlyRate(profile?.hourlyRate ? String(profile.hourlyRate) : "")
    setExperienceYears(profile?.experienceYears ? String(profile.experienceYears) : "")
  }, [profile])

  useEffect(() => {
    const token = localStorage.getItem("mboaTechToken")
    if (!token) return
    fetch(`${API_BASE_URL}/api/technicians/portfolio/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((items) => setPortfolio(Array.isArray(items) ? items : []))
      .catch(() => setPortfolio([]))
  }, [])

  useEffect(() => {
    if (!profile?.technicianId) return
    fetch(`${API_BASE_URL}/api/technicians/${profile.technicianId}/recommendations`)
      .then((res) => (res.ok ? res.json() : []))
      .then((items) => setRecCount(Array.isArray(items) ? items.length : 0))
      .catch(() => setRecCount(0))
  }, [profile?.technicianId])

  useEffect(() => {
    const token = localStorage.getItem("mboaTechToken")
    if (!token) return
    fetch(`${API_BASE_URL}/api/kyc`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((items) => setKycDocs(Array.isArray(items) ? items : []))
      .catch(() => setKycDocs([]))
  }, [])

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    markEdited()
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    uploadPhoto(file)
  }

  const uploadPhoto = async (file: File) => {
    setUploadingPhoto(true)
    setSaveError(null)
    const payload = new FormData()
    payload.append("firstName", sanitizeText(prenom, MAX_NAME_LENGTH))
    payload.append("lastName", sanitizeText(nom, MAX_NAME_LENGTH))
    payload.append("role", profile?.role || "technician")
    payload.append("domain", sanitizeText(profile?.domain || "", MAX_TEXT_LENGTH))
    payload.append("city", sanitizeText(ville, MAX_TEXT_LENGTH))
    payload.append("location", sanitizeText(quartier, MAX_TEXT_LENGTH))
    payload.append("phone", sanitizeText(phone, 20))
    payload.append("specialties", sanitizeMultiline(specs, MAX_MULTILINE_LENGTH))
    payload.append("bio", sanitizeMultiline(bio, MAX_MULTILINE_LENGTH))
    appendRateFields(payload)
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
      setPhotoPreview(newPhotoUrl || photoPreview)
      setPhotoFile(null)
      if (onUpdateProfile) {
        onUpdateProfile({
          username: updated.username || profile?.username || "",
          userId: updated.userId ?? profile?.userId,
          email: updated.email ?? profile?.email,
          firstName: updated.firstName || prenom.trim(),
          lastName: updated.lastName || nom.trim(),
          role: updated.role || profile?.role || "technician",
          domain: updated.domain || profile?.domain || "",
          city: updated.city || ville.trim() || "",
          location: updated.location || quartier.trim() || "",
          photoUrl: newPhotoUrl,
          phone: updated.phone ?? phone.trim(),
          specialties: updated.specialties ?? specs.trim(),
          bio: updated.bio ?? bio.trim(),
          verified: updated.verified ?? profile?.verified,
          technicianId: updated.technicianId ?? profile?.technicianId,
          hourlyRate:
            updated.hourlyRate !== undefined && updated.hourlyRate !== null
              ? Number(updated.hourlyRate)
              : profile?.hourlyRate,
          experienceYears:
            updated.experienceYears !== undefined && updated.experienceYears !== null
              ? Number(updated.experienceYears)
              : profile?.experienceYears,
        })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("Erreur lors de l'enregistrement de la photo de profil.")
      setSaveError(message)
      setSaved(false)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const save = async () => {
    setSaveError(null)

    const firstName = sanitizeText(prenom, MAX_NAME_LENGTH)
    const lastName = sanitizeText(nom, MAX_NAME_LENGTH)
    const city = sanitizeText(ville, MAX_TEXT_LENGTH)
    const location = sanitizeText(quartier, MAX_TEXT_LENGTH)
    const phoneCleaned = sanitizeText(phone, 20)
    const specialtiesCleaned = sanitizeMultiline(specs, MAX_MULTILINE_LENGTH)
    const bioCleaned = sanitizeMultiline(bio, MAX_MULTILINE_LENGTH)

    if (!firstName || !lastName) {
      setSaveError(t("Veuillez renseigner votre nom et prénom."))
      return
    }
    if (!isValidName(firstName) || !isValidName(lastName)) {
      setSaveError(t("Le nom et le prénom ne doivent contenir que des lettres."))
      return
    }
    if (phoneCleaned && !isValidPhone(phoneCleaned)) {
      setSaveError(t("Veuillez renseigner un numéro de téléphone valide (ex : +237 6 99 00 00 00)."))
      return
    }
    const fieldsValidation = [
      {
        key: "firstName",
        label: "prénom",
        value: prenom,
        maxLength: MAX_NAME_LENGTH,
      },
      { key: "lastName", label: "nom", value: nom, maxLength: MAX_NAME_LENGTH },
      { key: "city", label: "ville", value: ville, maxLength: MAX_TEXT_LENGTH },
      {
        key: "location",
        label: "quartier",
        value: quartier,
        maxLength: MAX_TEXT_LENGTH,
      },
      { key: "phone", label: "téléphone", value: phone, maxLength: 20 },
      {
        key: "specialties",
        label: "spécialités",
        value: specs,
        maxLength: MAX_MULTILINE_LENGTH,
      },
      { key: "bio", label: "bio", value: bio, maxLength: MAX_MULTILINE_LENGTH },
    ].some((f) => (f.value && f.value.length > f.maxLength) || hasSqlInjectionPattern(f.value))
    if (fieldsValidation) {
      setSaveError(t("Certains champs contiennent des caractères ou expressions non autorisés."))
      return
    }

    const payload = new FormData()
    payload.append("firstName", firstName)
    payload.append("lastName", lastName)
    payload.append("role", profile?.role || "technician")
    payload.append("domain", sanitizeText(profile?.domain || "", MAX_TEXT_LENGTH))
    payload.append("city", city)
    payload.append("location", location)
    payload.append("phone", phoneCleaned)
    payload.append("specialties", specialtiesCleaned)
    payload.append("bio", bioCleaned)
    appendRateFields(payload)
    if (photoFile) {
      payload.append("photo", photoFile)
    } else if (profile?.photoUrl) {
      payload.append("photoUrl", profile.photoUrl)
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
      const nextProfile: Profile = {
        username: updated.username || profile?.username || "",
        userId: updated.userId ?? profile?.userId,
        email: updated.email ?? profile?.email,
        firstName: updated.firstName || firstName,
        lastName: updated.lastName || lastName,
        role: updated.role || profile?.role || "technician",
        domain: updated.domain || profile?.domain || "",
        city: updated.city || city || "",
        location: updated.location || location || "",
        photoUrl: updated.photoUrl || photoPreview || profile?.photoUrl || "",
        phone: updated.phone ?? phoneCleaned,
        specialties: updated.specialties ?? specialtiesCleaned,
        bio: updated.bio ?? bioCleaned,
        verified: updated.verified ?? profile?.verified,
        technicianId: updated.technicianId ?? profile?.technicianId,
        hourlyRate:
          updated.hourlyRate !== undefined && updated.hourlyRate !== null
            ? Number(updated.hourlyRate)
            : hourlyRate.trim()
              ? Number(hourlyRate)
              : undefined,
        experienceYears:
          updated.experienceYears !== undefined && updated.experienceYears !== null
            ? Number(updated.experienceYears)
            : experienceYears.trim()
              ? Number(experienceYears)
              : undefined,
      }
      if (onUpdateProfile) onUpdateProfile(nextProfile)
      setPhotoPreview(nextProfile.photoUrl || "")
      setPhotoFile(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("Erreur lors de l'enregistrement du profil.")
      setSaveError(message)
      setSaved(false)
    }
  }

  const handleBeforeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setBeforeFile(file)
    setBeforePreview(URL.createObjectURL(file))
  }

  const handleAfterChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setAfterFile(file)
    setAfterPreview(URL.createObjectURL(file))
  }

  const addPortfolio = async () => {
    setPortfolioError(null)
    if (!beforeFile && !afterFile) {
      setPortfolioError(t("Ajoutez au moins une photo (avant ou après)."))
      return
    }
    const labelCleaned = sanitizeText(pfLabel, MAX_TEXT_LENGTH)
    if (hasSqlInjectionPattern(labelCleaned)) {
      setPortfolioError(t("Le libellé contient des caractères non autorisés."))
      return
    }
    setPortfolioBusy(true)
    const payload = new FormData()
    if (beforeFile) payload.append("before", beforeFile)
    if (afterFile) payload.append("after", afterFile)
    if (labelCleaned) payload.append("label", labelCleaned)
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/technicians/portfolio`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: payload,
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || t("Impossible d'ajouter la réalisation."))
      }
      const created = await response.json()
      setPortfolio((prev) => [created, ...prev])
      setPfLabel("")
      setBeforeFile(null)
      setAfterFile(null)
      setBeforePreview("")
      setAfterPreview("")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("Erreur lors de l'ajout de la réalisation.")
      setPortfolioError(message)
    } finally {
      setPortfolioBusy(false)
    }
  }

  const deletePortfolio = async (id: number) => {
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/technicians/portfolio/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) return
      setPortfolio((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      console.error("Erreur suppression realisation:", err)
    }
  }

  const refreshKyc = async () => {
    const token = localStorage.getItem("mboaTechToken")
    if (!token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/kyc`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setKycDocs(await res.json())
    } catch (err) {
      console.error("Erreur chargement documents KYC:", err)
    }
  }

  const uploadKyc = async (docType: string, file: File) => {
    setKycBusy(docType)
    setKycError(null)
    const payload = new FormData()
    payload.append("docType", docType)
    payload.append("file", file)
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/kyc`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: payload,
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || t("Impossible d'envoyer le document."))
      }
      await refreshKyc()
    } catch (error) {
      const message = error instanceof Error ? error.message : t("Erreur lors de l'envoi du document.")
      setKycError(message)
    } finally {
      setKycBusy(null)
    }
  }

  const deleteKyc = async (id: number) => {
    const token = localStorage.getItem("mboaTechToken")
    try {
      await fetch(`${API_BASE_URL}/api/kyc/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      await refreshKyc()
    } catch (err) {
      console.error("Erreur suppression document KYC:", err)
    }
  }

  const fileNameFromUrl = (url?: string) => {
    if (!url) return t("Document")
    const parts = url.split("/")
    return parts[parts.length - 1] || t("Document")
  }

  const KycUploadZone = ({
    label,
    icon,
    hint,
    docType,
    doc,
    onSelect,
    onDelete,
  }: {
    label: string
    icon: string
    hint: string
    docType: string
    doc?: KycDoc
    onSelect: (file: File) => void
    onDelete: (id: number) => void
  }) => {
    const { t, locale } = useI18n()
    const inputRef = useRef<HTMLInputElement | null>(null)
    const busy = kycBusy === docType
    return (
      <div>
        <p className="text-xs font-medium mb-1.5 t2-label">
          {label}
        </p>
        {doc ? (
          <div className="rounded-xl p-4 t2-kyc-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 t2-icon-bg">
                📄
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate t2-text-primary">
                  {fileNameFromUrl(doc.fileUrl)}
                </p>
                <span
                  className="text-xs font-medium"
                  style={{
                    color: doc.status === "validated" ? "#059669" : "#F59E0B",
                  }}
                >
                  {doc.status === "validated" ? t("✓ Validé") : t("En attente de validation")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0 text-white t2-replace-btn"
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "..." : t("Remplacer")}
              </button>
              <button
                type="button"
                onClick={() => onDelete(doc.id)}
                className="text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0 t2-delete-btn"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="w-full flex items-center gap-4 p-4 rounded-xl text-left t2-upload-zone"
            style={{ opacity: busy ? 0.6 : 1 }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 t2-icon-bg">
              {icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium t2-text-primary">
                {busy ? t("Envoi en cours...") : t("Télécharger le fichier")}
              </p>
              <p className="text-xs t2-text-muted">
                {hint}
              </p>
            </div>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#64748B"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 16 12 12 8 16" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
            </svg>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onSelect(file)
            e.target.value = ""
          }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-full p-4 sm:p-6 t2-page">
      <div className="mx-auto max-w-[min(1400px,95%)]">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="mb-1 text-xl font-bold sm:text-2xl t2-heading">
              {t("Mon profil")}
            </h1>
            <p className="text-sm t2-text-muted">
              {t("Gérez vos informations, spécialités et documents de certification")}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <button
              onClick={save}
              className="rounded-xl px-6 py-3.5 text-base font-bold text-white sm:px-8"
              style={{
                background: saved
                  ? "linear-gradient(135deg, #059669, #047857)"
                  : "linear-gradient(135deg, #2563EB, #1D4ED8)",
                fontFamily: "Poppins, sans-serif",
                boxShadow: "0 4px 20px rgba(37,99,235,0.3)",
              }}
            >
              {saved ? t("✓ Enregistré") : t("Enregistrer les modifications")}
            </button>
            {uploadingPhoto && (
              <p className="text-xs t2-text-blue">
                {t("Enregistrement de la photo de profil...")}
              </p>
            )}
            {saveError && !uploadingPhoto && (
              <p className="text-xs t2-text-error">
                {saveError}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Profile card */}
          <div className="flex flex-col gap-4">
            <div className="p-6 rounded-2xl text-center t2-card">
              <div className="relative mx-auto mb-4 w-20 h-20">
                <div className="h-20 w-20 rounded-full overflow-hidden border border-white/10 bg-[#0F172A]">
                  {photoPreview ? (
                    <img
                      src={resolvePhotoUrl(photoPreview)}
                      alt={t("Photo de profil")}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.15em] t2-text-muted">
                      {t("Photo")}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#2563EB] text-xs text-white shadow-lg t2-btn-shadow"
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
              <p className="text-base font-bold t2-heading">
                {prenom} {nom}
              </p>
              {profile?.email && (
                <p className="text-xs mt-0.5 t2-text-muted">
                  {profile.email}
                </p>
              )}
              <p className="text-sm mt-1 mb-3 t2-text-muted">
                {profile?.domain || t("Domaine non renseigné")}
              </p>
              {profile?.verified ? (
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold t2-badge-verified">
                  {t("✓ Identité vérifiée")}
                </span>
              ) : (
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold t2-badge-pending">
                  {t("Vérification en attente")}
                </span>
              )}
            </div>

            <div className="p-5 rounded-2xl t2-card">
              <p className="text-xs font-semibold mb-3 t2-section-heading">
                {t("Statut des documents")}
              </p>
              {(() => {
                const idRecto = getDoc("id_recto")
                const idVerso = getDoc("id_verso")
                const cert = getDoc("certificate")
                const idValidated =
                  idRecto?.status === "validated" && idVerso?.status === "validated"
                const certValidated = cert?.status === "validated"
                const rows = [
                  {
                    label: t("Pièce d'identité"),
                    status: idValidated
                      ? t("Validé")
                      : idRecto && idVerso
                        ? t("En attente")
                        : t("Non fournie"),
                    ok: idValidated,
                  },
                  {
                    label: t("Recommandations"),
                    status: `${recCount} ${t("reçue")}${recCount > 1 ? t("s") : ""}`,
                    ok: recCount >= 2,
                  },
                  {
                    label: t("Certif. métier"),
                    status: certValidated ? t("Validé") : cert ? t("En attente") : t("Non fourni"),
                    ok: certValidated,
                  },
                ]
                return rows.map((d) => (
                  <div
                    key={d.label}
                    className="flex items-center justify-between py-2 t2-doc-row"
                  >
                    <span className="text-xs t2-status-text">
                      {d.label}
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: d.ok ? "#059669" : "#F59E0B" }}
                    >
                      {d.status}
                    </span>
                  </div>
                ))
              })()}
            </div>
          </div>

          {/* Forms */}
          <div className="flex flex-col gap-5">
            {/* Personal info */}
            <div className="p-6 rounded-2xl t2-card">
              <h2 className="text-xs font-semibold mb-5 t2-section-heading">
                {t("Informations personnelles")}
              </h2>
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label={t("Nom")}
                  value={nom}
                  onChange={(v) => {
                    markEdited()
                    setNom(v)
                  }}
                  filter="letters"
                />
                <Field
                  label={t("Prénom")}
                  value={prenom}
                  onChange={(v) => {
                    markEdited()
                    setPrenom(v)
                  }}
                  filter="letters"
                />
              </div>
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label={t("Numéro de téléphone")}
                  value={phone}
                  onChange={(v) => {
                    markEdited()
                    setPhone(v)
                  }}
                  mono
                  filter="digits"
                />
                <Field
                  label={t("Ville")}
                  value={ville}
                  onChange={(v) => {
                    markEdited()
                    setVille(v)
                  }}
                  filter="letters"
                />
              </div>
              <Field
                label={t("Quartier / adresse")}
                value={quartier}
                onChange={(v) => {
                  markEdited()
                  setQuartier(v)
                }}
                filter="letters"
              />
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label={t("Tarif horaire (FCFA)")}
                  value={hourlyRate}
                  onChange={(v) => {
                    markEdited()
                    setHourlyRate(sanitizeDigits(v).slice(0, 9))
                  }}
                  mono
                  filter="digits"
                />
                <Field
                  label={t("Années d'expérience")}
                  value={experienceYears}
                  onChange={(v) => {
                    markEdited()
                    setExperienceYears(sanitizeDigits(v).slice(0, 3))
                  }}
                  mono
                  filter="digits"
                />
              </div>
              <p className="mt-2 text-[11px] t2-text-muted">
                {t("Ces informations sont affichées dans le catalogue : « Tarif horaire » et « Années d'expérience ».")}
              </p>
              <div className="mt-4">
                <p className="text-xs font-medium mb-1.5 t2-label">
                  {t("Présentation / bio")}
                </p>
                <textarea
                  value={bio}
                  onChange={(e) => {
                    markEdited()
                    setBio(e.target.value)
                  }}
                  rows={2}
                  className="w-full rounded-xl px-4 py-3.5 text-sm outline-none resize-none t2-input"
                />
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium mb-1.5 t2-label">
                  {t("Spécialités")}
                </p>
                <textarea
                  value={specs}
                  onChange={(e) => {
                    markEdited()
                    setSpecs(e.target.value)
                  }}
                  rows={3}
                  className="w-full rounded-xl px-4 py-3.5 text-sm outline-none resize-none t2-input"
                />
              </div>
            </div>

            {/* KYC */}
            <div className="p-6 rounded-2xl t2-card">
              <h2 className="text-xs font-semibold mb-5 t2-section-heading">
                {t("Documents KYC")}
              </h2>
              {kycError && (
                <p className="text-xs mb-3 t2-text-error">
                  {kycError}
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <KycUploadZone
                  label={t("Pièce d'identité — Recto")}
                  icon="🪪"
                  hint={t("CNI, Passeport · JPG, PNG, PDF")}
                  docType="id_recto"
                  doc={getDoc("id_recto")}
                  onSelect={(f) => uploadKyc("id_recto", f)}
                  onDelete={deleteKyc}
                />
                <KycUploadZone
                  label={t("Pièce d'identité — Verso")}
                  icon="🪪"
                  hint={t("Verso de la pièce d'identité")}
                  docType="id_verso"
                  doc={getDoc("id_verso")}
                  onSelect={(f) => uploadKyc("id_verso", f)}
                  onDelete={deleteKyc}
                />
                <KycUploadZone
                  label={t("Certificat métier")}
                  icon="📜"
                  hint={t("Attestation / diplôme du métier")}
                  docType="certificate"
                  doc={getDoc("certificate")}
                  onSelect={(f) => uploadKyc("certificate", f)}
                  onDelete={deleteKyc}
                />
              </div>
            </div>

            {/* Recommendations */}
            <div className="p-6 rounded-2xl t2-card">
              <h2 className="text-xs font-semibold mb-2 t2-section-heading">
                {t("Lettres de recommandation")}
              </h2>
              <p className="text-xs mb-4 t2-text-muted">
                {t("Lettres signées par des artisans seniors ou d'anciens clients hors-plateforme")}
              </p>

              {letters.length > 0 && (
                <div className="mb-4 space-y-2">
                  {letters.map((letter) => (
                    <div
                      key={letter.id}
                      className="rounded-xl p-3 flex items-center gap-3 t2-kyc-card"
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 t2-icon-bg">
                        📄
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate t2-text-primary">
                          {fileNameFromUrl(letter.fileUrl)}
                        </p>
                        <span
                          className="text-xs font-medium"
                          style={{
                            color: letter.status === "validated" ? "#059669" : "#F59E0B",
                          }}
                        >
                          {letter.status === "validated" ? t("✓ Validé") : t("En attente de validation")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteKyc(letter.id)}
                        disabled={kycBusy === "recommendation_letter"}
                        className="text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0 t2-delete-btn"
                        style={{
                          opacity: kycBusy === "recommendation_letter" ? 0.6 : 1,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => letterInputRef.current?.click()}
                disabled={kycBusy === "recommendation_letter"}
                className="w-full flex items-center gap-4 p-4 rounded-xl text-left t2-upload-zone"
                style={{ opacity: kycBusy === "recommendation_letter" ? 0.6 : 1 }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 t2-icon-bg">
                  📄
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium t2-text-primary">
                    {kycBusy === "recommendation_letter"
                      ? t("Envoi en cours...")
                      : letters.length > 0
                        ? t("Ajouter une lettre")
                        : t("Importer une lettre")}
                  </p>
                  <p className="text-xs t2-text-muted">
                    {t("PDF, JPG, PNG · Lettres signées et datées")}
                  </p>
                </div>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#64748B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="16 16 12 12 8 16" />
                  <line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
                </svg>
              </button>
              <input
                ref={letterInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadKyc("recommendation_letter", file)
                  e.target.value = ""
                }}
              />
            </div>

            {/* Portfolio — preuves avant/après */}
            <div className="p-6 rounded-2xl t2-card">
              <h2 className="text-xs font-semibold mb-2 t2-section-heading">
                {t("Mes réalisations")}
              </h2>
              <p className="text-xs mb-4 t2-text-muted">
                {t("Ajoutez des preuves avant / après de vos chantiers pour convaincre les clients.")}
              </p>

              <div className="mb-4">
                <Field label={t("Libellé de la réalisation")} value={pfLabel} onChange={setPfLabel} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium mb-1.5 t2-label">
                    {t("Photo — Avant")}
                  </p>
                  {beforePreview ? (
                    <div className="relative rounded-xl overflow-hidden">
                      <img
                        src={beforePreview}
                        alt={t("Avant")}
                        className="w-full object-cover"
                        style={{ height: "150px" }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setBeforeFile(null)
                          setBeforePreview("")
                        }}
                        className="absolute top-2 right-2 text-xs px-2 py-1 rounded-lg t2-remove-overlay"
                      >
                        {t("✕ Retirer")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => beforeInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-3 rounded-xl p-5 t2-upload-zone"
                    >
                      <span className="text-xl">📷</span>
                      <span className="text-sm font-medium t2-text-primary">
                        {t("Avant travaux")}
                      </span>
                    </button>
                  )}
                  <input
                    ref={beforeInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBeforeChange}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium mb-1.5 t2-label">
                    {t("Photo — Après")}
                  </p>
                  {afterPreview ? (
                    <div className="relative rounded-xl overflow-hidden">
                      <img
                        src={afterPreview}
                        alt={t("Après")}
                        className="w-full object-cover"
                        style={{ height: "150px" }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAfterFile(null)
                          setAfterPreview("")
                        }}
                        className="absolute top-2 right-2 text-xs px-2 py-1 rounded-lg t2-remove-overlay"
                      >
                        {t("✕ Retirer")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => afterInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-3 rounded-xl p-5 t2-upload-zone"
                    >
                      <span className="text-xl">✨</span>
                      <span className="text-sm font-medium t2-text-primary">
                        {t("Après travaux")}
                      </span>
                    </button>
                  )}
                  <input
                    ref={afterInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAfterChange}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={addPortfolio}
                  disabled={portfolioBusy}
                  className="rounded-xl px-5 py-3 text-sm font-bold text-white t2-primary-btn"
                  style={{
                    opacity: portfolioBusy ? 0.6 : 1,
                  }}
                >
                  {portfolioBusy ? t("Ajout en cours...") : t("+ Ajouter la réalisation")}
                </button>
                {portfolioError && (
                  <p className="text-xs t2-text-error">
                    {portfolioError}
                  </p>
                )}
              </div>

              {portfolio.length > 0 ? (
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {portfolio.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl overflow-hidden t2-item-card"
                    >
                      <div className="relative">
                        {item.afterUrl ? (
                          <img
                            src={resolvePhotoUrl(item.afterUrl)}
                            alt={item.label || t("Après")}
                            className="w-full object-cover"
                            style={{ height: "110px" }}
                          />
                        ) : (
                          <div className="w-full flex items-center justify-center text-xs t2-item-placeholder">
                            {t("Sans photo après")}
                          </div>
                        )}
                        <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-bold t2-after-badge">
                          {t("APRÈS")}
                        </span>
                      </div>
                      <div className="p-3 flex items-center justify-between gap-2">
                        <p className="text-xs font-medium truncate t2-text-primary">
                          {item.label || t("Réalisation")}
                        </p>
                        <button
                          type="button"
                          onClick={() => deletePortfolio(item.id)}
                          className="text-xs px-2 py-1 rounded-lg flex-shrink-0 t2-delete-btn"
                        >
                          {t("Supprimer")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-xl p-4 text-xs t2-empty-state">
                  {t("Aucune réalisation enregistrée. Sélectionnez une photo (avant et/ou après), puis cliquez sur « + Ajouter la réalisation » pour l'enregistrer.")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
