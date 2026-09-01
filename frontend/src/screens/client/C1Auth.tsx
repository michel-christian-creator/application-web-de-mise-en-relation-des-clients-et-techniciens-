import { useState, useRef, useEffect, type ChangeEvent } from "react"
import { motion } from "motion/react"
import { API_BASE_URL } from "../../config"
import FadeIn from "../../components/animations/FadeIn"
import Stagger from "../../components/animations/Stagger"
import StaggerItem from "../../components/animations/StaggerItem"
import ThemeToggle from "../../components/ThemeToggle"
import { useI18n } from "../../i18n"
import {
  sanitizeText,
  sanitizeMultiline,
  sanitizeLetters,
  sanitizeDigits,
  isValidEmail,
  validateFields,
  MAX_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_MULTILINE_LENGTH,
} from "../../utils/validation"
import "./C1Auth.css"

type BackendProfile = {
  username?: string
  firstName?: string
  lastName?: string
  role?: "client" | "technician" | "admin"
  domain?: string
  city?: string
  location?: string
  photoUrl?: string
}

interface Props {
  onNext: () => void
  onAuthComplete?: (
    role: "client" | "technician" | "admin",
    profile: {
      username: string
      firstName: string
      lastName: string
      role: "client" | "technician" | "admin"
      domain: string
      city: string
      location: string
      photoUrl?: string
    },
  ) => void
}

const cameroonCities = [
  "Bafoussam",
  "Bamenda",
  "Bertoua",
  "Buea",
  "Douala",
  "Ebolowa",
  "Edéa",
  "Garoua",
  "Kaélé",
  "Kousséri",
  "Limbe",
  "Maroua",
  "Ngaoundéré",
  "Nkongsamba",
  "Sa'a",
  "Tiko",
  "Yaoundé",
  "Autre",
].sort((a, b) => a.localeCompare(b))

const professions = [
  "Électricien",
  "Plombier",
  "Menuisier",
  "Peintre",
  "Carreleur",
  "Climatiseur",
  "Mécanicien",
  "Maçon",
  "Couvreur",
  "Jardinier",
  "Déménageur",
  "Informaticien",
  "Multi-métier",
  "Autre",
].sort((a, b) => a.localeCompare(b))

