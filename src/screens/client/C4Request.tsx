import { useEffect, useState } from "react"
import ImageUploader from "../../components/ImageUploader"
import type { Artisan } from "./C2Home"
import { API_BASE_URL } from "../../config"
import {
  sanitizeText,
  sanitizeMultiline,
  hasSqlInjectionPattern,
  MAX_TEXT_LENGTH,
} from "../../utils/validation"
import { useI18n } from "../../i18n"

interface Props {
  domain?: string
  artisan?: Artisan | null
  isSelf?: boolean
  onSessionExpired?: () => void
  onSubmit: (request: {
    id?: number
    domain: string
    description: string
    urgence: "normal" | "important" | "critique"
    files: File[]
    photoUrl?: string
    technicianId?: number
  }) => void
}

const MAX_FILES = 6

export default function C4Request({
  domain = "",
  artisan = null,
  isSelf = false,
  onSessionExpired,
  onSubmit,
}: Props) {
  const { t, locale } = useI18n()
  const [domainValue, setDomainValue] = useState(artisan?.metier || domain)
  const [categories, setCategories] = useState<string[]>([])
  const [desc, setDesc] = useState("")
  const [urgence, setUrgence] = useState<"normal" | "important" | "critique">("normal")
  const [files, setFiles] = useState<File[]>([])

  useEffect(() => {
    setDomainValue(artisan?.metier || domain)
  }, [artisan, domain])

  useEffect(() => {
    let cancelled = false

    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/technicians/categories`)
        if (!response.ok) throw new Error("Impossible de charger les métiers")
        const data = (await response.json()) as unknown
        if (cancelled) return
        const nextCategories = Array.isArray(data)
          ? data.filter(
              (category): category is string =>
                typeof category === "string" && category.trim().length > 0,
            )
          : []
        setCategories(nextCategories)
        if (!domain && !domainValue && nextCategories.length > 0) {
          setDomainValue(nextCategories[0])
        }
      } catch (error) {
        console.error(error)
      }
    }

    fetchCategories()

    const es = new EventSource(`${API_BASE_URL}/api/technicians/stream`)
    es.onmessage = () => {
      fetchCategories()
    }
    es.onerror = () => {
      // Laisse EventSource se reconnecter automatiquement en cas d'erreur réseau.
    }

    return () => {
      cancelled = true
      es.close()
    }
  }, [domain, domainValue])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const urgenceOpts = [
    {
      key: "normal" as const,
      label: t("Normal"),
      desc: t("Intervention possible sous 48–72h"),
      color: "#059669",
      bg: "rgba(5,150,105,0.12)",
      border: "rgba(5,150,105,0.3)",
    },
    {
      key: "important" as const,
      label: t("Important"),
      desc: t("Intervention souhaitée dans la journée"),
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.12)",
      border: "rgba(245,158,11,0.3)",
    },
    {
      key: "critique" as const,
      label: t("Urgence critique"),
      desc: t("Intervention immédiate requise"),
      color: "#EF4444",
      bg: "rgba(239,68,68,0.12)",
      border: "rgba(239,68,68,0.3)",
    },
  ]

  return (
    <div className="min-h-full p-4 sm:p-6" style={{ background: "#0B1120" }}>
      <div className="mx-auto max-w-[min(1400px,95%)]">
        <div className="mb-6 sm:mb-8">
          <h1
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: "Poppins, sans-serif", color: "#E8EDF5" }}
          >
            {t("Publier une demande d'intervention")}
          </h1>
          <p className="text-sm" style={{ color: "#64748B" }}>
            {t("Décrivez votre problème pour qu'")}
            {artisan?.fullname || t("un artisan")}{" "}
            {t("puisse préparer son intervention")}
          </p>
          <p className="text-sm mt-2" style={{ color: "#94A3B8" }}>
            {t("Domaine :")}{" "}
            <span style={{ color: "#E8EDF5" }}>{domainValue || t("Non précisé")}</span>
          </p>
        </div>

        {isSelf && artisan && (
          <div
            className="mb-5 rounded-2xl p-4 text-sm"
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.4)",
              color: "#FECACA",
            }}
          >
            <span className="font-semibold" style={{ color: "#FCA5A5" }}>
              {t("⛔ Intervention sur vous-même impossible")}
            </span>{" "}
            {t(" — vous êtes le technicien sélectionné (")}
            <strong>{artisan.fullname}</strong>
            {t("). Un technicien ne peut pas se demander une intervention à lui-même. Choisissez un autre technicien pour publier votre demande.")}
          </div>
        )}
        {artisan && !isSelf && (
          <div
            className="mb-5 rounded-2xl p-4 text-sm"
            style={{
              background: "rgba(37,99,235,0.10)",
              border: "1px solid rgba(37,99,235,0.3)",
              color: "#E8EDF5",
            }}
          >
            <span className="font-semibold" style={{ color: "#93C5FD" }}>
              {t("🎯 Demande réservée")}
            </span>{" "}
            {t(" — votre demande sera envoyée uniquement à ")}
            <strong>{artisan.fullname}</strong>
            {t(" (")}
            {artisan.metier}
            {t("). Le domaine est verrouillé sur son profil.")}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Main form */}
          <div className="flex flex-col gap-5">
            {/* Domaine */}
            <div
              className="p-5 rounded-2xl"
              style={{
                background: "#141C2F",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p
                className="text-xs font-semibold mb-3"
                style={{
                  color: "#64748B",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {t("Domaine de l'intervention")}
              </p>
              {artisan ? (
                <div
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-4 text-sm"
                  style={{
                    background: "#1E2A42",
                    border: "1px solid rgba(37,99,235,0.4)",
                    color: "#E8EDF5",
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>{artisan.icon || "🛠️"}</span>
                  <div>
                    <p
                      className="font-semibold"
                      style={{
                        fontFamily: "Poppins, sans-serif",
                        color: "#93C5FD",
                      }}
                    >
                      {artisan.metier}
                    </p>
                    <p className="text-xs" style={{ color: "#64748B" }}>
                      {t("Domaine verrouillé sur le technicien sélectionné")}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <select
                    value={domainValue}
                    onChange={(e) => setDomainValue(e.target.value)}
                    className="w-full rounded-xl px-4 py-4 text-sm outline-none"
                    style={{
                      background: "#1E2A42",
                      border: "1px solid rgba(255,255,255,0.06)",
                      color: "#E8EDF5",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    <option value="">{t("Choisir un métier")}</option>
                    <option value="Général">{t("Aucune idée du domaine")}</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs mt-2" style={{ color: "#64748B" }}>
                    {t(
                      "Sélectionnez un métier existant ou choisissez « Aucune idée du domaine ». La liste s’actualise automatiquement quand un nouveau métier arrive.",
                    )}
                  </p>
                </>
              )}
            </div>

            {/* Description */}
            <div
              className="p-5 rounded-2xl"
              style={{
                background: "#141C2F",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p
                className="text-xs font-semibold mb-3"
                style={{
                  color: "#64748B",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {t("Description du problème")}
              </p>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder={t("Décrivez votre problème au technicien avec le plus de précisions possible : localisation exacte, depuis quand, symptômes observés...")}
                rows={7}
                className="w-full rounded-xl px-4 py-4 text-sm resize-none outline-none"
                style={{
                  background: "#1E2A42",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#E8EDF5",
                  fontFamily: "Inter, sans-serif",
                }}
              />
              <div className="flex justify-between mt-2">
                <p className="text-xs" style={{ color: "#64748B" }}>
                  {t("Soyez le plus précis possible pour obtenir un devis juste")}
                </p>
                <p
                  className="text-xs font-mono"
                  style={{ color: desc.length > 400 ? "#F59E0B" : "#64748B" }}
                >
                  {desc.length}/500
                </p>
              </div>
            </div>

            {/* Media */}
            <div
              className="p-5 rounded-2xl"
              style={{
                background: "#141C2F",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <p
                  className="text-xs font-semibold"
                  style={{
                    color: "#64748B",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  {t("Photos & documents de la panne")}
                </p>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    background: files.length > 0 ? "rgba(37,99,235,0.15)" : "#1E2A42",
                    color: files.length > 0 ? "#93C5FD" : "#64748B",
                    border: `1px solid ${
                      files.length > 0 ? "rgba(37,99,235,0.35)" : "rgba(255,255,255,0.06)"
                    }`,
                  }}
                >
                  {files.length}/{MAX_FILES} {t("fichier")}
                  {files.length > 1 ? t("s") : ""}
                </span>
              </div>
              <div className="flex gap-3 flex-wrap">
                <ImageUploader files={files} onChange={(f) => setFiles(f)} maxFiles={MAX_FILES} />
              </div>
              <p className="text-xs mt-3 flex items-center gap-1" style={{ color: "#64748B" }}>
                <span>{t("JPG, PNG, PDF · Glissez-déposez ou cliquez · Max 10 Mo par fichier")}</span>
                {files.length === MAX_FILES && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: "rgba(245,158,11,0.15)",
                      color: "#FBBF24",
                    }}
                  >
                    {t("Limite atteinte")}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-5">
            {/* Urgence */}
            <div
              className="p-5 rounded-2xl"
              style={{
                background: "#141C2F",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p
                className="text-xs font-semibold mb-4"
                style={{
                  color: "#64748B",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {t("Niveau d'urgence")}
              </p>
              <div className="flex flex-col gap-2">
                {urgenceOpts.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setUrgence(opt.key)}
                    className="flex items-start gap-3 p-4 rounded-xl text-left"
                    style={{
                      background: urgence === opt.key ? opt.bg : "#1E2A42",
                      border: `1px solid ${urgence === opt.key ? opt.border : "transparent"}`,
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                      style={{ border: `2px solid ${opt.color}` }}
                    >
                      {urgence === opt.key && (
                        <div className="w-2 h-2 rounded-full" style={{ background: opt.color }} />
                      )}
                    </div>
                    <div>
                      <p
                        className="text-sm font-semibold"
                        style={{
                          color: urgence === opt.key ? opt.color : "#E8EDF5",
                          fontFamily: "Poppins, sans-serif",
                        }}
                      >
                        {opt.label}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                        {opt.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recap */}
            <div
              className="p-5 rounded-2xl"
              style={{
                background: "#141C2F",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p
                className="text-xs font-semibold mb-3"
                style={{
                  color: "#64748B",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {t("Récapitulatif")}
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#94A3B8" }}>
                    {t("Urgence")}
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{
                      color: urgenceOpts.find((o) => o.key === urgence)?.color,
                    }}
                  >
                    {urgenceOpts.find((o) => o.key === urgence)?.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#94A3B8" }}>
                    {t("Photos")}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "#E8EDF5" }}>
                    {files.length} {t("fichier(s)")}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={async () => {
                if (isSelf) {
                  setError(t("Un technicien ne peut pas se demander une intervention à lui-même."))
                  return
                }
                const cleanedDesc = sanitizeMultiline(desc, 500)
                const cleanedDomain = sanitizeText(domainValue, MAX_TEXT_LENGTH)
                if (cleanedDesc.length === 0 || cleanedDomain.length === 0) return
                if (hasSqlInjectionPattern(cleanedDesc) || hasSqlInjectionPattern(cleanedDomain)) {
                  setError(t("Votre demande contient des caractères ou expressions non autorisés."))
                  return
                }
                setError(null)
                setSubmitting(true)
                const categoryValue = cleanedDomain === "Général" ? "Général" : cleanedDomain
                const photoUrl = files.length > 0 ? URL.createObjectURL(files[0]) : undefined
                const formData = new FormData()
                formData.append("title", `${categoryValue} · ${cleanedDesc.slice(0, 40)}`)
                formData.append("category", categoryValue)
                formData.append("domain", categoryValue)
                formData.append("description", cleanedDesc)
                formData.append("urgency", urgence)
                if (artisan?.id) {
                  formData.append("technicianId", String(artisan.id))
                }
                if (files.length > 0) {
                  formData.append("photoUrl", photoUrl as string)
                  files.forEach((file) => formData.append("photos", file, file.name))
                  formData.append("photo", files[0], files[0].name)
                }
                try {
                  const token = localStorage.getItem("mboaTechToken")
                  const headers: Record<string, string> = {}
                  if (token) {
                    headers.Authorization = `Bearer ${token}`
                  }
                  const response = await fetch(`${API_BASE_URL}/api/chat/request`, {
                    method: "POST",
                    headers,
                    body: formData,
                  })
                  if (!response.ok) {
                    if (response.status === 401) {
                      localStorage.removeItem("mboaTechToken")
                      localStorage.removeItem("mboaTechUser")
                      localStorage.removeItem("mboaTechTechnicianId")
                      if (onSessionExpired) {
                        onSessionExpired()
                      } else {
                        window.location.reload()
                      }
                      return
                    }
                    const text = await response.text()
                    throw new Error(
                      text || `${t("Impossible de publier la demande (")}${response.status})`,
                    )
                  }
                  const saved = await response.json()
                  onSubmit({
                    id: saved.id,
                    domain: categoryValue,
                    description: cleanedDesc,
                    urgence: urgence,
                    files,
                    photoUrl: saved?.photoUrl || photoUrl,
                    technicianId: artisan?.id,
                  })
                } catch (err) {
                  console.error(err)
                  setError(err instanceof Error ? err.message : t("Erreur réseau"))
                } finally {
                  setSubmitting(false)
                }
              }}
              disabled={
                isSelf ||
                desc.trim().length === 0 ||
                domainValue.trim().length === 0 ||
                submitting
              }
              className="w-full py-4 rounded-xl font-bold text-base text-white"
              style={{
                background:
                  isSelf
                    ? "#3B1D2A"
                    : desc.trim().length > 0 && domainValue.trim().length > 0
                      ? "linear-gradient(135deg, #2563EB, #1D4ED8)"
                      : "#1E2A42",
                fontFamily: "Poppins, sans-serif",
                boxShadow:
                  !isSelf && desc.trim().length > 0 && domainValue.trim().length > 0
                    ? "0 4px 20px rgba(37,99,235,0.35)"
                    : "none",
                cursor:
                  isSelf || desc.trim().length === 0 || domainValue.trim().length === 0
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {submitting
                ? t("Publication en cours…")
                : isSelf
                  ? t("Intervention sur vous-même impossible")
                  : t("Publier et trouver un artisan")}
            </button>
            {error && (
              <p className="mt-3 text-sm" style={{ color: "#F87171" }}>
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
