import { useCallback, useEffect, useState } from "react"
import orangeLogo from "../../../orange-money-logo-png_seeklogo-440383.png"
import { API_BASE_URL } from "../../config"
import { isValidAmount } from "../../utils/validation"
import { useI18n } from "../../i18n"

export type PaymentDevis = {
  requestId?: number
  amount: number
  description?: string
  technicianName?: string
  category?: string
}

export type PaymentAccounts = {
  momo?: string
  orange?: string
  card?: string
}

export type PaymentHistoryItem = {
  id: number
  requestId?: number | null
  direction: "in" | "out"
  counterparty: string
  amount: number
  currency?: string
  status: string
  method: string
  typeLabel: string
  transactionRef?: string | null
  notes?: string | null
  createdAt?: string | null
}

interface Props {
  paymentsEnabled: boolean
  onConfirm: () => void
  devis?: PaymentDevis | null
  paymentAccounts?: PaymentAccounts | null
}

function formatAmount(value: number): string {
  try {
    return new Intl.NumberFormat("fr-FR").format(value)
  } catch {
    return String(value)
  }
}

export default function C6Payment({ paymentsEnabled, onConfirm, devis, paymentAccounts }: Props) {
  const { t, locale } = useI18n()
  const [mode, setMode] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [txRef, setTxRef] = useState<string | null>(null)
  const [history, setHistory] = useState<PaymentHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [pendingInfo, setPendingInfo] = useState<{
    txRef: string | null
    paymentUrl: string
  } | null>(null)
  const [pendingStatus, setPendingStatus] = useState<"pending" | "held" | "failed">("pending")
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const token = localStorage.getItem("mboaTechToken")
        const response = await fetch(`${API_BASE_URL}/api/payments/history`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!response.ok) throw new Error(`Erreur (${response.status})`)
        const data = (await response.json()) as {
          history?: PaymentHistoryItem[]
        }
        if (!cancelled) setHistory(Array.isArray(data.history) ? data.history : [])
      } catch (err) {
        console.error("Impossible de charger l'historique", err)
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const checkPendingPayment = useCallback(async (): Promise<"pending" | "held" | "failed"> => {
    if (!pendingInfo) return "pending"
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/payments/history`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) throw new Error(`Erreur (${response.status})`)
      const data = (await response.json()) as {
        history?: PaymentHistoryItem[]
      }
      const item = (data.history ?? []).find(
        (h) =>
          h.requestId === devis?.requestId &&
          (!pendingInfo.txRef || !h.transactionRef || h.transactionRef === pendingInfo.txRef) &&
          (h.status === "held" || h.status === "failed" || h.status === "released"),
      )
      if (!item) return "pending"
      return item.status === "held" || item.status === "released" ? "held" : "failed"
    } catch {
      return "pending"
    }
  }, [pendingInfo, devis?.requestId])

  useEffect(() => {
    if (!pendingInfo) return
    let cancelled = false
    const tick = async () => {
      const status = await checkPendingPayment()
      if (!cancelled) setPendingStatus(status)
    }
    tick()
    const interval = setInterval(tick, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [pendingInfo, checkPendingPayment])

  useEffect(() => {
    if (pendingInfo && pendingStatus === "held") {
      const timer = setTimeout(() => {
        setConfirmed(true)
      }, 400)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [pendingInfo, pendingStatus])

  function formatDate(value?: string | null): string {
    if (!value) return ""
    const d = new Date(value)
    if (isNaN(d.getTime())) return value
    const date = d.toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    const time = d.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    })
    return `${date} · ${time}`
  }

  function historyStatus(item: PaymentHistoryItem): { text: string; color: string; bg: string } {
    if (item.method === "refund")
      return { text: t("Remboursé"), color: "#059669", bg: "rgba(5,150,105,0.12)" }
    if (item.method === "payout")
      return { text: t("Versé"), color: "#2563EB", bg: "rgba(37,99,235,0.12)" }
    switch (item.status) {
      case "held":
        return {
          text: t("En garde"),
          color: "#F59E0B",
          bg: "rgba(245,158,11,0.12)",
        }
      case "released":
        return { text: t("Libéré"), color: "#059669", bg: "rgba(5,150,105,0.12)" }
      case "failed":
        return { text: t("Échoué"), color: "#EF4444", bg: "rgba(239,68,68,0.12)" }
      default:
        return {
          text: t("En attente"),
          color: "#94A3B8",
          bg: "rgba(148,163,184,0.12)",
        }
    }
  }

  const paymentModes = [
    {
      key: "momo",
      label: "MTN Mobile Money",
      icon: (
        <svg
          width="40"
          height="28"
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
      detail: "+237 677 XXX XXX",
    },
    {
      key: "orange",
      label: "Orange Money",
      icon: (
        <img
          src={orangeLogo}
          alt="Orange Money"
          className="h-full w-full object-contain rounded-xl"
        />
      ),
      detail: "+237 699 XXX XXX",
    },
    {
      key: "card",
      label: t("Carte Bancaire (Visa/Mastercard)"),
      icon: "💳",
      detail: "**** **** **** 4242",
    },
  ]

  const displayNumber = (key: string): string => {
    const configured = paymentAccounts?.[key as keyof PaymentAccounts]?.trim()
    if (configured) return configured
    return paymentModes.find((m) => m.key === key)?.detail || ""
  }

  const handleConfirm = async () => {
    const allowedModes = ["momo", "orange", "card"]
    if (!devis?.requestId || !devis.amount || !mode || submitting) return
    if (!allowedModes.includes(mode) || !isValidAmount(devis.amount)) {
      setSubmitError(t("Données de paiement invalides. Vérifiez le devis et le mode de paiement."))
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const token = localStorage.getItem("mboaTechToken")
      const response = await fetch(`${API_BASE_URL}/api/payments/deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          requestId: devis.requestId,
          amount: devis.amount,
          method: mode,
        }),
      })
      if (!response.ok) {
        let detail = t("Impossible de sécuriser les fonds.")
        try {
          const data = await response.json()
          if (data?.message) detail = data.message
        } catch {
          /* garde le message par défaut */
        }
        throw new Error(detail)
      }
      const data = (await response.json()) as {
        transactionRef?: string | null
        txRef?: string | null
        status?: string
        paymentUrl?: string | null
      }
      const reference = data.txRef ?? data.transactionRef ?? null
      if (data.status === "pending") {
        if (data.paymentUrl) {
          setTxRef(reference)
          setPendingInfo({ txRef: reference, paymentUrl: data.paymentUrl })
          setPendingStatus("pending")
          const popup = window.open(data.paymentUrl, "_blank", "noopener,noreferrer")
          if (!popup) window.location.href = data.paymentUrl
          return
        }
        setSubmitError(
          t("Le paiement est en attente de confirmation. Veuillez réessayer dans un instant."),
        )
        return
      }
      setTxRef(reference)
      setConfirmed(true)
      setTimeout(() => onConfirm(), 2200)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("Impossible de sécuriser les fonds."))
    } finally {
      setSubmitting(false)
    }
  }

  const reopenPaymee = () => {
    if (!pendingInfo) return
    const popup = window.open(pendingInfo.paymentUrl, "_blank", "noopener,noreferrer")
    if (!popup) window.location.href = pendingInfo.paymentUrl
  }

  const recheckPayment = async () => {
    if (checking || !pendingInfo) return
    setChecking(true)
    try {
      const status = await checkPendingPayment()
      setPendingStatus(status)
    } finally {
      setChecking(false)
    }
  }

  const cancelPending = () => {
    setPendingInfo(null)
    setPendingStatus("pending")
  }

  if (confirmed) {
    return (
      <div
        className="min-h-full flex items-center justify-center"
        style={{ background: "#0B1120" }}
      >
        <div className="text-center max-w-md">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mx-auto mb-6"
            style={{
              background: "rgba(5,150,105,0.15)",
              border: "2px solid #059669",
            }}
          >
            🔒
          </div>
          <h2
            className="text-3xl font-bold mb-3"
            style={{ fontFamily: "Poppins, sans-serif", color: "#059669" }}
          >
            {t("Fonds sécurisés !")}
          </h2>
          <p className="text-base mb-2" style={{ color: "#94A3B8" }}>
            {devis ? `${formatAmount(devis.amount)} FCFA` : t("Vos fonds")}{" "}
            {t("sont maintenant conservés en garde par MboaTech.")}
          </p>
          <p className="text-sm" style={{ color: "#64748B" }}>
            {devis?.technicianName
              ? `${t("Artisan")} ${devis.technicianName} ${t("sera notifié et interviendra suite à votre demande.")}`
              : t("L'artisan sera notifié et interviendra suite à votre demande.")}
          </p>
          {txRef && (
            <p
              className="text-xs font-mono mt-2 px-3 py-1.5 rounded-lg inline-block"
              style={{ background: "rgba(5,150,105,0.1)", color: "#059669" }}
            >
              {t("Réf. transaction")} : {txRef}
            </p>
          )}
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto mt-8"
            style={{ borderColor: "#059669", borderTopColor: "transparent" }}
          />
        </div>
      </div>
    )
  }

  if (pendingInfo) {
    const waiting = pendingStatus === "pending"
    const failed = pendingStatus === "failed"
    return (
      <div
        className="min-h-full flex items-center justify-center p-4"
        style={{ background: "#0B1120" }}
      >
        <div
          className="w-full max-w-md rounded-2xl p-8 text-center"
          style={{
            background: "#141C2F",
            border: `1px solid ${failed ? "rgba(239,68,68,0.3)" : "rgba(37,99,235,0.3)"}`,
          }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-5"
            style={{
              background: failed ? "rgba(239,68,68,0.12)" : "rgba(37,99,235,0.12)",
              border: `2px solid ${failed ? "#EF4444" : "#2563EB"}`,
            }}
          >
            {failed ? "✕" : "💳"}
          </div>
          <h2
            className="text-2xl font-bold mb-2"
            style={{
              fontFamily: "Poppins, sans-serif",
              color: failed ? "#F87171" : "#E8EDF5",
            }}
          >
            {failed
              ? t("Paiement non confirmé")
              : waiting
                ? t("Paiement en attente de confirmation")
                : t("Paiement confirmé !")}
          </h2>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "#94A3B8" }}>
            {failed
              ? t("Le paiement Paymee a été refusé ou annulé. Aucun fonds n'a été prélevé. Vous pouvez réessayer.")
              : waiting
                ? `${t("Un onglet Paymee s'est ouvert pour finaliser")} ${formatAmount(
                    devis?.amount ?? 0,
                  )} FCFA. ${t("Dès que le paiement est confirmé, les fonds sont mis en garde automatiquement.")}`
                : t("Votre paiement a été reçu. Les fonds sont maintenant conservés en garde par MboaTech.")}
          </p>
          {txRef && (
            <p
              className="text-xs font-mono mb-4 px-3 py-1.5 rounded-lg inline-block"
              style={{ background: "rgba(37,99,235,0.1)", color: "#2563EB" }}
            >
              {t("Réf. transaction")} : {txRef}
            </p>
          )}
          {failed ? (
            <button
              onClick={cancelPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white"
              style={{
                background: "linear-gradient(135deg, #059669, #047857)",
                fontFamily: "Poppins, sans-serif",
              }}
            >
              {t("Réessayer le paiement")}
            </button>
          ) : waiting ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={recheckPayment}
                disabled={checking}
                className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                  fontFamily: "Poppins, sans-serif",
                }}
              >
                {checking ? t("Vérification…") : t("J'ai payé — vérifier")}
              </button>
              <button
                onClick={reopenPaymee}
                className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-60"
                style={{
                  background: "#1E2A42",
                  color: "#94A3B8",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {t("Rouvrir la page Paymee")}
              </button>
              <button
                onClick={cancelPending}
                className="w-full py-2 text-xs"
                style={{ color: "#64748B" }}
              >
                {t("Annuler et revenir")}
              </button>
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mt-1"
                style={{
                  borderColor: "#2563EB",
                  borderTopColor: "transparent",
                }}
              />
            </div>
          ) : (
            <div>
              <button
                onClick={() => {
                  setConfirmed(true)
                }}
                className="w-full py-3 rounded-xl font-bold text-sm text-white"
                style={{
                  background: "linear-gradient(135deg, #059669, #047857)",
                  fontFamily: "Poppins, sans-serif",
                }}
              >
                {t("Continuer")}
              </button>
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mt-3"
                style={{
                  borderColor: "#059669",
                  borderTopColor: "transparent",
                }}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full p-3 sm:p-6" style={{ background: "#0B1120" }}>
      <div className="mx-auto max-w-[min(1400px,95%)]">
        <div className="mb-8">
          <h1
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: "Poppins, sans-serif", color: "#E8EDF5" }}
          >
            {t("Paiement en garde")}
          </h1>
          <p className="text-sm" style={{ color: "#64748B" }}>
            {t("Vos fonds sont protégés jusqu'à validation des travaux")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          {/* Left */}
          <div className="flex flex-col gap-5">
            {/* Devis recap */}
            <div
              className="p-6 rounded-2xl"
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
                {t("Récapitulatif du devis")}
              </p>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p
                    className="text-base font-semibold"
                    style={{
                      color: "#E8EDF5",
                      fontFamily: "Poppins, sans-serif",
                    }}
                  >
                    {devis?.description || t("Intervention")}
                  </p>
                  <p className="text-sm mt-1" style={{ color: "#64748B" }}>
                    {t("Artisan")} {devis?.technicianName || "MboaTech"}
                    {devis?.category ? ` · ${devis.category}` : ""}
                  </p>
                </div>
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: "rgba(5,150,105,0.15)",
                    color: "#059669",
                  }}
                >
                  {t("Devis accepté")}
                </span>
              </div>
              <div className="pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-baseline gap-3">
                  <p className="text-4xl font-bold font-mono" style={{ color: "#E8EDF5" }}>
                    {devis ? formatAmount(devis.amount) : "—"}
                  </p>
                  <p className="text-base" style={{ color: "#64748B" }}>
                    FCFA
                  </p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs" style={{ color: "#64748B" }}>
                    {t("Frais de service MboaTech")}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "#059669" }}>
                    {t("0 FCFA (offerts)")}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment modes */}
            <div
              className="p-6 rounded-2xl"
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
                {t("Mode de paiement")}
              </p>
              <div className="flex flex-col gap-3">
                {paymentModes.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className="flex items-center gap-4 p-4 rounded-xl text-left"
                    style={{
                      background: mode === m.key ? "#1E3A6A" : "#1E2A42",
                      border: `1px solid ${mode === m.key ? "rgba(37,99,235,0.5)" : "transparent"}`,
                      boxShadow: mode === m.key ? "0 0 0 1px rgba(37,99,235,0.2)" : "none",
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: "#141C2F" }}
                    >
                      {typeof m.icon === "string" ? m.icon : m.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className="text-sm font-semibold"
                          style={{
                            fontFamily: "Poppins, sans-serif",
                            color: "#E8EDF5",
                          }}
                        >
                          {m.label}
                        </p>
                      </div>
                      <p className="text-xs font-mono mt-0.5" style={{ color: "#64748B" }}>
                        {displayNumber(m.key)}
                      </p>
                    </div>
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0"
                      style={{
                        border: `2px solid ${mode === m.key ? "#2563EB" : "rgba(255,255,255,0.2)"}`,
                      }}
                    >
                      {mode === m.key && (
                        <div
                          className="w-full h-full rounded-full scale-50"
                          style={{
                            background: "#2563EB",
                            transform: "scale(0.55)",
                          }}
                        />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-4">
            {/* Réassurance */}
            <div
              className="p-5 rounded-2xl"
              style={{
                background: "rgba(5,150,105,0.08)",
                border: "1px solid rgba(5,150,105,0.25)",
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0"></span>
                <div>
                  <p
                    className="text-sm font-bold mb-2"
                    style={{
                      color: "#059669",
                      fontFamily: "Poppins, sans-serif",
                    }}
                  >
                    {t("Votre argent est en sécurité")}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "#94A3B8" }}>
                    {t("MboaTech conserve vos fonds en garde sécurisée. Le paiement n'est libéré à l'artisan que lorsque")}{" "}
                    <strong style={{ color: "#E8EDF5" }}>{t("vous validez explicitement")}</strong>{" "}
                    {t("la fin et la qualité des travaux.")}
                  </p>
                </div>
              </div>
            </div>

            {/* Summary */}
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
                {t("Résumé")}
              </p>
              <div className="flex flex-col gap-2.5">
                {[
                  {
                    label: t("Montant total"),
                    value: devis ? `${formatAmount(devis.amount)} FCFA` : "—",
                    highlight: true,
                  },
                  ...(devis?.requestId
                    ? [
                        {
                          label: t("N° de demande"),
                          value: `#${devis.requestId}`,
                          highlight: false,
                        },
                      ]
                    : []),
                  { label: t("Artisan"), value: devis?.technicianName || "—" },
                  {
                    label: t("Intervention"),
                    value: devis?.description || devis?.category || "—",
                  },
                  {
                    label: t("Mode"),
                    value: mode
                      ? paymentModes.find((m) => m.key === mode)?.label || "—"
                      : t("Non sélectionné"),
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "#64748B" }}>
                      {row.label}
                    </span>
                    <span
                      className="text-xs font-medium font-mono"
                      style={{ color: row.highlight ? "#E8EDF5" : "#94A3B8" }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {!paymentsEnabled && (
              <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200 mb-4">
                {t("Les paiements sont temporairement désactivés par l'administrateur. Les transactions ne sont pas disponibles pour le moment.")}
              </div>
            )}
            {submitError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 mb-4">
                {submitError}
              </div>
            )}
            <button
              onClick={handleConfirm}
              disabled={
                !mode || !paymentsEnabled || !devis?.requestId || !devis.amount || submitting
              }
              className="w-full py-4 rounded-xl font-bold text-base text-white"
              style={{
                background: !paymentsEnabled
                  ? "#6B7280"
                  : submitting
                    ? "#1E3A6A"
                    : mode
                      ? "linear-gradient(135deg, #059669, #047857)"
                      : "#1E2A42",
                fontFamily: "Poppins, sans-serif",
                boxShadow:
                  mode && paymentsEnabled && !submitting
                    ? "0 4px 20px rgba(5,150,105,0.4)"
                    : "none",
                cursor: mode && paymentsEnabled && !submitting ? "pointer" : "not-allowed",
              }}
            >
              {submitting
                ? t("Sécurisation des fonds…")
                : paymentsEnabled
                  ? t("Sécuriser les fonds et lancer les travaux")
                  : t("Paiements désactivés")}
            </button>
          </div>
        </div>

        {/* Historique des transactions */}
        <div
          className="mt-6 p-6 rounded-2xl"
          style={{
            background: "#141C2F",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p
                className="text-sm font-semibold"
                style={{ fontFamily: "Poppins, sans-serif", color: "#E8EDF5" }}
              >
                {t("Historique de vos transactions")}
              </p>
              <p className="text-xs" style={{ color: "#64748B" }}>
                {t("Dépôts, remboursements et versements")}
              </p>
            </div>
          </div>
          {historyLoading ? (
            <p className="text-sm" style={{ color: "#64748B" }}>
              {t("Chargement…")}
            </p>
          ) : history.length === 0 ? (
            <p className="text-sm" style={{ color: "#64748B" }}>
              {t("Aucune transaction pour le moment.")}
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {history.map((item) => {
                const label = historyStatus(item)
                const incoming = item.direction === "in"
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-xl"
                    style={{
                      background: "#1E2A42",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold"
                        style={{
                          background: incoming ? "rgba(5,150,105,0.15)" : "rgba(239,68,68,0.12)",
                          color: incoming ? "#059669" : "#F87171",
                        }}
                      >
                        {incoming ? "↓" : "↑"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "#E8EDF5" }}>
                          {item.typeLabel}
                        </p>
                        <p className="text-xs truncate" style={{ color: "#64748B" }}>
                          {item.counterparty || "MboaTech"}
                          {item.requestId ? ` · ${t("Demande")} #${item.requestId}` : ""}
                        </p>
                        <p
                          className="text-[11px] font-mono mt-0.5 truncate"
                          style={{ color: "#475569" }}
                        >
                          {formatDate(item.createdAt)}
                          {item.transactionRef ? ` · ${item.transactionRef}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <p
                        className="text-sm font-bold font-mono"
                        style={{ color: incoming ? "#059669" : "#F87171" }}
                      >
                        {incoming ? "+" : "−"}
                        {formatAmount(item.amount)} FCFA
                      </p>
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: label.color, background: label.bg }}
                      >
                        {label.text}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
