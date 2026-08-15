import { useCallback, useEffect, useRef, useState } from "react"
import { API_BASE_URL } from "../../config"
import { useI18n } from "../../i18n"
import Stagger from "../../components/animations/Stagger"
import StaggerItem from "../../components/animations/StaggerItem"
import type { PaymentAccounts } from "../client/C6Payment"
import orangeLogo from "../../../orange-money-logo-png_seeklogo-440383.png"

type WeekPoint = { day: string; value: number }
type TradeShare = { label: string; count: number; pct: number }

type LedgerItem = {
  id: number
  requestId?: number | null
  payer: string
  payee: string
  amount: number
  currency?: string
  status: string
  method: string
  typeLabel: string
  transactionRef?: string | null
  notes?: string | null
  createdAt?: string | null
}

type AdminDashboard = {
  activeUsers: number
  newUsersThisMonth: number
  ongoingChantiers: number
  requestsThisMonth: number
  heldAmount: number
  heldChantierCount: number
  openDisputes: number
  weekData: WeekPoint[]
  tradeDistribution: TradeShare[]
  weekStart: string
  weekEnd: string
}

interface Props {
  paymentsEnabled: boolean
  onTogglePayments: () => void
  paymentAccounts: PaymentAccounts
  onUpdateAccounts: (accounts: PaymentAccounts) => Promise<boolean>
}

function formatFullAmount(n: number): string {
  return `${(n ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA`
}

function formatWeekRange(start: string, end: string): string {
  if (!start || !end) return ""
  const s = new Date(start + "T00:00:00")
  const e = new Date(end + "T00:00:00")
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return ""
  const sText = s.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
  const eText = e.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  return `MboaTech Admin · Semaine du ${sText} – ${eText}`
}

function formatNow(): string {
  return new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function ledgerDate(value?: string | null): string {
  if (!value) return ""
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  const date = d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const time = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })
  return `${date} · ${time}`
}

