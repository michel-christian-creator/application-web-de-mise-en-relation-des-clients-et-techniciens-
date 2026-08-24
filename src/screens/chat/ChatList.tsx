import { useEffect, useRef, useState } from "react"
import { openChatSocket, formatScheduleShort, type ChatSocket } from "../../utils/chatSocket"
import ChatBubbleIcon from "../../components/icons/ChatBubbleIcon"
import type { PaymentDevis } from "../client/C6Payment"
import { API_BASE_URL } from "../../config"
import { sanitizeMultiline, isValidAmount, hasSqlInjectionPattern } from "../../utils/validation"
import { useI18n } from "../../i18n"
import "./ChatList.css"

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
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null)
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
        .catch((err) => console.error("Erreur chargement conversations archivees:", err))
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
      const sent =
        myUserId !== undefined &&
        socketRef.current?.sendRead({ requestId: selectedId, userId: myUserId })
      if (!sent && token) {
        fetch(`${API_BASE_URL}/api/chat/messages/${selectedId}/read`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch((err) => console.error("Erreur marquage messages lus:", err))
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
          if (initial) {
            setLoading(false)
            markRead()
          }
        })
    }

    loadMessages(true)

    const socket = openChatSocket(selectedId, {
      onMessage: (message) => {
        upsertMessage(message as IncomingChatMessage)
        bumpConversation(message as ChatMessage)
        if (!(myUserId !== undefined && (message as ChatMessage).senderUserId === myUserId)) {
          markRead()
        }
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
        .catch((err) => console.error("Erreur rafraichissement conversations:", err))
    }
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [endpoint])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    const el = chatInputRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 200) + "px"
  }, [input])

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
        if (chatInputRef.current) chatInputRef.current.style.height = "auto"
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
      if (chatInputRef.current) chatInputRef.current.style.height = "auto"
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
    <div className="cl-root min-h-full p-3 sm:p-6">
      <div
        className={`mx-auto flex flex-col ${
          direct ? "max-w-[min(1040px,95%)]" : "max-w-[min(1100px,95%)]"
        }`}
      >
        {!direct && (
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="cl-font-heading cl-text-primary text-2xl font-bold mb-1">
                {tr("Messagerie")}
              </h1>
              <p className="cl-text-muted text-sm">
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

        {error && <div className="cl-alert-error mb-4 p-3 rounded-xl text-sm">{error}</div>}

        {success && <div className="cl-alert-success mb-4 p-3 rounded-xl text-sm">{success}</div>}

        {loading && conversations.length === 0 ? (
          <div className="cl-text-muted text-center py-16">
            <p className="cl-text-primary text-base font-medium">
              {tr("Chargement des conversations…")}
            </p>
          </div>
        ) : !direct && visibleConversations.length === 0 ? (
          <div className="cl-panel cl-text-muted text-center py-16 rounded-2xl">
            <ChatBubbleIcon className="mx-auto mb-3 h-12 w-12 text-slate-600" />
            <p className="cl-text-primary text-base font-medium">
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
            {!direct && (
              <aside className="cl-panel flex flex-col overflow-hidden rounded-2xl max-h-72 lg:max-h-none lg:w-[320px] lg:flex-shrink-0">
                <div className="cl-header-gradient px-4 py-3 flex-shrink-0">
                  <p className="cl-font-heading cl-text-primary text-sm font-bold">
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
                      {tr("Actives")}
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
                      {tr("Archives")}
                      {archivedVisible.length > 0 ? ` (${archivedVisible.length})` : ""}
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
                        className="cl-conv-separator flex w-full items-center gap-3 px-4 py-3 text-left"
                        style={{
                          background: active ? "rgba(37,99,235,0.18)" : "transparent",
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
                            <p className="cl-text-primary truncate text-sm font-semibold">
                              {display}
                            </p>
                            <span className="cl-text-muted flex-shrink-0 text-[10px]">
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
                              <span className="cl-unread-badge flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold">
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

            <section
              className={`cl-panel ${
                direct ? (showDevisPanel ? "flex-1" : "w-full") : "flex-1"
              } flex flex-col overflow-hidden rounded-2xl min-h-[60vh] lg:min-h-0`}
            >
              {!selected ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <div className="cl-empty-icon flex h-16 w-16 items-center justify-center rounded-full">
                    <ChatBubbleIcon className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="cl-text-primary text-sm font-medium">
                    {tr("Chargement de la conversation…")}
                  </p>
                  <p className="cl-text-muted text-xs">
                    {tr("La discussion avec l'auteur de la demande s'ouvre.")}
                  </p>
                </div>
              ) : (
                <>
                  <div className="cl-header-gradient flex items-center gap-3 px-3 sm:px-5 py-3 flex-shrink-0">
                    {direct && onBack && (
                      <button
                        onClick={onBack}
                        className="cl-back-btn flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
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
                      <p className="cl-font-heading cl-text-primary truncate text-sm font-semibold">
                        {partnerDisplay}
                      </p>
                      <p className="cl-text-accent text-xs">
                        {selected?.domain || selected?.category} · {meta.label}
                      </p>
                    </div>
                    <span className="cl-realtime-badge flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold flex-shrink-0">
                      <span className="cl-realtime-dot h-1.5 w-1.5 animate-pulse rounded-full" />
                      {tr("Temps réel")}
                    </span>
                    {canValidateWork && (
                      <button
                        onClick={() => setShowReleaseConfirm(true)}
                        disabled={releasingFunds}
                        className="cl-btn-accept flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap"
                        style={{ cursor: releasingFunds ? "not-allowed" : "pointer" }}
                      >
                        {releasingFunds
                          ? tr("Libération en cours…")
                          : tr("Valider les travaux · libérer les fonds")}
                      </button>
                    )}
                  </div>

                  {showReleaseConfirm && (
                    <div
                      className="cl-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
                      onClick={() => setShowReleaseConfirm(false)}
                    >
                      <div
                        className="cl-modal w-full max-w-sm rounded-2xl p-6"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <span className="cl-modal-warning-icon flex items-center justify-center w-10 h-10 rounded-full text-lg">
                            ⚠
                          </span>
                          <h3
                            className="cl-font-heading text-base font-bold"
                            style={{ color: "#F1F5F9" }}
                          >
                            {tr("Confirmer la libération des fonds")}
                          </h3>
                        </div>
                        <p className="text-sm leading-relaxed mb-2" style={{ color: "#CBD5E1" }}>
                          {tr(
                            "Vous êtes sur le point de valider la fin de l'intervention et de libérer les fonds en garde au technicien.",
                          )}
                        </p>
                        <p className="cl-text-danger text-sm font-semibold leading-relaxed mb-6">
                          {tr(
                            "Cette action est irréversible. Ne confirmez que si les travaux sont réellement terminés et conformes.",
                          )}
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setShowReleaseConfirm(false)}
                            className="cl-modal-cancel-btn cl-font-heading flex-1 py-3 rounded-xl font-semibold text-sm"
                          >
                            {tr("Annuler")}
                          </button>
                          <button
                            onClick={() => {
                              setShowReleaseConfirm(false)
                              releaseFunds()
                            }}
                            disabled={releasingFunds}
                            className="cl-btn-accept cl-font-heading flex-1 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
                          >
                            {tr("Oui, je confirme")}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="cl-chat-bg flex-1 overflow-y-auto px-3 sm:px-6 py-5 flex flex-col gap-2">
                    {loading && (
                      <p className="cl-text-light-muted text-sm">
                        {tr("Chargement des messages…")}
                      </p>
                    )}
                    {!loading && messages.length === 0 && (
                      <p className="cl-text-light-muted text-sm text-center mt-10">
                        {tr(
                          "Aucun message pour le moment. Envoyez le premier message pour démarrer la conversation.",
                        )}
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
                            <span className="cl-system-msg rounded-full px-3 py-1.5 text-[11px] font-medium">
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
                              <div className="cl-inner-card overflow-hidden rounded-2xl shadow-lg">
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
                                  <p className="cl-text-accent cl-label-tracked text-xs font-bold">
                                    {tr("DEVIS")}
                                  </p>
                                </div>
                                <div className="px-4 py-3">
                                  <p className="cl-text-primary text-3xl font-bold font-mono">
                                    {formatAmount(Number(m.devisAmount))}{" "}
                                    <span className="cl-text-muted text-sm">FCFA</span>
                                  </p>
                                </div>
                                {m.devisStatus === "pending" && !mine && role === "client" ? (
                                  <div className="flex flex-col gap-2 px-4 pb-4">
                                    <button
                                      onClick={() => respondToDevis(m, "accepted")}
                                      disabled={respondingDevis === m.id}
                                      className="cl-btn-accept w-full rounded-lg py-2.5 text-xs font-bold text-white"
                                    >
                                      {respondingDevis === m.id
                                        ? tr("Traitement…")
                                        : tr("Accepter et procéder au paiement")}
                                    </button>
                                    <button
                                      onClick={() => respondToDevis(m, "rejected")}
                                      disabled={respondingDevis === m.id}
                                      className="cl-btn-reject w-full rounded-lg py-2.5 text-xs font-bold"
                                    >
                                      {tr("Rejeter le devis")}
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
                                className="cl-text-muted mt-0.5 px-1 text-[10px]"
                                style={{ textAlign: mine ? "right" : "left" }}
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
                              <div className="cl-inner-card overflow-hidden rounded-2xl shadow-lg">
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
                                  <p className="cl-text-success cl-label-tracked text-xs font-bold">
                                    {tr("INTERVENTION")}
                                  </p>
                                </div>
                                <div className="px-4 py-3">
                                  <p className="cl-text-primary cl-font-heading text-sm font-bold leading-snug">
                                    {formatScheduleDate(m.scheduleAt, locale, tr)}
                                  </p>
                                </div>
                                {m.scheduleStatus === "pending" && !mine && role === "client" ? (
                                  <div className="flex flex-col gap-2 px-4 pb-4">
                                    <button
                                      onClick={() => respondToSchedule(m, "accepted")}
                                      disabled={respondingSchedule === m.id}
                                      className="cl-btn-accept w-full rounded-lg py-2.5 text-xs font-bold text-white"
                                    >
                                      {respondingSchedule === m.id
                                        ? tr("Traitement…")
                                        : tr("Accepter l'intervention")}
                                    </button>
                                    <button
                                      onClick={() => respondToSchedule(m, "rejected")}
                                      disabled={respondingSchedule === m.id}
                                      className="cl-btn-reject w-full rounded-lg py-2.5 text-xs font-bold"
                                    >
                                      {tr("Refuser la proposition")}
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
                                className="cl-text-muted mt-0.5 px-1 text-[10px]"
                                style={{ textAlign: mine ? "right" : "left" }}
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
                              className={`rounded-2xl px-4 py-2.5 shadow-lg ${
                                mine ? "cl-bubble-mine" : "cl-bubble-other"
                              }`}
                            >
                              {m.imageUrl && (
                                <img
                                  src={m.imageUrl}
                                  alt={tr("Photo partagée dans le chat")}
                                  className="mb-2 w-full cursor-pointer rounded-xl object-cover"
                                  style={{ height: "140px" }}
                                />
                              )}
                              <p className="cl-text-primary cl-font-body text-sm leading-relaxed">
                                {m.text}
                              </p>
                            </div>
                            <p
                              className="cl-text-muted mt-0.5 px-1 text-[10px]"
                              style={{ textAlign: mine ? "right" : "left" }}
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

                  <div className="cl-input-bar flex items-center gap-3 px-3 sm:px-5 py-4 flex-shrink-0">
                    {showArchived || selectedIsArchived ? (
                      <p className="cl-archived-notice w-full text-center text-xs rounded-xl px-4 py-3">
                        {tr("✓ Intervention terminée — conversation archivée")}
                      </p>
                    ) : (
                      <>
                        <div className="cl-input-wrapper flex-1 flex flex-col rounded-xl px-4 py-3">
                          <textarea
                            ref={chatInputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value.slice(0, 500))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                send()
                              }
                            }}
                            placeholder={tr("Votre message...")}
                            rows={1}
                            className="cl-input-field w-full bg-transparent outline-none text-sm resize-none"
                            style={{ maxHeight: "200px", overflowY: "auto" }}
                          />
                          <span
                            className="text-right text-[10px] mt-0.5"
                            style={{ color: input.length > 450 ? "#EF4444" : "#475569" }}
                          >
                            {input.length}/500
                          </span>
                        </div>
                        <button
                          onClick={send}
                          disabled={!input.trim() || isSending}
                          className="cl-btn-action cl-btn-send flex h-11 w-11 items-center justify-center rounded-full flex-shrink-0"
                          aria-label={tr("Envoyer")}
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

            {showDevisPanel && (
              <aside className="cl-panel flex w-full flex-col overflow-hidden rounded-2xl lg:w-[260px] lg:flex-shrink-0">
                <div className="cl-header-gradient flex-shrink-0 px-4 py-3">
                  <p className="cl-font-heading cl-text-primary text-sm font-bold">{tr("Devis")}</p>
                </div>
                <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
                  <div className="cl-inner-card rounded-2xl p-4">
                    <p className="cl-text-light-muted text-xs">
                      {tr("Proposez le montant de votre intervention à")}{" "}
                      <strong className="cl-text-primary">{partnerDisplay}</strong>.
                    </p>
                    <div className="mt-3">
                      <label className="cl-text-primary mb-1.5 block text-xs font-semibold">
                        {tr("Montant (FCFA)")}
                      </label>
                      <div className="cl-input-field-wrapper flex items-center rounded-xl px-3 py-2.5">
                        <input
                          type="number"
                          min="0"
                          value={devisInput}
                          onChange={(e) => setDevisInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendDevis()}
                          placeholder="Ex : 15000"
                          className="cl-input-field flex-1 bg-transparent text-sm outline-none"
                        />
                      </div>
                    </div>
                    <button
                      onClick={sendDevis}
                      disabled={!devisInput.trim() || sendingDevis}
                      className="cl-btn-action cl-btn-devis mt-4 w-full rounded-xl py-3 text-sm font-bold"
                    >
                      {sendingDevis
                        ? tr("Envoi…")
                        : `${tr("Envoyer le devis à")} ${partnerDisplay}`}
                    </button>
                    <p className="cl-text-muted mt-2 text-[10px] leading-relaxed">
                      {tr(
                        "Le client pourra accepter et procéder au paiement, ou rejeter votre devis.",
                      )}
                    </p>
                  </div>

                  <div className="cl-inner-card rounded-2xl p-4">
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
                      <p className="cl-text-success cl-label-tracked text-xs font-bold">
                        {tr("PLANIFIER L'INTERVENTION")}
                      </p>
                    </div>
                    <p className="cl-text-light-muted mt-2 text-xs">
                      {tr("Fixez la date et l'heure de votre intervention pour")}{" "}
                      <strong className="cl-text-primary">{partnerDisplay}</strong>.
                    </p>
                    <div className="mt-3">
                      <label className="cl-text-primary mb-1.5 block text-xs font-semibold">
                        {tr("Date")}
                      </label>
                      <div className="cl-input-field-wrapper flex items-center rounded-xl px-3 py-2.5">
                        <input
                          type="date"
                          value={scheduleDate}
                          min={todayMin}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="cl-input-field w-full bg-transparent text-sm outline-none [color-scheme:dark]"
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="cl-text-primary mb-1.5 block text-xs font-semibold">
                        {tr("Heure")}
                      </label>
                      <div className="cl-input-field-wrapper flex items-center rounded-xl px-3 py-2.5">
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="cl-input-field w-full bg-transparent text-sm outline-none [color-scheme:dark]"
                        />
                      </div>
                    </div>
                    <button
                      onClick={sendSchedule}
                      disabled={!scheduleDate || !scheduleTime || sendingSchedule}
                      className="cl-btn-action cl-btn-schedule mt-4 w-full rounded-xl py-3 text-sm font-bold"
                    >
                      {sendingSchedule
                        ? tr("Envoi…")
                        : scheduleDate && scheduleTime
                          ? `${tr("Proposer le")} ${formatScheduleShort(`${scheduleDate}T${scheduleTime}`)}`
                          : tr("Proposer une intervention")}
                    </button>
                    <p className="cl-text-muted mt-2 text-[10px] leading-relaxed">
                      {tr("Le client pourra accepter ou refuser votre proposition.")}
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
