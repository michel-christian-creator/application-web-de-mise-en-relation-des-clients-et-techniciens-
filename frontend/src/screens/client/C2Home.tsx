import { useCallback, useEffect, useMemo, useState } from "react"

import { useI18n } from "../../i18n"

import LocationMarker from "../../components/LocationMarker"

import Stagger from "../../components/animations/Stagger"

import StaggerItem from "../../components/animations/StaggerItem"

import { resolvePhotoUrl } from "../../utils/photoUrl"

import { API_BASE_URL } from "../../config"

import "./C2Home.css"

export interface Artisan {
  id: number

  metier: string

  icon: string

  spec: string

  note: number

  prix: string

  quartier: string

  city: string

  missions: number

  dispo: boolean

  description: string

  image: string

  fullname: string

  experience: string

  ratingText: string

  successRate: number

  avgResponseTimeSec: number

  photoUrl?: string
}

interface RequestParams {
  domain: string

  description: string

  urgence: "normal" | "important" | "critique"

  files: File[]
}

interface Props {
  onSelectArtisan: (artisan: Artisan) => void

  searchRequest?: RequestParams | null
}

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=800&q=80",

  "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80",

  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80",

  "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",

  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800&q=80",

  "https://images.unsplash.com/photo-1581578010743-9d4d2b5f4b79?auto=format&fit=crop&w=800&q=80",
]

const categoryIcons: Record<string, string> = {
  électrique: "⚡",

  electricien: "⚡",

  plomberie: "🔧",

  plombier: "🔧",

  menuiserie: "🪚",

  menuisier: "🪚",

  peinture: "🎨",

  peintre: "🎨",

  carrelage: "🪟",

  carreleur: "🪟",

  climatisation: "❄️",

  climatiseur: "❄️",
}

const normalizeCategory = (value: string) => (value ?? "").trim()

const normalizeForQuery = (value: string) => {
  if (!value) return ""

  try {
    return value

      .normalize("NFD")

      .replace(/\p{M}/gu, "")

      .trim()

      .toLowerCase()
  } catch (e) {
    return value.trim().toLowerCase()
  }
}

