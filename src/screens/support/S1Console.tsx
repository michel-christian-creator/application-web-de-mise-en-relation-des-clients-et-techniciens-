import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { API_BASE_URL } from "../../config"
import { resolvePhotoUrl } from "../../utils/photoUrl"
import { useI18n } from "../../i18n"

type Person = { name: string; username: string; photoUrl: string; city: string }

type DisputeSummary = {
  requestId: number
  category: string
  description: string
  status: string
  urgency: string
  createdAt: string
  disputeOpenAt: string
  reporterRole: "client" | "technician"
  heldAmount: number
  client: Person | null
  technician: Person | null
}

type DisputeMessage = {
  id: number
  senderRole: "client" | "technician" | "system"
  senderName: string
  text: string | null
  time: string | null
  hasAttachment: boolean
  attachmentUrl: string | null
  devisAmount: number | null
  devisStatus: string | null
  scheduleAt: string | null
}

type DisputeDetail = DisputeSummary & {
  decision: string | null
  fundsDeposited: boolean
  messages: DisputeMessage[]
}

function formatAmount(n: number, locale: string): string {
  return (n ?? 0).toLocaleString(locale, { maximumFractionDigits: 0 })
}

function formatDateTime(iso: string | null, locale: string, t: (key: string) => string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  return (
    d.toLocaleDateString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) +
    " " +
    t("à") +
    " " +
    d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
  )
}