export default function C1Auth({ onNext, onAuthComplete }: Props) {
  const { t, locale } = useI18n()
  const [step, setStep] = useState<"choice" | "credentials" | "profile" | "phone" | "otp">("choice")
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  })
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    email: "",
    role: "client" as "client" | "technician" | "admin",
    domain: "",
    city: "",
    location: "",
    photoUrl: "",
    bio: "",
    specialties: "",
    hourlyRate: "",
    experienceYears: "",
  })
  const [customCity, setCustomCity] = useState("")
  const [customDomain, setCustomDomain] = useState("")
  const [selectedDomains, setSelectedDomains] = useState<string[]>([])
  const [customMultiDomains, setCustomMultiDomains] = useState(["", "", ""])
  const multiProfessions = professions.filter((p) => p !== "Multi-métier" && p !== "Autre")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState(["", "", "", ""])
  const [timer, setTimer] = useState(59)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (step !== "otp") return
    const id = setInterval(() => setTimer((t) => (t > 0 ? t - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [step])

  const registerUser = async () => {
    const url = `${API_BASE_URL}/api/register`
    const firstName = sanitizeText(profile.firstName, MAX_NAME_LENGTH)
    const lastName = sanitizeText(profile.lastName, MAX_NAME_LENGTH)
    const email = sanitizeText(profile.email, 254)
    const city = sanitizeText(
      profile.city === "Autre" ? customCity : profile.city,
      MAX_TEXT_LENGTH,
    )
    const location = sanitizeText(profile.location, MAX_TEXT_LENGTH)
    const domain = sanitizeText(
      profile.domain === "Autre"
        ? customDomain
        : profile.domain === "Multi-métier"
          ? [
              ...selectedDomains.filter((d) => d !== "Autre"),
              ...customMultiDomains.filter((d) => d.trim()),
            ].join(", ")
          : profile.domain,
      MAX_MULTILINE_LENGTH,
    )
    const bio = sanitizeMultiline(profile.bio, MAX_MULTILINE_LENGTH)
    const specialties = sanitizeMultiline(profile.specialties, MAX_MULTILINE_LENGTH)
    const password = credentials.password
    const generatedUsername = `${firstName.toLowerCase()}${lastName.toLowerCase()}`.replace(
      /\s+/g,
      "",
    )

    const body = {
      username: generatedUsername,
      email,
      password,
      firstName,
      lastName,
      phone: sanitizeText(phone, 20),
      role: profile.role,
      city,
      location,
      domain,
      bio,
      specialties,
      hourlyRate: profile.hourlyRate ? Number(profile.hourlyRate) : null,
      experienceYears: profile.experienceYears ? Number(profile.experienceYears) : null,
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || t("Erreur ") + response.status)
    }

    return generatedUsername
  }

  const loginUser = async (email?: string) => {
    const emailToUse = email || credentials.email
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: emailToUse,
        password: credentials.password,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || t("Identifiants invalides."))
    }

    const data = ((await response.json()) ?? {}) as {
      role?: string
      username?: string
      email?: string
      firstName?: string
      lastName?: string
      domain?: string
      city?: string
      location?: string
      photoUrl?: string
      token?: string
      accessToken?: string
      jwt?: string
      authToken?: string
    }

    const token = data.token ?? data.accessToken ?? data.jwt ?? data.authToken
    if (token) {
      localStorage.removeItem("mboaTechUser")
      localStorage.setItem("mboaTechToken", token)
    }

    const authHeader =
      response.headers.get("Authorization") ||
      response.headers.get("X-Auth-Token") ||
      response.headers.get("x-auth-token")
    if (authHeader) {
      const bearer = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader
      localStorage.removeItem("mboaTechUser")
      localStorage.setItem("mboaTechToken", bearer)
    }

    return data
  }

  const handleProfileNext = async () => {
    if (!profile.firstName.trim()) {
      setError(t("Veuillez renseigner votre prénom."))
      return
    }

    if (!profile.lastName.trim()) {
      setError(t("Veuillez renseigner votre nom."))
      return
    }

    if (!profile.gender.trim()) {
      setError(t("Veuillez sélectionner votre sexe."))
      return
    }

    if (!credentials.password.trim()) {
      setError(t("Veuillez renseigner un mot de passe."))
      return
    }

    if (credentials.password.length < 6) {
      setError(t("Votre mot de passe doit contenir au moins 6 caractères."))
      return
    }

    if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]+$/.test(credentials.password)) {
      setError(
        t("Votre mot de passe doit être composé uniquement de lettres et de chiffres, avec au moins une lettre et un chiffre."),
      )
      return
    }

    if (!profile.email.trim()) {
      setError(t("Veuillez renseigner votre email."))
      return
    }
    if (!isValidEmail(profile.email)) {
      setError(t("Veuillez renseigner un email valide."))
      return
    }
    if (!profile.city.trim()) {
      setError(t("Veuillez renseigner votre ville."))
      return
    }
    if (profile.city === "Autre" && !customCity.trim()) {
      setError(t("Veuillez préciser votre ville."))
      return
    }
    if (!profile.location.trim()) {
      setError(t("Veuillez renseigner votre quartier ou localisation."))
      return
    }
    if (profile.role === "technician" && !profile.domain.trim()) {
      setError(t("Veuillez préciser votre domaine d'expertise."))
      return
    }
    if (profile.role === "technician" && profile.domain === "Multi-métier" && selectedDomains.length === 0) {
      setError(t("Veuillez sélectionner au moins un métier."))
      return
    }
    if (profile.role === "technician" && profile.domain === "Multi-métier" && selectedDomains.includes("Autre") && customMultiDomains.every((d) => !d.trim())) {
      setError(t("Veuillez préciser au moins un métier personnalisé."))
      return
    }
    if (profile.role === "technician" && profile.domain === "Autre" && !customDomain.trim()) {
      setError(t("Veuillez préciser votre métier."))
      return
    }
    if (profile.role === "technician") {
      const hourly = profile.hourlyRate.trim()
        ? Number(profile.hourlyRate)
        : 0
      const experience = profile.experienceYears.trim()
        ? Number(profile.experienceYears)
        : 0
      if (profile.hourlyRate.trim() && (isNaN(hourly) || hourly < 0 || hourly > 100000000)) {
        setError(t("Veuillez renseigner un tarif horaire valide (en FCFA, entre 0 et 100 000 000)."))
        return
      }
      if (
        profile.experienceYears.trim() &&
        (isNaN(experience) || experience < 0 || experience > 200 || !Number.isInteger(experience))
      ) {
        setError(t("Veuillez renseigner une expérience valide (0 à 200 ans, nombre entier)."))
        return
      }
    }

    const fieldsValidation = validateFields([
      {
        key: "firstName",
        label: "prénom",
        value: profile.firstName,
        maxLength: MAX_NAME_LENGTH,
        required: true,
      },
      {
        key: "lastName",
        label: "nom",
        value: profile.lastName,
        maxLength: MAX_NAME_LENGTH,
        required: true,
      },
      {
        key: "email",
        label: "email",
        value: profile.email,
        maxLength: 254,
        required: true,
      },
      {
        key: "city",
        label: "ville",
        value: profile.city,
        maxLength: MAX_TEXT_LENGTH,
        required: true,
      },
      {
        key: "location",
        label: "quartier",
        value: profile.location,
        maxLength: MAX_TEXT_LENGTH,
        required: true,
      },
      {
        key: "domain",
        label: "domaine",
        value: profile.domain === "Multi-métier" ? selectedDomains.join(", ") : profile.domain,
        maxLength: MAX_MULTILINE_LENGTH,
      },
      {
        key: "bio",
        label: "bio",
        value: profile.bio,
        maxLength: MAX_MULTILINE_LENGTH,
      },
      {
        key: "specialties",
        label: "spécialités",
        value: profile.specialties,
        maxLength: MAX_MULTILINE_LENGTH,
      },
    ])
    if (!fieldsValidation.valid) {
      setError(fieldsValidation.message ?? t("Des caractères non autorisés ont été détectés."))
      return
    }

    setError("")

    let fetchedProfile: BackendProfile | null = null
    let registeredUsername: string = ""
    try {
      registeredUsername = await registerUser()
    } catch (error) {
      const message = error instanceof Error ? error.message : t("Erreur lors de l'inscription.")
      setError(message)
      return
    }
    try {
      fetchedProfile = (await loginUser(profile.email)) as BackendProfile
    } catch {
      setError(t("Compte créé, mais connexion automatique impossible. Veuillez vous connecter."))
      setStep("credentials")
      return
    }

    const resolvedRole: "client" | "technician" | "admin" =
      (fetchedProfile?.role as "client" | "technician" | "admin") ?? profile.role
    const resolvedFirstName = (
      fetchedProfile?.firstName ||
      profile.firstName ||
      t("Utilisateur")
    ).trim()
    const resolvedLastName = (
      fetchedProfile?.lastName ||
      profile.lastName ||
      (profile.role === "technician" ? t("Technicien") : t("Client"))
    ).trim()
    const resolvedDomain = fetchedProfile?.domain ?? profile.domain
    const resolvedCity = fetchedProfile?.city ?? profile.city
    const resolvedLocation = fetchedProfile?.location ?? profile.location
    const resolvedPhotoUrl = fetchedProfile?.photoUrl ?? profile.photoUrl

    if (onAuthComplete) {
      onAuthComplete(resolvedRole, {
        username: registeredUsername || credentials.email,
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        role: resolvedRole,
        domain: resolvedDomain,
        city: resolvedCity,
        location: resolvedLocation,
        photoUrl: resolvedPhotoUrl,
      })
    }

    if (typeof onNext === "function") {
      onNext()
    }
  }

  const handleCredentialsNext = async () => {
    if (!credentials.email.trim()) {
      setError(t("Veuillez renseigner votre email."))
      return
    }

    if (!isValidEmail(credentials.email)) {
      setError(t("Veuillez renseigner un email valide."))
      return
    }

    if (!credentials.password.trim()) {
      setError(t("Veuillez renseigner votre mot de passe."))
      return
    }

    const loginProfile = await loginUser().catch(() => null)
    const email = credentials.email

    if (!loginProfile) {
      setError(t("Connexion impossible : vérifiez votre email et votre mot de passe."))
      return
    }

    const sourceProfile = loginProfile
    const resolvedRole =
      sourceProfile.role === "technician"
        ? "technician"
        : sourceProfile.role === "admin"
          ? "admin"
          : "client"
    const resolvedDomain = sourceProfile.domain ?? ""

    setProfile((prev) => ({
      ...prev,
      firstName: sourceProfile.firstName ?? prev.firstName,
      lastName: sourceProfile.lastName ?? prev.lastName,
      role: resolvedRole,
      domain: resolvedDomain,
      city: sourceProfile.city ?? prev.city,
      location: sourceProfile.location ?? prev.location,
    }))

    if (onAuthComplete) {
      onAuthComplete(resolvedRole, {
        username: sourceProfile.username ?? email,
        firstName: sourceProfile.firstName ?? t("Utilisateur"),
        lastName: sourceProfile.lastName ?? "",
        role: resolvedRole,
        domain: resolvedDomain,
        city: sourceProfile.city ?? "",
        location: sourceProfile.location ?? "",
        photoUrl: sourceProfile.photoUrl,
      })
    }

    setError("")
    if (typeof onNext === "function") {
      onNext()
    }
  }

  const handleChoice = (selectedMode: "signup" | "login") => {
    if (selectedMode === "login") {
      setStep("credentials")
    } else {
      setStep("profile")
    }
  }

  const handleSend = () => {
    if (phone.length >= 8) {
      setStep("otp")
      setTimer(59)
    }
  }

  const handleOtp = (val: string, i: number) => {
    if (!/^\d?$/.test(val)) return
    const next = [...otp]
    next[i] = val
    setOtp(next)
    if (val && i < 3) inputRefs.current[i + 1]?.focus()
    if (next.every((d) => d !== "")) setTimeout(() => onNext(), 300)
  }

  const handleKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) inputRefs.current[i - 1]?.focus()
  }

  const updateProfile = (field: keyof typeof profile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
    if (error) setError("")
  }

  const updateCredentials = (field: "email" | "password", value: string) => {
    setCredentials((prev) => ({ ...prev, [field]: value }))
    if (error) setError("")
  }

  return (
    <div className="flex min-h-screen overflow-hidden auth-bg">
      {/* Theme toggle — fixed top-right */}
      <div className="fixed top-5 right-5 z-50">
        <ThemeToggle className="border-white/15 auth-theme-toggle" />
      </div>

      {/* Left panel — branding */}
      <div
        className="flex flex-col justify-between p-10 h-screen overflow-hidden auth-left-panel"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center auth-logo-icon"
          >
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
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
            className="font-bold text-lg auth-text-primary"
          >
            MboaTech
          </span>
        </div>

        <div className="flex-1 flex flex-col justify-between">
          <FadeIn delay={0.15}>
            <div>
              <h1
                className="text-4xl font-bold leading-tight mb-4 max-w-[90%] auth-text-primary"
              >
                {t("Votre artisan de confiance,")}
                <br />
                <span className="auth-text-green">{t("en toute sérénité.")}</span>
              </h1>
              <p
                className="text-base leading-relaxed auth-description"
              >
                {t("Trouvez, évaluez et payez votre artisan en toute sérénité — vos fonds sont gardés jusqu'à validation.")}
              </p>
            </div>
          </FadeIn>

          <Stagger className="grid gap-3 mt-8" staggerDelay={0.12}>
            {[
              {
                text: "Paiement en garde sécurisé",
                accent: "from-[#0ea5e9] to-[#22c55e]",
              },
              {
                text: "Artisans vérifiés & certifiés par leurs pairs",
                accent: "from-[#f59e0b] to-[#ef4444]",
              },
              {
                text: "Notes objectives et transparentes",
                accent: "from-[#8b5cf6] to-[#2563eb]",
              },
            ].map((item) => (
              <StaggerItem
                key={item.text}
                hoverY={-4}
                className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111827] p-3 shadow-[0_18px_60px_-42px_rgba(0,0,0,0.8)] transition duration-300"
              >
                <div
                  className={`absolute left-0 top-1/2 h-12 w-12 -translate-y-1/2 rounded-r-full bg-gradient-to-br ${item.accent} opacity-90 blur-sm animate-[pulse_2.5s_ease-in-out_infinite]`}
                />
                <div className="relative flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/80 text-sm font-semibold text-white ring-1 ring-white/10">
                    <span className="text-base">✓</span>
                  </div>
                  <span className="text-sm font-semibold auth-text-primary">
                    {t(item.text)}
                  </span>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <div className="mt-auto">
          <p className="text-xs auth-footer-text">
            {t("© 2026 MboaTech · Cameroun")}
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div
        className="flex flex-col justify-center overflow-y-auto px-4 py-8 auth-right-panel"
      >
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="auth-form-card"
        >
          {step === "choice" ? (
            <>
              <h2
                className="text-2xl font-bold mb-2 auth-text-primary"
              >
                {t("Bienvenue")}
              </h2>
              <p className="text-sm mb-8 auth-text-muted">
                {t("Choisissez ce que vous souhaitez faire pour commencer.")}
              </p>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => handleChoice("signup")}
                  className="rounded-xl border px-4 py-4 text-left auth-choice-btn"
                >
                  <div className="font-semibold">{t("Créer un compte")}</div>
                  <div className="mt-1 text-sm auth-text-muted">
                    {t("Pour rejoindre MboaTech en tant que client ou technicien.")}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleChoice("login")}
                  className="rounded-xl border px-4 py-4 text-left auth-choice-btn"
                >
                  <div className="font-semibold">{t("Se connecter")}</div>
                  <div className="mt-1 text-sm auth-text-muted">
                    {t("Si vous avez déjà un compte, accédez directement à votre espace.")}
                  </div>
                </button>
              </div>
            </>
          ) : step === "credentials" ? (
            <>
              <h2
                className="text-2xl font-bold mb-2 auth-text-primary"
              >
                {t("Connexion à votre espace")}
              </h2>
              <p className="text-sm mb-6 auth-text-muted">
                {t("Saisissez vos identifiants puis poursuivez la vérification.")}
              </p>

              <div className="mb-4">
                <p
                  className="text-xs font-medium mb-2 auth-label"
                >
                  {t("Email")}
                </p>
                <input
                  type="email"
                  value={credentials.email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateCredentials("email", e.target.value)
                  }
                  placeholder={t("Votre adresse email")}
                  className="w-full rounded-xl border px-4 py-3 outline-none auth-input"
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <p
                  className="text-xs font-medium mb-2 auth-label"
                >
                  {t("Mot de passe")}
                </p>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={credentials.password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      updateCredentials("password", e.target.value)
                    }
                    placeholder={t("Votre mot de passe")}
                    className="w-full rounded-xl border px-4 py-3 pr-12 outline-none auth-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("Masquer le mot de passe") : t("Afficher le mot de passe")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ color: showPassword ? "#2563EB" : "#64748B" }}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M3 3l18 18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M10.6 5.1A9.7 9.7 0 0 1 12 5c4.9 0 8.6 4 9.6 5.1.3.4.3 1 0 1.4-.4.5-1 1.2-1.8 2"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M6.6 6.9C4.5 8.3 3 10 2.4 11.1c-.3.4-.3 1 0 1.4C3.4 13.6 7.1 17.6 12 17.6c1.5 0 2.9-.4 4.1-1"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M9.5 9.7a3 3 0 0 0 4.2 4.2"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M2.4 12.5C3.4 11.4 7.1 7.4 12 7.4s8.6 4 9.6 5.1c.3.4.3 1 0 1.4C20.6 15 16.9 19 12 19s-8.6-4-9.6-5.1c-.3-.4-.3-1 0-1.4Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    )}
                  </button>
                </div>
                <label
                  className="mt-2 flex items-center gap-2 text-xs select-none auth-checkbox-label"
                >
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="w-4 h-4 rounded auth-checkbox"
                  />
                  {t("Afficher le mot de passe")}
                </label>
              </div>

              {error && (
                <p className="mb-4 text-sm auth-error">
                  {error}
                </p>
              )}

              <button
                onClick={handleCredentialsNext}
                className="w-full py-4 rounded-xl font-semibold text-base text-white mb-4 auth-btn-primary"
              >
                {t("Continuer")}
              </button>

              <button
                onClick={() => setStep("choice")}
                className="w-full text-sm text-center py-2 auth-text-muted"
              >
                {t("← Retour au choix")}
              </button>
            </>
          ) : step === "profile" ? (
            <>
              <h2
                className="text-2xl font-bold mb-2 auth-text-primary"
              >
                {t("Créer votre compte")}
              </h2>
              <p className="text-sm mb-6 auth-text-muted">
                {t("Quelques informations pour commencer votre aventure MboaTech.")}
              </p>

                <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2">
                <div>
                  <p
                    className="text-xs font-medium mb-2 auth-label"
                  >
                    {t("Prénom")}
                  </p>
                  <input
                    type="text"
                    value={profile.firstName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      updateProfile("firstName", sanitizeLetters(e.target.value))
                    }
                    placeholder={t("Votre prénom")}
                    className="w-full rounded-xl border px-4 py-3 outline-none auth-input"
                  />
                </div>
                <div>
                  <p
                    className="text-xs font-medium mb-2 auth-label"
                  >
                    {t("Nom")}
                  </p>
                  <input
                    type="text"
                    value={profile.lastName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      updateProfile("lastName", sanitizeLetters(e.target.value))
                    }
                    placeholder={t("Votre nom")}
                    className="w-full rounded-xl border px-4 py-3 outline-none auth-input"
                  />
                </div>
              </div>

              <div className="mb-4">
                <p
                  className="text-xs font-medium mb-2 auth-label"
                >
                  {t("Sexe")}
                </p>
                <select
                  value={profile.gender}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    updateProfile("gender", e.target.value)
                  }
                  className="w-full rounded-xl border px-4 py-3 outline-none auth-input"
                >
                  <option value="" className="auth-option">
                    {t("Sélectionner votre sexe")}
                  </option>
                  <option value="masculin" className="auth-option">
                    {t("Masculin")}
                  </option>
                  <option value="feminin" className="auth-option">
                    {t("Féminin")}
                  </option>
                </select>
              </div>

              <div className="mb-4">
                <p
                  className="text-xs font-medium mb-2 auth-label"
                >
                  {t("Mot de passe")}
                </p>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={credentials.password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      updateCredentials("password", e.target.value)
                    }
                    placeholder={t("Créez un mot de passe sécurisé")}
                    className="w-full rounded-xl border px-4 py-3 pr-12 outline-none auth-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("Masquer le mot de passe") : t("Afficher le mot de passe")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ color: showPassword ? "#2563EB" : "#64748B" }}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M3 3l18 18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M10.6 5.1A9.7 9.7 0 0 1 12 5c4.9 0 8.6 4 9.6 5.1.3.4.3 1 0 1.4-.4.5-1 1.2-1.8 2"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M6.6 6.9C4.5 8.3 3 10 2.4 11.1c-.3.4-.3 1 0 1.4C3.4 13.6 7.1 17.6 12 17.6c1.5 0 2.9-.4 4.1-1"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M9.5 9.7a3 3 0 0 0 4.2 4.2"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M2.4 12.5C3.4 11.4 7.1 7.4 12 7.4s8.6 4 9.6 5.1c.3.4.3 1 0 1.4C20.6 15 16.9 19 12 19s-8.6-4-9.6-5.1c-.3-.4-.3-1 0-1.4Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    )}
                  </button>
                </div>
                <label
                  className="mt-2 flex items-center gap-2 text-xs select-none auth-checkbox-label"
                >
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="w-4 h-4 rounded auth-checkbox"
                  />
                  {t("Afficher le mot de passe")}
                </label>
                <p
                  className="text-[11px] mt-1.5"
                  style={{
                    color: credentials.password.length > 0 ? "#94A3B8" : "#64748B",
                  }}
                >
                  {t("Au moins 6 caractères, composé de lettres et de chiffres (ex : ")}
                  <span className="auth-mono-example">maison2026</span>
                  {t(").")}
                </p>
              </div>

              <div className="mb-4">
                <p
                  className="text-xs font-medium mb-2 auth-label"
                >
                  {t("Email")}
                </p>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateProfile("email", e.target.value)
                  }
                  placeholder={t("Votre email")}
                  className="w-full rounded-xl border px-4 py-3 outline-none auth-input"
                />
              </div>

              <div className="mb-4">
                <p
                  className="text-xs font-medium mb-2 auth-label"
                >
                  {t("Ville")}
                </p>
                <select
                  value={
                    profile.city === "" || cameroonCities.includes(profile.city)
                      ? profile.city
                      : "Autre"
                  }
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    const value = e.target.value
                    updateProfile("city", value === "Autre" ? "Autre" : value)
                  }}
                  className="w-full rounded-xl border px-4 py-3 outline-none auth-input"
                >
                  <option value="" className="auth-option">
                    {t("Sélectionner une ville")}
                  </option>
                  {cameroonCities.map((city) => (
                    <option
                      key={city}
                      value={city}
                      className="auth-option"
                    >
                      {city}
                    </option>
                  ))}
                </select>
                {profile.city === "Autre" && (
                  <input
                    type="text"
                    value={customCity}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setCustomCity(sanitizeLetters(e.target.value))
                    }
                    placeholder={t("Précisez votre ville")}
                    className="mt-3 w-full rounded-xl border px-4 py-3 outline-none auth-input"
                  />
                )}
              </div>

              <div className="mb-4">
                <p
                  className="text-xs font-medium mb-2 auth-label"
                >
                  {t("Quartier / localisation")}
                </p>
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateProfile("location", sanitizeLetters(e.target.value))
                  }
                  placeholder={t("Ex : Bastos, Mokolo, Bonanjo")}
                  className="w-full rounded-xl border px-4 py-3 outline-none auth-input"
                />
              </div>

              <div className="mb-4">
                <p
                  className="text-xs font-medium mb-2 auth-label"
                >
                  {t("Vous êtes")}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => updateProfile("role", "client")}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                      profile.role === "client"
                        ? "auth-role-active"
                        : "auth-role-inactive"
                    }`}
                  >
                    {t("Client")}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateProfile("role", "technician")}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                      profile.role === "technician"
                        ? "auth-role-active"
                        : "auth-role-inactive"
                    }`}
                  >
                    {t("Technicien")}
                  </button>
                </div>
              </div>

              {profile.role === "technician" && (
                <div className="mb-4">
                  <p
                    className="text-xs font-medium mb-2 auth-label"
                  >
                    {t("Métier")}
                  </p>
                  <select
                    value={
                      profile.domain === "" || professions.includes(profile.domain)
                        ? profile.domain
                        : "Autre"
                    }
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                      const value = e.target.value
                      updateProfile("domain", value)
                      if (value !== "Multi-métier") setSelectedDomains([])
                    }}
                    className="w-full rounded-xl border px-4 py-3 outline-none auth-input"
                  >
                    <option value="" className="auth-option">
                      {t("Sélectionner un métier")}
                    </option>
                    {professions.map((profession) => (
                      <option
                        key={profession}
                        value={profession}
                        className="auth-option"
                      >
                        {profession}
                      </option>
                    ))}
                  </select>
                  {profile.domain === "Multi-métier" && (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {multiProfessions.map((profession) => {
                        const checked = selectedDomains.includes(profession)
                        const atMax = !checked && selectedDomains.length >= 3
                        return (
                          <label
                            key={profession}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                              atMax
                                ? "cursor-not-allowed opacity-50 auth-multi-unchecked"
                                : "cursor-pointer"
                            } ${
                              checked
                                ? "auth-multi-checked"
                                : "auth-multi-unchecked"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={atMax}
                              onChange={() => {
                                setSelectedDomains((prev) =>
                                  checked
                                    ? prev.filter((d) => d !== profession)
                                    : [...prev, profession],
                                )
                              }}
                              className="w-4 h-4 rounded accent-[#2563EB]"
                            />
                            <span className="auth-text-primary">{profession}</span>
                          </label>
                        )
                      })}
                      {/* Autre checkbox */}
                      {(() => {
                        const autreChecked = selectedDomains.includes("Autre")
                        const atMax = !autreChecked && selectedDomains.length >= 3
                        return (
                          <label
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                              atMax
                                ? "cursor-not-allowed opacity-50 auth-multi-unchecked"
                                : "cursor-pointer"
                            } ${
                              autreChecked
                                ? "auth-multi-checked"
                                : "auth-multi-unchecked"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={autreChecked}
                              disabled={atMax}
                              onChange={() => {
                                setSelectedDomains((prev) =>
                                  autreChecked
                                    ? prev.filter((d) => d !== "Autre")
                                    : [...prev, "Autre"],
                                )
                                if (!autreChecked) {
                                  setCustomMultiDomains(["", "", ""])
                                }
                              }}
                              className="w-4 h-4 rounded accent-[#2563EB]"
                            />
                            <span className="auth-text-primary">Autre</span>
                          </label>
                        )
                      })()}
                    </div>
                  )}
                  {profile.domain === "Multi-métier" && selectedDomains.includes("Autre") && (
                    <div className="mt-3 flex flex-col gap-2">
                      {customMultiDomains.map((val, i) => (
                        <input
                          key={i}
                          type="text"
                          value={val}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            const next = [...customMultiDomains]
                            next[i] = sanitizeLetters(e.target.value)
                            setCustomMultiDomains(next)
                          }}
                          placeholder={`${t("Métier personnalisé")} ${i + 1}`}
                          className="w-full rounded-xl border px-4 py-3 text-sm outline-none auth-input"
                        />
                      ))}
                    </div>
                  )}
                  {profile.domain === "Multi-métier" && selectedDomains.length > 0 && (
                    <p className="mt-2 text-xs auth-text-muted">
                      {selectedDomains.length}/3 {t("métier(s) sélectionné(s)")}
                    </p>
                  )}
                  {profile.domain === "Multi-métier" && selectedDomains.length >= 3 && (
                    <p className="mt-1 text-xs text-amber-400">
                      {t("Maximum 3 métiers atteint.")}
                    </p>
                  )}
                  {profile.domain === "Autre" && (
                    <input
                      type="text"
                      value={customDomain}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setCustomDomain(sanitizeLetters(e.target.value))
                      }
                      placeholder={t("Précisez votre métier")}
                      className="mt-3 w-full rounded-xl border px-4 py-3 outline-none auth-input"
                    />
                  )}
                </div>
              )}

              {profile.role === "technician" && (
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p
                      className="text-xs font-medium mb-2 auth-label"
                    >
                      {t("Tarif horaire (FCFA)")}
                    </p>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={profile.hourlyRate}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        updateProfile("hourlyRate", sanitizeDigits(e.target.value).slice(0, 9))
                      }
                      placeholder={t("Ex : 5000")}
                      className="w-full rounded-xl border px-4 py-3 outline-none auth-input"
                    />
                    <p className="text-[11px] mt-1.5 auth-text-muted">
                      {t("Optionnel · visible dans le catalogue")}
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-xs font-medium mb-2 auth-label"
                    >
                      {t("Années d'expérience")}
                    </p>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={profile.experienceYears}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        updateProfile("experienceYears", sanitizeDigits(e.target.value).slice(0, 3))
                      }
                      placeholder={t("Ex : 5")}
                      className="w-full rounded-xl border px-4 py-3 outline-none auth-input"
                    />
                    <p className="text-[11px] mt-1.5 auth-text-muted">
                      {t("Optionnel")}
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <p className="mb-4 text-sm auth-error">
                  {error}
                </p>
              )}

              <button
                onClick={handleProfileNext}
                className="w-full py-4 rounded-xl font-semibold text-base text-white auth-btn-primary"
              >
                {t("Suivant")}
              </button>

              <p className="mt-4 text-center text-sm auth-text-muted">
                {t("Déjà un compte ?")}{" "}
                <button
                  type="button"
                  onClick={() => setStep("credentials")}
                  className="font-medium auth-link"
                >
                  {t("Se connecter")}
                </button>
              </p>
            </>
          ) : step === "phone" ? (
            <>
              <h2
                className="text-2xl font-bold mb-2 auth-text-primary"
              >
                {t("Vérification de compte")}
              </h2>
              <p className="text-sm mb-8 auth-text-muted">
                {t("Entrez votre numéro pour recevoir un code de sécurité")}
              </p>

              <div className="mb-6">
                <p
                  className="text-xs font-medium mb-2 auth-label"
                >
                  {t("Numéro de téléphone")}
                </p>
                <div
                  className="flex items-center gap-3 rounded-xl px-4 py-4 border auth-input"
                >
                  <span className="text-lg">🇨🇲</span>
                  <span className="text-sm font-medium auth-text-muted">
                    +237
                  </span>
                  <div className="w-px h-5 auth-phone-divider" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(sanitizeDigits(e.target.value))}
                    placeholder="6 XX XX XX XX"
                    className="flex-1 bg-transparent outline-none text-base auth-phone-input"
                    autoFocus
                  />
                </div>
              </div>

              <button
                onClick={handleSend}
                className="w-full py-4 rounded-xl font-semibold text-base text-white mb-4"
                style={{
                  background:
                    phone.length >= 8 ? "linear-gradient(135deg, #2563EB, #1D4ED8)" : "#1E2A42",
                  fontFamily: "Poppins, sans-serif",
                  boxShadow: phone.length >= 8 ? "0 4px 20px rgba(37,99,235,0.35)" : "none",
                  cursor: phone.length >= 8 ? "pointer" : "not-allowed",
                }}
              >
                {t("Recevoir mon code de sécurité")}
              </button>

              <button
                onClick={() => setStep("choice")}
                className="w-full text-sm text-center py-2 auth-text-muted"
              >
                {t("← Retour au choix")}
              </button>
            </>
          ) : (
            <>
              <h2
                className="text-2xl font-bold mb-2 auth-text-primary"
              >
                {t("Code de vérification")}
              </h2>
              <p className="text-sm mb-8 auth-text-muted">
                {t("Code envoyé au ")}<strong className="auth-text-primary">+237 {phone}</strong>
              </p>

              <div className="flex justify-between gap-3 mb-6">
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el
                    }}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleOtp(e.target.value, i)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    className="flex-1 h-16 text-center text-2xl font-bold rounded-xl border-2 outline-none auth-input"
                    style={{
                      borderColor: d ? "#2563EB" : "rgba(255,255,255,0.1)",
                      fontFamily: "JetBrains Mono, monospace",
                      boxShadow: d ? "0 0 0 3px rgba(37,99,235,0.2)" : "none",
                    }}
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              <div className="text-center mb-6">
                {timer > 0 ? (
                  <p className="text-sm font-medium auth-timer">
                    {t("Renvoyer dans ")}
                    <span className="auth-mono">
                      00:{String(timer).padStart(2, "0")}
                    </span>
                  </p>
                ) : (
                  <button
                    onClick={() => setTimer(59)}
                    className="text-sm font-semibold auth-link"
                  >
                    {t("Renvoyer le code")}
                  </button>
                )}
              </div>

              <button
                onClick={() => setStep("phone")}
                className="w-full text-sm text-center py-2 auth-text-muted"
              >
                {t("← Modifier le numéro")}
              </button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
