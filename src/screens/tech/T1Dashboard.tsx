import { useCallback, useEffect, useRef, useState } from "react"
import LocationMarker from "../../components/LocationMarker"
import FadeIn from "../../components/animations/FadeIn"
import Stagger from "../../components/animations/Stagger"
import StaggerItem from "../../components/animations/StaggerItem"
import TiltCard from "../../components/animations/TiltCard"
import { API_BASE_URL } from "../../config"
import { sanitizeDigits } from "../../utils/validation"
import { useI18n } from "../../i18n"
import orangeLogo from "../../../orange-money-logo-png_seeklogo-440383.png"

interface Props {
  onOpenChat: (request: { id: number; clientName: string; category: string }) => void
  focusRequestId?: number | null
}

type TechRequest = {
  id: number
  category: string
  domain: string
  description: string
  urgency: string
  status: string
  type: string
  createdAt: string
  clientName: string
  clientLocation: string
  reservedUntil?: string | null
}

type ActiveChantier = {
  id: number
  category: string
  description: string
  scheduledAt?: string | null
  reservedUntil?: string | null
  urgency?: string
  clientName: string
  clientLocation: string
  heldAmount: number
}

type TechStats = {
  balance: number
  held: number
  completedThisMonth: number
  missions: number
  ratingAvg: number
  ratingCount: number
  successRate: number
  avgResponseTimeSec: number
  availabilityStatus: string
  activeChantiers: ActiveChantier[]
  activeReservations: number
  maxReservations: number
  freezeRemainingSec: number
  suspendedUntil?: string | null
  suspendedPermanent?: boolean
  suspensionRemainingSec?: number
  noShows30d?: number
  reservationUrgencyUsage?: Record<string, number>
  reservationRules?: { critique: number; important: number; normal: number }
}

type DayItem = {
  id: number
  category: string
  description: string
  status: string
  scheduledAt?: string | null
  updatedAt?: string | null
  clientName: string
  clientLocation: string
  heldAmount: number
}

type TechDay = {
  date: string
  planned: DayItem[]
  inProgress: DayItem[]
  completedToday: DayItem[]
}

const withdrawMethods = [
  {
    key: "momo",
    label: "MTN Mobile Money",
    icon: (
      <svg
        width="52"
        height="30"
        viewBox="0 0 160 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="160" height="110" rx="44" fill="#FFD500" />
        <ellipse cx="80" cy="55" rx="66" ry="34" fill="black" opacity="0.08" />
        <text
          x="50%"
          y="58%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#000"
          fontSize="48"
          fontFamily="Arial, sans-serif"
          fontWeight="bold"
        >
          MTN
        </text>
      </svg>
    ),
  },
  {
    key: "orange",
    label: "Orange Money",
    icon: <img src={orangeLogo} alt="Orange Money" className="h-7 w-auto object-contain" />,
  },
  {
    key: "bank",
    label: "Compte bancaire",
    icon: (
      <svg
        width="40"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#E8EDF5"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 21h18" />
        <path d="M4 21V10m16 11V10" />
        <path d="M12 21V10" />
        <path d="M3 10l9-6 9 6" />
        <path d="M8 21v-5m8 5v-5" />
        <path d="M8 15h.01M12 15h.01M16 15h.01" />
      </svg>
    ),
  },
] as const

type WithdrawMethod = (typeof withdrawMethods)[number]["key"]

const urgenceStyle: Record<
  string,
  {
    color: string
    bg: string
    border: string
    label: string
  }
> = {
  critique: {
    color: "#EF4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.3)",
    label: "Urgence critique",
  },
  important: {
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.3)",
    label: "Important",
  },
  normal: {
    color: "#059669",
    bg: "rgba(5,150,105,0.12)",
    border: "rgba(5,150,105,0.3)",
    label: "Normal",
  },
}

function normalizeUrgency(u: string | null | undefined): string {
  if (!u) return "normal"
  const v = u.trim().toLowerCase()
  if (v === "critique") return "critique"
  if (v === "important") return "important"
  return "normal"
}

function timeAgo(iso: string, t: (key: string) => string): string {
  if (!iso) return ""
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return t("à l'instant")
  if (mins < 60) return t("Il y a ") + mins + t(" min")
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t("Il y a ") + hours + t(" h")
  const days = Math.floor(hours / 24)
  return t("Il y a ") + days + t(" j")
}

function formatAmount(n: number, locale: string): string {
  return (n ?? 0).toLocaleString(locale, { maximumFractionDigits: 0 })
}

function formatScheduled(
  iso: string | null | undefined,
  t: (key: string) => string,
  locale: string,
): string {
  if (!iso) return t("Date à confirmer")
  const d = new Date(iso)
  if (isNaN(d.getTime())) return t("Date à confirmer")
  return (
    d.toLocaleDateString(locale, { day: "numeric", month: "short" }) +
    t(" à ") +
    d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
  )
}

