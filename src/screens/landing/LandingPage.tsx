import { useRef, useEffect, useState } from "react"
import { motion, useScroll, useTransform, useInView } from "motion/react"
import TiltCard from "../../components/animations/TiltCard"
import FadeIn from "../../components/animations/FadeIn"
import Stagger from "../../components/animations/Stagger"
import StaggerItem from "../../components/animations/StaggerItem"
import ConnectionNetwork from "../../components/animations/ConnectionNetwork"
import PhoneShowcase from "../../components/animations/PhoneShowcase"
import CityMap3D from "../../components/animations/CityMap3D"
import ThemeToggle from "../../components/ThemeToggle"
import { useI18n } from "../../i18n"
import { API_BASE_URL } from "../../config"
import "./LandingPage.css"

interface Props {
  onLogin: () => void
  onRegister: () => void
}

/* ───────── SVG Icons ───────── */
const icons = {
  lock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  check: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  checkCircle: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  bolt: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  clipboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  message: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  search: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  dollarSign: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  star: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  barChart: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  creditCard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  phone: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  trendingUp: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  calendar: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  award: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  ),
  activity: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
}

/* ───────── Floating 3D Orb ───────── */
function FloatingOrb({
  size,
  color,
  x,
  y,
  delay,
  duration,
}: {
  size: number
  color: string
  x: string
  y: string
  delay: number
  duration: number
}) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        background: `radial-gradient(circle at 30% 30%, ${color}40, ${color}10)`,
        boxShadow: `0 0 ${size}px ${color}20`,
        filter: "blur(1px)",
      }}
      animate={{
        y: [0, -30, 0, 20, 0],
        x: [0, 15, -10, 5, 0],
        rotateX: [0, 15, -10, 5, 0],
        rotateY: [0, -20, 10, -5, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  )
}

/* ───────── 3D Floating Card ───────── */
function FloatingFeature({
  icon,
  title,
  desc,
  delay,
  rotation,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  delay: number
  rotation: { x: number; y: number; z: number }
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, rotateX: 25, rotateY: -20 }}
      whileInView={{ opacity: 1, scale: 1, rotateX: rotation.x, rotateY: rotation.y }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 1000 }}
    >
      <TiltCard maxTilt={6} hoverScale={1.04}>
        <div
          className="rounded-2xl p-6 sm:p-8 landing-feature-card"
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl mb-5 landing-feature-icon"
          >
            {icon}
          </div>
          <h3
            className="text-lg font-bold mb-2 landing-card-title"
          >
            {title}
          </h3>
          <p className="text-sm leading-relaxed landing-card-desc">
            {desc}
          </p>
        </div>
      </TiltCard>
    </motion.div>
  )
}

/* ───────── Animated Counter ───────── */
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-60px" })
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isInView) return
    let start = 0
    const step = Math.max(1, Math.floor(target / 40))
    const timer = setInterval(() => {
      start += step
      if (start >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(start)
      }
    }, 30)
    return () => clearInterval(timer)
  }, [isInView, target])

  return (
    <span ref={ref} className="tabular-nums">
      {count.toLocaleString("fr-FR")}
      {suffix}
    </span>
  )
}

/* ───────── Step Connector Line ───────── */
function StepConnector() {
  return (
    <div className="hidden lg:flex items-center justify-center px-2">
      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="h-px w-16 landing-connector"
      />
    </div>
  )
}