function ledgerStatus(item: LedgerItem): { text: string; color: string; bg: string } {
  if (item.method === "refund")
    return { text: "Remboursé", color: "#059669", bg: "rgba(5,150,105,0.12)" }
  if (item.method === "payout")
    return { text: "Versé", color: "#2563EB", bg: "rgba(37,99,235,0.12)" }
  switch (item.status) {
    case "held":
      return { text: "En garde", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" }
    case "released":
      return { text: "Libéré", color: "#059669", bg: "rgba(5,150,105,0.12)" }
    case "failed":
      return { text: "Échoué", color: "#EF4444", bg: "rgba(239,68,68,0.12)" }
    default:
      return {
        text: "En attente",
        color: "#94A3B8",
        bg: "rgba(148,163,184,0.12)",
      }
  }
}

type WithdrawalItem = {
  id: number
  technicianUserId?: number
  technicianName: string
  amount: number
  method: string
  account: string
  status: string
  notes?: string | null
  createdAt?: string | null
}

function withdrawStatus(w: WithdrawalItem): { text: string; color: string; bg: string } {
  if (w.status === "paid") return { text: "Payé", color: "#059669", bg: "rgba(5,150,105,0.12)" }
  if (w.status === "rejected")
    return { text: "Rejeté", color: "#EF4444", bg: "rgba(239,68,68,0.12)" }
  return {
    text: "En attente",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
  }
}

function withdrawMethodLabel(method: string): string {
  if (method === "momo") return "MTN Mobile Money"
  if (method === "orange") return "Orange Money"
  if (method === "bank") return "Compte bancaire"
  return method
}

export default function A1Dashboard({
  paymentsEnabled,
  onTogglePayments,
  paymentAccounts,
  onUpdateAccounts,
}: Props) {
  const { t } = useI18n()
  const [data, setData] = useState<AdminDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [accounts, setAccounts] = useState<PaymentAccounts>({
    momo: "",
    orange: "",
    card: "",
  })
  const [savingAccounts, setSavingAccounts] = useState(false)
  const [accountsMsg, setAccountsMsg] = useState<string | null>(null)
  const accountsEdited = useRef(false)
  const [payments, setPayments] = useState<LedgerItem[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [releasedTotal, setReleasedTotal] = useState(0)
  const [heldTotal, setHeldTotal] = useState(0)
  const [grandTotal, setGrandTotal] = useState(0)
  const [heldByMethod, setHeldByMethod] = useState<Record<string, number>>({})
  const [totalByMethod, setTotalByMethod] = useState<Record<string, number>>({})
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([])
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(true)
  const [pendingWithdrawTotal, setPendingWithdrawTotal] = useState(0)
  const [withdrawalsMsg, setWithdrawalsMsg] = useState<string | null>(null)
  const [withdrawalsMsgOk, setWithdrawalsMsgOk] = useState(false)
  const [processingWithdrawId, setProcessingWithdrawId] = useState<number | null>(null)

  useEffect(() => {
    if (accountsEdited.current) return
    const hasServerValues = paymentAccounts.momo || paymentAccounts.orange || paymentAccounts.card
    if (hasServerValues) {
      setAccounts({
        momo: paymentAccounts.momo ?? "",
        orange: paymentAccounts.orange ?? "",
        card: paymentAccounts.card ?? "",
      })
    }
  }, [paymentAccounts])

  const handleAccountChange = (key: keyof PaymentAccounts, value: string) => {
    accountsEdited.current = true
    setAccounts((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveAccounts = async () => {
    setSavingAccounts(true)
    setAccountsMsg(null)
    const ok = await onUpdateAccounts({ ...accounts })
    setSavingAccounts(false)
    setAccountsMsg(ok ? "Enregistré" : "Échec de l'enregistrement")
  }

  const fetchDashboard = useCallback(async () => {
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) throw new Error(`Erreur (${response.status})`)
      const result: AdminDashboard = await response.json()
      setData(result)
      setError(null)
      setLastUpdate(formatNow())
    } catch (err) {
      console.error("Impossible de charger la supervision", err)
      setError(err instanceof Error ? err.message : "Impossible de charger la supervision")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 15000)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  const fetchPayments = useCallback(async () => {
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/admin/payments`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) throw new Error(`Erreur (${response.status})`)
      const result = (await response.json()) as {
        payments?: LedgerItem[]
        releasedTotal?: number
        heldTotal?: number
        grandTotal?: number
        heldByMethod?: Record<string, number>
        totalByMethod?: Record<string, number>
      }
      setPayments(Array.isArray(result?.payments) ? result.payments : [])
      setReleasedTotal(Number(result?.releasedTotal) || 0)
      setHeldTotal(Number(result?.heldTotal) || 0)
      setGrandTotal(Number(result?.grandTotal) || 0)
      setHeldByMethod(result?.heldByMethod ?? {})
      setTotalByMethod(result?.totalByMethod ?? {})
    } catch (err) {
      console.error("Impossible de charger le registre des paiements", err)
    } finally {
      setPaymentsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPayments()
    const interval = setInterval(fetchPayments, 15000)
    return () => clearInterval(interval)
  }, [fetchPayments])

  const fetchWithdrawals = useCallback(async () => {
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/admin/withdrawals`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) throw new Error(`Erreur (${response.status})`)
      const result = (await response.json()) as {
        withdrawals?: WithdrawalItem[]
        pendingTotal?: number
      }
      setWithdrawals(Array.isArray(result?.withdrawals) ? result.withdrawals : [])
      setPendingWithdrawTotal(Number(result?.pendingTotal) || 0)
    } catch (err) {
      console.error("Impossible de charger les retraits", err)
    } finally {
      setWithdrawalsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWithdrawals()
    const interval = setInterval(fetchWithdrawals, 15000)
    return () => clearInterval(interval)
  }, [fetchWithdrawals])

  const decideWithdraw = async (id: number, action: "process" | "reject") => {
    setProcessingWithdrawId(id)
    setWithdrawalsMsg(null)
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/admin/withdrawals/${id}/${action}`, {
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
        throw new Error(`Impossible de traiter le retrait (HTTP ${response.status})${detail}`)
      }
      setWithdrawalsMsgOk(action === "process")
      setWithdrawalsMsg(
        action === "process"
          ? "Retrait validé : le paiement au technicien a été enregistré."
          : "Retrait refusé : le technicien en a été informé.",
      )
      fetchWithdrawals()
      fetchPayments()
    } catch (err) {
      setWithdrawalsMsgOk(false)
      setWithdrawalsMsg(err instanceof Error ? err.message : "Erreur réseau")
    } finally {
      setProcessingWithdrawId(null)
    }
  }

  const weekData = Array.isArray(data?.weekData) ? data!.weekData : []
  const maxVal = Math.max(1, ...weekData.map((d) => Number(d.value) || 0))
  const chart = weekData
  const trades = Array.isArray(data?.tradeDistribution) ? data!.tradeDistribution : []
  const totalTradeCount = trades.reduce((sum, t) => sum + (Number(t.count) || 0), 0)

  const kpis = [
    {
      label: "Utilisateurs actifs",
      value: (data?.activeUsers ?? 0).toLocaleString("fr-FR"),
      delta: `+${data?.newUsersThisMonth ?? 0} ce mois`,
      color: "#2563EB",
    },
    {
      label: "Chantiers en cours",
      value: (data?.ongoingChantiers ?? 0).toLocaleString("fr-FR"),
      delta: `+${data?.requestsThisMonth ?? 0} ce mois`,
      color: "#059669",
    },
    {
      label: "Montant en garde",
      value: formatFullAmount(data?.heldAmount ?? 0),
      delta: `${data?.heldChantierCount ?? 0} chantiers`,
      color: "#F59E0B",
    },
    {
      label: "Litiges en cours",
      value: (data?.openDisputes ?? 0).toLocaleString("fr-FR"),
      delta: data?.openDisputes ? "à résoudre" : "aucun",
      color: "#8B5CF6",
    },
  ]

  return (
    <div className="min-h-full p-3 sm:p-6" style={{ background: "#0B1120" }}>
      <div className="mx-auto max-w-[min(1400px,95%)]">
        {/* Header */}
        <div className="flex flex-col gap-4 pb-6 mb-8 border-b border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1
                className="text-2xl font-bold"
                style={{ fontFamily: "Poppins, sans-serif", color: "#E8EDF5" }}
              >
                {t("Supervision Générale")}
              </h1>
              <p className="text-sm" style={{ color: "#64748B" }}>
                {data ? formatWeekRange(data.weekStart, data.weekEnd) : t("Chargement…")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${loading ? "bg-yellow-500" : "bg-green-500"}`}
                style={{
                  boxShadow: loading ? "0 0 6px #F59E0B" : "0 0 6px #059669",
                }}
              />
              <span className="text-xs" style={{ color: loading ? "#F59E0B" : "#059669" }}>
                {loading
                  ? t("Synchronisation…")
                  : lastUpdate
                    ? t("À jour · ") + lastUpdate
                    : t("Tous les systèmes opérationnels")}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-2xl border border-white/10 bg-[#141C2F] p-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: "#E8EDF5" }}>
                  {t("Paiements")}
                </p>
                <p className="text-xs" style={{ color: "#94A3B8" }}>
                  {t(paymentsEnabled ? "Activés" : "Désactivés")}
                </p>
              </div>
            </div>
            <button
              onClick={onTogglePayments}
              className="rounded-2xl px-5 py-3 text-sm font-semibold"
              style={{
                background: paymentsEnabled ? "#EF4444" : "#059669",
                color: "white",
              }}
            >
              {t(paymentsEnabled ? "Désactiver les paiements" : "Réactiver les paiements")}
            </button>
          </div>

          {/* Comptes de la plateforme */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "#141C2F",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    color: "#E8EDF5",
                  }}
                >
                  {t("Comptes de la plateforme")}
                </p>
                <p className="text-xs" style={{ color: "#64748B" }}>
                  {t("Numéros qui recevront et sécuriseront les fonds des clients")}
                </p>
              </div>
              {accountsMsg && (
                <span
                  className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    background:
                      accountsMsg === "Enregistré"
                        ? "rgba(5,150,105,0.15)"
                        : "rgba(239,68,68,0.15)",
                    color: accountsMsg === "Enregistré" ? "#059669" : "#EF4444",
                  }}
                >
                  {t(accountsMsg)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                [
                  { key: "momo", label: "MTN Mobile Money" },
                  { key: "orange", label: "Orange Money" },
                  { key: "card", label: "Compte bancaire (Visa/Mastercard)" },
                ] as const
              ).map((field) => (
                <div key={field.key}>
                  <p className="text-xs mb-1.5" style={{ color: "#94A3B8" }}>
                    {t(field.label)}
                  </p>
                  <input
                    value={accounts[field.key] ?? ""}
                    onChange={(e) => handleAccountChange(field.key, e.target.value)}
                    placeholder={t("Numéro du compte")}
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none"
                    style={{
                      background: "#1E2A42",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#E8EDF5",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSaveAccounts}
                disabled={savingAccounts}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #059669, #047857)",
                  fontFamily: "Poppins, sans-serif",
                }}
              >
                {savingAccounts ? t("Enregistrement…") : t("Enregistrer les numéros")}
              </button>
              <p className="text-xs" style={{ color: "#64748B" }}>
                {t("Affichés sur l'écran de paiement des clients.")}
              </p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <Stagger
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 lg:grid-cols-4"
          staggerDelay={0.09}
        >
          {kpis.map((k) => (
            <StaggerItem
              key={k.label}
              hoverY={-3}
              className="p-5 rounded-2xl"
              style={{ background: "#141C2F", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(5,150,105,0.12)",
                    color: "#059669",
                  }}
                >
                  {k.delta}
                </span>
              </div>
              <p
                className="text-2xl font-bold"
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  color: "#E8EDF5",
                }}
              >
                {k.value}
              </p>
              <p className="text-xs mt-1" style={{ color: "#64748B" }}>
                {t(k.label)}
              </p>
            </StaggerItem>
          ))}
        </Stagger>

        {/* Solde des fonds en garde par méthode de paiement */}
        <Stagger
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 lg:grid-cols-4"
          staggerDelay={0.07}
        >
          {(
            [
              {
                key: "momo",
                label: "MTN Mobile Money",
                color: "#FDB515",
                icon: (
                  <svg
                    width="120"
                    height="66"
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
                color: "#FF7900",
                icon: (
                  <img
                    src={orangeLogo}
                    alt="Orange Money"
                    className="h-16 w-auto object-contain"
                    style={{ opacity: 0.55 }}
                  />
                ),
              },
              {
                key: "card",
                label: "Compte bancaire (Visa/Mastercard)",
                color: "#2563EB",
                icon: (
                  <svg
                    width="96"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#93C5FD"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: 0.7 }}
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
          ).map((m) => (
            <StaggerItem
              key={m.key}
              hoverY={-3}
              className="relative p-5 rounded-2xl overflow-hidden"
              style={{ background: "#141C2F", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="pointer-events-none absolute -right-4 -bottom-3 opacity-[0.11]">
                {m.icon}
              </div>
              <div
                className="w-2 h-2 rounded-full mb-3 relative"
                style={{ background: m.color, boxShadow: `0 0 8px ${m.color}` }}
              />
              <p
                className="relative text-xl font-bold"
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  color: "#E8EDF5",
                }}
              >
                {formatFullAmount(totalByMethod[m.key] ?? 0)}
              </p>
              <p className="relative text-xs mt-1" style={{ color: "#64748B" }}>
                {t(m.label)}
              </p>
            </StaggerItem>
          ))}
          <StaggerItem
            hoverY={-3}
            className="p-5 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #1F2937, #141C2F)",
              border: "1px solid rgba(5,150,105,0.3)",
            }}
          >
            <div
              className="w-2 h-2 rounded-full mb-3"
              style={{ background: "#059669", boxShadow: "0 0 8px #059669" }}
            />
            <p
              className="text-xl font-bold"
              style={{
                fontFamily: "JetBrains Mono, monospace",
                color: "#34D399",
              }}
            >
              {formatFullAmount(grandTotal)}
            </p>
            <p className="text-xs mt-1" style={{ color: "#64748B" }}>
              {t("Total des transactions")}
            </p>
          </StaggerItem>
        </Stagger>

        {/* Graph + Infos */}
        <div className="grid grid-cols-1 gap-4 mb-6 lg:grid-cols-[1fr_280px]">
          {/* Chart */}
          <div
            className="p-5 rounded-2xl"
            style={{
              background: "#141C2F",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-sm font-semibold"
                style={{ fontFamily: "Poppins, sans-serif", color: "#E8EDF5" }}
              >
                {t("Demandes créées par semaine")}
              </h2>
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{ background: "rgba(37,99,235,0.12)", color: "#2563EB" }}
              >
                {t("Semaine en cours")}
              </span>
            </div>
            <div className="flex items-end gap-3" style={{ height: "160px" }}>
              {chart.map((d) => {
                const value = Number(d.value) || 0
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-xs font-mono" style={{ color: "#64748B" }}>
                      {value}
                    </span>
                    <div
                      className="w-full rounded-t-lg"
                      style={{
                        height: `${Math.max(4, (value / maxVal) * 120)}px`,
                        background:
                          value === maxVal && value > 0
                            ? "linear-gradient(to top, #2563EB, #3B82F6)"
                            : "rgba(37,99,235,0.25)",
                        transition: "height 500ms ease",
                      }}
                    />
                    <span className="text-xs" style={{ color: "#64748B" }}>
                      {d.day}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Stats side */}
          <div className="flex flex-col gap-3">
            <div
              className="flex-1 p-5 rounded-2xl"
              style={{
                background: "#141C2F",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <h2
                className="text-xs font-semibold mb-4"
                style={{
                  color: "#64748B",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {t("Répartition par métier")}
              </h2>
              {trades.length === 0 && !loading && (
                <p className="text-xs" style={{ color: "#64748B" }}>
                  {t("Aucune demande enregistrée.")}
                </p>
              )}
              {trades.slice(0, 4).map((item, index) => {
                const colors = ["#2563EB", "#059669", "#F59E0B", "#8B5CF6"]
                const color = colors[index % colors.length]
                return (
                  <div
                    key={item.label}
                    className="mb-3 rounded-xl border border-white/10 bg-[#0F172A] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#E8EDF5" }}>
                          {item.label}
                        </p>
                        <p className="text-xs" style={{ color: "#64748B" }}>
                          {item.count} {t(item.count > 1 ? "demandes" : "demande")}
                        </p>
                      </div>
                      <span
                        className="rounded-full px-2 py-1 text-xs font-semibold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {item.pct}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Alert zone */}
        <div>
          <h2
            className="text-sm font-semibold mb-3"
            style={{ fontFamily: "Poppins, sans-serif", color: "#E8EDF5" }}
          >
            {t("Zone d'alerte critique")}
          </h2>
          {!alertDismissed && data && Number(data.openDisputes) > 0 ? (
            <div
              className="p-4 rounded-2xl"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-xl"></span>
                  <div>
                    <p
                      className="text-sm font-semibold mb-0.5"
                      style={{
                        color: "#EF4444",
                        fontFamily: "Poppins, sans-serif",
                      }}
                    >
                      {data.openDisputes} {t(data.openDisputes > 1 ? "litiges en cours" : "litige en cours")}
                    </p>
                    <p className="text-xs" style={{ color: "#94A3B8" }}>
                      {data.openDisputes > 1
                        ? t("Des litiges clients restent non résolus sur la plateforme.")
                        : t("Un litige client reste non résolu sur la plateforme.")}
                      {t(" Intervention de médiation requise.")}
                    </p>
                    <p className="text-xs mt-1.5 font-mono" style={{ color: "#64748B" }}>
                      {t("source: /api/admin/dashboard · mise à jour en temps réel")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAlertDismissed(true)}
                  className="text-xs px-3 py-1.5 rounded-lg ml-4 flex-shrink-0"
                  style={{ background: "#1E2A42", color: "#94A3B8" }}
                >
                  {t("Ignorer")}
                </button>
              </div>
            </div>
          ) : (
            <div
              className="p-4 rounded-2xl"
              style={{
                background: "rgba(5,150,105,0.06)",
                border: "1px solid rgba(5,150,105,0.15)",
              }}
            >
              <div className="flex items-center gap-3">
                <span style={{ color: "#059669" }}>✓</span>
                <p className="text-sm" style={{ color: "#64748B" }}>
                  {loading
                    ? t("Vérification des systèmes…")
                    : error
                      ? t("Synchronisation en cours — ") + error
                      : t("Aucune alerte critique. Tous les systèmes fonctionnent normalement.")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Registre des paiements */}
        <div
          className="mt-8 rounded-2xl p-5"
          style={{
            background: "#141C2F",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2
                className="text-sm font-semibold"
                style={{ fontFamily: "Poppins, sans-serif", color: "#E8EDF5" }}
              >
                {t("Registre des paiements")}
              </h2>
              <p className="text-xs" style={{ color: "#64748B" }}>
                {t("Tous les mouvements d'argent : dépôts, remboursements et versements")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                style={{ background: "rgba(5,150,105,0.12)", color: "#059669" }}
              >
                {t("Total libéré : ")}
                {formatFullAmount(releasedTotal)}
              </span>
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                style={{ background: "rgba(37,99,235,0.12)", color: "#2563EB" }}
              >
                {payments.length} {t(payments.length > 1 ? "transactions" : "transaction")}
              </span>
            </div>
          </div>
          {paymentsLoading ? (
            <p className="text-sm" style={{ color: "#64748B" }}>
              {t("Chargement…")}
            </p>
          ) : payments.length === 0 ? (
            <p className="text-sm" style={{ color: "#64748B" }}>
              {t("Aucun paiement enregistré.")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left" style={{ minWidth: "760px" }}>
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider" style={{ color: "#64748B" }}>
                    <th className="pb-2 pr-3 font-semibold whitespace-nowrap">{t("Date")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("Demande")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("De → Vers")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("Type")}</th>
                    <th className="pb-2 pr-3 font-semibold text-right">{t("Montant")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("Statut")}</th>
                    <th className="pb-2 font-semibold">{t("Référence")}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const st = ledgerStatus(p)
                    return (
                      <tr
                        key={p.id}
                        className="text-sm align-top"
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <td
                          className="py-2.5 pr-3 text-xs font-mono whitespace-nowrap"
                          style={{ color: "#94A3B8" }}
                        >
                          {ledgerDate(p.createdAt)}
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap" style={{ color: "#94A3B8" }}>
                          {p.requestId ? `#${p.requestId}` : "—"}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="block" style={{ color: "#E8EDF5" }}>
                            {p.payer}
                          </span>
                          <span className="block text-xs" style={{ color: "#64748B" }}>
                            → {p.payee}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap" style={{ color: "#E8EDF5" }}>
                          {p.typeLabel}
                        </td>
                        <td
                          className="py-2.5 pr-3 text-right font-mono font-semibold whitespace-nowrap"
                          style={{ color: "#E8EDF5" }}
                        >
                          {formatFullAmount(p.amount)}
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">
                          <span
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: st.color, background: st.bg }}
                          >
                            {t(st.text)}
                          </span>
                        </td>
                        <td
                          className="py-2.5 text-xs font-mono whitespace-nowrap"
                          style={{ color: "#475569" }}
                        >
                          {p.transactionRef || "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Retraits des techniciens */}
        <div
          className="mt-8 rounded-2xl p-5"
          style={{
            background: "#141C2F",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2
                className="text-sm font-semibold"
                style={{ fontFamily: "Poppins, sans-serif", color: "#E8EDF5" }}
              >
                {t("Retraits des techniciens")}
              </h2>
              <p className="text-xs" style={{ color: "#64748B" }}>
                {t("Demande de versement du solde : effectuez le transfert manuel, puis validez ici")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                style={{
                  background: "rgba(245,158,11,0.12)",
                  color: "#F59E0B",
                }}
              >
                {t("En attente : ")}
                {formatFullAmount(pendingWithdrawTotal)}
              </span>
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                style={{ background: "rgba(37,99,235,0.12)", color: "#2563EB" }}
              >
                {withdrawals.length} {t(withdrawals.length > 1 ? "demandes" : "demande")}
              </span>
            </div>
          </div>
          {withdrawalsMsg && (
            <div
              className="mb-4 p-3 rounded-xl text-xs font-medium"
              style={{
                background: withdrawalsMsgOk ? "rgba(5,150,105,0.12)" : "rgba(239,68,68,0.12)",
                color: withdrawalsMsgOk ? "#34D399" : "#F87171",
                border: `1px solid ${
                  withdrawalsMsgOk ? "rgba(5,150,105,0.3)" : "rgba(239,68,68,0.3)"
                }`,
              }}
            >
              {t(withdrawalsMsg)}
            </div>
          )}
          {withdrawalsLoading ? (
            <p className="text-sm" style={{ color: "#64748B" }}>
              {t("Chargement…")}
            </p>
          ) : withdrawals.length === 0 ? (
            <p className="text-sm" style={{ color: "#64748B" }}>
              {t("Aucune demande de retrait enregistrée.")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left" style={{ minWidth: "820px" }}>
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider" style={{ color: "#64748B" }}>
                    <th className="pb-2 pr-3 font-semibold whitespace-nowrap">{t("Date")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("Technicien")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("Méthode")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("Compte")}</th>
                    <th className="pb-2 pr-3 font-semibold text-right">{t("Montant")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("Statut")}</th>
                    <th className="pb-2 font-semibold">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => {
                    const st = withdrawStatus(w)
                    return (
                      <tr
                        key={w.id}
                        className="text-sm align-top"
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <td
                          className="py-2.5 pr-3 text-xs font-mono whitespace-nowrap"
                          style={{ color: "#94A3B8" }}
                        >
                          {ledgerDate(w.createdAt)}
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap" style={{ color: "#E8EDF5" }}>
                          {w.technicianName}
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap" style={{ color: "#94A3B8" }}>
                          {t(withdrawMethodLabel(w.method))}
                        </td>
                        <td
                          className="py-2.5 pr-3 font-mono text-xs whitespace-nowrap"
                          style={{ color: "#94A3B8" }}
                        >
                          {w.account}
                        </td>
                        <td
                          className="py-2.5 pr-3 text-right font-mono font-semibold whitespace-nowrap"
                          style={{ color: "#E8EDF5" }}
                        >
                          {formatFullAmount(w.amount)}
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">
                          <span
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: st.color, background: st.bg }}
                          >
                            {t(st.text)}
                          </span>
                        </td>
                        <td className="py-2.5 whitespace-nowrap">
                          {w.status === "pending" ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => decideWithdraw(w.id, "process")}
                                disabled={processingWithdrawId === w.id}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white disabled:opacity-60"
                                style={{
                                  background: "linear-gradient(135deg, #059669, #047857)",
                                }}
                              >
                                {processingWithdrawId === w.id
                                  ? t("Traitement…")
                                  : t("Valider le paiement")}
                              </button>
                              <button
                                onClick={() => decideWithdraw(w.id, "reject")}
                                disabled={processingWithdrawId === w.id}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-60"
                                style={{
                                  background: "rgba(239,68,68,0.12)",
                                  color: "#F87171",
                                  border: "1px solid rgba(239,68,68,0.3)",
                                }}
                              >
                                {t("Rejeter")}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: "#475569" }}>
                              {w.notes || "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
