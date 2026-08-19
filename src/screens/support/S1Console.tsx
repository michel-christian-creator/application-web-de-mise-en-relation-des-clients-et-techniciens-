import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { API_BASE_URL } from "../../config"
import { resolvePhotoUrl } from "../../utils/photoUrl"
import { useI18n } from "../../i18n"
import "./S1Console.css"

const resolveKycUrl = (url: string): string => {
  const resolved = resolvePhotoUrl(url)
  if (resolved.includes("/api/kyc/file/")) {
    const token = localStorage.getItem("mboaTechToken")
    if (token) return `${resolved}${resolved.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
  }
  return resolved
}

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
    <div className="console-root min-h-full p-3 sm:p-6">
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
            <h1 className="console-heading text-2xl font-bold">
              {tab === "kyc"
                ? t("Vérification des documents KYC")
                : `${t("Console de résolution — Litige")} #${selectedId ?? "—"}`}
            </h1>
            <p className="console-text-muted text-sm mt-1">
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
            <span className="console-badge-warning px-4 py-1.5 rounded-full text-sm font-semibold">
              {detail ? `⚠ ${t("En attente de décision")}` : t("Sélectionnez un litige")}
            </span>
          )}
        </div>

        {tab === "kyc" ? (
          <div className="flex flex-col gap-5">
            {kycLoading && kycDocs.length === 0 ? (
              <div className="console-status-loading p-10 rounded-2xl text-center">
                <p className="console-text-secondary text-sm">
                  {t("Chargement des documents KYC…")}
                </p>
              </div>
            ) : kycError && kycDocs.length === 0 ? (
              <div className="console-status-error p-10 rounded-2xl text-center">
                <p className="console-text-danger text-sm">
                  {kycError}
                </p>
              </div>
            ) : kycGroups.length === 0 ? (
              <div className="console-status-success p-10 rounded-2xl text-center">
                <p className="console-text-success text-lg">
                  ✓
                </p>
                <p className="console-text-secondary text-sm mt-1">
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
                      className="console-card p-5 rounded-2xl"
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <p className="console-heading text-sm font-bold truncate">
                            {user.userName || `${t("Utilisateur")} #${userId}`}
                          </p>
                          <p className="console-text-muted text-xs font-mono mt-0.5">
                            @{user.username || "—"}
                            {user.technicianId ? ` · ${t("Technicien")} #${user.technicianId}` : ""}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${
                            user.verified ? "console-badge-success" : "console-badge-pending"
                          }`}
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
                              className="console-card-inner rounded-xl p-3 flex items-center gap-3"
                            >
                              {doc.fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileUrl) ? (
                                <img
                                  src={resolveKycUrl(doc.fileUrl)}
                                  alt={docTypeLabel(doc.docType, t)}
                                  className="console-img-thumb w-14 h-14 rounded-lg object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="console-card w-14 h-14 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                                  📄
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="console-text-primary text-xs font-semibold truncate">
                                  {docTypeLabel(doc.docType, t)}
                                </p>
                                <p className="console-text-muted text-[11px] truncate">
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
                                    href={resolveKycUrl(doc.fileUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="console-btn-link text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                                  >
                                    {t("Voir")}
                                  </a>
                                )}
                                {canReview && (
                                  <>
                                    <button
                                      onClick={() => reviewKyc(doc.id, "approve")}
                                      disabled={kycBusy != null}
                                      className="console-btn-approve text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                                    >
                                      {t("Valider")}
                                    </button>
                                    <button
                                      onClick={() => reviewKyc(doc.id, "reject")}
                                      disabled={kycBusy != null}
                                      className="console-text-error console-card-inner text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
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
              <p className="console-text-error text-xs">
                {kycError}
              </p>
            )}
          </div>
        ) : (
          <>
            {loading && disputes.length === 0 ? (
              <div className="console-status-loading p-10 rounded-2xl text-center">
                <p className="console-text-secondary text-sm">
                  {t("Chargement des litiges en cours…")}
                </p>
              </div>
            ) : error && disputes.length === 0 ? (
              <div className="console-status-error p-10 rounded-2xl text-center">
                <p className="console-text-danger text-sm">
                  {error}
                </p>
              </div>
            ) : disputes.length === 0 ? (
              <div className="console-status-success p-10 rounded-2xl text-center">
                <p className="console-text-success text-lg">
                  ✓
                </p>
                <p className="console-text-secondary text-sm mt-1">
                  {t("Aucun litige en cours. Tous les dossiers sont résolus.")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_1fr_320px]">
                <div className="flex flex-col gap-4">
                  <div className="console-card p-4 rounded-2xl">
                    <h2 className="console-section-heading text-xs font-semibold mb-3">
                      {t("Litiges en attente")}
                    </h2>
                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                      {disputes.map((d) => (
                        <button
                          key={d.requestId}
                          onClick={() => setSelectedId(d.requestId)}
                          className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors ${
                            selectedId === d.requestId
                              ? "bg-[#1E3A6A] border border-blue-500/35"
                              : "bg-[#0F172A] border border-white/8"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="console-text-primary text-sm font-semibold">
                              #{d.requestId} · {d.category}
                            </span>
                            <span className="console-text-warning text-xs font-mono">
                              {formatAmount(d.heldAmount, locale)} F
                            </span>
                          </div>
                          <p className="console-text-secondary text-xs truncate">
                            {d.description}
                          </p>
                          <p className="console-text-muted text-[11px] mt-1">
                            {formatDay(d.disputeOpenAt, locale)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selected && detail && (
                    <>
                      <div className="console-card p-5 rounded-2xl">
                        <h2 className="console-section-heading text-xs font-semibold mb-4">
                          {t("Dossier")}
                        </h2>
                        <div className="mb-4">
                          <p className="console-text-secondary text-xs mb-1">
                            {t("Client")}
                          </p>
                          <p className="console-text-primary text-sm font-semibold">
                            {detail.client?.name || t("Client")}
                          </p>
                          <p className="console-text-muted text-xs font-mono">
                            {detail.client?.username || "—"}
                          </p>
                        </div>
                        <div className="mb-4">
                          <p className="console-text-secondary text-xs mb-1">
                            {t("Technicien")}
                          </p>
                          <p className="console-text-primary text-sm font-semibold">
                            {detail.technician?.name || t("Non assigné")}
                          </p>
                          <p className="console-text-muted text-xs font-mono">
                            {detail.technician?.username || "—"}
                          </p>
                        </div>
                        <div className="console-divider pt-4">
                          <p className="console-text-secondary text-xs mb-1">
                            {t("Montant en garde")}
                          </p>
                          <p className="console-text-warning text-2xl font-bold font-mono">
                            {formatAmount(detail.heldAmount, locale)}{" "}
                            <span className="console-text-muted text-sm font-normal">
                              FCFA
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="console-card p-5 rounded-2xl">
                        <h2 className="console-section-heading text-xs font-semibold mb-3">
                          {t("Réclamation")}
                        </h2>
                        <p className="console-text-secondary text-sm leading-relaxed">
                          "{detail.description}"
                        </p>
                        <p className="console-text-muted text-xs mt-2">
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

                <div className="console-card rounded-2xl overflow-hidden flex flex-col">
                  <div className="console-divider-bottom px-5 py-4">
                    <h2 className="console-section-heading text-xs font-semibold">
                      {t("Historique de la conversation (lecture seule)")}
                    </h2>
                  </div>
                  <div
                    ref={chatRef}
                    className="flex-1 overflow-y-auto p-5 flex flex-col gap-3"
                    style={{ maxHeight: "520px" }}
                  >
                    {detailMessages.length === 0 && (
                      <p className="console-text-muted text-xs text-center">
                        {t("Aucun message échangé sur cette demande.")}
                      </p>
                    )}
                    {detailMessages.map((m) => {
                      if (m.senderRole === "system") {
                        return (
                          <div key={m.id} className="flex justify-center">
                            <div className="max-w-[85%] text-center">
                              <p className="console-text-muted text-[11px] mb-1">
                                {m.senderName} · {formatDay(m.time, locale)}
                              </p>
                              <div className="console-message-system rounded-xl px-4 py-2">
                                <p className="console-text-secondary text-xs">
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
                            <p className="console-text-muted text-xs mb-1">
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
                                <div className="console-root rounded-xl mb-2 overflow-hidden" style={{ height: "120px" }}>
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
                                <p className="console-text-primary text-sm">
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

                <div className="flex flex-col gap-4">
                  <div className="console-card p-5 rounded-2xl">
                    <h2 className="console-section-heading text-xs font-semibold mb-4">
                      {t("Preuves partagées")}
                    </h2>
                    {proofMessages.length === 0 ? (
                      <p className="console-text-muted text-xs">
                        {t("Aucune pièce jointe dans la discussion.")}
                      </p>
                    ) : (
                      proofMessages.slice(0, 4).map((m, i) => (
                        <div key={m.id} className="mb-3">
                          <p className="console-text-secondary text-xs mb-2">
                            {m.senderName === detail?.client?.name || m.senderRole === "client"
                              ? t("Preuve client")
                              : t("Preuve technicien")}{" "}
                            · {formatDay(m.time, locale)}
                          </p>
                          <img
                            src={m.attachmentUrl ?? ""}
                            alt={`Preuve ${i + 1}`}
                            className="console-img-proof w-full rounded-xl object-cover"
                          />
                        </div>
                      ))
                    )}
                  </div>

                  {!decisionDone ? (
                    <div className="console-card p-5 rounded-2xl flex flex-col gap-3">
                      <h2 className="console-section-heading text-xs font-semibold mb-1">
                        {t("Décision financière")}
                      </h2>
                      <button
                        onClick={() => decide("client")}
                        disabled={deciding != null}
                        className="console-btn-refund w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                      >
                        {deciding === "client"
                          ? t("Traitement…")
                          : t("Rembourser intégralement le client")}
                      </button>
                      <button
                        onClick={() => decide("tech")}
                        disabled={deciding != null}
                        className="console-btn-tech w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                      >
                        {deciding === "tech" ? t("Traitement…") : t("Verser les fonds au technicien")}
                      </button>
                      <button
                        onClick={() => decide("split")}
                        disabled={deciding != null}
                        className="console-btn-split w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                      >
                        {deciding === "split" ? t("Traitement…") : t("Partager les fonds (50/50)")}
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
                        className="console-heading text-sm font-bold mb-1"
                        style={{
                          color:
                            decisionDone === "client"
                              ? "#EF4444"
                              : decisionDone === "tech"
                                ? "#059669"
                                : "#94A3B8",
                        }}
                      >
                        {decisionDone === "client"
                          ? t("✓ Remboursement déclenché")
                          : decisionDone === "tech"
                            ? t("✓ Fonds versés au technicien")
                            : t("✓ Partage 50/50 déclenché")}
                      </p>
                      <p className="console-text-muted text-xs">
                        {t("Litige clôturé · notifications envoyées aux parties.")}
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
