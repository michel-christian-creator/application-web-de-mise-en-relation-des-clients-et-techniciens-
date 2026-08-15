import { useState, useEffect, useCallback, useRef } from "react"
import C1Auth from "./screens/client/C1Auth"
import C2Home from "./screens/client/C2Home"
import C3Profile from "./screens/client/C3Profile"
import type { Artisan } from "./screens/client/C2Home"
import C4Request from "./screens/client/C4Request"
import C5Chat from "./screens/client/C5Chat"
import C6Payment, { type PaymentDevis, type PaymentAccounts } from "./screens/client/C6Payment"
import ChatList from "./screens/chat/ChatList"
import T1Dashboard from "./screens/tech/T1Dashboard"
import T2Profile from "./screens/tech/T2Profile"
import S1Console from "./screens/support/S1Console"
import A1Dashboard from "./screens/admin/A1Dashboard"
import BellIcon from "./components/BellIcon"
import NotificationsPanel from "./components/NotificationsPanel"
import LanguageMenu from "./components/LanguageMenu"
import { useNotifications, type Notification as AppNotification } from "./hooks/useNotifications"
import { resolvePhotoUrl } from "./utils/photoUrl"
import { API_BASE_URL } from "./config"
import { useI18n } from "./i18n"

type Space = "client" | "tech" | "support" | "admin"
type UserRole = "client" | "technician" | "admin"
type UserProfile = {
  userId?: number
  username: string
  email?: string
  firstName: string
  lastName: string
  role: UserRole
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

type ClientRequest = {
  id?: number
  domain: string
  description: string
  urgence: "normal" | "important" | "critique"
  files: File[]
  photoUrl?: string
  technicianId?: number
}

const spaces: { key: Space; label: string; icon: string }[] = [
  { key: "client", label: "Espace Client", icon: "" },
  { key: "tech", label: "Espace Technicien", icon: "" },
  { key: "support", label: "Service Client", icon: "" },
  { key: "admin", label: "Administration", icon: "" },
]

const clientNav = [
  { key: "home", label: "C2 · Accueil & Recherche", short: "Accueil" },
  { key: "profile", label: "C3 · Mon profil", short: "Profil" },
  { key: "request", label: "C4 · Demande d'intervention", short: "Demande" },
  { key: "chat", label: "C5 · Chat privé", short: "Chat" },
  { key: "payment", label: "C6 · Paiement en garde", short: "Paiement" },
]

const techNav = [
  { key: "dashboard", label: "T1 · Tableau de bord", short: "Dashboard" },
  { key: "profile", label: "T2 · Mon profil", short: "Profil" },
  { key: "chat", label: "T3 · Messagerie", short: "Chat" },
]

export default function App() {
  const [space, setSpace] = useState<Space>("client")
  const [clientScreen, setClientScreen] = useState(0)
  const [techScreen, setTechScreen] = useState(0)
  const [userRole, setUserRole] = useState<UserRole>("client")
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [selectedArtisan, setSelectedArtisan] = useState<Artisan | null>(null)
  const [clientRequest, setClientRequest] = useState<ClientRequest | null>(null)
  const [paymentsEnabled, setPaymentsEnabled] = useState(true)
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccounts>({
    momo: "",
    orange: "",
    card: "",
  })
  const [focusRequestId, setFocusRequestId] = useState<number | null>(null)
  const [chatRequest, setChatRequest] = useState<{
    id: number
    name: string
    category: string
  } | null>(null)
  const [chatUnread, setChatUnread] = useState(0)
  const [paymentInfo, setPaymentInfo] = useState<PaymentDevis | null>(null)
  const { notifications, unreadCount, markAsRead, markAllRead, clearAll } = useNotifications({
    requestId: clientRequest?.id ?? chatRequest?.id ?? null,
  })

  const refreshProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem("mboaTechToken")
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
      const response = await fetch(`${API_BASE_URL}/api/profile/me`, {
        headers,
        credentials: "include",
      })
      if (!response.ok) return null
      return (await response.json()) as UserProfile & { photoUrl?: string }
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    const loadCurrentProfile = async () => {
      const profile = await refreshProfile()
      if (!profile) return
      setUserRole(profile.role)
      setUserProfile(profile)
      if (profile.role === "admin") {
        setSpace("admin")
        setTechScreen(0)
        setClientScreen(0)
      } else if (profile.role === "technician") {
        setSpace("tech")
        setTechScreen(0)
        setClientScreen(0)
      } else {
        setSpace("client")
        setClientScreen(1)
        setTechScreen(0)
      }
    }

    loadCurrentProfile()
  }, [refreshProfile])
  const [showNotifications, setShowNotifications] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [])

  const { lang, setLang, t } = useI18n()

  const refreshPaymentsSetting = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/payments`)
      if (!response.ok) return
      const data = (await response.json()) as {
        paymentsEnabled?: boolean
        accounts?: Partial<PaymentAccounts>
      }
      if (typeof data.paymentsEnabled === "boolean") {
        setPaymentsEnabled(data.paymentsEnabled)
      }
      if (data.accounts) {
        setPaymentAccounts((prev) => ({ ...prev, ...data.accounts }))
      }
    } catch {
      // Garde l'état actuel en cas de coupure réseau.
    }
  }, [])

  useEffect(() => {
    refreshPaymentsSetting()
    const interval = setInterval(refreshPaymentsSetting, 15000)
    return () => clearInterval(interval)
  }, [refreshPaymentsSetting])

  const handleTogglePayments = async () => {
    const token = localStorage.getItem("mboaTechToken")
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings/payments`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ paymentsEnabled: !paymentsEnabled }),
      })
      if (!response.ok) return
      const data = (await response.json()) as { paymentsEnabled?: boolean }
      if (typeof data.paymentsEnabled === "boolean") {
        setPaymentsEnabled(data.paymentsEnabled)
      }
    } catch {
      // Garde l'état actuel en cas de coupure réseau.
    }
  }

  const handleUpdatePaymentAccounts = async (accounts: PaymentAccounts) => {
    const token = localStorage.getItem("mboaTechToken")
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings/payments`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ paymentsEnabled, accounts }),
      })
      if (!response.ok) return false
      const data = (await response.json()) as {
        paymentsEnabled?: boolean
        accounts?: Partial<PaymentAccounts>
      }
      if (typeof data.paymentsEnabled === "boolean") {
        setPaymentsEnabled(data.paymentsEnabled)
      }
      if (data.accounts) {
        setPaymentAccounts((prev) => ({ ...prev, ...data.accounts }))
      }
      return true
    } catch {
      return false
    }
  }

  const refreshChatUnread = useCallback(async () => {
    const token = localStorage.getItem("mboaTechToken")
    if (!token) {
      setChatUnread(0)
      return
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) return
      const data = await response.json()
      setChatUnread(typeof data?.count === "number" ? data.count : 0)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!userProfile) {
      setChatUnread(0)
      return
    }
    refreshChatUnread()
    const interval = setInterval(refreshChatUnread, 3000)
    return () => clearInterval(interval)
  }, [userProfile, refreshChatUnread])

  useEffect(() => {
    if (!userProfile) return
    refreshChatUnread()
  }, [techScreen, clientScreen, userProfile, refreshChatUnread])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshChatUnread()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [refreshChatUnread])

  const handleSpaceChange = (s: Space) => {
    if (s === "tech" && userRole !== "technician") return
    if ((s === "support" || s === "admin") && userRole !== "admin") return

    setSpace(s)
    setFocusRequestId(null)
    setChatRequest(null)
    setPaymentInfo(null)
    setTechScreen(0)
    if (s === "client") {
      setClientScreen(1)
    } else {
      setClientScreen(0)
    }
  }

  const currentNav = (space === "client" ? clientNav : space === "tech" ? techNav : []).map(
    (item) => ({
      ...item,
      label: t(item.label),
      short: t(item.short),
    }),
  )
  const currentIdx = space === "client" ? clientScreen : techScreen
  const setCurrentIdx = space === "client" ? setClientScreen : setTechScreen
  const firstScreen = space === "client" ? 1 : 0
  const lastScreen = firstScreen + currentNav.length - 1

  const openClientNav = (index: number) => {
    setCurrentIdx(index)
    if (space === "client" && index === 2) {
      setSelectedArtisan(null)
    }
    if (space === "client" && index === 3) {
      setSelectedArtisan(null)
    }
  }

  const handleLogout = () => {
    const token = localStorage.getItem("mboaTechToken")
    if (token) {
      fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    localStorage.removeItem("mboaTechToken")
    localStorage.removeItem("mboaTechUser")
    localStorage.removeItem("mboaTechTechnicianId")
    setUserRole("client")
    setUserProfile(null)
    setSelectedArtisan(null)
    setClientRequest(null)
    setFocusRequestId(null)
    setChatRequest(null)
    setPaymentInfo(null)
    setSpace("client")
    setClientScreen(0)
    setTechScreen(0)
  }

  const handleAuthComplete = (role: UserRole, profile?: UserProfile) => {
    setUserRole(role)
    setUserProfile(profile ?? null)
    // Save user profile to localStorage
    if (profile) {
      localStorage.setItem("mboaTechUser", JSON.stringify(profile))
    }
    if (role === "admin") {
      setSpace("admin")
      setClientScreen(0)
      setTechScreen(0)
    } else if (role === "technician") {
      setSpace("tech")
      setClientScreen(0)
      setTechScreen(0)
    } else {
      setSpace("client")
      setClientScreen(1)
      setTechScreen(0)
    }
    setSelectedArtisan(null)
    // Recharge le profil authentique depuis le backend pour un affichage complet,
    // mais sans jamais écraser la nouvelle session avec le profil d'un ancien utilisateur.
    const expectedUsername = profile?.username
    refreshProfile().then((fetched) => {
      if (!fetched) return
      if (expectedUsername && fetched.username && fetched.username !== expectedUsername) {
        return
      }
      setUserRole(fetched.role)
      setUserProfile(fetched)
      localStorage.setItem("mboaTechUser", JSON.stringify(fetched))
    })
  }

  const handleRequestSubmit = (request: ClientRequest) => {
    setClientRequest(request)
    setClientScreen(1)
  }

  const handleProfileUpdate = (profile: UserProfile) => {
    setUserProfile((prev) => {
      const merged = prev ? { ...prev, ...profile } : profile
      localStorage.setItem("mboaTechUser", JSON.stringify(merged))
      return merged
    })
  }

  const renderContent = () => {
    if (space === "client") {
      switch (clientScreen) {
        case 0:
          return <C1Auth onNext={() => setClientScreen(1)} onAuthComplete={handleAuthComplete} />
        case 1:
          return (
            <C2Home
              searchRequest={clientRequest}
              onSelectArtisan={(artisan) => {
                setSelectedArtisan(artisan)
                setClientScreen(2)
              }}
            />
          )
        case 2:
          return (
            <C3Profile
              profile={userProfile}
              artisan={selectedArtisan}
              onBack={() => setClientScreen(1)}
              onRequest={() => setClientScreen(3)}
              onUpdateProfile={handleProfileUpdate}
            />
          )
        case 3:
          return (
            <C4Request
              artisan={selectedArtisan}
              domain={selectedArtisan?.metier ?? clientRequest?.domain ?? userProfile?.domain ?? ""}
              isSelf={
                !!userProfile?.technicianId && userProfile.technicianId === selectedArtisan?.id
              }
              onSessionExpired={() => setClientScreen(0)}
              onSubmit={handleRequestSubmit}
            />
          )
        case 4:
          return (
            <ChatList
              role="client"
              myUserId={userProfile?.userId}
              focusRequestId={chatRequest?.id ?? null}
              profile={userProfile}
              onPayment={(devis) => {
                setPaymentInfo(devis)
                setClientScreen(5)
              }}
              onUnreadChange={setChatUnread}
            />
          )
        case 5:
          return (
            <C6Payment
              paymentsEnabled={paymentsEnabled}
              devis={paymentInfo}
              paymentAccounts={paymentAccounts}
              onConfirm={() => setClientScreen(1)}
            />
          )
        case 6:
          return chatRequest ? (
            <C5Chat
              requestId={chatRequest.id}
              viewerRole="client"
              artisan={{
                fullname: chatRequest.name,
                metier: chatRequest.category,
              }}
              profile={userProfile}
              onPayment={(devis) => {
                setPaymentInfo(devis)
                setClientScreen(5)
              }}
            />
          ) : (
            <C4Request
              artisan={selectedArtisan}
              domain={selectedArtisan?.metier ?? clientRequest?.domain ?? userProfile?.domain ?? ""}
              isSelf={
                !!userProfile?.technicianId && userProfile.technicianId === selectedArtisan?.id
              }
              onSessionExpired={() => setClientScreen(0)}
              onSubmit={handleRequestSubmit}
            />
          )
      }
    }
    if (space === "tech") {
      switch (techScreen) {
        case 0:
          return (
            <T1Dashboard
              focusRequestId={focusRequestId}
              onOpenChat={(req) => {
                setChatRequest({
                  id: req.id,
                  name: req.clientName,
                  category: req.category,
                })
                setFocusRequestId(req.id)
                setTechScreen(3)
              }}
            />
          )
        case 1:
          return <T2Profile profile={userProfile} onUpdateProfile={handleProfileUpdate} />
        case 2:
          return (
            <ChatList
              role="tech"
              myUserId={userProfile?.userId}
              profile={userProfile}
              onUnreadChange={setChatUnread}
            />
          )
        case 3:
          return chatRequest ? (
            <ChatList
              role="tech"
              myUserId={userProfile?.userId}
              focusRequestId={chatRequest.id}
              direct
              onBack={() => setTechScreen(0)}
              profile={userProfile}
              onUnreadChange={setChatUnread}
            />
          ) : (
            <T1Dashboard
              focusRequestId={focusRequestId}
              onOpenChat={(req) => {
                setChatRequest({
                  id: req.id,
                  name: req.clientName,
                  category: req.category,
                })
                setFocusRequestId(req.id)
                setTechScreen(3)
              }}
            />
          )
      }
    }
    if (space === "support") return <S1Console />
    if (space === "admin")
      return (
        <A1Dashboard
          paymentsEnabled={paymentsEnabled}
          paymentAccounts={paymentAccounts}
          onTogglePayments={handleTogglePayments}
          onUpdateAccounts={handleUpdatePaymentAccounts}
        />
      )
    return null
  }

  const toggleNotifications = () => setShowNotifications((v) => !v)

  const handleNotificationClick = (notification: AppNotification) => {
    setShowNotifications(false)
    const requestId = notification.requestId ?? null
    if (userRole === "admin") {
      setSpace(
        notification.type === "message" || notification.type === "request" ? "support" : "admin",
      )
      return
    }
    if (notification.type === "review") {
      if (userRole === "technician") {
        setSpace("tech")
        setTechScreen(1)
      } else {
        setSpace("client")
        setClientScreen(2)
      }
      return
    }
    if (userRole === "technician") {
      setSpace("tech")
      if (notification.type === "message" && requestId) {
        setChatRequest({ id: requestId, name: "", category: "" })
        setFocusRequestId(requestId)
        setTechScreen(3)
      } else {
        setTechScreen(0)
        setFocusRequestId(requestId)
      }
      return
    }
    if (requestId) {
      setChatRequest({ id: requestId, name: "", category: "" })
      setSpace("client")
      setClientScreen(notification.type === "message" ? 6 : 4)
    } else {
      setSpace("client")
      setClientScreen(1)
    }
  }

  const hasSubNav = space === "client" || space === "tech"
  const showGlobalHeader = !(space === "client" && clientScreen === 0)
  const visibleSpaces = spaces
    .filter((s) => {
      if (s.key === "tech") return userRole === "technician"
      if (s.key === "support" || s.key === "admin") return userRole === "admin"
      return true
    })
    .map((s) => ({ ...s, label: t(s.label) }))

  const navPills = currentNav.map((item, i) => {
    if (item.key === "profile" && space === "client") return null
    const showUnread = item.key === "chat" && chatUnread > 0
    return (
      <button
        key={i}
        onClick={() => openClientNav(firstScreen + i)}
        className="relative rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap"
        style={{
          background: currentIdx === firstScreen + i ? "#141C2F" : "transparent",
          color: currentIdx === firstScreen + i ? "#E8EDF5" : "#64748B",
          border:
            currentIdx === firstScreen + i
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid transparent",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {item.short}
        {showUnread && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-semibold text-white">
            {chatUnread > 99 ? "99+" : chatUnread}
          </span>
        )}
      </button>
    )
  })

  const accountArea = (
    <>
      <div className="flex items-center gap-2">
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={toggleNotifications}
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#141C2F] text-slate-100"
            style={{ boxShadow: "inset 0 1px 2px rgba(255,255,255,0.04)" }}
            aria-label="Notifications"
          >
            <BellIcon className="h-5 w-5 text-slate-100" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-[11px] font-semibold text-white">
                {unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <NotificationsPanel
              notifications={notifications}
              onMarkAsRead={(id) => markAsRead(id)}
              onMarkAllRead={() => markAllRead()}
              onClearAll={() => clearAll()}
              onNavigate={handleNotificationClick}
            />
          )}
        </div>
        <div className="hidden sm:flex flex-col text-right text-xs leading-tight">
          <span className="font-semibold" style={{ color: "#E8EDF5" }}>
            {userProfile?.firstName || userProfile?.username || "Utilisateur"}
          </span>
          <span style={{ color: "#94A3B8" }}>
            {userProfile
              ? userProfile.role === "technician"
                ? t("Technicien")
                : userProfile.role === "admin"
                  ? t("Administrateur")
                  : t("Client")
              : t("Connectez-vous")}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setSpace("client")
            setClientScreen(2) // open profile (C3Profile)
            setTechScreen(0)
            setSelectedArtisan(null)
          }}
          className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#141C2F] text-slate-100"
          style={{ boxShadow: "inset 0 1px 2px rgba(255,255,255,0.04)" }}
        >
          {userProfile?.photoUrl ? (
            <img
              src={resolvePhotoUrl(userProfile.photoUrl)}
              alt="Photo de profil"
              className="h-full w-full object-cover"
            />
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z"
                stroke="#E8EDF5"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 20C4 16.6863 6.68629 14 10 14H14C17.3137 14 20 16.6863 20 20"
                stroke="#E8EDF5"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
      <button
        onClick={handleLogout}
        className="w-full rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap sm:w-auto"
        style={{
          background: "#1E2A42",
          color: "#E8EDF5",
          border: "1px solid rgba(255,255,255,0.08)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {t("Log out")}
      </button>
    </>
  )

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#070D1A] text-slate-100">
      {showGlobalHeader && (
        <header className="flex-shrink-0 border-b border-white/10 bg-[#0B1120]">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                  <path
                    d="M8 24V14l8-6 8 6v10"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M13 24v-5h6v5"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="24" cy="10" r="4" fill="#059669" />
                  <path
                    d="M22.5 10l1.2 1.2L25.5 8.5"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span
                className="text-sm font-bold"
                style={{ fontFamily: "Poppins, sans-serif", color: "#E8EDF5" }}
              >
                MboaTech
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {visibleSpaces.map((s) => (
                <button
                  key={s.key}
                  onClick={() => handleSpaceChange(s.key)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap sm:px-4"
                  style={{
                    background: space === s.key ? "#1E3A6A" : "transparent",
                    color: space === s.key ? "#fff" : "#64748B",
                    border:
                      space === s.key ? "1px solid rgba(37,99,235,0.35)" : "1px solid transparent",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>

            {hasSubNav && (
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {navPills}
                <LanguageMenu />
                {accountArea}
              </div>
            )}
            {!hasSubNav && (
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <LanguageMenu />
                {accountArea}
              </div>
            )}
          </div>
        </header>
      )}

      <main
        className={
          showGlobalHeader
            ? "flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6"
            : "flex-1 overflow-hidden"
        }
      >
        <div
          className={
            showGlobalHeader
              ? "mx-auto flex w-full max-w-[min(1400px,95%)] flex-col"
              : "flex h-full w-full flex-col"
          }
        >
          {renderContent()}
        </div>
      </main>
    </div>
  )
}