export default function C2Home({ searchRequest, onSelectArtisan }: Props) {
  const { t, locale } = useI18n()

  const [categories, setCategories] = useState<string[]>([])

  const [technicians, setTechnicians] = useState<Artisan[]>([])

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const [selectedFilter, setSelectedFilter] = useState<"Mieux notés" | "Plus proches" | null>(null)

  const [query, setQuery] = useState("")

  const [loading, setLoading] = useState(false)

  const [lastResponseCount, setLastResponseCount] = useState<number | null>(null)

  // Get user's city and quartier from localStorage

  const { userCity, userQuartier } = useMemo(() => {
    try {
      const storedUser = localStorage.getItem("mboaTechUser")

      if (storedUser) {
        const user = JSON.parse(storedUser)

        return {
          userCity: user.city || "Yaoundé",

          userQuartier: user.location || "Bastos",
        }
      }
    } catch (e) {
      console.error("Erreur lors de la lecture de la localisation utilisateur:", e)
    }

    return {
      userCity: "Yaoundé",

      userQuartier: "Bastos",
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/technicians/categories`)

      if (!response.ok) throw new Error("Erreur lors du chargement des catégories")

      const data = (await response.json()) as unknown

      const list = Array.isArray(data) ? data : []

      const nextCategories = list

        .filter((category): category is string => typeof category === "string")

        .map(normalizeCategory)

        .filter((category) => category.length > 0)

      setCategories(nextCategories)
    } catch (error) {
      console.error(error)
    }
  }, [])

  useEffect(() => {
    if (searchRequest?.domain) {
      setSelectedCategory(searchRequest.domain)
    }
  }, [searchRequest?.domain])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    const fetchTechniciansFor = async (category?: string) => {
      const cat = category ?? selectedCategory

      setLoading(true)

      try {
        const isGeneral =
          cat &&
          (normalizeForQuery(cat) === "general" ||
            normalizeForQuery(cat) === "aucune idee du domaine")

        const queryValue = isGeneral ? "" : cat ? normalizeForQuery(cat) : ""

        const url = queryValue
          ? `${API_BASE_URL}/api/technicians?domain=${encodeURIComponent(queryValue)}`
          : `${API_BASE_URL}/api/technicians`

        const response = await fetch(url)

        if (!response.ok) throw new Error("Erreur lors du chargement des techniciens")

        const data = await response.json()

        if (!Array.isArray(data)) throw new Error("Réponse invalide du serveur")

        const mapped: Artisan[] = data.map((entry: any, index: number) => {
          const record = entry && typeof entry === "object" ? entry : {}

          const domain = normalizeCategory(record.domain || cat)

          const note = Number(record.ratingAvg ?? 0) || 0

          const hourlyRate = Number(record.hourlyRate ?? 0) || 0

          const experienceYears = Number(record.experienceYears ?? 0) || 0

          const availability = String(record.availabilityStatus ?? "available").toLowerCase()

          return {
            id: Number(record.id ?? index + 1),

            metier: domain,

            icon: categoryIcons[domain.toLowerCase()] ?? "🛠️",

            spec: record.specialties || "Intervention rapide et fiable",

            prix:
              hourlyRate > 0 ? `${hourlyRate.toLocaleString("fr-FR")} FCFA/h` : "Tarif selon devis",

            note: Number(note.toFixed(1)),

            quartier: record.location || t("Non spécifié"),

            city: record.city || "Yaoundé",

            missions: Number(record.ratingCount ?? 0),

            dispo: availability !== "unavailable" && availability !== "busy",

            description: record.bio || t("Technicien spécialisé en ") + domain + ".",

            image: record.photoUrl || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],

            photoUrl: record.photoUrl || undefined,

            fullname: record.fullname || t("Technicien"),

            experience:
              experienceYears > 0
                ? `${experienceYears} an${experienceYears > 1 ? "s" : ""} d'expérience`
                : "Expérience confirmée",

            ratingText: `${note > 0 ? `Note ${note.toFixed(1)}` : "Très bon profil"}`,

            successRate: Number(record.successRate ?? 0) || 0,

            avgResponseTimeSec: Number(record.avgResponseTimeSec ?? 0) || 0,
          }
        })

        setTechnicians(mapped)

        setLastResponseCount(mapped.length)
      } catch (error) {
        console.error(error)

        setTechnicians([])
      } finally {
        setLoading(false)
      }
    }

    fetchTechniciansFor(selectedCategory ?? undefined)
  }, [selectedCategory])

  useEffect(() => {
    const es = new EventSource(`${API_BASE_URL}/api/technicians/stream`)

    es.onmessage = () => {
      fetchCategories()
    }

    es.onerror = () => {
      // Laisse EventSource se reconnecter automatiquement en cas d'erreur réseau.
    }

    return () => es.close()
  }, [fetchCategories, selectedCategory])

  const displayed = useMemo(() => {
    const q = query.trim().toLowerCase()

    const baseList = q
      ? technicians.filter((tech) =>
          [tech.fullname, tech.metier, tech.spec, tech.city, tech.quartier, tech.description]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : [...technicians]

    if (selectedFilter === "Mieux notés") {
      return baseList.sort((a, b) => b.note - a.note)
    }

    if (selectedFilter === "Plus proches") {
      // Filter by same city only

      const sameCity = baseList.filter((tech) => {
        // Normalize for comparison

        const techCity = (tech.city || "").toLowerCase().trim()

        const userCityNorm = (userCity || "Yaoundé").toLowerCase().trim()

        return techCity === userCityNorm
      })

      // Sort by availability first, then by number of missions

      return sameCity.sort((a, b) => {
        if (a.dispo !== b.dispo) {
          return a.dispo ? -1 : 1
        }

        return b.missions - a.missions
      })
    }

    return baseList
  }, [selectedFilter, technicians, userCity, query])

  return (
    <div className="min-h-full p-4 sm:p-6 home-page">
      <div className="mx-auto max-w-[min(1400px,95%)]">
        {searchRequest && (
          <div
            className="mb-5 rounded-2xl home-card p-5 text-sm"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold home-text">
                  {t("Demande enregistrée")}
                </p>
                <p className="home-text-muted">{searchRequest.description}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span
                  className="rounded-full px-3 py-1 home-badge-blue"
                >
                  {t("Domaine : ")}
                  {searchRequest.domain}
                </span>
                <span
                  className="rounded-full px-3 py-1 home-badge-amber"
                >
                  {t("Urgence : ")}
                  {searchRequest.urgence}
                </span>
                <span
                  className="rounded-full px-3 py-1 home-badge-green"
                >
                  {t("Photos : ")}
                  {searchRequest.files.length}
                </span>
              </div>
            </div>
          </div>
        )}
        <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <LocationMarker className="h-4 w-4 text-slate-300" />
              <span className="text-sm font-medium home-text-dim">
                {userCity}
                {userQuartier ? `, ${userQuartier}` : ""}
              </span>
            </div>
            <h1
              className="text-2xl font-bold home-title"
            >
              {t("Trouver un artisan")}
            </h1>
          </div>
          <div />
        </div>

        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div
            className="flex flex-1 items-center gap-3 rounded-xl px-5 py-3.5 home-search-bar"
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
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Rechercher un électricien, plombier, menuisier...")}
              className="flex-1 bg-transparent outline-none text-sm home-search-input"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Mieux notés" },

              { label: "Plus proches" },
            ].map((f) => (
              <button
                key={f.label}
                onClick={() =>
                  setSelectedFilter(
                    selectedFilter === f.label ? null : (f.label as "Mieux notés" | "Plus proches"),
                  )
                }
                className={`px-4 py-3 rounded-xl text-sm font-medium home-filter-btn ${
                  selectedFilter === f.label ? "home-filter-btn-active" : ""
                }`}
              >
                {t(f.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-3xl home-card p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-sm font-semibold home-text">
                {t("Domaines disponibles")}
              </p>
              <p className="mt-1 text-xs home-text-muted"></p>
            </div>
            <span
              className="inline-flex rounded-full home-pill px-3 py-1 text-xs font-medium"
            >
              {categories.length} {t("domaines")}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {categories.length > 0 ? (
              categories.map((category) => (
                <button
                  key={category}
                  onClick={() =>
                    setSelectedCategory(selectedCategory === category ? null : category)
                  }
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    selectedCategory === category ? "home-chip-active" : "home-chip"
                  }`}
                >
                  {category}
                </button>
              ))
            ) : (
              <span className="text-xs home-text-muted">{t("Chargement des domaines...")}</span>
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <div className="rounded-3xl home-card p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold home-text">
                    {t("Demande")}
                  </p>
                  <p className="mt-1 text-xs home-text-muted">
                    {searchRequest ? searchRequest.domain : t("Sélectionnez un domaine")}
                  </p>
                </div>
                <span
                  className="inline-flex rounded-full home-pill px-3 py-1 text-xs font-medium"
                >
                  {lastResponseCount ?? 0} {t("artisans")}
                </span>
              </div>
            </div>

            <Stagger className="space-y-4">
              {displayed.length > 0 ? (
                displayed.map((artisan) => (
                  <StaggerItem key={artisan.id} hoverY={-2}>
                    <button
                      onClick={() => onSelectArtisan(artisan)}
                      className="w-full rounded-[28px] home-card p-6 text-left home-card-hover"
                    >
                      <div className="flex items-start gap-5">
                        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-3xl bg-slate-700">
                          <img
                            src={resolvePhotoUrl(artisan.image)}
                            alt={artisan.fullname}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-lg font-semibold home-text">
                                {artisan.fullname}
                              </p>
                              <p className="text-sm home-text-muted">
                                {artisan.metier}
                              </p>
                            </div>
                            <span className="flex items-center gap-0.5 rounded-full home-pill px-3 py-0.5">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <svg
                                  key={i}
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill={
                                    i <= Math.round(artisan.note)
                                      ? "#FBBF24"
                                      : undefined
                                  }
                                  className={i > Math.round(artisan.note) ? "home-star-inactive" : undefined}
                                >
                                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
                                </svg>
                              ))}
                              {artisan.note > 0 && (
                                <span
                                  className="ml-1 text-xs font-semibold home-text-accent"
                                >
                                  {artisan.note.toFixed(1)}
                                </span>
                              )}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed home-text-desc">
                            {artisan.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  </StaggerItem>
                ))
              ) : (
                <div className="rounded-[28px] home-card p-6 text-center">
                  <p className="text-sm home-text-muted">
                    {query.trim()
                      ? t("Aucun artisan ne correspond à « ") + query.trim() + t(" ».")
                      : selectedFilter === "Plus proches"
                        ? t("Aucun technicien n'est proche de vous pour le moment")
                        : t("Aucun artisan trouvé pour ce filtre.")}
                  </p>
                </div>
              )}
            </Stagger>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-[#141C2F] p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold home-text">
                    {t("Filtrer")}
                  </p>
                  <p className="text-xs home-text-muted">
                    {t("Affinez votre recherche")}
                  </p>
                </div>
                <span
                  className="inline-flex rounded-full bg-[#1E3A6A] px-3 py-1 text-xs font-semibold home-text-accent"
                >
                  {selectedFilter ? t(selectedFilter) : t("Aucun filtre")}
                </span>
              </div>
              <div className="space-y-4">
                <p className="text-xs home-text-muted">
                  {selectedFilter ? (
                    <>
                      {t("Résultats triés par")}{" "}
                      <strong className="home-text">
                        {selectedFilter === "Mieux notés" ? t("note") : t("proximité")}
                      </strong>
                      .
                    </>
                  ) : (
                    <>
                      {t(
                        "Affichage de tous les techniciens. Cliquez sur un filtre pour trier les résultats.",
                      )}
                    </>
                  )}
                </p>
                <div className="space-y-3">
                  {displayed.length > 0 ? (
                    displayed.slice(0, 3).map((artisan) => (
                      <div
                        key={artisan.id}
                        className="rounded-2xl border border-white/10 bg-[#0F172A] p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold home-text">
                              {artisan.fullname}
                            </p>
                            <p className="text-xs home-text-muted">
                              {artisan.metier}
                            </p>
                          </div>
                          <span
                            className="text-xs rounded-full px-2 py-1 home-badge-blue"
                          >
                            {selectedFilter === "Mieux notés"
                              ? t("Note ") + artisan.note.toFixed(1)
                              : selectedFilter === "Plus proches"
                                ? artisan.quartier
                                : `${artisan.missions} ${t("missions")}`}
                          </span>
                        </div>
                        <p className="text-xs mt-2 home-text-muted">
                          {selectedFilter === "Mieux notés"
                            ? `${artisan.missions} ${t("missions")} • ${
                                artisan.dispo ? t("Disponible") : t("Occupé")
                              }`
                            : selectedFilter === "Plus proches"
                              ? `${t("Quartier")} ${artisan.quartier} • ${
                                  artisan.dispo ? t("Disponible") : t("Occupé")
                                }`
                              : `${artisan.metier} • ${artisan.dispo ? t("Disponible") : t("Occupé")}`}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs home-text-muted">
                      {query.trim()
                        ? t("Aucun artisan ne correspond à « ") + query.trim() + t(" ».")
                        : selectedFilter === "Plus proches"
                          ? t("Aucun technicien n'est proche de vous pour le moment")
                          : t("Aucun artisan trouvé pour ce filtre.")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
