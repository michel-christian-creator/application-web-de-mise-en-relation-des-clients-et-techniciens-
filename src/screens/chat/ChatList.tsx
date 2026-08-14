import { useEffect, useRef, useState } from "react"
import { openChatSocket, formatScheduleShort, type ChatSocket } from "../../utils/chatSocket"
import ChatBubbleIcon from "../../components/icons/ChatBubbleIcon"
import type { PaymentDevis } from "../client/C6Payment"
import { API_BASE_URL } from "../../config"
import { sanitizeMultiline, isValidAmount, hasSqlInjectionPattern } from "../../utils/validation"
import { useI18n } from "../../i18n"

const SYSTEM_SENDER_ID = 999999999999

interface Props {
  role: "client" | "tech"
  myUserId?: number
  focusRequestId?: number | null
  direct?: boolean
  onBack?: () => void
  onPayment?: (devis: PaymentDevis) => void
  onUnreadChange?: (count: number) => void
  profile?: {
    username?: string
    firstName?: string
    lastName?: string
    role?: string
    photoUrl?: string
  } | null
}

type Conversation = {
  id: number
  category: string
  domain: string
  description: string
  urgency: string
  status: string
  createdAt: string
  clientName?: string
  technicianName?: string
  unreadCount?: number
  lastMessage?: string | null
  lastMessageAt?: string | null
  lastSender?: number | null
  lastIsMine?: boolean
  fundsDeposited?: boolean
  fundsReleased?: boolean
  disputeOpen?: boolean
  disputeReporterUserId?: number
  disputeOpenAt?: string
}

interface ChatMessage {
  id: number
  requestId: number
  senderUserId?: number
  sender?: string
  text: string
  imageUrl?: string | null
  timestamp: string
  time?: string
  read?: boolean
  devisAmount?: number | null
  devisStatus?: string | null
  scheduleAt?: string | null
  scheduleStatus?: string | null
}

type IncomingChatMessage = Omit<ChatMessage, "time">

function ReadReceipt({ read }: { read: boolean }) {
  const color = read ? "#60A5FA" : "#64748B"
  return (
    <span className="mr-1 inline-flex align-middle" style={{ color }}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {read ? (
          <>
            <path d="M18 6 7 17l-5-5" />
            <path d="m22 10-7.5 7.5L13 16" />
          </>
        ) : (
          <path d="M20 6 9 17l-5-5" />
        )}
      </svg>
    </span>
  )
}

