import { useEffect, useRef, useState } from "react"
import { openChatSocket, type ChatSocket } from "../../utils/chatSocket"
import { API_BASE_URL } from "../../config"
import { sanitizeMultiline, hasSqlInjectionPattern } from "../../utils/validation"
import { useI18n } from "../../i18n"
import type { PaymentDevis } from "./C6Payment"

interface Props {
  requestId?: number
  viewerRole?: "client" | "tech"
  artisan?: {
    fullname: string
    metier?: string
  } | null
  profile?: {
    username?: string
    firstName?: string
    lastName?: string
    role?: string
    photoUrl?: string
    userId?: number
  } | null
  onPayment: (devis: PaymentDevis) => void
}

interface ChatMessage {
  id: number
  requestId: number
  senderUserId?: number
  sender: string
  text: string
  imageUrl?: string | null
  timestamp: string
  time?: string
  read?: boolean
  devisAmount?: number
  devisStatus?: string
}

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

const SYSTEM_SENDER_ID = 999999999999

function formatChatTime(iso: string, locale: string): string {
  try {
    const date = new Date(iso)
    if (isNaN(date.getTime())) return ""
    return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
  } catch {
    return ""
  }
}

export default function C5Chat({
  requestId,
  viewerRole = "client",
  artisan,
  profile,
  onPayment,
}: Props) {
  const { t, locale } = useI18n()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const socketRef = useRef<ChatSocket | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [signalingDispute, setSignalingDispute] = useState(false)
  const [disputeDone, setDisputeDone] = useState(false)
  const [sendingImage, setSendingImage] = useState(false)
  const [requestState, setRequestState] = useState<{
    status?: string
    fundsDeposited?: boolean
    fundsReleased?: boolean
  } | null>(null)
  const [releasingFunds, setReleasingFunds] = useState(false)
  const [released, setReleased] = useState(false)
  const [ratingToast, setRatingToast] = useState(false)
  const ratingToastTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (ratingToastTimer.current) window.clearTimeout(ratingToastTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!requestId) return
    let cancelled = false
    const token = localStorage.getItem("mboaTechToken")
    fetch(`${API_BASE_URL}/api/chat/requests/client`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("refresh failed"))))
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : []
        const current = list.find((item: { id?: number }) => item.id === requestId)
        if (current) {
          setRequestState({
            status: current.status,
            fundsDeposited: current.fundsDeposited,
            fundsReleased: current.fundsReleased,
          })
          if (current.fundsReleased) {
            setReleased(true)
          }
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [requestId])

  useEffect(() => {
    if (!requestId) return
    setLoading(true)
    setError(null)

    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem("mboaTechToken")
        const response = await fetch(`${API_BASE_URL}/api/chat/messages/${requestId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!response.ok) throw new Error(t("Impossible de charger l'historique de chat"))
        const data: ChatMessage[] = await response.json()
        setMessages(
          (Array.isArray(data) ? data : []).map((message) => ({
            ...message,
            time: formatChatTime(message.timestamp, locale),
          })),
        )
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : t("Erreur réseau"))
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
  }, [requestId])

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) =>
      prev.some((m) => m.id === message.id)
        ? prev
        : [...prev, { ...message, time: formatChatTime(message.timestamp, locale) }],
    )
  }

  useEffect(() => {
    if (!requestId) return
    const socket = openChatSocket(requestId, {
      onMessage: (message) => {
        appendMessage(message as ChatMessage)
      },
      onRead: (messageIds) => {
        const ids = new Set(messageIds)
        if (ids.size === 0) return
        setMessages((prev) => prev.map((m) => (ids.has(m.id) ? { ...m, read: true } : m)))
      },
      onError: (message) => setError(message),
      onReconnect: () => {
        const token = localStorage.getItem("mboaTechToken")
        fetch(`${API_BASE_URL}/api/chat/messages/${requestId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error("refresh failed"))))
          .then((data: unknown) => {
            setMessages(
              (Array.isArray(data) ? data : []).map((message) => ({
                ...(message as ChatMessage),
                time: formatChatTime((message as ChatMessage).timestamp, locale),
              })),
            )
          })
          .catch(() => {})
      },
    })
    socketRef.current = socket

    return () => {
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [requestId])

  const send = async () => {
    if (!requestId) return
    const text = sanitizeMultiline(input, 500)
    if (!text) return
    if (hasSqlInjectionPattern(text)) {
      setError(t("Ce message contient des caractères ou expressions non autorisés."))
      return
    }
    setError(null)

    if (socketRef.current && profile?.userId !== undefined) {
      const sent = socketRef.current.sendMessage({
        requestId,
        text,
        senderUserId: profile.userId,
        senderName: profile?.firstName || profile?.username || "Utilisateur",
      })
      if (sent) {
        setInput("")
        return
      }
    }

    setIsSending(true)
    const messagePayload = {
      requestId,
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
      if (!response.ok) throw new Error(t("Impossible d'envoyer le message"))
      const saved: ChatMessage = await response.json()
      setMessages((prev) =>
        prev.some((m) => m.id === saved.id)
          ? prev
          : [...prev, { ...saved, time: formatChatTime(saved.timestamp, locale) }],
      )
      setInput("")
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : t("Erreur réseau"))
    } finally {
      setIsSending(false)
    }
  }

  const artisanName = artisan?.fullname || "Artisan MboaTech"
  const artisanRole = artisan?.metier ? `${artisan.metier}` : t("Artisan")

  const canValidateWork =
    requestId != null &&
    requestState?.status === "completed" &&
    requestState?.fundsDeposited === true &&
    !released

  const releaseFunds = async () => {
    if (!requestId || releasingFunds) return
    setError(null)
    setReleasingFunds(true)
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/payments/release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ requestId }),
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
          t("Impossible de libérer les fonds (HTTP ") + `${response.status})` + detail,
        )
      }
      await response.json()
      setReleased(true)
      setError(null)
      setRatingToast(true)
      if (ratingToastTimer.current) window.clearTimeout(ratingToastTimer.current)
      ratingToastTimer.current = window.setTimeout(() => setRatingToast(false), 60000)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : t("Erreur réseau"))
    } finally {
      setReleasingFunds(false)
    }
  }

  const signalDispute = async () => {
    if (!requestId || signalingDispute) return
    setError(null)
    setSignalingDispute(true)
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/chat/request/${requestId}/dispute`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) throw new Error(t("Impossible de signaler le litige"))
      setDisputeDone(true)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : t("Erreur réseau"))
    } finally {
      setSignalingDispute(false)
    }
  }

  const sendImage = async (file: File) => {
    if (!requestId) return
    if (file.size > 2 * 1024 * 1024) {
      setError(t("La photo est trop volumineuse (2 Mo maximum)."))
      return
    }
    setError(null)
    setSendingImage(true)
    try {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      await new Promise<void>((resolve, reject) => {
        reader.onload = () => resolve()
        reader.onerror = () => reject(new Error(t("Lecture de la photo impossible")))
      })
      const imageUrl = String(reader.result || "")
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          requestId,
          sender: viewerRole === "tech" ? "tech" : "client",
          text: t("📷 Photo envoyée"),
          imageUrl,
          senderName: profile?.firstName || profile?.username || "Utilisateur",
        }),
      })
      if (!response.ok) throw new Error(t("Impossible d'envoyer la photo"))
      const saved: ChatMessage = await response.json()
      setMessages((prev) =>
        prev.some((m) => m.id === saved.id)
          ? prev
          : [...prev, { ...saved, time: formatChatTime(saved.timestamp, locale) }],
      )
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : t("Erreur réseau"))
    } finally {
      setSendingImage(false)
    }
  }

  const devisMessage = [...messages].reverse().find((m) => m.devisAmount != null) ?? null
  const devisAmount = devisMessage?.devisAmount ?? 0
  const devisAccepted = devisMessage?.devisStatus === "accepted"
  const devisRejected = devisMessage?.devisStatus === "rejected"

  const formatAmount = (value: number) =>
    new Intl.NumberFormat("fr-FR").format(Math.round(Number(value) || 0))

  const buildDevis = (message: ChatMessage): PaymentDevis => ({
    requestId,
    amount: Number(message.devisAmount) || 0,
    description: message.text || "Prestation",
    technicianName: artisanName,
    category: artisan?.metier,
  })

  const acceptAndPay = async (message: ChatMessage) => {
    setError(null)
    if (message.devisStatus === "accepted") {
      onPayment(buildDevis(message))
      return
    }
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/chat/devis/${message.id}/accept`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) throw new Error(t("Impossible d'accepter le devis"))
      const updated = (await response.json()) as ChatMessage
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? { ...m, ...updated, time: m.time } : m)),
      )
      onPayment(buildDevis(updated))
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : t("Erreur réseau"))
    }
  }

  return (
    <div className="min-h-full p-3 sm:p-6" style={{ background: "#0B1120" }}>
      {ratingToast && (
        <div
          className="fixed top-20 right-4 sm:right-6 z-50 max-w-sm w-[calc(100%-2rem)] sm:w-96 p-4 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #1E3A6A, #141C2F)",
            border: "1px solid rgba(37,99,235,0.4)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.55), 0 0 24px rgba(37,99,235,0.25)",
            animation: "fadeSlideIn 400ms ease",
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none" style={{ color: "#FBBF24" }}>
              ⭐
            </span>
            <div className="flex-1">
              <p
                className="text-sm font-bold"
                style={{ fontFamily: "Poppins, sans-serif", color: "#E8EDF5" }}
              >
                {t("Intervention terminée — donnez votre avis")}
              </p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: "#94A3B8" }}>
                {t("Vous pouvez noter")} {artisanName} {t("et laisser un commentaire. Allez sur")}{" "}
                <span style={{ color: "#93C5FD" }}>{t("Accueil & Recherche")}</span>,{" "}
                {t("ouvrez le profil du technicien, puis utilisez la section")}{" "}
                <span style={{ color: "#93C5FD" }}>{t("Votre avis")}</span>{" "}
                {t("(étoiles + commentaire). Vous ne pouvez le faire qu'une seule fois.")}
              </p>
            </div>
            <button
              onClick={() => setRatingToast(false)}
              className="flex-shrink-0 text-xs rounded-lg px-2 py-1"
              style={{ background: "#1E2A42", color: "#94A3B8" }}
            >
              {t("Fermer")}
            </button>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-[min(1400px,95%)] h-full">
        <div className="grid grid-cols-1 gap-5 h-full lg:grid-cols-[1fr_340px]">
          {/* Chat panel */}
          <div
            className="flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: "#141C2F",
              border: "1px solid rgba(255,255,255,0.06)",
              height: "65vh",
              maxHeight: "calc(100vh - 140px)",
            }}
          >
            {/* Chat header */}
            <div
              className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative flex-shrink-0">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=48&h=48&fit=crop&auto=format"
                    alt={`${artisanName} — ${t("identité vérifiée")}`}
                    className="w-11 h-11 rounded-full object-cover"
                    style={{ border: "2px solid #059669" }}
                  />
                  <span
                    className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500"
                    style={{ border: "2px solid #141C2F" }}
                  />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{
                      fontFamily: "Poppins, sans-serif",
                      color: "#E8EDF5",
                    }}
                  >
                    {artisanName}
                    <span
                      className="ml-2 text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{
                        background: "rgba(5,150,105,0.15)",
                        color: "#059669",
                      }}
                    >
                      ✓ {t("Identité vérifiée")}
                    </span>
                  </p>
                  <p className="text-xs" style={{ color: "#059669" }}>
                    {t("En ligne")} · {artisanRole}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={{
                    background: "rgba(37,99,235,0.15)",
                    color: "#93C5FD",
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full"
                    style={{ background: "#60A5FA" }}
                  />
                  {t("Temps réel")}
                </span>
                <button
                  onClick={signalDispute}
                  disabled={!requestId || signalingDispute || disputeDone || released}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{
                    background: disputeDone
                      ? "rgba(5,150,105,0.12)"
                      : released
                        ? "rgba(148,163,184,0.12)"
                        : "rgba(239,68,68,0.12)",
                    color: disputeDone ? "#34D399" : released ? "#94A3B8" : "#EF4444",
                    border: `1px solid ${
                      disputeDone
                        ? "rgba(5,150,105,0.3)"
                        : released
                          ? "rgba(148,163,184,0.3)"
                          : "rgba(239,68,68,0.25)"
                    }`,
                    cursor: !requestId || signalingDispute ? "not-allowed" : "pointer",
                  }}
                >
                  {disputeDone
                    ? `✓ ${t("Litige signalé")}`
                    : released
                      ? `✓ ${t("Fonds libérés · litige fermé")}`
                      : signalingDispute
                        ? t("Signalement en cours…")
                        : `⚠ ${t("Signaler un litige")}`}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-5 flex flex-col gap-4">
              {loading && (
                <p className="text-sm" style={{ color: "#94A3B8" }}>
                  {t("Chargement des messages...")}
                </p>
              )}
              {!loading && messages.length === 0 && (
                <p className="text-sm" style={{ color: "#94A3B8" }}>
                  {t(
                    "Aucun message pour le moment. Envoyez le premier message pour démarrer la conversation.",
                  )}
                </p>
              )}
              {messages.map((m) => {
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
                const mine = m.sender === (viewerRole === "tech" ? "tech" : "client")
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[60%] min-w-0">
                      <div
                        className="rounded-2xl px-5 py-3 break-words"
                        style={{
                          background: mine ? "#1E3A6A" : "#1E2A42",
                          borderBottomRightRadius: mine ? "4px" : undefined,
                          borderBottomLeftRadius: !mine ? "4px" : undefined,
                        }}
                      >
                        {m.imageUrl && (
                          <img
                            src={m.imageUrl}
                            alt={t("Photo partagée dans le chat")}
                            className="rounded-xl mb-3 w-full object-cover cursor-pointer"
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
                        className="text-xs mt-1 px-1"
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
            </div>

            {/* Input */}
            <div
              className="flex items-center gap-2 px-3 sm:px-6 py-4 flex-shrink-0"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) sendImage(file)
                  e.target.value = ""
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!requestId || sendingImage}
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "#1E2A42",
                  opacity: !requestId || sendingImage ? 0.5 : 1,
                  cursor: !requestId ? "not-allowed" : "pointer",
                }}
                aria-label={t("Envoyer une photo")}
              >
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
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <div
                className="flex-1 flex items-center rounded-xl px-4 py-3"
                style={{
                  background: "#1E2A42",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder={
                    requestId
                      ? t("Votre message...")
                      : t("Publiez d'abord une demande pour démarrer le chat")
                  }
                  disabled={!requestId}
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: "#E8EDF5", fontFamily: "Inter, sans-serif" }}
                />
              </div>
              <button
                onClick={send}
                disabled={!requestId || !input.trim() || isSending}
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: requestId && input.trim() ? "#2563EB" : "#1E2A42",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            {error && (
              <p className="px-6 pb-4 text-sm" style={{ color: "#F87171" }}>
                {error}
              </p>
            )}
          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-4">
            {/* Devis */}
            <div
              className="p-5 rounded-2xl"
              style={{
                background: "#141C2F",
                border: "1px solid rgba(5,150,105,0.25)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">📋</span>
                <p
                  className="text-sm font-semibold"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    color: "#E8EDF5",
                  }}
                >
                  {t("Devis")}
                </p>
                <span
                  className="ml-auto text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: devisAccepted
                      ? "rgba(5,150,105,0.15)"
                      : devisRejected
                        ? "rgba(239,68,68,0.15)"
                        : devisMessage
                          ? "rgba(245,158,11,0.15)"
                          : "rgba(148,163,184,0.12)",
                    color: devisAccepted
                      ? "#059669"
                      : devisRejected
                        ? "#EF4444"
                        : devisMessage
                          ? "#F59E0B"
                          : "#94A3B8",
                  }}
                >
                  {devisAccepted
                    ? t("Accepté")
                    : devisRejected
                      ? t("Rejeté")
                      : devisMessage
                        ? t("En attente")
                        : "—"}
                </span>
              </div>
              {devisMessage ? (
                <>
                  <div className="mb-4 p-3 rounded-xl" style={{ background: "#1E2A42" }}>
                    <p className="text-xs mb-1" style={{ color: "#94A3B8" }}>
                      {devisMessage.text}
                    </p>
                    <p className="text-2xl font-bold font-mono" style={{ color: "#E8EDF5" }}>
                      {formatAmount(devisAmount)}{" "}
                      <span className="text-sm font-normal" style={{ color: "#64748B" }}>
                        FCFA
                      </span>
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#64748B" }}>
                      {t("N° demande #")}
                      {requestId ?? "—"}
                    </p>
                  </div>
                  <button
                    onClick={() => devisMessage && acceptAndPay(devisMessage)}
                    disabled={devisRejected || !requestId}
                    className="w-full py-3.5 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, #059669, #047857)",
                      boxShadow: "0 2px 12px rgba(5,150,105,0.3)",
                      fontFamily: "Poppins, sans-serif",
                    }}
                  >
                    {devisAccepted
                      ? `🔐 ${t("Procéder au paiement sécurisé")}`
                      : devisRejected
                        ? `✖ ${t("Devis rejeté")}`
                        : `✅ ${t("Accepter le devis et payer")}`}
                  </button>
                </>
              ) : (
                <p className="text-xs" style={{ color: "#94A3B8" }}>
                  {t(
                    "Aucun devis reçu pour le moment. Le technicien vous enverra une proposition chiffrée ici.",
                  )}
                </p>
              )}
            </div>

            {/* Validation des travaux */}
            {canValidateWork && (
              <div
                className="p-5 rounded-2xl"
                style={{
                  background: "rgba(5,150,105,0.08)",
                  border: "1px solid rgba(5,150,105,0.35)",
                }}
              >
                <p
                  className="text-sm font-semibold mb-1.5"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    color: "#E8EDF5",
                  }}
                >
                  {t("Les travaux sont terminés")}
                </p>
                <p className="text-xs leading-relaxed mb-4" style={{ color: "#94A3B8" }}>
                  {t(
                    "Confirmez la fin de la prestation pour libérer les fonds en garde au technicien.",
                  )}
                </p>
                <button
                  onClick={releaseFunds}
                  disabled={releasingFunds}
                  className="w-full py-3.5 rounded-xl font-bold text-sm text-white disabled:opacity-60"
                  style={{
                    background: "linear-gradient(135deg, #059669, #047857)",
                    boxShadow: "0 2px 12px rgba(5,150,105,0.3)",
                    fontFamily: "Poppins, sans-serif",
                  }}
                >
                  {releasingFunds
                    ? t("Libération en cours…")
                    : t("Valider les travaux · libérer les fonds")}
                </button>
              </div>
            )}

            {/* Info artisan */}
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
                {t("Artisan")}
              </p>
              <div className="flex items-center gap-3 mb-3">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=48&h=48&fit=crop&auto=format"
                  alt={artisanName}
                  className="w-10 h-10 rounded-full object-cover"
                  style={{ border: "2px solid #059669" }}
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: "#E8EDF5" }}>
                    {artisanName}
                  </p>
                  <p className="text-xs" style={{ color: "#64748B" }}>
                    {artisanRole} · ⭐ 4.9
                  </p>
                </div>
              </div>
              <p className="text-xs" style={{ color: "#64748B" }}>
                ✓ {t("Identité vérifiée par MboaTech")}
                <br />✓ {t("Certifié par 5 artisans seniors")}
              </p>
            </div>

            {/* Réassurance */}
            <div
              className="p-4 rounded-2xl"
              style={{
                background: "rgba(5,150,105,0.06)",
                border: "1px solid rgba(5,150,105,0.2)",
              }}
            >
              <p className="text-xs leading-relaxed" style={{ color: "#94A3B8" }}>
                🔐 <strong style={{ color: "#059669" }}>{t("Paiement sécurisé.")}</strong>{" "}
                {t(
                  "Vos fonds sont retenus en garde et ne sont versés qu'après votre validation des travaux.",
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
