import { useCallback, useEffect, useState } from "react"
import { API_BASE_URL } from "../config"

export type NotificationType = "message" | "request" | "review" | "system"

export type Notification = {
  id: string
  title: string
  message: string
  time?: string
  read?: boolean
  type?: NotificationType
  requestId?: number | null
}

type RawNotification = {
  id: number
  title?: string | null
  message?: string | null
  type?: string | null
  read?: boolean
  createdAt?: string | null
  requestId?: number | null
}

interface Options {
  requestId?: number | null
}

const MAX_NOTIFICATIONS = 15

function relativeTime(date: Date): string {
  const diff = Math.max(0, Date.now() - date.getTime())
  if (diff < 60_000) return "à l'instant"
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const token = localStorage.getItem("mboaTechToken")
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

function currentToken(): string {
  return localStorage.getItem("mboaTechToken") ?? ""
}

function normalizeType(type?: string | null): NotificationType {
  if (type === "message" || type === "request" || type === "review") {
    return type
  }
  return "system"
}

function toNotification(raw: RawNotification): Notification {
  let time = ""
  if (raw.createdAt) {
    try {
      time = relativeTime(new Date(raw.createdAt))
    } catch {
      time = ""
    }
  }
  return {
    id: String(raw.id),
    title: raw.title ?? "Notification",
    message: raw.message ?? "",
    type: normalizeType(raw.type),
    read: Boolean(raw.read),
    time,
    requestId: raw.requestId != null ? Number(raw.requestId) : null,
  }
}

export function useNotifications({ requestId = null }: Options = {}) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const refresh = useCallback(async () => {
    const tokenAtFetch = currentToken()
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: authHeaders(),
        credentials: "include",
      })
      if (!response.ok) return
      const data = (await response.json()) as {
        notifications?: RawNotification[]
      } | null
      if (tokenAtFetch !== currentToken()) return
      const items = Array.isArray(data?.notifications)
        ? data!.notifications.map(toNotification)
        : []
      setNotifications(items.slice(0, MAX_NOTIFICATIONS))
    } catch {
      // Garde l'état actuel en cas de coupure réseau.
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const interval = setInterval(refresh, 10000)
    return () => clearInterval(interval)
  }, [refresh])

  // Vide les notifications d'un compte précédent dès que le token change
  // (ex. : connexion en tant qu'admin après une session client/technicien),
  // puis recharge immédiatement avec le nouveau compte.
  useEffect(() => {
    let last = currentToken()
    const interval = setInterval(() => {
      const current = currentToken()
      if (current !== last) {
        last = current
        setNotifications([])
        refresh()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    const es = new EventSource(`${API_BASE_URL}/api/technicians/stream`, {
      withCredentials: true,
    })

    es.addEventListener("recommendation", () => refresh())
    es.addEventListener("request", () => refresh())

    es.onerror = () => {
      // Laisse EventSource se reconnecter automatiquement (pas de close()).
    }
    return () => es.close()
  }, [refresh])

  useEffect(() => {
    if (!requestId) return

    const es = new EventSource(`${API_BASE_URL}/api/chat/stream/${requestId}`, {
      withCredentials: true,
    })

    es.addEventListener("message", () => refresh())

    es.onerror = () => {
      // Laisse EventSource se reconnecter automatiquement (pas de close()).
    }
    return () => es.close()
  }, [requestId, refresh])

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    fetch(`${API_BASE_URL}/api/notifications/read/${id}`, {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {})
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    fetch(`${API_BASE_URL}/api/notifications/read-all`, {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {})
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    fetch(`${API_BASE_URL}/api/notifications`, {
      method: "DELETE",
      headers: authHeaders(),
    }).catch(() => {})
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  return { notifications, unreadCount, markAsRead, markAllRead, clearAll }
}