function timeAgo(iso: string, t: (key: string) => string): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ""
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return t("à l'instant")
  if (mins < 60) return `${mins} ${t("min")}`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ${t("h")}`
  const days = Math.floor(hours / 24)
  return `${days} ${t("j")}`
}

function formatTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

function initials(name: string): string {
  const parts = (name || "?").trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : ""
  return (first + last).toUpperCase()
}

const AVATAR_COLORS = [
  "#1D4ED8",
  "#047857",
  "#B45309",
  "#7C3AED",
  "#BE185D",
  "#0E7490",
  "#4D7C0F",
  "#9F1239",
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

const MESSAGE_SENT_COLOR = "#2563EB"

function formatAmount(value: number): string {
  try {
    return new Intl.NumberFormat("fr-FR").format(value)
  } catch {
    return String(value)
  }
}

function devisStatusLabel(
  status: string | null,
  mine: boolean,
  t: (key: string) => string,
): string {
  if (status === "accepted") return t("Devis accepté")
  if (status === "rejected") return t("Devis rejeté")
  return mine ? t("En attente de réponse") : t("Devis reçu")
}

function devisStatusStyle(status: string | null): { background: string; color: string } {
  if (status === "accepted") return { background: "rgba(5,150,105,0.15)", color: "#059669" }
  if (status === "rejected") return { background: "rgba(239,68,68,0.12)", color: "#F87171" }
  return { background: "rgba(37,99,235,0.15)", color: "#93C5FD" }
}

function scheduleStatusLabel(
  status: string | null,
  mine: boolean,
  t: (key: string) => string,
): string {
  if (status === "accepted") return t("Intervention confirmée")
  if (status === "rejected") return t("Proposition refusée")
  return mine ? t("En attente de réponse") : t("Proposition reçue")
}

function scheduleStatusStyle(status: string | null): { background: string; color: string } {
  if (status === "accepted") return { background: "rgba(5,150,105,0.15)", color: "#059669" }
  if (status === "rejected") return { background: "rgba(239,68,68,0.12)", color: "#F87171" }
  return { background: "rgba(5,150,105,0.12)", color: "#34D399" }
}

function formatScheduleDate(iso: string, locale: string, t: (key: string) => string): string {
  try {
    const date = new Date(iso)
    const day = date.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    const time = date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    })
    return `${day} ${t("à")} ${time}`
  } catch {
    return iso
  }
}

export default function ChatList({
  role,
  myUserId,
  focusRequestId,
  direct = false,
  onBack,
  onPayment,
  onUnreadChange,
  profile,
}: Props) {
  const { t: tr, locale } = useI18n()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [nowTick, setNowTick] = useState<number>(Date.now())
  const [isSending, setIsSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [devisInput, setDevisInput] = useState("")
  const [sendingDevis, setSendingDevis] = useState(false)
  const [respondingDevis, setRespondingDevis] = useState<number | null>(null)
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("")
  const [sendingSchedule, setSendingSchedule] = useState(false)
  const [respondingSchedule, setRespondingSchedule] = useState<number | null>(null)
  const [releasingFunds, setReleasingFunds] = useState(false)
  const [releasedRequestId, setReleasedRequestId] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const socketRef = useRef<ChatSocket | null>(null)
  const conversationsRef = useRef<Conversation[]>([])

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0)

  useEffect(() => {
    onUnreadChange?.(totalUnread)
  }, [totalUnread, onUnreadChange])

  const endpoint = role === "tech" ? "/api/chat/requests/technician" : "/api/chat/requests/client"
  const archivedEndpoint =
    role === "tech"
      ? "/api/chat/requests/technician/archived"
      : "/api/chat/requests/client/archived"

  const [showArchived, setShowArchived] = useState(false)
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([])

  const isArchivedConv = (c: Conversation) => c.status === "completed" && c.fundsReleased === true

  const switchTab = (archived: boolean) => {
    setShowArchived(archived)
    if (archived) {
      const target = archivedConversations.find((c) => Boolean(c.lastMessage))
      if (target && !archivedConversations.some((c) => c.id === selectedId)) {
        setSelectedId(target.id)
      }
    } else {
      const target = conversations.find((c) => Boolean(c.lastMessage) && !isArchivedConv(c))
      if (target && !conversations.some((c) => c.id === selectedId && !isArchivedConv(c))) {
        setSelectedId(target.id)
      }
    }
  }

  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(null), 6000)
    return () => clearTimeout(t)
  }, [success])

  useEffect(() => {
    const token = localStorage.getItem("mboaTechToken")
    fetch(`${API_BASE_URL}${endpoint}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${tr("Erreur")} (${r.status})`)
        return r.json()
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setConversations(list)
        const wanted =
          focusRequestId != null && list.some((c) => c.id === focusRequestId)
            ? focusRequestId
            : null
        const firstVisible = list.find((c) => Boolean(c.lastMessage))
        setSelectedId((prev) => prev ?? wanted ?? firstVisible?.id ?? null)
        setError(null)
      })
      .catch((err) => {
        console.error(err)
        setError(err instanceof Error ? err.message : tr("Impossible de charger les conversations"))
      })
      .finally(() => setLoading(false))
  }, [endpoint])

  useEffect(() => {
    const token = localStorage.getItem("mboaTechToken")
    const loadArchived = () => {
      fetch(`${API_BASE_URL}${archivedEndpoint}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("refresh failed"))))
        .then((data) => {
          const list = Array.isArray(data) ? data : []
          setArchivedConversations(list)
        })
        .catch(() => {})
    }
    loadArchived()
    const interval = setInterval(loadArchived, 5000)
    return () => clearInterval(interval)
  }, [archivedEndpoint])

  useEffect(() => {
    if (focusRequestId == null) return
    if (
      conversationsRef.current.some((c) => c.id === focusRequestId) ||
      archivedConversations.some((c) => c.id === focusRequestId)
    ) {
      setSelectedId(focusRequestId)
    }
  }, [focusRequestId, archivedConversations])

  useEffect(() => {
    if (!selectedId) return
    setMessages([])
    setError(null)
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedId && c.unreadCount ? { ...c, unreadCount: 0 } : c)),
    )

    const token = localStorage.getItem("mboaTechToken")
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined

    const markRead = () => {
      if (myUserId !== undefined) {
        socketRef.current?.sendRead({ requestId: selectedId, userId: myUserId })
      } else if (token) {
        fetch(`${API_BASE_URL}/api/chat/messages/${selectedId}/read`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {})
      }
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedId && c.unreadCount ? { ...c, unreadCount: 0 } : c)),
      )
    }

    const loadMessages = (initial: boolean) => {
      fetch(`${API_BASE_URL}/api/chat/messages/${selectedId}`, { headers })
        .then((r) => {
          if (!r.ok) throw new Error(tr("Impossible de charger l'historique de chat"))
          return r.json()
        })
        .then((data: ChatMessage[]) => {
          setMessages(
            data.map((message) => ({
              ...message,
              time: formatTime(message.timestamp, locale),
            })),
          )
        })
        .catch((err) => {
          console.error(err)
          setError(err instanceof Error ? err.message : tr("Erreur réseau"))
        })
        .finally(() => {
          if (initial) setLoading(false)
        })
    }

    loadMessages(true)

    const socket = openChatSocket(selectedId, {
      onMessage: (message) => {
        upsertMessage(message as IncomingChatMessage)
        bumpConversation(message as ChatMessage)
      },
      onRead: (messageIds) => {
        const ids = new Set(messageIds)
        if (ids.size === 0) return
        setMessages((prev) => prev.map((m) => (ids.has(m.id) ? { ...m, read: true } : m)))
      },
      onDevis: (message) => {
        upsertMessage(message as IncomingChatMessage)
      },
      onSchedule: (message) => {
        upsertMessage(message as IncomingChatMessage)
      },
      onError: (message) => setError(message),
      onReconnect: () => {
        loadMessages(false)
        markRead()
      },
    })
    socketRef.current = socket

    return () => {
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [selectedId, endpoint, myUserId])

  useEffect(() => {
    const token = localStorage.getItem("mboaTechToken")
    const refresh = () => {
      fetch(`${API_BASE_URL}${endpoint}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("refresh failed"))))
        .then((data) => {
          const list = Array.isArray(data) ? data : []
          setConversations((prev) => {
            if (prev.length === 0) return prev
            const knownIds = new Set(prev.map((c) => c.id))
            let changed = false
            const next = prev.map((c) => {
              const fresh = list.find((f) => f.id === c.id)
              if (!fresh) return c
              if (
                fresh.lastMessage === c.lastMessage &&
                fresh.lastMessageAt === c.lastMessageAt &&
                fresh.unreadCount === c.unreadCount &&
                fresh.fundsDeposited === c.fundsDeposited &&
                fresh.fundsReleased === c.fundsReleased &&
                fresh.disputeOpen === c.disputeOpen
              ) {
                return c
              }
              changed = true
              return {
                ...c,
                lastMessage: fresh.lastMessage ?? c.lastMessage,
                lastMessageAt: fresh.lastMessageAt ?? c.lastMessageAt,
                lastSender: fresh.lastSender ?? c.lastSender,
                lastIsMine: fresh.lastIsMine ?? c.lastIsMine,
                unreadCount: fresh.unreadCount ?? 0,
                technicianName: fresh.technicianName ?? c.technicianName,
                clientName: fresh.clientName ?? c.clientName,
                status: fresh.status ?? c.status,
                fundsDeposited: fresh.fundsDeposited ?? c.fundsDeposited,
                fundsReleased: fresh.fundsReleased ?? c.fundsReleased,
                disputeOpen: fresh.disputeOpen ?? c.disputeOpen,
              }
            })
            const freshOnes = list.filter((f) => !knownIds.has(f.id))
            if (freshOnes.length > 0) {
              changed = true
              return [...freshOnes, ...next]
            }
            return changed ? next : prev
          })
        })
        .catch(() => {})
    }
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [endpoint])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const send = async () => {
    if (!selectedId) return
    const text = sanitizeMultiline(input, 500)
    if (!text) return
    if (hasSqlInjectionPattern(text)) {
      setError(tr("Ce message contient des caractères ou expressions non autorisés."))
      return
    }
    setError(null)

    if (socketRef.current && myUserId !== undefined) {
      const sent = socketRef.current.sendMessage({
        requestId: selectedId,
        text,
        senderUserId: myUserId,
        senderName: profile?.firstName || profile?.username || "Utilisateur",
      })
      if (sent) {
        setInput("")
        return
      }
    }

    setIsSending(true)
    const messagePayload = {
      requestId: selectedId,
      sender: profile?.role === "technician" ? "tech" : "client",
      text,
      imageUrl: null,
      senderName: profile?.firstName || profile?.username || "Utilisateur",
    }

    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(messagePayload),
      })
      if (!response.ok) throw new Error(tr("Impossible d'envoyer le message"))
      const saved: ChatMessage = await response.json()
      upsertMessage(saved)
      bumpConversation(saved)
      setInput("")
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : tr("Erreur réseau"))
    } finally {
      setIsSending(false)
    }
  }

  const sendDevis = async () => {
    if (!devisInput.trim() || !selectedId) return
    const amount = Number(devisInput)
    if (!isValidAmount(amount)) {
      setError(tr("Montant du devis invalide. Utilisez un entier positif (max 100 000 000 FCFA)."))
      return
    }
    setError(null)
    setSendingDevis(true)
    const senderName = profile?.firstName || profile?.username || "Utilisateur"

    if (socketRef.current && myUserId !== undefined) {
      const sent = socketRef.current.sendDevis({
        requestId: selectedId,
        amount,
        senderUserId: myUserId,
        senderName,
      })
      if (sent) {
        setDevisInput("")
        setSendingDevis(false)
        return
      }
    }

    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          requestId: selectedId,
          sender: "tech",
          text: `${tr("Devis de")} ${formatAmount(amount)} FCFA`,
          imageUrl: null,
          devisAmount: amount,
          devisStatus: "pending",
          senderName,
        }),
      })
      if (!response.ok) throw new Error(tr("Impossible d'envoyer le devis"))
      const saved: ChatMessage = await response.json()
      upsertMessage(saved)
      bumpConversation(saved)
      setDevisInput("")
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : tr("Erreur réseau"))
    } finally {
      setSendingDevis(false)
    }
  }

  const respondToDevis = async (message: ChatMessage, status: "accepted" | "rejected") => {
    setRespondingDevis(message.id)
    setError(null)
    try {
      const token = localStorage.getItem("mboaTechToken")
      const action = status === "accepted" ? "accept" : "reject"
      const response = await fetch(`${API_BASE_URL}/api/chat/devis/${message.id}/${action}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) {
        let detail = ""
        try {
          const text = await response.text()
          detail = text ? ` · ${text.slice(0, 200)}` : ""
        } catch {
          /* ignore */
        }
        throw new Error(
          `${tr("Impossible de traiter le devis (HTTP")} ${response.status})${detail}`,
        )
      }
      const updated: ChatMessage = await response.json()
      upsertMessage(updated)
      if (status === "accepted") {
        const devis: PaymentDevis = {
          requestId: selected?.id,
          amount: message.devisAmount != null ? Number(message.devisAmount) : 0,
          description: selected?.description,
          technicianName: role === "tech" ? selected?.clientName : selected?.technicianName,
          category: selected?.category || selected?.domain,
        }
        setTimeout(() => onPayment?.(devis), 700)
      }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : tr("Erreur réseau"))
    } finally {
      setRespondingDevis(null)
    }
  }

  const sendSchedule = async () => {
    if (!scheduleDate || !scheduleTime || !selectedId) return
    setError(null)
    const scheduleAt = `${scheduleDate}T${scheduleTime}`
    const parsedSchedule = new Date(scheduleAt)
    if (Number.isNaN(parsedSchedule.getTime()) || parsedSchedule.getTime() <= Date.now()) {
      setError(tr("Veuillez proposer une date d'intervention valide, dans le futur."))
      return
    }
    const senderName = profile?.firstName || profile?.username || "Utilisateur"

    setSendingSchedule(true)

    if (socketRef.current && myUserId !== undefined) {
      const sent = socketRef.current.sendSchedule({
        requestId: selectedId,
        scheduleAt,
        senderUserId: myUserId,
        senderName,
      })
      if (sent) {
        setScheduleDate("")
        setScheduleTime("")
        setSendingSchedule(false)
        return
      }
    }

    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          requestId: selectedId,
          sender: "tech",
          text: `${tr("Intervention proposée le")} ${formatScheduleShort(scheduleAt)}`,
          imageUrl: null,
          scheduleAt,
          scheduleStatus: "pending",
          senderName,
        }),
      })
      if (!response.ok) throw new Error(tr("Impossible d'envoyer la proposition"))
      const saved: ChatMessage = await response.json()
      upsertMessage(saved)
      bumpConversation(saved)
      setScheduleDate("")
      setScheduleTime("")
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : tr("Erreur réseau"))
    } finally {
      setSendingSchedule(false)
    }
  }

  const respondToSchedule = async (message: ChatMessage, status: "accepted" | "rejected") => {
    setRespondingSchedule(message.id)
    setError(null)
    try {
      const token = localStorage.getItem("mboaTechToken")
      const action = status === "accepted" ? "accept" : "reject"
      const response = await fetch(`${API_BASE_URL}/api/chat/schedule/${message.id}/${action}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) {
        let detail = ""
        try {
          const text = await response.text()
          detail = text ? ` · ${text.slice(0, 200)}` : ""
        } catch {
          /* ignore */
        }
        throw new Error(
          `${tr("Impossible de traiter la proposition (HTTP")} ${response.status})${detail}`,
        )
      }
      const updated: ChatMessage = await response.json()
      upsertMessage(updated)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : tr("Erreur réseau"))
    } finally {
      setRespondingSchedule(null)
    }
  }

  const mergeRequestState = (request: {
    id: number
    fundsDeposited?: boolean
    fundsReleased?: boolean
    disputeOpen?: boolean
    disputeReporterUserId?: number
    disputeOpenAt?: string
  }) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === request.id
          ? {
              ...c,
              fundsDeposited: request.fundsDeposited ?? c.fundsDeposited,
              fundsReleased: request.fundsReleased ?? c.fundsReleased,
              disputeOpen: request.disputeOpen ?? c.disputeOpen,
              disputeReporterUserId:
                "disputeReporterUserId" in request
                  ? request.disputeReporterUserId
                  : c.disputeReporterUserId,
              disputeOpenAt: "disputeOpenAt" in request ? request.disputeOpenAt : c.disputeOpenAt,
            }
          : c,
      ),
    )
  }

  const signalDispute = async () => {
    if (!selectedId) return
    setError(null)
    setSuccess(null)
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/chat/request/${selectedId}/dispute`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) {
        let detail = ""
        try {
          const text = await response.text()
          detail = text ? ` · ${text.slice(0, 200)}` : ""
        } catch {
          /* ignore */
        }
        throw new Error(
          `${tr("Impossible de signaler le litige (HTTP")} ${response.status})${detail}`,
        )
      }
      const updated = await response.json()
      mergeRequestState(updated)
      setSuccess(
        tr("Litige signalé avec succès. Votre signalement a été transmis à l'administration."),
      )
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : tr("Erreur réseau"))
    }
  }

  const resolveDispute = async () => {
    if (!selectedId) return
    setError(null)
    setSuccess(null)
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(
        `${API_BASE_URL}/api/chat/request/${selectedId}/dispute/resolve`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      )
      if (!response.ok) {
        let detail = ""
        try {
          const text = await response.text()
          detail = text ? ` · ${text.slice(0, 200)}` : ""
        } catch {
          /* ignore */
        }
        throw new Error(
          `${tr("Impossible d'annuler le litige (HTTP")} ${response.status})${detail}`,
        )
      }
      const updated = await response.json()
      mergeRequestState(updated)
      setSuccess(tr("Litige annulé. Un compromis a été enregistré entre les deux parties."))
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : tr("Erreur réseau"))
    }
  }

  const releaseFunds = async () => {
    if (!selectedId || releasingFunds) return
    setError(null)
    setSuccess(null)
    setReleasingFunds(true)
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/payments/release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ requestId: selectedId }),
      })
      if (!response.ok) {
        let detail = ""
        try {
          const text = await response.text()
          detail = text ? ` · ${text.slice(0, 200)}` : ""
        } catch {
          /* ignore */
        }
        throw new Error(
          `${tr("Impossible de libérer les fonds (HTTP")} ${response.status})${detail}`,
        )
      }
      await response.json()
      setReleasedRequestId(selectedId)
      setSuccess(
        tr("Travaux validés : les fonds en garde ont été libérés et versés au technicien."),
      )
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : tr("Erreur réseau"))
    } finally {
      setReleasingFunds(false)
    }
  }

  const selected =
    conversations.find((c) => c.id === selectedId && !isArchivedConv(c)) ??
    archivedConversations.find((c) => c.id === selectedId)
  const activeConversations = conversations.filter(
    (c) => Boolean(c.lastMessage) && !isArchivedConv(c),
  )
  const archivedVisible = archivedConversations.filter((c) => Boolean(c.lastMessage))
  const visibleConversations = showArchived ? archivedVisible : activeConversations
  const selectedIsArchived = !!selected && isArchivedConv(selected)
  const allConversations = [...conversations, ...archivedConversations]
  const now = new Date()
  const todayMin = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const partnerNameOf = (c?: Conversation) => {
    const base = role === "tech" ? c?.clientName : c?.technicianName
    return base || c?.domain || c?.category || tr(role === "tech" ? "Client" : "Artisan")
  }
  const partnerDisplay = partnerNameOf(selected)
  const meta = selected
    ? (statusMeta[selected.status] ?? statusMeta.published)
    : statusMeta.published
  const showDevisPanel = role === "tech" && !!selected

  const disputeDeadline = selected?.disputeOpenAt
    ? new Date(selected.disputeOpenAt).getTime() + 24 * 3600 * 1000
    : 0
  const disputeExpired = selected?.disputeOpen ? nowTick >= disputeDeadline : false
  const canCancelDispute =
    selected?.disputeOpen === true &&
    selected.disputeReporterUserId != null &&
    selected.disputeReporterUserId === myUserId &&
    !disputeExpired
  const canValidateWork =
    role === "client" &&
    !!selected &&
    selected.status === "completed" &&
    selected.fundsDeposited === true &&
    selected.fundsReleased !== true &&
    releasedRequestId !== selected.id
  const disputeRemainMs = Math.max(0, disputeDeadline - nowTick)
  const disputeRemain = selected?.disputeOpen
    ? `${String(Math.floor(disputeRemainMs / 3600000)).padStart(2, "0")}:${String(Math.floor((disputeRemainMs % 3600000) / 60000)).padStart(2, "0")}:${String(Math.floor((disputeRemainMs % 60000) / 1000)).padStart(2, "0")}`
    : ""

  useEffect(() => {
    if (!selected?.disputeOpen) return
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [selected?.disputeOpen, selectedId])

  const bumpConversation = (message: ChatMessage) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === message.requestId)
      if (idx === -1) return prev
      const updated = [...prev]
      const conv = {
        ...updated[idx],
        lastMessage: message.text,
        lastMessageAt: message.timestamp,
        lastSender: message.senderUserId,
        lastIsMine: myUserId !== undefined && message.senderUserId === myUserId,
      }
      updated.splice(idx, 1)
      return [conv, ...updated]
    })
  }

  const upsertMessage = (message: ChatMessage) => {
    setMessages((prev) => {
      const existing = prev.some((m) => m.id === message.id)
      if (!existing) {
        return [...prev, { ...message, time: formatTime(message.timestamp, locale) }]
      }
      return prev.map((m) =>
        m.id === message.id ? { ...m, ...message, time: formatTime(message.timestamp, locale) } : m,
      )
    })
  }

  return (
    <div className="min-h-full p-3 sm:p-6" style={{ background: "#0B1120" }}>
      <div
        className={`mx-auto flex flex-col ${
          direct ? "max-w-[min(1040px,95%)]" : "max-w-[min(1100px,95%)]"
        }`}
      >
        {!direct && (
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1
                className="text-2xl font-bold mb-1"
                style={{ fontFamily: "Poppins, sans-serif", color: "#E8EDF5" }}
              >
                {tr("Messagerie")}
              </h1>
              <p className="text-sm" style={{ color: "#64748B" }}>
                {role === "tech"
                  ? tr("Vos conversations avec les clients")
                  : tr("Vos conversations avec les artisans")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
              <button
                onClick={signalDispute}
                disabled={
                  !selected?.fundsDeposited || selected?.disputeOpen || selected?.fundsReleased
                }
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
                style={{
                  background: "transparent",
                  color:
                    !selected?.fundsDeposited || selected?.disputeOpen || selected?.fundsReleased
                      ? "#64748B"
                      : "#EF4444",
                  border: `1px solid ${
                    !selected?.fundsDeposited || selected?.disputeOpen || selected?.fundsReleased
                      ? "#334155"
                      : "#EF4444"
                  }`,
                  cursor:
                    !selected?.fundsDeposited || selected?.disputeOpen || selected?.fundsReleased
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {selected?.fundsReleased
                  ? `✓ ${tr("Fonds libérés · litige fermé")}`
                  : `⚠ ${tr("Signaler un litige")}`}
              </button>
              <button
                onClick={resolveDispute}
                disabled={!canCancelDispute}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
                style={{
                  background: "transparent",
                  color: canCancelDispute ? "#34D399" : "#64748B",
                  border: `1px solid ${canCancelDispute ? "#34D399" : "#334155"}`,
                  cursor: canCancelDispute ? "pointer" : "not-allowed",
                }}
              >
                {`✓ ${tr("Annuler le litige — nous avons trouvé un compromis")}`}
                {selected?.disputeOpen && (
                  <span
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      color: canCancelDispute ? "#34D399" : "#64748B",
                    }}
                  >
                    {canCancelDispute
                      ? `⏱ ${disputeRemain}`
                      : disputeExpired
                        ? `· ${tr("délai expiré")}`
                        : `· ${tr("indisponible")}`}
                  </span>
                )}
              </button>
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

        {success && (
          <div
            className="mb-4 p-3 rounded-xl text-sm"
            style={{
              background: "rgba(52,211,153,0.1)",
              color: "#34D399",
              border: "1px solid rgba(52,211,153,0.25)",
            }}
          >
            {success}
          </div>
        )}

        {loading && conversations.length === 0 ? (
          <div className="text-center py-16" style={{ color: "#64748B" }}>
            <p className="text-base font-medium" style={{ color: "#E8EDF5" }}>
              {tr("Chargement des conversations…")}
            </p>
          </div>
        ) : !direct && visibleConversations.length === 0 ? (
          <div
            className="text-center py-16 rounded-2xl"
            style={{
              background: "#141C2F",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#64748B",
            }}
          >
            <ChatBubbleIcon className="mx-auto mb-3 h-12 w-12 text-slate-600" />
            <p className="text-base font-medium" style={{ color: "#E8EDF5" }}>
              {showArchived
                ? tr("Aucune intervention archivée")
                : tr("Aucune conversation pour le moment")}
            </p>
            <p className="text-sm mt-1">
              {showArchived
                ? tr("Vos interventions terminées apparaîtront ici et resteront consultables.")
                : role === "tech"
                  ? tr(
                      "Une conversation apparaîtra ici dès que vous échangez un premier message avec un client.",
                    )
                  : tr(
                      "Votre conversation apparaîtra ici dès le premier message échangé avec un artisan.",
                    )}
            </p>
          </div>
        ) : (
          <div
            className={`flex flex-col gap-4 lg:flex-row ${
              direct ? "lg:h-[calc(100vh-96px)]" : "lg:h-[calc(100vh-190px)]"
            }`}
            style={{ minHeight: "440px" }}
          >
            {/* Liste des conversations */}
            {!direct && (
              <aside
                className="flex flex-col overflow-hidden rounded-2xl max-h-72 lg:max-h-none lg:w-[320px] lg:flex-shrink-0"
                style={{
                  background: "#141C2F",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  className="px-4 py-3 flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #1E3A6A, #1D4ED8)",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <p
                    className="text-sm font-bold"
                    style={{
                      fontFamily: "Poppins, sans-serif",
                      color: "#E8EDF5",
                    }}
                  >
                    {tr("Discussions")}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      onClick={() => switchTab(false)}
                      className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{
                        background: !showArchived ? "rgba(255,255,255,0.18)" : "transparent",
                        color: "#E8EDF5",
                        border: "1px solid rgba(255,255,255,0.15)",
                      }}
                    >
                      Actives
                    </button>
                    <button
                      onClick={() => switchTab(true)}
                      className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{
                        background: showArchived ? "rgba(255,255,255,0.18)" : "transparent",
                        color: "#E8EDF5",
                        border: "1px solid rgba(255,255,255,0.15)",
                      }}
                    >
                      Archives{archivedVisible.length > 0 ? ` (${archivedVisible.length})` : ""}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {visibleConversations.map((c) => {
                    const display = partnerNameOf(c)
                    const active = selectedId === c.id
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left"
                        style={{
                          background: active ? "rgba(37,99,235,0.18)" : "transparent",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        <div
                          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ background: avatarColor(display) }}
                        >
                          {initials(display)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p
                              className="truncate text-sm font-semibold"
                              style={{ color: "#E8EDF5" }}
                            >
                              {display}
                            </p>
                            <span
                              className="flex-shrink-0 text-[10px]"
                              style={{ color: "#64748B" }}
                            >
                              {timeAgo(c.lastMessageAt || c.createdAt, tr)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <p
                              className="truncate text-xs"
                              style={{ color: active ? "#93C5FD" : "#94A3B8" }}
                            >
                              {c.lastMessage
                                ? `${c.lastIsMine ? "Vous : " : ""}${c.lastMessage}`
                                : c.domain || c.category}
                            </p>
                            {(c.unreadCount ?? 0) > 0 && (
                              <span
                                className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                                style={{
                                  background: "#2563EB",
                                  color: "#FFFFFF",
                                }}
                              >
                                {c.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </aside>
            )}

            {/* Conversation */}
            <section
              className={`${
                direct ? (showDevisPanel ? "flex-1" : "w-full") : "flex-1"
              } flex flex-col overflow-hidden rounded-2xl min-h-[60vh] lg:min-h-0`}
              style={{
                background: "#141C2F",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {!selected ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full"
                    style={{ background: "#1E2A42" }}
                  >
                    <ChatBubbleIcon className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium" style={{ color: "#E8EDF5" }}>
                    Chargement de la conversation…
                  </p>
                  <p className="text-xs" style={{ color: "#64748B" }}>
                    La discussion avec l'auteur de la demande s'ouvre.
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className="flex items-center gap-3 px-3 sm:px-5 py-3 flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #1E3A6A, #1D4ED8)",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {direct && onBack && (
                      <button
                        onClick={onBack}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: "rgba(255,255,255,0.12)",
                          color: "#E8EDF5",
                        }}
                        aria-label="Retour"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </button>
                    )}
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ background: avatarColor(partnerDisplay) }}
                    >
                      {initials(partnerDisplay)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-semibold"
                        style={{
                          fontFamily: "Poppins, sans-serif",
                          color: "#E8EDF5",
                        }}
                      >
                        {partnerDisplay}
                      </p>
                      <p className="text-xs" style={{ color: "#93C5FD" }}>
                        {selected?.domain || selected?.category} · {meta.label}
                      </p>
                    </div>
                    <span
                      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold flex-shrink-0"
                      style={{
                        background: "rgba(37,99,235,0.15)",
                        color: "#93C5FD",
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 animate-pulse rounded-full"
                        style={{ background: "#60A5FA" }}
                      />
                      Temps réel
                    </span>
                    {canValidateWork && (
                      <button
                        onClick={releaseFunds}
                        disabled={releasingFunds}
                        className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap"
                        style={{
                          background: "linear-gradient(135deg, #059669, #047857)",
                          color: "#FFFFFF",
                          boxShadow: "0 2px 12px rgba(5,150,105,0.35)",
                          cursor: releasingFunds ? "not-allowed" : "pointer",
                        }}
                      >
                        {releasingFunds
                          ? "Libération en cours…"
                          : "Valider les travaux · libérer les fonds"}
                      </button>
                    )}
                  </div>

                  <div
                    className="flex-1 overflow-y-auto px-3 sm:px-6 py-5 flex flex-col gap-2"
                    style={{ background: "#0F172A" }}
                  >
                    {loading && (
                      <p className="text-sm" style={{ color: "#94A3B8" }}>
                        Chargement des messages…
                      </p>
                    )}
                    {!loading && messages.length === 0 && (
                      <p className="text-sm text-center mt-10" style={{ color: "#94A3B8" }}>
                        Aucun message pour le moment. Envoyez le premier message pour démarrer la
                        conversation.
                      </p>
                    )}
                    {messages.map((m) => {
                      const mine =
                        myUserId !== undefined && m.senderUserId !== undefined
                          ? m.senderUserId === myUserId
                          : m.sender === (role === "tech" ? "tech" : "client")
                      if (m.senderUserId === SYSTEM_SENDER_ID) {
                        return (
                          <div key={m.id} className="flex justify-center">
                            <span
                              className="rounded-full px-3 py-1.5 text-[11px] font-medium"
                              style={{
                                background: "rgba(148,163,184,0.12)",
                                color: "#94A3B8",
                                border: "1px solid rgba(148,163,184,0.18)",
                              }}
                            >
                              {m.text}
                            </span>
                          </div>
                        )
                      }
                      if (m.devisAmount != null) {
                        return (
                          <div
                            key={m.id}
                            className={`flex ${mine ? "justify-end" : "justify-start"}`}
                          >
                            <div className="max-w-[78%]">
                              <div
                                className="overflow-hidden rounded-2xl shadow-lg"
                                style={{
                                  background: "#1E2A42",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                }}
                              >
                                <div className="flex items-center gap-2 px-4 pt-3">
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#93C5FD"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <line x1="12" y1="1" x2="12" y2="23" />
                                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                  </svg>
                                  <p
                                    className="text-xs font-bold"
                                    style={{
                                      color: "#93C5FD",
                                      letterSpacing: "0.08em",
                                    }}
                                  >
                                    DEVIS
                                  </p>
                                </div>
                                <div className="px-4 py-3">
                                  <p
                                    className="text-3xl font-bold font-mono"
                                    style={{ color: "#E8EDF5" }}
                                  >
                                    {formatAmount(Number(m.devisAmount))}{" "}
                                    <span className="text-sm" style={{ color: "#64748B" }}>
                                      FCFA
                                    </span>
                                  </p>
                                </div>
                                {m.devisStatus === "pending" && !mine && role === "client" ? (
                                  <div className="flex flex-col gap-2 px-4 pb-4">
                                    <button
                                      onClick={() => respondToDevis(m, "accepted")}
                                      disabled={respondingDevis === m.id}
                                      className="w-full rounded-lg py-2.5 text-xs font-bold text-white"
                                      style={{
                                        background: "linear-gradient(135deg, #059669, #047857)",
                                        boxShadow: "0 2px 12px rgba(5,150,105,0.35)",
                                      }}
                                    >
                                      {respondingDevis === m.id
                                        ? "Traitement…"
                                        : "Accepter et procéder au paiement"}
                                    </button>
                                    <button
                                      onClick={() => respondToDevis(m, "rejected")}
                                      disabled={respondingDevis === m.id}
                                      className="w-full rounded-lg py-2.5 text-xs font-bold"
                                      style={{
                                        background: "rgba(239,68,68,0.12)",
                                        color: "#F87171",
                                        border: "1px solid rgba(239,68,68,0.3)",
                                      }}
                                    >
                                      Rejeter le devis
                                    </button>
                                  </div>
                                ) : (
                                  <div className="px-4 pb-4">
                                    <span
                                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                                      style={devisStatusStyle(m.devisStatus ?? null)}
                                    >
                                      {devisStatusLabel(m.devisStatus ?? null, mine, tr)}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <p
                                className="mt-0.5 px-1 text-[10px]"
                                style={{
                                  color: "#64748B",
                                  textAlign: mine ? "right" : "left",
                                }}
                              >
                                {mine && <ReadReceipt read={!!m.read} />}
                                {m.time}
                              </p>
                            </div>
                          </div>
                        )
                      }
                      if (m.scheduleAt != null) {
                        return (
                          <div
                            key={m.id}
                            className={`flex ${mine ? "justify-end" : "justify-start"}`}
                          >
                            <div className="max-w-[78%]">
                              <div
                                className="overflow-hidden rounded-2xl shadow-lg"
                                style={{
                                  background: "#1E2A42",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                }}
                              >
                                <div className="flex items-center gap-2 px-4 pt-3">
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#34D399"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <rect x="3" y="4" width="18" height="18" rx="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                  </svg>
                                  <p
                                    className="text-xs font-bold"
                                    style={{
                                      color: "#34D399",
                                      letterSpacing: "0.08em",
                                    }}
                                  >
                                    INTERVENTION
                                  </p>
                                </div>
                                <div className="px-4 py-3">
                                  <p
                                    className="text-sm font-bold leading-snug"
                                    style={{
                                      color: "#E8EDF5",
                                      fontFamily: "Poppins, sans-serif",
                                    }}
                                  >
                                    {formatScheduleDate(m.scheduleAt, locale, tr)}
                                  </p>
                                </div>
                                {m.scheduleStatus === "pending" && !mine && role === "client" ? (
                                  <div className="flex flex-col gap-2 px-4 pb-4">
                                    <button
                                      onClick={() => respondToSchedule(m, "accepted")}
                                      disabled={respondingSchedule === m.id}
                                      className="w-full rounded-lg py-2.5 text-xs font-bold text-white"
                                      style={{
                                        background: "linear-gradient(135deg, #059669, #047857)",
                                        boxShadow: "0 2px 12px rgba(5,150,105,0.35)",
                                      }}
                                    >
                                      {respondingSchedule === m.id
                                        ? "Traitement…"
                                        : "Accepter l'intervention"}
                                    </button>
                                    <button
                                      onClick={() => respondToSchedule(m, "rejected")}
                                      disabled={respondingSchedule === m.id}
                                      className="w-full rounded-lg py-2.5 text-xs font-bold"
                                      style={{
                                        background: "rgba(239,68,68,0.12)",
                                        color: "#F87171",
                                        border: "1px solid rgba(239,68,68,0.3)",
                                      }}
                                    >
                                      Refuser la proposition
                                    </button>
                                  </div>
                                ) : (
                                  <div className="px-4 pb-4">
                                    <span
                                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                                      style={scheduleStatusStyle(m.scheduleStatus ?? null)}
                                    >
                                      {scheduleStatusLabel(m.scheduleStatus ?? null, mine, tr)}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <p
                                className="mt-0.5 px-1 text-[10px]"
                                style={{
                                  color: "#64748B",
                                  textAlign: mine ? "right" : "left",
                                }}
                              >
                                {mine && <ReadReceipt read={!!m.read} />}
                                {m.time}
                              </p>
                            </div>
                          </div>
                        )
                      }
                      return (
                        <div
                          key={m.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div className="max-w-[70%]">
                            <div
                              className="rounded-2xl px-4 py-2.5 shadow-lg"
                              style={{
                                background: mine ? MESSAGE_SENT_COLOR : "#1E2A42",
                                borderBottomRightRadius: mine ? "4px" : undefined,
                                borderBottomLeftRadius: !mine ? "4px" : undefined,
                              }}
                            >
                              {m.imageUrl && (
                                <img
                                  src={m.imageUrl}
                                  alt="Photo partagée dans le chat"
                                  className="mb-2 w-full cursor-pointer rounded-xl object-cover"
                                  style={{ height: "140px" }}
                                />
                              )}
                              <p
                                className="text-sm leading-relaxed"
                                style={{
                                  color: "#E8EDF5",
                                  fontFamily: "Inter, sans-serif",
                                }}
                              >
                                {m.text}
                              </p>
                            </div>
                            <p
                              className="mt-0.5 px-1 text-[10px]"
                              style={{
                                color: "#64748B",
                                textAlign: mine ? "right" : "left",
                              }}
                            >
                              {mine && <ReadReceipt read={!!m.read} />}
                              {m.time}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={bottomRef} />
                  </div>

                  <div
                    className="flex items-center gap-3 px-3 sm:px-5 py-4 flex-shrink-0"
                    style={{
                      background: "#141C2F",
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {showArchived || selectedIsArchived ? (
                      <p
                        className="w-full text-center text-xs rounded-xl px-4 py-3"
                        style={{
                          background: "rgba(5,150,105,0.08)",
                          color: "#34D399",
                          border: "1px solid rgba(5,150,105,0.2)",
                        }}
                      >
                        ✓ Intervention terminée — conversation archivée
                      </p>
                    ) : (
                      <>
                        <div
                          className="flex flex-1 items-center rounded-xl px-4 py-3"
                          style={{
                            background: "#1E2A42",
                            border: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && send()}
                            placeholder="Votre message..."
                            className="flex-1 bg-transparent outline-none text-sm"
                            style={{
                              color: "#E8EDF5",
                              fontFamily: "Inter, sans-serif",
                            }}
                          />
                        </div>
                        <button
                          onClick={send}
                          disabled={!input.trim() || isSending}
                          className="flex h-11 w-11 items-center justify-center rounded-full flex-shrink-0 text-white"
                          style={{
                            background: input.trim() ? "#2563EB" : "#1E2A42",
                            boxShadow: input.trim() ? "0 2px 10px rgba(37,99,235,0.35)" : "none",
                          }}
                          aria-label="Envoyer"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </section>

            {/* Panneau devis (technicien, chat direct) */}
            {showDevisPanel && (
              <aside
                className="flex w-full flex-col overflow-hidden rounded-2xl lg:w-[260px] lg:flex-shrink-0"
                style={{
                  background: "#141C2F",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  className="flex-shrink-0 px-4 py-3"
                  style={{
                    background: "linear-gradient(135deg, #1E3A6A, #1D4ED8)",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <p
                    className="text-sm font-bold"
                    style={{
                      fontFamily: "Poppins, sans-serif",
                      color: "#E8EDF5",
                    }}
                  >
                    Devis
                  </p>
                </div>
                <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: "#1E2A42",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <p className="text-xs" style={{ color: "#94A3B8" }}>
                      Proposez le montant de votre intervention à{" "}
                      <strong style={{ color: "#E8EDF5" }}>{partnerDisplay}</strong>.
                    </p>
                    <div className="mt-3">
                      <label
                        className="mb-1.5 block text-xs font-semibold"
                        style={{ color: "#E8EDF5" }}
                      >
                        Montant (FCFA)
                      </label>
                      <div
                        className="flex items-center rounded-xl px-3 py-2.5"
                        style={{
                          background: "#0F172A",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <input
                          type="number"
                          min="0"
                          value={devisInput}
                          onChange={(e) => setDevisInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendDevis()}
                          placeholder="Ex : 15000"
                          className="flex-1 bg-transparent text-sm outline-none"
                          style={{
                            color: "#E8EDF5",
                            fontFamily: "Inter, sans-serif",
                          }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={sendDevis}
                      disabled={!devisInput.trim() || sendingDevis}
                      className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-white"
                      style={{
                        background: devisInput.trim()
                          ? "linear-gradient(135deg, #2563EB, #1D4ED8)"
                          : "#1E2A42",
                        boxShadow: devisInput.trim() ? "0 4px 16px rgba(37,99,235,0.35)" : "none",
                      }}
                    >
                      {sendingDevis ? "Envoi…" : `Envoyer le devis à ${partnerDisplay}`}
                    </button>
                    <p className="mt-2 text-[10px] leading-relaxed" style={{ color: "#64748B" }}>
                      Le client pourra accepter et procéder au paiement, ou rejeter votre devis.
                    </p>
                  </div>

                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: "#1E2A42",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#34D399"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <p
                        className="text-xs font-bold"
                        style={{ color: "#34D399", letterSpacing: "0.08em" }}
                      >
                        PLANIFIER L'INTERVENTION
                      </p>
                    </div>
                    <p className="mt-2 text-xs" style={{ color: "#94A3B8" }}>
                      Fixez la date et l'heure de votre intervention pour{" "}
                      <strong style={{ color: "#E8EDF5" }}>{partnerDisplay}</strong>.
                    </p>
                    <div className="mt-3">
                      <label
                        className="mb-1.5 block text-xs font-semibold"
                        style={{ color: "#E8EDF5" }}
                      >
                        Date
                      </label>
                      <div
                        className="flex items-center rounded-xl px-3 py-2.5"
                        style={{
                          background: "#0F172A",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <input
                          type="date"
                          value={scheduleDate}
                          min={todayMin}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="w-full bg-transparent text-sm outline-none [color-scheme:dark]"
                          style={{
                            color: "#E8EDF5",
                            fontFamily: "Inter, sans-serif",
                          }}
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label
                        className="mb-1.5 block text-xs font-semibold"
                        style={{ color: "#E8EDF5" }}
                      >
                        Heure
                      </label>
                      <div
                        className="flex items-center rounded-xl px-3 py-2.5"
                        style={{
                          background: "#0F172A",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-full bg-transparent text-sm outline-none [color-scheme:dark]"
                          style={{
                            color: "#E8EDF5",
                            fontFamily: "Inter, sans-serif",
                          }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={sendSchedule}
                      disabled={!scheduleDate || !scheduleTime || sendingSchedule}
                      className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-white"
                      style={{
                        background:
                          scheduleDate && scheduleTime
                            ? "linear-gradient(135deg, #059669, #047857)"
                            : "#1E2A42",
                        boxShadow:
                          scheduleDate && scheduleTime ? "0 4px 16px rgba(5,150,105,0.35)" : "none",
                      }}
                    >
                      {sendingSchedule
                        ? "Envoi…"
                        : scheduleDate && scheduleTime
                          ? `Proposer le ${formatScheduleShort(`${scheduleDate}T${scheduleTime}`)}`
                          : "Proposer une intervention"}
                    </button>
                    <p className="mt-2 text-[10px] leading-relaxed" style={{ color: "#64748B" }}>
                      Le client pourra accepter ou refuser votre proposition.
                    </p>
                  </div>
                </div>
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
  assigned: { label: "En cours", color: "#93C5FD", bg: "rgba(37,99,235,0.12)" },
  in_progress: {
    label: "Intervention en cours",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
  },
  completed: {
    label: "Terminée",
    color: "#059669",
    bg: "rgba(5,150,105,0.12)",
  },
  published: { label: "Publiée", color: "#93C5FD", bg: "rgba(37,99,235,0.12)" },
}