/* ═══════════════════════════════════════════ */
/*                LANDING PAGE                */
/* ═══════════════════════════════════════════ */
export default function LandingPage({ onLogin, onRegister }: Props) {
  const { t } = useI18n()
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  const [stats, setStats] = useState({ technicianCount: 0, completedRequests: 0, cityCount: 0, avgRating: 0 })

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/public/stats`)
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {})
  }, [])

  return (
    <div className="landing min-h-screen w-full overflow-x-hidden">
      {/* Theme toggle — fixed top-right */}
      <div className="fixed top-5 right-5 z-50">
        <ThemeToggle className="border-white/15 landing-theme-toggle" />
      </div>

      {/* ══════════ HERO ══════════ */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        {/* Background grid */}
          <div
            className="absolute inset-0 opacity-[0.04] landing-hero-grid"
          />

        {/* Floating orbs */}
        <FloatingOrb size={300} color="#2563EB" x="10%" y="15%" delay={0} duration={8} />
        <FloatingOrb size={200} color="#059669" x="75%" y="20%" delay={1} duration={10} />
        <FloatingOrb size={150} color="#8B5CF6" x="60%" y="65%" delay={2} duration={12} />
        <FloatingOrb size={100} color="#F59E0B" x="20%" y="70%" delay={0.5} duration={9} />
        <FloatingOrb size={80} color="#EC4899" x="85%" y="75%" delay={1.5} duration={11} />

        {/* Radial gradient overlay */}
        <div
          className="absolute inset-0 landing-radial-hero"
        />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 text-center px-4 max-w-5xl mx-auto"
        >
          {/* Badge */}
          <FadeIn delay={0.1}>
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-8 landing-badge"
            >
              <span className="h-2 w-2 rounded-full animate-pulse landing-badge-dot" />
              <span className="text-xs font-semibold landing-badge-text">
                Plateforme de services techniques au Cameroun
              </span>
            </div>
          </FadeIn>

          {/* Headline */}
          <FadeIn delay={0.25}>
            <h1
              className="text-4xl sm:text-5xl md:text-7xl font-extrabold leading-tight mb-6 landing-headline"
            >
              Trouvez votre{" "}
              <span className="landing-gradient-text">
                artisan de confiance
              </span>{" "}
              en quelques clics
            </h1>
          </FadeIn>

          {/* Subtitle */}
          <FadeIn delay={0.4}>
            <p
              className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed landing-subtitle"
            >
              MboaTech connecte les clients aux meilleurs techniciens certifiés.
              Paiement sécurisé en garde, suivi en temps réel, avis vérifiés.
            </p>
          </FadeIn>

          {/* CTA Buttons */}
          <FadeIn delay={0.55}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 8px 30px rgba(37,99,235,0.4)" }}
                whileTap={{ scale: 0.97 }}
                onClick={onRegister}
                className="px-8 py-4 rounded-2xl font-bold text-white text-sm sm:text-base cursor-pointer landing-cta-primary"
              >
                Commencer gratuitement
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05, background: "#1E2A42" }}
                whileTap={{ scale: 0.97 }}
                onClick={onLogin}
                className="px-8 py-4 rounded-2xl font-semibold text-sm sm:text-base cursor-pointer landing-cta-secondary"
              >
                J'ai déjà un compte
              </motion.button>
            </div>
          </FadeIn>

          {/* Trust badges */}
          <FadeIn delay={0.7}>
            <div className="flex flex-wrap items-center justify-center gap-6 mt-12">
              {[
                { icon: icons.lock, text: "Paiement sécurisé" },
                { icon: icons.checkCircle, text: "Artisans vérifiés" },
                { icon: icons.bolt, text: "Intervention rapide" },
              ].map((badge) => (
                <div key={badge.text} className="flex items-center gap-2">
                  <span className="landing-trust-icon">{badge.icon}</span>
                  <span className="text-xs font-medium landing-trust-text">
                    {badge.text}
                  </span>
                </div>
              ))}
            </div>
          </FadeIn>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div
            className="w-6 h-10 rounded-full flex items-start justify-center pt-2 landing-scroll-ring"
          >
            <motion.div
              className="w-1.5 h-1.5 rounded-full landing-scroll-dot"
              animate={{ y: [0, 12, 0], opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </section>

      {/* ══════════ CONCEPT 1: CONNECTION NETWORK ══════════ */}
      <section className="relative py-16 sm:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <p
              className="text-xs font-bold tracking-widest uppercase text-center mb-3 landing-section-label"
            >
              Mise en relation
            </p>
            <h2
              className="text-3xl sm:text-4xl font-extrabold text-center mb-4 landing-section-title"
            >
              Une demande, des{" "}
              <span className="landing-accent-green">professionnels</span> mobilisés
            </h2>
            <p className="text-center text-sm max-w-lg mx-auto mb-8 landing-section-desc">
              Votre demande de dépannage est distribuée instantanément aux techniciens qualifiés autour de vous.
            </p>
          </FadeIn>
          <ConnectionNetwork />
        </div>
      </section>

      {/* ══════════ CONCEPT 2: PHONE SHOWCASE ══════════ */}
      <section className="relative py-16 sm:py-24 px-4">
        <div
          className="absolute inset-0 landing-radial-phone"
        />
        <div className="relative max-w-6xl mx-auto">
          <FadeIn>
            <p
              className="text-xs font-bold tracking-widest uppercase text-center mb-3 landing-section-label-green"
            >
              Expérience utilisateur
            </p>
            <h2
              className="text-3xl sm:text-4xl font-extrabold text-center mb-4 landing-section-title"
            >
              De la demande au{" "}
              <span className="landing-accent-purple">paiement</span>, tout en un
            </h2>
            <p className="text-center text-sm max-w-lg mx-auto mb-8 landing-section-desc">
              Suivez chaque étape de votre intervention en temps réel, de la publication à la libération des fonds.
            </p>
          </FadeIn>
          <PhoneShowcase />
        </div>
      </section>

      {/* ══════════ CONCEPT 3: CITY MAP ══════════ */}
      <section className="relative py-16 sm:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <p
              className="text-xs font-bold tracking-widest uppercase text-center mb-3 landing-section-label-amber"
            >
              Géolocalisation
            </p>
            <h2
              className="text-3xl sm:text-4xl font-extrabold text-center mb-4 landing-section-title"
            >
              Des techniciens{" "}
              <span className="landing-accent-green">près de chez vous</span>
            </h2>
            <p className="text-center text-sm max-w-lg mx-auto mb-8 landing-section-desc">
              Visualisez en temps réel les artisans disponibles dans votre ville. Disponibilité mise à jour instantanément.
            </p>
          </FadeIn>
          <CityMap3D />
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section className="relative py-24 sm:py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <p
              className="text-xs font-bold tracking-widest uppercase text-center mb-3 landing-section-label"
            >
              Comment ça marche
            </p>
            <h2
              className="text-3xl sm:text-4xl font-extrabold text-center mb-4 landing-section-title"
            >
              Simple, rapide, sécurisé
            </h2>
            <p className="text-center text-sm max-w-lg mx-auto mb-16 landing-section-desc">
              De la demande d'intervention à la libération des fonds, tout se passe en toute transparence.
            </p>
          </FadeIn>

          <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-0">
            {[
              {
                step: "01",
                icon: icons.clipboard,
                title: "Décrivez votre besoin",
                desc: "Créez une demande avec le domaine, la description et le niveau d'urgence. Un technicien adapté sera notifié.",
              },
              {
                step: "02",
                icon: icons.message,
                title: "Discutez et planifiez",
                desc: "Échangez en temps réel, recevez un devis, proposez un créneau. Tout se fait dans le chat privé.",
              },
              {
                step: "03",
                icon: icons.checkCircle,
                title: "Validez et payez",
                desc: "Les travaux terminés, vous validez et les fonds sont libérés au technicien. Simple et sécurisé.",
              },
            ].map((item, i) => (
              <div key={item.step} className="flex items-center">
                <FadeIn delay={i * 0.15}>
                  <div className="flex flex-col items-center text-center px-6 py-8 max-w-xs">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-2xl mb-5 landing-step-icon"
                    >
                      {item.icon}
                    </div>
                    <span
                      className="text-xs font-bold tracking-widest mb-2 landing-step-label"
                    >
                      ÉTAPE {item.step}
                    </span>
                    <h3
                      className="text-base font-bold mb-2 landing-step-title"
                    >
                      {item.title}
                    </h3>
                    <p className="text-sm leading-relaxed landing-step-desc">
                      {item.desc}
                    </p>
                  </div>
                </FadeIn>
                {i < 2 && <StepConnector />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FEATURES GRID ══════════ */}
      <section className="relative py-24 sm:py-32 px-4">
        <div
          className="absolute inset-0 landing-radial-features"
        />
        <div className="relative max-w-6xl mx-auto">
          <FadeIn>
            <p
              className="text-xs font-bold tracking-widest uppercase text-center mb-3 landing-section-label-green"
            >
              Fonctionnalités
            </p>
            <h2
              className="text-3xl sm:text-4xl font-extrabold text-center mb-4 landing-section-title"
            >
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-center text-sm max-w-lg mx-auto mb-16 landing-section-desc">
              Une plateforme complète pour gérer vos interventions de A à Z.
            </p>
          </FadeIn>

          <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: icons.search,
                title: "Recherche intelligente",
                desc: "Trouvez un artisan par domaine, ville, note moyenne ou disponibilité. Filtres en temps réel.",
              },
              {
                icon: icons.message,
                title: "Chat temps réel",
                desc: "Messagerie instantanée avec accusé de réception, envoi de photos et de devis intégrés.",
              },
              {
                icon: icons.dollarSign,
                title: "Paiement en garde",
                desc: "Les fonds sont sécurisés jusqu'à validation du travail. MoMo, Orange Money, CB.",
              },
              {
                icon: icons.star,
                title: "Avis vérifiés",
                desc: "Seuls les clients ayant complété une intervention peuvent laisser un avis. Zéro faux avis.",
              },
              {
                icon: icons.activity,
                title: "Suivi en temps réel",
                desc: "Disponibilité des artisans en direct, statut des demandes, notifications instantanées.",
              },
              {
                icon: icons.shield,
                title: "Protection totale",
                desc: "Système de litige avec médiation. En cas de problème, l'administration intervient.",
              },
            ].map((f, i) => (
              <StaggerItem key={f.title} hoverY={-4}>
                <div
                  className="rounded-2xl p-6 h-full landing-card"
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl mb-4 landing-card-icon"
                  >
                    {f.icon}
                  </div>
                  <h3
                    className="text-base font-bold mb-2 landing-card-title"
                  >
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed landing-card-desc">
                    {f.desc}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ══════════ FOR CLIENTS ══════════ */}
      <section className="relative py-24 sm:py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <FadeIn>
              <div>
                <p
                  className="text-xs font-bold tracking-widest uppercase mb-3 landing-section-label-blue"
                >
                  Pour les clients
                </p>
                <h2
                  className="text-3xl sm:text-4xl font-extrabold mb-6 landing-section-title"
                >
                  Des travaux en toute{" "}
                  <span className="landing-accent-green">sérénité</span>
                </h2>
                <div className="space-y-5">
                  {[
                    {
                      icon: icons.search,
                      title: "Artisans certifiés",
                      desc: "Chaque artisan est vérifié (pièce d'identité, certificat métier). Vous êtes entre de bonnes mains.",
                    },
                    {
                      icon: icons.creditCard,
                      title: "Paiement protégé",
                      desc: "Vos fonds sont en garde jusqu'à ce que vous validiez les travaux. Pas de paiement anticipé.",
                    },
                    {
                      icon: icons.phone,
                      title: "Support réactif",
                      desc: "En cas de litige, notre équipe intervient sous 24h pour trouver un compromis équitable.",
                    },
                  ].map((item, i) => (
                    <FadeIn key={item.title} delay={0.1 * (i + 1)}>
                      <div className="flex gap-4">
                        <div
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl landing-list-icon-blue"
                        >
                          {item.icon}
                        </div>
                        <div>
                          <h4
                            className="text-sm font-bold mb-1 landing-list-title"
                          >
                            {item.title}
                          </h4>
                          <p className="text-sm leading-relaxed landing-list-desc">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    </FadeIn>
                  ))}
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="relative">
                <FloatingFeature
                  icon={icons.clipboard}
                  title="Demande d'intervention"
                  desc="Décrivez votre besoin en 2 minutes"
                  delay={0}
                  rotation={{ x: 2, y: -3, z: 0 }}
                />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══════════ FOR TECHNICIENS ══════════ */}
      <section className="relative py-24 sm:py-32 px-4">
        <div
          className="absolute inset-0 landing-radial-tech"
        />
        <div className="relative max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <FadeIn delay={0.2}>
              <div className="relative order-2 lg:order-1">
                <FloatingFeature
                  icon={icons.barChart}
                  title="Dashboard complet"
                  desc="Statistiques, planning, revenus en temps réel"
                  delay={0}
                  rotation={{ x: 2, y: 3, z: 0 }}
                />
              </div>
            </FadeIn>

            <FadeIn className="order-1 lg:order-2">
              <div>
                <p
                  className="text-xs font-bold tracking-widest uppercase mb-3 landing-section-label-green"
                >
                  Pour les techniciens
                </p>
                <h2
                  className="text-3xl sm:text-4xl font-extrabold mb-6 landing-section-title"
                >
                  Développez votre{" "}
                  <span className="landing-accent-blue">activité</span>
                </h2>
                <div className="space-y-5">
                  {[
                    {
                      icon: icons.trendingUp,
                      title: "Revenus stables",
                      desc: "Recevez vos paiements directement après chaque intervention. MoMo, Orange Money ou virement.",
                    },
                    {
                      icon: icons.calendar,
                      title: "Gestion simplifiée",
                      desc: "Planning intégré, rappels avant intervention, statut de disponibilité en un clic.",
                    },
                    {
                      icon: icons.award,
                      title: "Visibilité accrue",
                      desc: "Votre profil apparaît aux clients de votre ville et de votre domaine. Portfolio et avis construisent votre réputation.",
                    },
                  ].map((item, i) => (
                    <FadeIn key={item.title} delay={0.1 * (i + 1)}>
                      <div className="flex gap-4">
                        <div
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl landing-list-icon-green"
                        >
                          {item.icon}
                        </div>
                        <div>
                          <h4
                            className="text-sm font-bold mb-1 landing-list-title"
                          >
                            {item.title}
                          </h4>
                          <p className="text-sm leading-relaxed landing-list-desc">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    </FadeIn>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══════════ STATS ══════════ */}
      <section className="relative py-24 sm:py-32 px-4">
        <div className="max-w-5xl mx-auto">
          <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { value: stats.technicianCount, suffix: "+", label: "Artisans certifiés", color: "#2563EB" },
              { value: stats.completedRequests, suffix: "+", label: "Interventions réalisées", color: "#059669" },
              { value: stats.cityCount || 1, label: "Villes couvertes", color: "#F59E0B" },
              { value: Math.round(stats.avgRating * 10) / 10 || 4.8, label: "Note moyenne", color: "#8B5CF6" },
            ].map((stat) => (
              <StaggerItem key={stat.label}>
                <div className="text-center py-6">
                  <p
                    className="text-3xl sm:text-4xl font-extrabold mb-2"
                    style={{ fontFamily: "Poppins, sans-serif", color: stat.color }}
                  >
                    <Counter target={stat.value} suffix={stat.suffix ?? ""} />
                  </p>
                  <p className="text-xs sm:text-sm font-medium landing-stat-label">
                    {stat.label}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ══════════ FINAL CTA ══════════ */}
      <section className="relative py-24 sm:py-32 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <FadeIn>
            <div
              className="rounded-3xl p-10 sm:p-16 landing-cta-card"
            >
              <h2
                className="text-3xl sm:text-4xl font-extrabold mb-4 landing-section-title"
              >
                Prêt à commencer ?
              </h2>
              <p className="text-sm sm:text-base max-w-md mx-auto mb-8 landing-section-desc">
                Rejoignez des milliers de Camerounais qui font confiance à MboaTech pour leurs travaux.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: "0 8px 30px rgba(37,99,235,0.4)" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onRegister}
                  className="px-8 py-4 rounded-2xl font-bold text-white text-sm sm:text-base cursor-pointer landing-cta-primary"
                >
                  Créer mon compte gratuitement
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05, background: "#1E2A42" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onLogin}
                  className="px-8 py-4 rounded-2xl font-semibold text-sm sm:text-base cursor-pointer landing-cta-secondary"
                >
                  Se connecter
                </motion.button>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer
        className="border-t py-10 px-4 landing-footer"
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg landing-footer-logo"
            >
              <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                <path d="M8 24V14l8-6 8 6v10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13 24v-5h6v5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="24" cy="10" r="4" fill="#059669" />
              </svg>
            </div>
            <span
              className="text-sm font-bold landing-footer-brand"
            >
              MboaTech
            </span>
          </div>
          <p className="text-xs landing-footer-copy">
            &copy; 2026 MboaTech. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  )
}
