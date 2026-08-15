import React from "react"
import type { Notification } from "../hooks/useNotifications"
import { useI18n } from "../i18n"

interface Props {
  notifications: Notification[]
  onMarkAsRead: (id: string) => void
  onMarkAllRead: () => void
  onClearAll?: () => void
  onNavigate?: (notification: Notification) => void
}

const typeMeta: Record<string, { color: string; bg: string }> = {
  message: { color: "#93C5FD", bg: "rgba(37,99,235,0.16)" },
  request: { color: "#6EE7B7", bg: "rgba(5,150,105,0.16)" },
  review: { color: "#FBBF24", bg: "rgba(245,158,11,0.16)" },
  system: { color: "#94A3B8", bg: "rgba(100,116,139,0.16)" },
}

function NotificationIcon({ type }: { type: string }) {
  const stroke = (typeMeta[type] ?? typeMeta.system).color
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }
  switch (type) {
    case "message":
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )
    case "request":
      return (
        <svg {...common}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      )
    case "review":
      return (
        <svg {...common}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      )
  }
}

export default function NotificationsPanel({
  notifications,
  onMarkAsRead,
  onMarkAllRead,
  onClearAll,
  onNavigate,
}: Props) {
  const { t } = useI18n()
  const handleClick = (n: Notification) => {
    if (n.read !== true) {
      onMarkAsRead(n.id)
    }
    if (onNavigate) {
      onNavigate(n)
    }
  }
  return (
    <div
      style={{ right: 16, top: 64 }}
      className="absolute z-50 w-80 rounded-2xl border border-white/10 bg-[#0B1120] shadow-lg"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-white/5">
        <h3 className="text-sm font-semibold" style={{ color: "#E8EDF5" }}>
          Notifications
          {notifications.filter((n) => !n.read).length > 0 && (
            <span
              className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
              style={{ background: "#EF4444", color: "white" }}
            >
              {notifications.filter((n) => !n.read).length}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onMarkAllRead}
            className="text-xs px-2 py-1 rounded-md"
            style={{ background: "#1E2A42", color: "#94A3B8" }}
          >
            {t("Tout marquer lu")}
          </button>
          {onClearAll && (
            <button
              onClick={onClearAll}
              className="text-xs px-2 py-1 rounded-md"
              style={{ background: "transparent", color: "#64748B" }}
              title={t("Vider les notifications")}
            >
              {t("Vider")}
            </button>
          )}
        </div>
      </div>
      <div className="max-h-80 overflow-auto p-2">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "#1E2A42" }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748B"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 17H9a3 3 0 0 1-3-3V10a6 6 0 1 1 12 0v4a3 3 0 0 1-3 3z" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: "#94A3B8" }}>
              {t("Aucune notification")}
            </p>
            <p className="text-xs" style={{ color: "#64748B" }}>
              {t("Les nouveaux événements apparaîtront ici en temps réel.")}
            </p>
          </div>
        ) : (
          notifications.map((n) => {
            const meta = typeMeta[n.type ?? "system"] ?? typeMeta.system
            return (
              <div
                key={n.id}
                className="flex items-start gap-3 rounded-md p-3 hover:bg-white/2"
                style={{ cursor: "pointer" }}
                onClick={() => handleClick(n)}
              >
                <div className="flex-shrink-0">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={{
                      background: meta.bg,
                      border: `1px solid ${n.read ? "rgba(255,255,255,0.06)" : "transparent"}`,
                    }}
                  >
                    <NotificationIcon type={n.type ?? "system"} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium truncate" style={{ color: "#E8EDF5" }}>
                      {n.title}
                    </div>
                    <div className="flex-shrink-0 text-xs" style={{ color: "#94A3B8" }}>
                      {n.time || ""}
                    </div>
                  </div>
                  <div className="mt-0.5 text-xs leading-relaxed" style={{ color: "#94A3B8" }}>
                    {n.message}
                  </div>
                </div>
                {!n.read && (
                  <div
                    className="mt-1.5 flex-shrink-0 h-2 w-2 rounded-full"
                    style={{ background: "#3B82F6" }}
                  />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