function formatDay(iso: string | null, locale: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  return (
    d.toLocaleDateString(locale, { day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
  )
}

function devisLabel(status: string | null, t: (key: string) => string): string {
  switch (status) {
    case "accepted":
      return t("Devis validé")
    case "rejected":
      return t("Devis rejeté")
    case "refunded":
      return t("Devis remboursé (décision admin)")
    case "paid":
      return t("Devis versé au technicien (décision admin)")
    case "split":
      return t("Devis partagé 50/50 (décision admin)")
    default:
      return t("Devis")
  }
}

const urgencyLabel: Record<string, string> = {
  critique: "Urgence critique",
  important: "Important",
  normal: "Normal",
}

type KycDoc = {
  id: number
  userId: number
  docType: string
  fileUrl: string
  status: string
  createdAt: string | null
  userName?: string
  username?: string
  technicianId?: number
  verified?: boolean
}

function docTypeLabel(docType: string, t: (key: string) => string): string {
  switch (docType) {
    case "id_recto":
      return t("Pièce d'identité — Recto")
    case "id_verso":
      return t("Pièce d'identité — Verso")
    case "certificate":
      return t("Certificat métier")
    case "recommendation_letter":
      return t("Lettre de recommandation")
    default:
      return docType
  }
}

function docStatusBadge(
  status: string,
  t: (key: string) => string,
): { text: string; color: string; bg: string } {
  switch (status) {
    case "validated":
      return { text: t("Validé"), color: "#059669", bg: "rgba(5,150,105,0.15)" }
    case "rejected":
      return { text: t("Rejeté"), color: "#EF4444", bg: "rgba(239,68,68,0.12)" }
    default:
      return {
        text: t("En attente"),
        color: "#F59E0B",
        bg: "rgba(245,158,11,0.12)",
      }
  }
}

function fileNameFromUrl(url: string): string {
  try {
    return decodeURIComponent(url.split("/").pop() || url)
  } catch {
    return url.split("/").pop() || url
  }
}

export default function S1Console() {
  const { t, locale } = useI18n()
  const [disputes, setDisputes] = useState<DisputeSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<DisputeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deciding, setDeciding] = useState<string | null>(null)
  const [decisionDone, setDecisionDone] = useState<string | null>(null)
  const chatRef = useRef<HTMLDivElement | null>(null)
  const [tab, setTab] = useState<"disputes" | "kyc">("disputes")
  const [kycDocs, setKycDocs] = useState<KycDoc[]>([])
  const [kycLoading, setKycLoading] = useState(true)
  const [kycError, setKycError] = useState<string | null>(null)
  const [kycBusy, setKycBusy] = useState<number | null>(null)

  const authHeaders = () => {
    const headers: Record<string, string> = {}
    const token = localStorage.getItem("mboaTechToken")
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
  }

  const fetchList = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/disputes`, {
        headers: authHeaders(),
      })
      if (!response.ok) throw new Error(`${t("Erreur")} (${response.status})`)
      const data = (await response.json()) as { disputes?: DisputeSummary[] }
      const items = data.disputes ?? []
      setDisputes(items)
      setError(null)
      setSelectedId((prev) => {
        if (prev == null) return items.length ? items[0].requestId : null
        if (items.some((d) => d.requestId === prev)) return prev
        return items.length ? items[0].requestId : null
      })
      if (decisionDone) setDecisionDone(null)
    } catch (err) {
      console.error("Impossible de charger les litiges", err)
      setError(err instanceof Error ? err.message : t("Impossible de charger les litiges"))
    } finally {
      setLoading(false)
    }
  }, [decisionDone])

  const fetchDetail = useCallback(async (requestId: number | null) => {
    if (requestId == null) {
      setDetail(null)
      return
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/disputes/${requestId}`, {
        headers: authHeaders(),
      })
      if (!response.ok) throw new Error(`${t("Erreur")} (${response.status})`)
      const data = (await response.json()) as DisputeDetail
      setDetail(data)
    } catch (err) {
      console.error("Impossible de charger le litige", err)
    }
  }, [])

  const fetchKyc = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/kyc`, {
        headers: authHeaders(),
      })
      if (!response.ok) throw new Error(`${t("Erreur")} (${response.status})`)
      const data = (await response.json()) as { documents?: KycDoc[] }
      setKycDocs(data.documents ?? [])
      setKycError(null)
    } catch (err) {
      console.error("Impossible de charger les documents KYC", err)
      setKycError(err instanceof Error ? err.message : t("Impossible de charger les documents KYC"))
    } finally {
      setKycLoading(false)
    }
  }, [])

  const reviewKyc = async (docId: number, action: "approve" | "reject") => {
    if (kycBusy != null) return
    setKycBusy(docId)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/kyc/${docId}/${action}`, {
        method: "POST",
        headers: authHeaders(),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => null)
        throw new Error(err?.message || `${t("Erreur")} (${response.status})`)
      }
      await fetchKyc()
    } catch (err) {
      console.error(err)
      setKycError(err instanceof Error ? err.message : t("Impossible de mettre à jour le document"))
    } finally {
      setKycBusy(null)
    }
  }

  useEffect(() => {
    if (tab === "kyc") fetchKyc()
  }, [tab, fetchKyc])

  useEffect(() => {
    fetchList()
    const interval = setInterval(fetchList, 15000)
    return () => clearInterval(interval)
  }, [fetchList])

  useEffect(() => {
    fetchDetail(selectedId)
  }, [selectedId, fetchDetail])

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [detail])

  const decide = async (decision: string) => {
    if (selectedId == null || deciding) return
    setDeciding(decision)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/disputes/${selectedId}/decide`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => null)
        throw new Error(err?.message || `${t("Erreur")} (${response.status})`)
      }
      setDecisionDone(decision)
      setSelectedId(null)
      setDetail(null)
      await fetchList()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : t("Impossible d'appliquer la décision"))
    } finally {
      setDeciding(null)
    }
  }

  const detailMessages = Array.isArray(detail?.messages) ? detail.messages : []
  const proofMessages = detailMessages.filter((m) => m.hasAttachment)
  const selected = disputes.find((d) => d.requestId === selectedId) ?? null
  const reporterName =
    detail?.reporterRole === "client"
      ? detail.client?.name || t("Client")
      : detail?.technician?.name || t("Technicien")

  const kycGroups = useMemo(() => {
    const groups = new Map<number, KycDoc[]>()
    for (const doc of kycDocs) {
      const list = groups.get(doc.userId) ?? []
      list.push(doc)
      groups.set(doc.userId, list)
    }
    return Array.from(groups.entries()).sort((a, b) => {
      const aTime = Math.max(...a[1].map((d) => new Date(d.createdAt ?? 0).getTime() || 0))
      const bTime = Math.max(...b[1].map((d) => new Date(d.createdAt ?? 0).getTime() || 0))
      return bTime - aTime
    })
  }, [kycDocs])

  return (
    <div className="min-h-full p-3 sm:p-6" style={{ background: "#0B1120" }}>
      <div className="mx-auto max-w-[min(1400px,95%)]">
        {/* Tab switcher */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => setTab("disputes")}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: tab === "disputes" ? "#1E3A6A" : "#141C2F",
              color: tab === "disputes" ? "#fff" : "#64748B",
              border: `1px solid ${
                tab === "disputes" ? "rgba(37,99,235,0.4)" : "rgba(255,255,255,0.06)"
              }`,
              fontFamily: "Inter, sans-serif",
            }}
          >
            ⚖ {t("Litiges")}
          </button>
          <button
            onClick={() => setTab("kyc")}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: tab === "kyc" ? "#1E3A6A" : "#141C2F",
              color: tab === "kyc" ? "#fff" : "#64748B",
              border: `1px solid ${
                tab === "kyc" ? "rgba(37,99,235,0.4)" : "rgba(255,255,255,0.06)"
              }`,
              fontFamily: "Inter, sans-serif",
            }}
          >
            🪪 {t("Vérification KYC")}
          </button>
        </div>

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "Poppins, sans-serif", color: "#E8EDF5" }}
            >
              {tab === "kyc"
                ? t("Vérification des documents KYC")
                : `${t("Console de résolution — Litige")} #${selectedId ?? "—"}`}
            </h1>
            <p className="text-sm mt-1" style={{ color: "#64748B" }}>
              {tab === "kyc"
                ? kycLoading
                  ? t("Chargement des documents…")
                  : `${kycDocs.length} ${kycDocs.length > 1 ? t("documents") : t("document")} ${
                      kycDocs.length > 1 ? t("déposés") : t("déposé")
                    } · ${t("validation de l'identité des techniciens")}`
                : detail?.disputeOpenAt
                  ? `${t("Ouvert le")} ${formatDateTime(detail.disputeOpenAt, locale, t)} · ${
                      detail.category
                    } · ${t("En cours d'arbitrage")}`
                  : loading
                    ? t("Chargement…")
                    : `${disputes.length} ${
                        disputes.length > 1 ? t("litiges") : t("litige")
                      } ${t("en cours sur la plateforme")}`}
            </p>
          </div>
          {tab !== "kyc" && (
            <span
              className="px-4 py-1.5 rounded-full text-sm font-semibold"
              style={{
                background: "rgba(245,158,11,0.12)",
                color: "#F59E0B",
                border: "1px solid rgba(245,158,11,0.3)",
              }}
            >
              {detail ? `⚠ ${t("En attente de décision")}` : t("Sélectionnez un litige")}
            </span>
          )}
        </div>

        {tab === "kyc" ? (
          <div className="flex flex-col gap-5">
            {kycLoading && kycDocs.length === 0 ? (
              <div
                className="p-10 rounded-2xl text-center"
                style={{
                  background: "#141C2F",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p className="text-sm" style={{ color: "#94A3B8" }}>
                  {t("Chargement des documents KYC…")}
                </p>
              </div>
            ) : kycError && kycDocs.length === 0 ? (
              <div
                className="p-10 rounded-2xl text-center"
                style={{
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.25)",
                }}
              >
                <p className="text-sm" style={{ color: "#EF4444" }}>
                  {kycError}
                </p>
              </div>
            ) : kycGroups.length === 0 ? (
              <div
                className="p-10 rounded-2xl text-center"
                style={{
                  background: "rgba(5,150,105,0.06)",
                  border: "1px solid rgba(5,150,105,0.15)",
                }}
              >
                <p className="text-lg" style={{ color: "#059669" }}>
                  ✓
                </p>
                <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
                  {t("Aucun document KYC déposé pour le moment.")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {kycGroups.map(([userId, docs]) => {
                  const user = docs[0]
                  const pendingCount = docs.filter((d) => d.status === "pending").length
                  const allValidated = docs.every((d) => d.status === "validated")
                  return (
                    <div
                      key={userId}
                      className="p-5 rounded-2xl"
                      style={{
                        background: "#141C2F",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <p
                            className="text-sm font-bold truncate"
                            style={{
                              fontFamily: "Poppins, sans-serif",
                              color: "#E8EDF5",
                            }}
                          >
                            {user.userName || `${t("Utilisateur")} #${userId}`}
                          </p>
                          <p className="text-xs font-mono mt-0.5" style={{ color: "#64748B" }}>
                            @{user.username || "—"}
                            {user.technicianId ? ` · ${t("Technicien")} #${user.technicianId}` : ""}
                          </p>
                        </div>
                        <span
                          className="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
                          style={
                            user.verified
                              ? {
                                  background: "rgba(5,150,105,0.15)",
                                  color: "#059669",
                                  border: "1px solid rgba(5,150,105,0.3)",
                                }
                              : {
                                  background: "rgba(245,158,11,0.12)",
                                  color: "#F59E0B",
                                  border: "1px solid rgba(245,158,11,0.3)",
                                }
                          }
                        >
                          {user.verified
                            ? `✓ ${t("Profil vérifié")}`
                            : pendingCount > 0
                              ? `${pendingCount} ${t("en attente")}`
                              : allValidated
                                ? t("Non vérifié")
                                : t("Documents incomplets")}
                        </span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {docs.map((doc) => {
                          const badge = docStatusBadge(doc.status, t)
                          const canReview = doc.status === "pending"
                          return (
                            <div
                              key={doc.id}
                              className="rounded-xl p-3 flex items-center gap-3"
                              style={{
                                background: "#1E2A42",
                                border: "1px solid rgba(255,255,255,0.06)",
                              }}
                            >
                              {doc.fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileUrl) ? (
                                <img
                                  src={resolvePhotoUrl(doc.fileUrl)}
                                  alt={docTypeLabel(doc.docType, t)}
                                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                                  style={{
                                    border: "1px solid rgba(255,255,255,0.08)",
                                  }}
                                />
                              ) : (
                                <div
                                  className="w-14 h-14 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                                  style={{ background: "#141C2F" }}
                                >
                                  📄
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p
                                  className="text-xs font-semibold truncate"
                                  style={{ color: "#E8EDF5" }}
                                >
                                  {docTypeLabel(doc.docType, t)}
                                </p>
                                <p className="text-[11px] truncate" style={{ color: "#64748B" }}>
                                  {fileNameFromUrl(doc.fileUrl)}
                                </p>
                                <span
                                  className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                  style={{
                                    color: badge.color,
                                    background: badge.bg,
                                  }}
                                >
                                  {badge.text}
                                </span>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                {doc.fileUrl && (
                                  <a
                                    href={resolvePhotoUrl(doc.fileUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                                    style={{
                                      background: "rgba(37,99,235,0.12)",
                                      color: "#60A5FA",
                                    }}
                                  >
                                    {t("Voir")}
                                  </a>
                                )}
                                {canReview && (
                                  <>
                                    <button
                                      onClick={() => reviewKyc(doc.id, "approve")}
                                      disabled={kycBusy != null}
                                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                                      style={{
                                        background: "linear-gradient(135deg, #059669, #047857)",
                                      }}
                                    >
                                      {t("Valider")}
                                    </button>
                                    <button
                                      onClick={() => reviewKyc(doc.id, "reject")}
                                      disabled={kycBusy != null}
                                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                                      style={{
                                        background: "rgba(239,68,68,0.15)",
                                        color: "#F87171",
                                      }}
                                    >
                                      {t("Rejeter")}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {kycError && kycDocs.length > 0 && (
              <p className="text-xs" style={{ color: "#F87171" }}>
                {kycError}
              </p>
            )}
          </div>
        ) : (
          <>
            {loading && disputes.length === 0 ? (
              <div
                className="p-10 rounded-2xl text-center"
                style={{
                  background: "#141C2F",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p className="text-sm" style={{ color: "#94A3B8" }}>
                  {t("Chargement des litiges en cours…")}
                </p>
              </div>
            ) : error && disputes.length === 0 ? (
              <div
                className="p-10 rounded-2xl text-center"
                style={{
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.25)",
                }}
              >
                <p className="text-sm" style={{ color: "#EF4444" }}>
                  {error}
                </p>
              </div>
            ) : disputes.length === 0 ? (
              <div
                className="p-10 rounded-2xl text-center"
                style={{
                  background: "rgba(5,150,105,0.06)",
                  border: "1px solid rgba(5,150,105,0.15)",
                }}
              >
                <p className="text-lg" style={{ color: "#059669" }}>
                  ✓
                </p>
                <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
                  {t("Aucun litige en cours. Tous les dossiers sont résolus.")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_1fr_320px]">
                {/* Col 1: Liste des litiges + dossier */}
                <div className="flex flex-col gap-4">
                  <div
                    className="p-4 rounded-2xl"
                    style={{
                      background: "#141C2F",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <h2
                      className="text-xs font-semibold mb-3"
                      style={{
                        color: "#64748B",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                      }}
                    >
                      {t("Litiges en attente")}
                    </h2>
                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                      {disputes.map((d) => (
                        <button
                          key={d.requestId}
                          onClick={() => setSelectedId(d.requestId)}
                          className="w-full text-left rounded-xl px-3 py-2.5 transition-colors"
                          style={{
                            background: selectedId === d.requestId ? "#1E3A6A" : "#0F172A",
                            border:
                              selectedId === d.requestId
                                ? "1px solid rgba(37,99,235,0.35)"
                                : "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold" style={{ color: "#E8EDF5" }}>
                              #{d.requestId} · {d.category}
                            </span>
                            <span className="text-xs font-mono" style={{ color: "#F59E0B" }}>
                              {formatAmount(d.heldAmount, locale)} F
                            </span>
                          </div>
                          <p className="text-xs truncate" style={{ color: "#94A3B8" }}>
                            {d.description}
                          </p>
                          <p className="text-[11px] mt-1" style={{ color: "#64748B" }}>
                            {formatDay(d.disputeOpenAt, locale)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selected && detail && (
                    <>
                      <div
                        className="p-5 rounded-2xl"
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
                          {t("Dossier")}
                        </h2>
                        <div className="mb-4">
                          <p className="text-xs mb-1" style={{ color: "#94A3B8" }}>
                            {t("Client")}
                          </p>
                          <p className="text-sm font-semibold" style={{ color: "#E8EDF5" }}>
                            {detail.client?.name || t("Client")}
                          </p>
                          <p className="text-xs font-mono" style={{ color: "#64748B" }}>
                            {detail.client?.username || "—"}
                          </p>
                        </div>
                        <div className="mb-4">
                          <p className="text-xs mb-1" style={{ color: "#94A3B8" }}>
                            {t("Technicien")}
                          </p>
                          <p className="text-sm font-semibold" style={{ color: "#E8EDF5" }}>
                            {detail.technician?.name || t("Non assigné")}
                          </p>
                          <p className="text-xs font-mono" style={{ color: "#64748B" }}>
                            {detail.technician?.username || "—"}
                          </p>
                        </div>
                        <div
                          className="pt-4"
                          style={{
                            borderTop: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <p className="text-xs mb-1" style={{ color: "#94A3B8" }}>
                            {t("Montant en garde")}
                          </p>
                          <p className="text-2xl font-bold font-mono" style={{ color: "#F59E0B" }}>
                            {formatAmount(detail.heldAmount, locale)}{" "}
                            <span className="text-sm font-normal" style={{ color: "#64748B" }}>
                              FCFA
                            </span>
                          </p>
                        </div>
                      </div>

                      <div
                        className="p-5 rounded-2xl"
                        style={{
                          background: "#141C2F",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <h2
                          className="text-xs font-semibold mb-3"
                          style={{
                            color: "#64748B",
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                          }}
                        >
                          {t("Réclamation")}
                        </h2>
                        <p className="text-sm leading-relaxed" style={{ color: "#94A3B8" }}>
                          "{detail.description}"
                        </p>
                        <p className="text-xs mt-2" style={{ color: "#64748B" }}>
                          {t("Signalé par")} : {reporterName} (
                          {detail.reporterRole === "client" ? t("Client") : t("Technicien")}) ·{" "}
                          {formatDay(detail.disputeOpenAt, locale)}
                        </p>
                        {detail.urgency && (
                          <span
                            className="mt-2 inline-block text-xs px-2 py-1 rounded-full"
                            style={{
                              background:
                                detail.urgency === "critique"
                                  ? "rgba(239,68,68,0.12)"
                                  : "rgba(245,158,11,0.12)",
                              color: detail.urgency === "critique" ? "#EF4444" : "#F59E0B",
                            }}
                          >
                            {urgencyLabel[detail.urgency]
                              ? t(urgencyLabel[detail.urgency])
                              : detail.urgency}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Col 2: Chat */}
                <div
                  className="rounded-2xl overflow-hidden flex flex-col"
                  style={{
                    background: "#141C2F",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="px-5 py-4"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <h2
                      className="text-xs font-semibold"
                      style={{
                        color: "#64748B",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                      }}
                    >
                      {t("Historique de la conversation (lecture seule)")}
                    </h2>
                  </div>
                  <div
                    ref={chatRef}
                    className="flex-1 overflow-y-auto p-5 flex flex-col gap-3"
                    style={{ maxHeight: "520px" }}
                  >
                    {detailMessages.length === 0 && (
                      <p className="text-xs text-center" style={{ color: "#64748B" }}>
                        {t("Aucun message échangé sur cette demande.")}
                      </p>
                    )}
                    {detailMessages.map((m) => {
                      if (m.senderRole === "system") {
                        return (
                          <div key={m.id} className="flex justify-center">
                            <div className="max-w-[85%] text-center">
                              <p className="text-[11px] mb-1" style={{ color: "#64748B" }}>
                                {m.senderName} · {formatDay(m.time, locale)}
                              </p>
                              <div
                                className="rounded-xl px-4 py-2"
                                style={{
                                  background: "#0F172A",
                                  border: "1px solid rgba(255,255,255,0.06)",
                                }}
                              >
                                <p className="text-xs" style={{ color: "#94A3B8" }}>
                                  {m.text}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      const isClient = m.senderRole === "client"
                      return (
                        <div
                          key={m.id}
                          className={`flex ${isClient ? "justify-end" : "justify-start"}`}
                        >
                          <div className="max-w-[85%] sm:max-w-[75%] min-w-0">
                            <p className="text-xs mb-1" style={{ color: "#64748B" }}>
                              {m.senderName} ({isClient ? t("client") : t("technicien")}) ·{" "}
                              {formatDay(m.time, locale)}
                            </p>
                            <div
                              className="rounded-2xl px-4 py-3 break-words"
                              style={{
                                background: isClient ? "#1E3A6A" : "#1E2A42",
                                borderBottomRightRadius: isClient ? "4px" : undefined,
                                borderBottomLeftRadius: !isClient ? "4px" : undefined,
                              }}
                            >
                              {m.hasAttachment && (
                                <div
                                  className="rounded-xl mb-2 overflow-hidden"
                                  style={{
                                    height: "120px",
                                    background: "#0B1120",
                                  }}
                                >
                                  <img
                                    src={m.attachmentUrl ?? ""}
                                    alt={t("Preuve partagée")}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              {m.devisStatus && (
                                <span
                                  className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mb-1.5"
                                  style={{
                                    background:
                                      m.devisStatus === "accepted"
                                        ? "rgba(5,150,105,0.15)"
                                        : "rgba(245,158,11,0.12)",
                                    color: m.devisStatus === "accepted" ? "#059669" : "#F59E0B",
                                  }}
                                >
                                  {devisLabel(m.devisStatus, t)} ·{" "}
                                  {formatAmount(m.devisAmount ?? 0, locale)} FCFA
                                </span>
                              )}
                              {m.text && (
                                <p className="text-sm" style={{ color: "#E8EDF5" }}>
                                  {m.text}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Col 3: Preuves + décision */}
                <div className="flex flex-col gap-4">
                  <div
                    className="p-5 rounded-2xl"
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
                      {t("Preuves partagées")}
                    </h2>
                    {proofMessages.length === 0 ? (
                      <p className="text-xs" style={{ color: "#64748B" }}>
                        Aucune pièce jointe dans la discussion.
                      </p>
                    ) : (
                      proofMessages.slice(0, 4).map((m, i) => (
                        <div key={m.id} className="mb-3">
                          <p className="text-xs mb-2" style={{ color: "#94A3B8" }}>
                            {m.senderName === detail?.client?.name || m.senderRole === "client"
                              ? "Preuve client"
                              : "Preuve technicien"}{" "}
                            · {formatDay(m.time, locale)}
                          </p>
                          <img
                            src={m.attachmentUrl ?? ""}
                            alt={`Preuve ${i + 1}`}
                            className="w-full rounded-xl object-cover"
                            style={{
                              height: "110px",
                              border: "1px solid rgba(255,255,255,0.08)",
                            }}
                          />
                        </div>
                      ))
                    )}
                  </div>

                  {!decisionDone ? (
                    <div
                      className="p-5 rounded-2xl flex flex-col gap-3"
                      style={{
                        background: "#141C2F",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <h2
                        className="text-xs font-semibold mb-1"
                        style={{
                          color: "#64748B",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                        }}
                      >
                        Décision financière
                      </h2>
                      <button
                        onClick={() => decide("client")}
                        disabled={deciding != null}
                        className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                        style={{
                          background: "linear-gradient(135deg, #DC2626, #B91C1C)",
                          boxShadow: "0 2px 12px rgba(220,38,38,0.3)",
                        }}
                      >
                        {deciding === "client"
                          ? "Traitement…"
                          : "Rembourser intégralement le client"}
                      </button>
                      <button
                        onClick={() => decide("tech")}
                        disabled={deciding != null}
                        className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                        style={{
                          background: "linear-gradient(135deg, #059669, #047857)",
                          boxShadow: "0 2px 12px rgba(5,150,105,0.3)",
                        }}
                      >
                        {deciding === "tech" ? "Traitement…" : "Verser les fonds au technicien"}
                      </button>
                      <button
                        onClick={() => decide("split")}
                        disabled={deciding != null}
                        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                        style={{
                          background: "#1E2A42",
                          color: "#94A3B8",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        {deciding === "split" ? "Traitement…" : "Partager les fonds (50/50)"}
                      </button>
                    </div>
                  ) : (
                    <div
                      className="p-5 rounded-2xl"
                      style={{
                        background:
                          decisionDone === "client"
                            ? "rgba(220,38,38,0.1)"
                            : decisionDone === "tech"
                              ? "rgba(5,150,105,0.1)"
                              : "rgba(100,116,139,0.1)",
                        border: `1px solid ${
                          decisionDone === "client"
                            ? "rgba(220,38,38,0.3)"
                            : decisionDone === "tech"
                              ? "rgba(5,150,105,0.3)"
                              : "rgba(100,116,139,0.3)"
                        }`,
                      }}
                    >
                      <p
                        className="text-sm font-bold mb-1"
                        style={{
                          color:
                            decisionDone === "client"
                              ? "#EF4444"
                              : decisionDone === "tech"
                                ? "#059669"
                                : "#94A3B8",
                          fontFamily: "Poppins, sans-serif",
                        }}
                      >
                        {decisionDone === "client"
                          ? "✓ Remboursement déclenché"
                          : decisionDone === "tech"
                            ? "✓ Fonds versés au technicien"
                            : "✓ Partage 50/50 déclenché"}
                      </p>
                      <p className="text-xs" style={{ color: "#64748B" }}>
                        Litige clôturé · notifications envoyées aux parties.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
