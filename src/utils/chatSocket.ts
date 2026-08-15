import { API_WS_BASE } from "../config"

export interface ChatMessageDto {
  id: number
  requestId: number
  senderUserId?: number
  sender?: string
  text: string
  imageUrl?: string | null
  timestamp: string
  read?: boolean
  devisAmount?: number | null
  devisStatus?: string | null
  scheduleAt?: string | null
  scheduleStatus?: string | null
}

export interface ChatSocket {
  sendMessage: (payload: {
    requestId: number
    text: string
    senderUserId: number
    senderName?: string
  }) => boolean
  sendDevis: (payload: {
    requestId: number
    amount: number
    senderUserId: number
    senderName?: string
  }) => boolean
  sendSchedule: (payload: {
    requestId: number
    scheduleAt: string
    senderUserId: number
    senderName?: string
  }) => boolean
  sendRead: (payload: { requestId: number; userId: number }) => boolean
  close: () => void
}

export function formatScheduleShort(iso: string): string {
  try {
    const [date, time] = iso.split("T")
    return `${date} à ${time ?? ""}`
  } catch {
    return iso
  }
}

export function openChatSocket(
  requestId: number,
  handlers: {
    onMessage: (message: ChatMessageDto) => void
    onRead: (messageIds: number[]) => void
    onDevis?: (message: ChatMessageDto) => void
    onSchedule?: (message: ChatMessageDto) => void
    onError?: (message: string) => void
    onReconnect?: () => void
  },
): ChatSocket {
  const token = localStorage.getItem("mboaTechToken")
  const url = `${API_WS_BASE}/ws/chat/${requestId}${token ? `?token=${encodeURIComponent(token)}` : ""}`
  let ws: WebSocket | null = null
  let closed = false
  let firstOpen = true
  let retryCount = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const onMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      if (data?.type === "message") {
        handlers.onMessage(data as ChatMessageDto)
      } else if (data?.type === "read") {
        handlers.onRead(Array.isArray(data.messageIds) ? data.messageIds : [])
      } else if (data?.type === "devis" && handlers.onDevis) {
        handlers.onDevis(data as ChatMessageDto)
      } else if (data?.type === "schedule" && handlers.onSchedule) {
        handlers.onSchedule(data as ChatMessageDto)
      } else if (data?.type === "error" && handlers.onError) {
        handlers.onError(String(data.message ?? "Erreur de chat"))
      }
    } catch {
      // ignore malformed frames
    }
  }

  const connect = () => {
    try {
      ws = new WebSocket(url)
    } catch {
      ws = null
    }
    if (!ws) return

    ws.onmessage = onMessage
    ws.onopen = () => {
      retryCount = 0
      if (!firstOpen) {
        handlers.onReconnect?.()
      }
      firstOpen = false
    }
    ws.onclose = () => {
      if (closed) return
      const delay = Math.min(1500 * 2 ** retryCount, 20000)
      retryCount += 1
      reconnectTimer = setTimeout(connect, delay)
    }
    ws.onerror = () => {
      // la fermeture suivra ; le timer de reconnexion prend le relais.
    }
  }

  connect()

  return {
    sendMessage: (payload) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "message", ...payload }))
        return true
      }
      return false
    },
    sendDevis: (payload) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "message",
            requestId: payload.requestId,
            text: `Devis de ${payload.amount} FCFA`,
            senderUserId: payload.senderUserId,
            devisAmount: payload.amount,
            senderName: payload.senderName,
          }),
        )
        return true
      }
      return false
    },
    sendSchedule: (payload) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "message",
            requestId: payload.requestId,
            text: `Intervention proposée le ${formatScheduleShort(payload.scheduleAt)}`,
            senderUserId: payload.senderUserId,
            scheduleAt: payload.scheduleAt,
            senderName: payload.senderName,
          }),
        )
        return true
      }
      return false
    },
    sendRead: (payload) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "read", ...payload }))
        return true
      }
      return false
    },
    close: () => {
      closed = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      try {
        ws?.close()
      } catch {
        // ignore
      }
    },
  }
}