function formatCountdown(iso: string | null | undefined, t: (key: string) => string): string {
  if (!iso) return ""
  const target = new Date(iso).getTime()
  if (isNaN(target)) return ""
  const remaining = target - Date.now()
  if (remaining <= 0) return t("expirée")
  const hours = Math.floor(remaining / 3600000)
  const minutes = Math.floor((remaining % 3600000) / 60000)
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")}`
  const seconds = Math.floor((remaining % 60000) / 1000)
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function msToScheduled(iso: string | null | undefined, now: number): number {
  if (!iso) return Number.POSITIVE_INFINITY
  const t = new Date(iso).getTime()
  return isNaN(t) ? Number.POSITIVE_INFINITY : t - now
}

function formatFreeze(sec: number): string {
  if (!sec || sec <= 0) return ""
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")}`
  return `${minutes} min`
}

function formatHours(h: number, t: (key: string) => string): string {
  return h === 1 ? t("1 heure") : h + t(" heures")
}

function urgencyLabel(urgency: string, t: (key: string) => string): string {
  return urgency === "critique"
    ? t("critique")
    : urgency === "important"
      ? t("importante")
      : t("standard")
}

function urgencyColor(urgency: string): string {
  return urgency === "critique" ? "#EF4444" : urgency === "important" ? "#F59E0B" : "#3B82F6"
}

function formatDayLabel(date: string, locale: string): string {
  if (!date) return ""
  const parts = date.split("-").map(Number)
  if (parts.length < 3 || parts.some((p) => isNaN(p))) return date
  const dt = new Date(parts[0], parts[1] - 1, parts[2])
  return dt.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

function formatResponse(sec: number, t: (key: string) => string): string {
  if (!sec || sec <= 0) return "—"
  if (sec < 60) return `< 1 ${t("min")}`
  if (sec < 3600) return `${Math.round(sec / 60)} ${t("min")}`
  return `${(sec / 3600).toFixed(1)} ${t("h")}`
}

export default function T1Dashboard({ onOpenChat, focusRequestId }: Props) {
  const { t, locale } = useI18n()
  const [online, setOnline] = useState(true)
  const [requests, setRequests] = useState<TechRequest[]>([])
  const [stats, setStats] = useState<TechStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<number[]>([])
  const [technicianId, setTechnicianId] = useState<number | null>(null)
  const [day, setDay] = useState<TechDay | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [toast, setToast] = useState<{ id: number; urgency: string; hours: number } | null>(null)
  const toastTimer = useRef<number | null>(null)
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState<"form" | "confirm">("form")
  const [withdrawMethod, setWithdrawMethod] = useState<WithdrawMethod>("momo")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawAccount, setWithdrawAccount] = useState("")
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false)
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!focusRequestId) return
    const el = cardRefs.current[focusRequestId]
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [focusRequestId, requests])

  useEffect(() => {
    const token = localStorage.getItem("mboaTechToken")
    if (!token) return
    fetch(`${API_BASE_URL}/api/profile/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p && p.technicianId) {
          setTechnicianId(Number(p.technicianId))
          localStorage.setItem("mboaTechTechnicianId", String(p.technicianId))
        }
      })
      .catch((err) => console.error(err))
  }, [])

  const fetchRequests = useCallback(async () => {
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/chat/requests/technician`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) throw new Error(t("Erreur (") + response.status + ")")
      const data: TechRequest[] = await response.json()
      setRequests(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : t("Impossible de charger les demandes"))
    } finally {
      setLoading(false)
    }
  }, [t])

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/tech/dashboard`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) throw new Error(t("Erreur (") + response.status + ")")
      const data = (await response.json()) as TechStats | null
      if (data && typeof data === "object") {
        setStats(data)
        setOnline(data.availabilityStatus !== "offline" && data.availabilityStatus !== "busy")
      }
    } catch (err) {
      console.error("Impossible de charger les statistiques", err)
    }
  }, [t])

  const fetchDay = useCallback(async () => {
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/tech/day`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) throw new Error(t("Erreur (") + response.status + ")")
      const data = (await response.json()) as TechDay | null
      setDay(data && typeof data === "object" ? data : null)
    } catch (err) {
      console.error("Impossible de charger la journée", err)
    }
  }, [t])

  const balance = stats?.balance ?? 0

  const handleWithdrawOpen = () => {
    setWithdrawError(null)
    setWithdrawSuccess(null)
    setWithdrawStep("form")
    setWithdrawAmount("")
    setWithdrawAccount("")
    setWithdrawOpen(true)
  }

  const handleWithdrawClose = () => {
    if (withdrawSubmitting) return
    setWithdrawOpen(false)
    setWithdrawError(null)
    setWithdrawSuccess(null)
  }

  const sanitizeWithdrawAccount = (value: string): string => {
    if (withdrawMethod === "bank") {
      return (value ?? "").replace(/[^A-Za-z0-9 .-]/g, "").slice(0, 40)
    }
    return sanitizeDigits(value).slice(0, 12)
  }

  const goToConfirm = () => {
    const parsedAmount = Number(withdrawAmount)
    if (!withdrawAmount || !Number.isInteger(parsedAmount) || parsedAmount < 100) {
      setWithdrawError(t("Montant invalide (minimum 100 FCFA)."))
      return
    }
    if (parsedAmount > balance) {
      setWithdrawError(
        t("Montant supérieur à votre solde (") + formatAmount(balance, locale) + t(" FCFA)."),
      )
      return
    }
    if (!withdrawAccount.trim()) {
      setWithdrawError(t("Veuillez renseigner votre numéro de compte."))
      return
    }
    if (withdrawMethod !== "bank" && withdrawAccount.replace(/\D/g, "").length < 8) {
      setWithdrawError(t("Numéro de téléphone invalide (8 à 12 chiffres)."))
      return
    }
    setWithdrawError(null)
    setWithdrawStep("confirm")
  }

  const handleSubmitWithdraw = async () => {
    setWithdrawSubmitting(true)
    setWithdrawError(null)
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/technicians/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          method: withdrawMethod,
          account: withdrawAccount.trim(),
          amount: Number(withdrawAmount),
        }),
      })
      if (!response.ok) {
        let message = t("Erreur (") + response.status + ")"
        try {
          const data = await response.json()
          if (data?.error) message = data.error
        } catch {
          void 0
        }
        throw new Error(message)
      }
      setWithdrawSuccess(t("Votre demande de retrait a bien été enregistrée."))
      fetchStats()
      setTimeout(() => {
        setWithdrawOpen(false)
        setWithdrawStep("form")
        setWithdrawAmount("")
        setWithdrawAccount("")
        setWithdrawSuccess(null)
      }, 2000)
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : t("Impossible d'effectuer le retrait."))
    } finally {
      setWithdrawSubmitting(false)
    }
  }

  useEffect(() => {
    fetchRequests()
    fetchStats()
    fetchDay()
    const interval = setInterval(() => {
      fetchRequests()
      fetchStats()
      fetchDay()
    }, 15000)
    const ticker = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearInterval(interval)
      clearInterval(ticker)
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [fetchRequests, fetchStats, fetchDay])

  const decline = async (id: number) => {
    setDismissed((d) => [...d, id])
    try {
      const token = localStorage.getItem("mboaTechToken")
      await fetch(`${API_BASE_URL}/api/chat/request/${id}/reopen`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
    } catch (err) {
      console.error(err)
    }
    fetchRequests()
  }

  const accept = async (id: number) => {
    const token = localStorage.getItem("mboaTechToken")
    const tid = technicianId ?? Number(localStorage.getItem("mboaTechTechnicianId") || "")
    if (!tid) {
      setError(t("Impossible de déterminer votre profil technicien. Reconnectez-vous."))
      return
    }
    const target = requests.find((r) => r.id === id)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat/request/${id}/assign?technicianId=${tid}`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      )
      if (!response.ok) {
        const text = await response.text()
        let message = text || t("Erreur (") + response.status + ")"
        try {
          const data = JSON.parse(text)
          if (data?.message) message = data.message
        } catch {
          void 0
        }
        throw new Error(message)
      }
      fetchRequests()
      fetchStats()
      if (target) {
        const rules = stats?.reservationRules
        const hours =
          target.urgency === "critique"
            ? (rules?.critique ?? 1)
            : target.urgency === "important"
              ? (rules?.important ?? 4)
              : (rules?.normal ?? 8)
        if (toastTimer.current) window.clearTimeout(toastTimer.current)
        setToast({ id: Date.now(), urgency: target.urgency, hours })
        toastTimer.current = window.setTimeout(() => setToast(null), 60000)
      }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : t("Impossible d'accepter la demande"))
    }
  }

  const startRequest = async (id: number) => {
    const token = localStorage.getItem("mboaTechToken")
    try {
      const response = await fetch(`${API_BASE_URL}/api/tech/request/${id}/start`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || t("Erreur (") + response.status + ")")
      }
      fetchDay()
      fetchStats()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : t("Impossible de démarrer l'intervention"))
    }
  }

  const completeRequest = async (id: number) => {
    const token = localStorage.getItem("mboaTechToken")
    try {
      const response = await fetch(`${API_BASE_URL}/api/tech/request/${id}/complete`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || t("Erreur (") + response.status + ")")
      }
      fetchDay()
      fetchStats()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : t("Impossible de terminer l'intervention"))
    }
  }

  const toggleAvailability = async () => {
    const target = online ? "offline" : "available"
    const token = localStorage.getItem("mboaTechToken")
    setOnline(!online)
    try {
      const response = await fetch(`${API_BASE_URL}/api/tech/availability?status=${target}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) {
        const text = await response.text()
        setOnline(online)
        throw new Error(text || t("Erreur (") + response.status + ")")
      }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : t("Impossible de changer votre statut"))
    }
  }

  const visible = requests.filter(
    (r) => !dismissed.includes(r.id) && r.status !== "in_progress" && r.status !== "completed",
  )

  const availabilityStatus = stats?.availabilityStatus ?? (online ? "available" : "offline")
  const inIntervention = availabilityStatus === "busy"

  const maxReservations = stats?.maxReservations ?? 3
  const urgencyUsage = (u: string): number =>
    stats?.reservationUrgencyUsage?.[normalizeUrgency(u)] ?? 0
  const atUrgencyLimit = (u: string): boolean => urgencyUsage(u) >= maxReservations
  const freezeSec = stats?.freezeRemainingSec ?? 0
  const frozen = freezeSec > 0
  const suspendedPermanent = stats?.suspendedPermanent === true
  const suspensionSec = stats?.suspensionRemainingSec ?? 0
  const suspended = suspendedPermanent || suspensionSec > 0
  const noShows30d = stats?.noShows30d ?? 0
  const urgencyLevels: Array<"critique" | "important" | "normal"> = [
    "critique",
    "important",
    "normal",
  ]

  return (
    <div className="min-h-full p-3 sm:p-6" style={{ background: "#0B1120" }}>
      <div className="mx-auto max-w-[min(1400px,95%)]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <h1
              className="text-2xl font-bold mb-0.5"
              style={{ fontFamily: "Poppins, sans-serif", color: "#E8EDF5" }}
            >
              {t("Tableau de bord")}
            </h1>
            <p className="text-sm" style={{ color: "#64748B" }}>
              {t("Demandes d'intervention qui vous sont réservées")}
            </p>
          </div>
          <button
            onClick={inIntervention ? undefined : toggleAvailability}
            disabled={inIntervention}
            className="flex items-center gap-3 px-6 py-3 rounded-xl font-semibold text-sm"
            style={{
              background: inIntervention
                ? "rgba(245,158,11,0.12)"
                : online
                  ? "rgba(5,150,105,0.15)"
                  : "#141C2F",
              border: `1px solid ${
                inIntervention
                  ? "rgba(245,158,11,0.4)"
                  : online
                    ? "rgba(5,150,105,0.4)"
                    : "rgba(255,255,255,0.1)"
              }`,
              color: inIntervention ? "#F59E0B" : online ? "#059669" : "#64748B",
              fontFamily: "Poppins, sans-serif",
              cursor: inIntervention ? "default" : "pointer",
            }}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: inIntervention ? "#F59E0B" : online ? "#059669" : "#64748B",
                boxShadow: inIntervention ? "0 0 8px #F59E0B" : online ? "0 0 8px #059669" : "none",
              }}
            />
            {inIntervention
              ? t("En intervention")
              : online
                ? t("En ligne · Disponible")
                : t("Hors ligne")}
          </button>
        </div>

        {suspended && (
          <div
            className="mb-6 p-4 rounded-2xl text-sm flex items-start gap-3"
            style={{
              background: suspendedPermanent ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
              border: `1px solid ${
                suspendedPermanent ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.4)"
              }`,
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>{suspendedPermanent ? "🚫" : "⏸"}</span>
            <div>
              <p
                className="font-bold"
                style={{ color: suspendedPermanent ? "#F87171" : "#FBBF24" }}
              >
                {suspendedPermanent
                  ? t("Compte définitivement suspendu")
                  : t("Compte suspendu · réessai dans ") + formatFreeze(suspensionSec)}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                {suspendedPermanent
                  ? t("Vous avez dépassé le seuil de non-présentations. La connexion est bloquée.")
                  : t("Vous avez enregistré ") +
                    noShows30d +
                    t(
                      " non-présentation(s) sur 30 jours. Les acceptations de nouvelles demandes sont bloquées jusqu'à la fin de la suspension.",
                    )}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          {/* Left — wallet + stats */}
          <div className="flex flex-col gap-4">
            {/* Wallet */}
            <TiltCard
              maxTilt={6}
              hoverScale={1.02}
              className="p-6 rounded-2xl"
              style={{
                background: "linear-gradient(160deg, #1A2D5A 0%, #141C2F 100%)",
                border: "1px solid rgba(37,99,235,0.25)",
              }}
            >
              <p className="text-xs mb-2" style={{ color: "#94A3B8" }}>
                {t("Solde disponible")}
              </p>
              <p className="text-4xl font-bold font-mono mb-1" style={{ color: "#E8EDF5" }}>
                {formatAmount(stats?.balance ?? 0, locale)}
              </p>
              <p className="text-sm mb-4" style={{ color: "#64748B" }}>
                FCFA
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#64748B" }}>
                    {t("Chantiers terminés")}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "#059669" }}>
                    {stats?.completedThisMonth ?? 0} {t("ce mois")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#64748B" }}>
                    {t("En garde")}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "#F59E0B" }}>
                    {formatAmount(stats?.held ?? 0, locale)} FCFA
                  </span>
                </div>
              </div>
              <button
                onClick={handleWithdrawOpen}
                className="mt-4 w-full py-2.5 rounded-xl text-xs font-semibold"
                style={{
                  background: "rgba(37,99,235,0.2)",
                  color: "#2563EB",
                  border: "1px solid rgba(37,99,235,0.3)",
                }}
              >
                {t("Retirer les fonds →")}
              </button>
            </TiltCard>

            {/* Stats */}
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
                {t("Performance")}
              </p>
              <Stagger className="grid grid-cols-2 gap-3" staggerDelay={0.08}>
                {[
                  {
                    label: t("Missions"),
                    value: formatAmount(stats?.missions ?? 0, locale),
                  },
                  {
                    label: t("Note moy."),
                    value: stats && stats.ratingCount > 0 ? stats.ratingAvg.toFixed(1) : "—",
                  },
                  {
                    label: t("Taux réussite"),
                    value:
                      stats && stats.successRate > 0 ? `${Math.round(stats.successRate)}%` : "—",
                  },
                  {
                    label: t("Réponse"),
                    value: formatResponse(stats?.avgResponseTimeSec ?? 0, t),
                  },
                ].map((s) => (
                  <StaggerItem
                    key={s.label}
                    className="p-3 rounded-xl"
                    style={{ background: "#1E2A42" }}
                  >
                    <p className="text-xl font-bold font-mono" style={{ color: "#E8EDF5" }}>
                      {s.value}
                    </p>
                    <p className="text-xs" style={{ color: "#64748B" }}>
                      {s.label}
                    </p>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>

            {/* Quick nav */}
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
                {t("Mes chantiers actifs")}
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {urgencyLevels.map((level) => {
                  const usage = urgencyUsage(level)
                  const full = usage >= maxReservations
                  const st = urgenceStyle[level]
                  return (
                    <span
                      key={level}
                      className="text-xs px-2.5 py-1 rounded-full font-mono"
                      style={{
                        background: full ? "rgba(239,68,68,0.12)" : st.bg,
                        color: full ? "#F87171" : st.color,
                        border: `1px solid ${full ? "rgba(239,68,68,0.3)" : st.border}`,
                      }}
                    >
                      {t(st.label)} {usage}/{maxReservations}
                    </span>
                  )
                })}
                {frozen && (
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={{
                      background: "rgba(239,68,68,0.12)",
                      color: "#F87171",
                      border: "1px solid rgba(239,68,68,0.3)",
                    }}
                  >
                    {t("Gel ")}
                    {formatFreeze(freezeSec)}
                  </span>
                )}
              </div>
              {(stats?.activeChantiers?.length ?? 0) === 0 ? (
                <div
                  className="p-3 rounded-xl text-sm"
                  style={{ background: "#1E2A42", color: "#64748B" }}
                >
                  {t("Aucun chantier actif pour le moment")}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {stats?.activeChantiers.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() =>
                        onOpenChat({
                          id: ch.id,
                          clientName: ch.clientName,
                          category: ch.category,
                        })
                      }
                      className="p-3 rounded-xl text-left hover:opacity-90 transition-opacity"
                      style={{
                        background: "rgba(37,99,235,0.08)",
                        border: "1px solid rgba(37,99,235,0.2)",
                      }}
                    >
                      <p className="text-sm font-medium" style={{ color: "#E8EDF5" }}>
                        {ch.clientName} · {ch.category}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                        {formatScheduled(ch.scheduledAt, t, locale)}
                      </p>
                      {ch.reservedUntil && (
                        <p className="text-xs mt-0.5 font-mono" style={{ color: "#FBBF24" }}>
                          {t("⏳ Réservée · expiration dans ")}
                          {formatCountdown(ch.reservedUntil, t)}
                        </p>
                      )}
                      {Number(ch.heldAmount) > 0 && (
                        <p className="text-xs mt-1 font-mono" style={{ color: "#F59E0B" }}>
                          {formatAmount(Number(ch.heldAmount), locale)} FCFA {t("en garde")}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right — requests */}
          <div>
            {/* Ma journée */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-base font-semibold"
                  style={{ fontFamily: "Poppins, sans-serif", color: "#E8EDF5" }}
                >
                  {t("Ma journée")}
                </h2>
                <span
                  className="text-xs px-3 py-1 rounded-full font-mono capitalize"
                  style={{
                    background: "rgba(37,99,235,0.12)",
                    color: "#93C5FD",
                    border: "1px solid rgba(37,99,235,0.3)",
                  }}
                >
                  {day ? formatDayLabel(day.date, locale) : ""}
                </span>
              </div>

              {!day ||
              (day.inProgress.length === 0 &&
                day.planned.length === 0 &&
                day.completedToday.length === 0) ? (
                <div
                  className="p-4 rounded-2xl text-sm"
                  style={{
                    background: "#141C2F",
                    color: "#64748B",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {t("Aucune intervention prévue aujourd'hui")}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {day.inProgress.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p
                        className="text-xs font-semibold"
                        style={{
                          color: "#F59E0B",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        {t("● En cours")}
                      </p>
                      {day.inProgress.map((item) => (
                        <div
                          key={item.id}
                          className="p-4 rounded-2xl"
                          style={{
                            background: "rgba(245,158,11,0.08)",
                            border: "1px solid rgba(245,158,11,0.3)",
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p
                                className="text-sm font-semibold truncate"
                                style={{ color: "#E8EDF5" }}
                              >
                                {item.clientName} · {item.category}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                                {formatScheduled(item.scheduledAt, t, locale)}
                              </p>
                            </div>
                            <button
                              onClick={() => completeRequest(item.id)}
                              className="px-4 py-2 rounded-lg text-sm font-bold text-white flex-shrink-0"
                              style={{
                                background: "linear-gradient(135deg, #059669, #047857)",
                                boxShadow: "0 2px 10px rgba(5,150,105,0.3)",
                              }}
                            >
                              {t("Terminer")}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {day.planned.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p
                        className="text-xs font-semibold"
                        style={{
                          color: "#94A3B8",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        {t("À venir aujourd'hui")}
                      </p>
                      {day.planned.map((item) => {
                        const msLeft = msToScheduled(item.scheduledAt, now)
                        const imminent = msLeft <= 2 * 60 * 1000
                        const late = msLeft < 0
                        const startStyle = imminent
                          ? late
                            ? {
                                background: "linear-gradient(135deg, #EF4444, #B91C1C)",
                                boxShadow: "0 2px 14px rgba(239,68,68,0.5)",
                              }
                            : {
                                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                                boxShadow: "0 2px 14px rgba(245,158,11,0.5)",
                              }
                          : {
                              background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                              boxShadow: "0 2px 10px rgba(37,99,235,0.3)",
                            }
                        return (
                          <div
                            key={item.id}
                            className="p-4 rounded-2xl"
                            style={{
                              background: "#141C2F",
                              border: "1px solid rgba(37,99,235,0.25)",
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p
                                  className="text-sm font-semibold truncate"
                                  style={{ color: "#E8EDF5" }}
                                >
                                  {item.clientName} · {item.category}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                                  {formatScheduled(item.scheduledAt, t, locale)}
                                </p>
                                <p className="text-xs mt-1" style={{ color: "#64748B" }}>
                                  {item.description}
                                </p>
                                {imminent && (
                                  <p
                                    className="text-xs mt-1 font-mono font-semibold"
                                    style={{ color: late ? "#F87171" : "#FBBF24" }}
                                  >
                                    {late
                                      ? t("⚠ Intervention en retard — lancez le démarrage")
                                      : `${t("⚠ Démarrage imminent · ")}${formatCountdown(item.scheduledAt, t)}`}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => startRequest(item.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold text-white flex-shrink-0 ${imminent ? "mboa-blink" : ""}`}
                                style={startStyle}
                              >
                                {t("Démarrer →")}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {day.completedToday.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p
                        className="text-xs font-semibold"
                        style={{
                          color: "#059669",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        {t("Terminées aujourd'hui")}
                      </p>
                      {day.completedToday.map((item) => (
                        <button
                          key={item.id}
                          onClick={() =>
                            onOpenChat({
                              id: item.id,
                              clientName: item.clientName,
                              category: item.category,
                            })
                          }
                          className="w-full p-4 rounded-2xl text-left hover:opacity-90 transition-opacity"
                          style={{
                            background: "rgba(5,150,105,0.06)",
                            border: "1px solid rgba(5,150,105,0.2)",
                          }}
                        >
                          <p className="text-sm font-semibold" style={{ color: "#E8EDF5" }}>
                            {item.clientName} · {item.category}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                            {t("Terminée · ")}
                            {formatScheduled(item.updatedAt, t, locale)}
                          </p>
                          <p className="text-xs mt-1 font-semibold" style={{ color: "#34D399" }}>
                            {t("Ouvrir le chat →")}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-base font-semibold"
                style={{ fontFamily: "Poppins, sans-serif", color: "#E8EDF5" }}
              >
                {t("Nouvelles demandes")}
              </h2>
              <span
                className="text-xs px-3 py-1 rounded-full font-mono"
                style={{
                  background: visible.length > 0 ? "rgba(239,68,68,0.12)" : "rgba(5,150,105,0.12)",
                  color: visible.length > 0 ? "#EF4444" : "#059669",
                  border: `1px solid ${
                    visible.length > 0 ? "rgba(239,68,68,0.2)" : "rgba(5,150,105,0.2)"
                  }`,
                }}
              >
                {visible.length} {t("en attente")}
              </span>
            </div>

            {frozen && (
              <div
                className="mb-4 p-4 rounded-2xl text-sm flex items-start gap-3"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  color: "#F87171",
                  border: "1px solid rgba(239,68,68,0.25)",
                }}
              >
                <span className="text-lg leading-none">⚠</span>
                <div>
                  <p className="font-semibold">{t("Acceptations gelées")}</p>
                  <p className="mt-0.5 text-xs opacity-90">
                    {t("Vous avez décliné trop de demandes récemment. Nouvelle acceptation possible dans ")}
                    {formatFreeze(freezeSec)}.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div
                className="mb-4 p-3 rounded-xl text-sm"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  color: "#F87171",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                {error}
              </div>
            )}

            {loading && visible.length === 0 ? (
              <div className="text-center py-16" style={{ color: "#64748B" }}>
                <p className="text-base font-medium" style={{ color: "#E8EDF5" }}>
                  {t("Chargement des demandes…")}
                </p>
              </div>
            ) : (
              <Stagger className="flex flex-col gap-3" staggerDelay={0.07}>
                {visible.map((a) => {
                  const s = urgenceStyle[a.urgency] ?? urgenceStyle.normal
                  const reserved = a.type === "assigned"
                  const focused = a.id === focusRequestId
                  const aUrgency = normalizeUrgency(a.urgency)
                  const cardBlocked = frozen || atUrgencyLimit(aUrgency) || suspended
                  return (
                    <StaggerItem key={a.id}>
                      <div
                        ref={(el) => {
                          cardRefs.current[a.id] = el
                        }}
                        className="p-4 sm:p-5 rounded-2xl"
                        style={{
                          background: focused ? "#16213B" : "#141C2F",
                          border: focused
                            ? "2px solid #2563EB"
                            : `1px solid ${
                                reserved
                                  ? "rgba(37,99,235,0.3)"
                                  : a.urgency === "critique"
                                    ? "rgba(239,68,68,0.25)"
                                    : "rgba(255,255,255,0.06)"
                              }`,
                          boxShadow: focused ? "0 0 0 3px rgba(37,99,235,0.25)" : undefined,
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-1">
                              <div className="min-w-0">
                                <p
                                  className="text-sm font-semibold"
                                  style={{
                                    fontFamily: "Poppins, sans-serif",
                                    color: "#E8EDF5",
                                  }}
                                >
                                  {a.domain || a.category}
                                </p>
                                <div
                                  className="flex flex-wrap items-center gap-x-2 text-xs"
                                  style={{ color: "#64748B" }}
                                >
                                  <LocationMarker className="h-3 w-3 text-slate-300 flex-shrink-0" />
                                  <span className="min-w-0">
                                    {a.clientName}
                                    {a.clientLocation ? ` · ${a.clientLocation}` : ""} ·{" "}
                                    {timeAgo(a.createdAt, t)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 flex-shrink-0 mt-2 sm:mt-0 sm:ml-3">
                                {focused && (
                                  <span
                                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                    style={{
                                      background: "rgba(37,99,235,0.2)",
                                      color: "#93C5FD",
                                      border: "1px solid rgba(37,99,235,0.45)",
                                    }}
                                  >
                                    {t("Depuis notification")}
                                  </span>
                                )}
                                {reserved && (
                                  <span
                                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                    style={{
                                      background: "rgba(37,99,235,0.12)",
                                      color: "#93C5FD",
                                      border: "1px solid rgba(37,99,235,0.3)",
                                    }}
                                  >
                                    {t("Réservée")}
                                  </span>
                                )}
                                {reserved && a.reservedUntil && (
                                  <span
                                    className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                                    style={{
                                      background: "rgba(245,158,11,0.12)",
                                      color: "#FBBF24",
                                      border: "1px solid rgba(245,158,11,0.3)",
                                    }}
                                  >
                                    ⏳ {formatCountdown(a.reservedUntil, t)}
                                  </span>
                                )}
                                <span
                                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                                  style={{
                                    background: s.bg,
                                    color: s.color,
                                    border: `1px solid ${s.border}`,
                                  }}
                                >
                                  {t(s.label)}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm mb-3" style={{ color: "#94A3B8" }}>
                              {a.description}
                            </p>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <span
                                className="text-xs font-medium truncate min-w-0"
                                style={{ color: "#2563EB" }}
                              >
                                {t("Client : ")}
                                {a.clientName}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                {reserved ? (
                                  <button
                                    onClick={() => decline(a.id)}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold"
                                    style={{
                                      background: "rgba(239,68,68,0.1)",
                                      color: "#EF4444",
                                      border: "1px solid rgba(239,68,68,0.2)",
                                    }}
                                  >
                                    {t("Décliner")}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => accept(a.id)}
                                    disabled={cardBlocked}
                                    className="px-3 sm:px-6 py-2 rounded-lg text-sm font-bold whitespace-nowrap"
                                    style={{
                                      background: cardBlocked
                                        ? "#1E2A42"
                                        : "linear-gradient(135deg, #2563EB, #1D4ED8)",
                                      color: cardBlocked ? "#64748B" : "#fff",
                                      boxShadow: cardBlocked
                                        ? "none"
                                        : "0 2px 10px rgba(37,99,235,0.3)",
                                      cursor: cardBlocked ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    {suspended
                                      ? t("Compte suspendu")
                                      : frozen
                                        ? t("Acceptations gelées")
                                        : atUrgencyLimit(aUrgency)
                                          ? `${t("Limite urgence (")}${maxReservations})`
                                          : t("Accepter la demande →")}
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    onOpenChat({
                                      id: a.id,
                                      clientName: a.clientName,
                                      category: a.category || a.domain,
                                    })
                                  }
                                  className="px-4 sm:px-6 py-2 rounded-lg text-sm font-bold text-white whitespace-nowrap"
                                  style={{
                                    background: "linear-gradient(135deg, #059669, #047857)",
                                    boxShadow: "0 2px 10px rgba(5,150,105,0.3)",
                                  }}
                                >
                                  {t("Ouvrir le chat →")}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </StaggerItem>
                  )
                })}
                {visible.length === 0 && !loading && (
                  <div className="text-center py-16" style={{ color: "#64748B" }}>
                    <p className="text-base font-medium" style={{ color: "#E8EDF5" }}>
                      {t("Aucune demande pour le moment")}
                    </p>
                    <p className="text-sm mt-1">
                      {t("Les demandes réservées pour vous et celles de votre domaine apparaîtront ici")}
                    </p>
                  </div>
                )}
              </Stagger>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div
          className="fixed z-[60] max-w-sm rounded-2xl p-4"
          style={{
            right: "1.25rem",
            bottom: "1.25rem",
            background: "#0F172A",
            border: `1px solid ${urgencyColor(toast.urgency)}`,
            boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 0 24px ${urgencyColor(toast.urgency)}55`,
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none" style={{ color: urgencyColor(toast.urgency) }}>
              ⚡
            </span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#E8EDF5" }}>
                {t("Demande d'urgence")} {urgencyLabel(toast.urgency, t)} {t("réservée")}
              </p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: "#94A3B8" }}>
                {t("Réservation de ")}
                {formatHours(toast.hours, t)}
                {t(" : si l'intervention n'est pas traitée et approuvée dans ce délai, la demande sera libérée automatiquement pour les autres techniciens.")}
              </p>
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-[10px] font-mono" style={{ color: "#64748B" }}>
                  {t("⏳ Ce message disparaîtra dans 1 min")}
                </span>
                <button
                  onClick={() => setToast(null)}
                  className="text-[10px] font-semibold"
                  style={{ color: "#93C5FD" }}
                >
                  {t("Fermer")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {withdrawOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(2,6,23,0.8)" }}
          onClick={handleWithdrawClose}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{
              background: "#0F172A",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-lg font-bold"
                style={{
                  fontFamily: "Poppins, sans-serif",
                  color: "#E8EDF5",
                }}
              >
                {t("Retirer les fonds")}
              </h2>
              <button
                onClick={handleWithdrawClose}
                disabled={withdrawSubmitting}
                className="text-2xl leading-none"
                style={{ color: "#64748B" }}
              >
                ×
              </button>
            </div>

            {withdrawSuccess ? (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: "#34D399" }}>
                  {withdrawSuccess}
                </p>
              </div>
            ) : withdrawStep === "form" ? (
              <>
                <div
                  className="mb-5 rounded-xl p-4"
                  style={{
                    background: "#141C2F",
                    border: "1px solid rgba(37,99,235,0.2)",
                  }}
                >
                  <p className="text-xs mb-1" style={{ color: "#94A3B8" }}>
                    {t("Solde disponible")}
                  </p>
                  <p className="text-2xl font-bold font-mono" style={{ color: "#E8EDF5" }}>
                    {formatAmount(balance, locale)}{" "}
                    <span className="text-sm font-normal" style={{ color: "#64748B" }}>
                      FCFA
                    </span>
                  </p>
                </div>

                <p
                  className="text-xs font-semibold mb-2"
                  style={{
                    color: "#94A3B8",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {t("Méthode de retrait")}
                </p>
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {withdrawMethods.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => {
                        setWithdrawMethod(m.key)
                        setWithdrawAccount("")
                        setWithdrawError(null)
                      }}
                      className="rounded-xl px-2 py-3 text-xs font-semibold"
                      style={{
                        background: withdrawMethod === m.key ? "rgba(37,99,235,0.2)" : "#141C2F",
                        color: withdrawMethod === m.key ? "#93C5FD" : "#94A3B8",
                        border:
                          withdrawMethod === m.key
                            ? "1px solid rgba(37,99,235,0.5)"
                            : "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <span className="block h-7 mb-1 flex items-center justify-center">
                        {typeof m.icon === "string" ? m.icon : m.icon}
                      </span>
                      {t(m.label)}
                    </button>
                  ))}
                </div>

                <p
                  className="text-xs font-semibold mb-2"
                  style={{
                    color: "#94A3B8",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {t("Montant")}
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(sanitizeDigits(e.target.value).slice(0, 7))}
                  placeholder={t("Ex : 25000")}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none mb-5"
                  style={{
                    background: "#141C2F",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "#E8EDF5",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                />

                <p
                  className="text-xs font-semibold mb-2"
                  style={{
                    color: "#94A3B8",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {withdrawMethod === "bank"
                    ? t("Numéro de compte")
                    : t("Numéro de téléphone")}
                </p>
                <input
                  type="text"
                  inputMode={withdrawMethod === "bank" ? "text" : "numeric"}
                  value={withdrawAccount}
                  onChange={(e) => setWithdrawAccount(sanitizeWithdrawAccount(e.target.value))}
                  placeholder={
                    withdrawMethod === "bank"
                      ? t("Ex : 0045 1234 5678 9012")
                      : t("Ex : 6 55 12 34 56")
                  }
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none mb-5"
                  style={{
                    background: "#141C2F",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "#E8EDF5",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                />

                {withdrawError && (
                  <p className="text-sm mb-4" style={{ color: "#EF4444" }}>
                    {withdrawError}
                  </p>
                )}

                <button
                  onClick={goToConfirm}
                  className="w-full py-3.5 rounded-xl font-semibold text-white"
                  style={{
                    background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                    boxShadow: "0 4px 20px rgba(37,99,235,0.35)",
                  }}
                >
                  {t("Continuer →")}
                </button>
              </>
            ) : (
              <>
                <div
                  className="rounded-xl p-4 mb-4 space-y-2"
                  style={{
                    background: "#141C2F",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "#94A3B8" }}>
                      {t("Méthode")}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: "#E8EDF5" }}>
                      {t(withdrawMethods.find((m) => m.key === withdrawMethod)?.label ?? "")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "#94A3B8" }}>
                      {t("Compte")}
                    </span>
                    <span className="text-xs font-mono font-semibold" style={{ color: "#E8EDF5" }}>
                      {withdrawAccount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "#94A3B8" }}>
                      {t("Montant")}
                    </span>
                    <span className="text-sm font-bold font-mono" style={{ color: "#34D399" }}>
                      {formatAmount(Number(withdrawAmount), locale)} FCFA
                    </span>
                  </div>
                </div>

                {withdrawError && (
                  <p className="text-sm mb-4" style={{ color: "#EF4444" }}>
                    {withdrawError}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setWithdrawStep("form")
                      setWithdrawError(null)
                    }}
                    disabled={withdrawSubmitting}
                    className="flex-1 py-3.5 rounded-xl text-sm font-semibold"
                    style={{ background: "#1E2A42", color: "#E8EDF5" }}
                  >
                    {t("← Modifier")}
                  </button>
                  <button
                    onClick={handleSubmitWithdraw}
                    disabled={withdrawSubmitting}
                    className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                    style={{
                      background: "linear-gradient(135deg, #059669, #047857)",
                      boxShadow: "0 4px 20px rgba(5,150,105,0.35)",
                    }}
                  >
                    {withdrawSubmitting ? t("Envoi en cours...") : t("Confirmer le retrait")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
