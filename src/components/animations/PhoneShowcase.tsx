import { useRef } from "react"
import { motion, useScroll, useTransform } from "motion/react"

const STEPS = [
  { step: "01", label: "Demande de dépannage", color: "#2563EB" },
  { step: "02", label: "Vérification KYC", color: "#059669" },
  { step: "03", label: "Paiement sécurisé", color: "#8B5CF6" },
]

/* ───────────────────────── SCREEN 1 : LIVE TRACKING ───────────────────────── */
function ScreenTracking() {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "#0A0F1E" }}>
      <StatusBar />
      <div className="px-5 pt-4 pb-3">
        <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#3B82F6" }}>
          Suivi en direct
        </p>
      </div>
      <div className="px-4 mb-3">
        <motion.div
          className="rounded-2xl p-4 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(37,99,235,0.04) 100%)",
            border: "1px solid rgba(37,99,235,0.2)",
          }}
          animate={{ boxShadow: ["0 0 0 0 rgba(37,99,235,0)", "0 0 20px 2px rgba(37,99,235,0.15)", "0 0 0 0 rgba(37,99,235,0)"] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <motion.span
                className="absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: "#EF4444" }}
                animate={{ scale: [1, 1.8, 1], opacity: [0.75, 0, 0.75] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "#EF4444" }} />
            </span>
            <span className="text-[8px] font-extrabold uppercase tracking-wider" style={{ color: "#F87171" }}>
              Urgent
            </span>
          </div>
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
              style={{ background: "rgba(37,99,235,0.2)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold mb-0.5" style={{ color: "#E8EDF5", fontFamily: "Poppins" }}>
                Fuite d&apos;eau — Urgent
              </p>
              <p className="text-[8px] leading-relaxed" style={{ color: "#64748B" }}>
                Fuite sous l&apos;évier de la cuisine. Eau qui dégouline en continu.
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <span
              className="text-[7px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(239,68,68,0.12)", color: "#F87171", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              Critique
            </span>
            <span
              className="text-[7px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: "#141C2F", color: "#64748B" }}
            >
              Douala
            </span>
          </div>
        </motion.div>
      </div>
      <div className="px-4 mb-3">
        <div className="rounded-xl p-3" style={{ background: "#141C2F", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-2 mb-2.5">
            <motion.div
              className="w-4 h-4 rounded-full border-2 border-t-transparent"
              style={{ borderColor: "#3B82F6", borderTopColor: "transparent" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <span className="text-[8px] font-semibold" style={{ color: "#94A3B8" }}>
              Recherche d&apos;artisans...
            </span>
          </div>
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "#1E2A42" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #2563EB, #60A5FA)" }}
              initial={{ width: "0%" }}
              animate={{ width: ["0%", "72%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[7px]" style={{ color: "#475569" }}>3 artisan(s) proche</span>
            <span className="text-[7px] font-bold" style={{ color: "#3B82F6" }}>72%</span>
          </div>
        </div>
      </div>
      <div className="px-4 flex-1">
        <p className="text-[7px] uppercase tracking-widest font-bold mb-2" style={{ color: "#475569" }}>
          Artisans disponibles
        </p>
        <div className="space-y-2">
          {[
            { name: "Jean K.", trade: "Plombier", dist: "1.2 km", rating: "4.8" },
            { name: "Paul M.", trade: "Électricien", dist: "2.5 km", rating: "4.6" },
          ].map((t) => (
            <div
              key={t.name}
              className="flex items-center gap-2.5 rounded-xl p-2.5"
              style={{ background: "#0F1629", border: "1px solid rgba(255,255,255,0.04)" }}
            >
              <div
                className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.2)" }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-bold" style={{ color: "#E8EDF5" }}>{t.name}</p>
                <p className="text-[7px]" style={{ color: "#64748B" }}>{t.trade} · {t.dist}</p>
              </div>
              <div className="flex items-center gap-0.5">
                <svg width="7" height="7" viewBox="0 0 24 24" fill="#FBBF24" stroke="#FBBF24" strokeWidth="1">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span className="text-[7px] font-bold" style={{ color: "#FBBF24" }}>{t.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 pb-5 pt-3">
        <div
          className="rounded-xl py-2.5 text-center text-[9px] font-bold"
          style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)", color: "white" }}
        >
          Publier la demande
        </div>
      </div>
    </div>
  )
}

/* ───────────────────── SCREEN 2 : KYC / SECURITY BADGE ───────────────────── */
function ScreenKYC() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: "#0A0F1E" }}>
      <StatusBar />
      <div className="relative mb-6">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 90 + i * 30,
              height: 90 + i * 30,
              top: "50%",
              left: "50%",
              marginTop: -(90 + i * 30) / 2,
              marginLeft: -(90 + i * 30) / 2,
              border: `1px solid rgba(5,150,105,${0.25 - i * 0.07})`,
            }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2.5, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        <motion.div
          className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(5,150,105,0.25), rgba(5,150,105,0.08))",
            border: "2px solid rgba(5,150,105,0.4)",
            boxShadow: "0 0 40px rgba(5,150,105,0.2)",
          }}
          animate={{ rotateY: [0, 0, 180, 180, 0] }}
          transition={{ duration: 5, repeat: Infinity, times: [0, 0.35, 0.5, 0.85, 1] }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <motion.polyline
              points="9 12 11 14 15 10"
              stroke="#34D399"
              strokeWidth="2.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: 1.5, repeat: Infinity, repeatDelay: 3.5 }}
            />
          </svg>
          <div className="absolute inset-0 rounded-2xl" style={{ boxShadow: "0 0 30px rgba(52,211,153,0.15)" }} />
        </motion.div>
      </div>
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <motion.div
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 mb-3"
          style={{ background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.3)" }}
          animate={{ boxShadow: ["0 0 0 0 rgba(52,211,153,0)", "0 0 16px 4px rgba(52,211,153,0.15)", "0 0 0 0 rgba(52,211,153,0)"] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-[9px] font-extrabold" style={{ color: "#34D399" }}>
            Artisan Vérifié KYC
          </span>
        </motion.div>
        <p className="text-[10px] font-bold mb-1" style={{ color: "#E8EDF5", fontFamily: "Poppins" }}>
          Jean Kamga
        </p>
        <p className="text-[8px] mb-1" style={{ color: "#64748B" }}>
          Plombier certifié · 8 ans d&apos;expérience
        </p>
        <div className="flex items-center justify-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <svg key={s} width="10" height="10" viewBox="0 0 24 24" fill={s <= 4 ? "#FBBF24" : "none"} stroke="#FBBF24" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ))}
          <span className="text-[9px] font-bold ml-1" style={{ color: "#FBBF24" }}>4.8</span>
        </div>
      </motion.div>
      <div className="w-full px-4 space-y-2">
        {["Pièce d'identité validée", "Diplôme professionnel vérifié", "Adresse confirmée"].map((text, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: "#141C2F", border: "1px solid rgba(255,255,255,0.04)" }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1 + i * 0.3 }}
          >
            <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(5,150,105,0.2)" }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-[8px]" style={{ color: "#94A3B8" }}>{text}</span>
          </motion.div>
        ))}
      </div>
      <div className="px-4 pb-5 pt-4 w-full">
        <div
          className="rounded-xl py-2.5 text-center text-[9px] font-bold"
          style={{ background: "rgba(5,150,105,0.12)", color: "#34D399", border: "1px solid rgba(5,150,105,0.25)" }}
        >
          Intervient dans 25 min
        </div>
      </div>
    </div>
  )
}

/* ──────────────────── SCREEN 3 : ESCROW / PAYMENT VAULT ──────────────────── */
function ScreenEscrow() {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "#0A0F1E" }}>
      <StatusBar />
      <div className="px-5 pt-4 pb-2">
        <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#8B5CF6" }}>
          Paiement en garde
        </p>
      </div>
      <div className="px-4 mb-3">
        <div
          className="rounded-2xl p-5 text-center relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(139,92,246,0.02) 100%)",
            border: "1px solid rgba(139,92,246,0.2)",
          }}
        >
          <motion.div
            className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.06))",
              border: "1px solid rgba(139,92,246,0.3)",
              boxShadow: "0 0 24px rgba(139,92,246,0.15)",
            }}
            animate={{ rotateY: [0, 0, 180, 180, 0], scale: [1, 1.05, 1.05, 1, 1] }}
            transition={{ duration: 5, repeat: Infinity, times: [0, 0.3, 0.5, 0.8, 1] }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <circle cx="12" cy="16" r="1.5" fill="#A78BFA" />
            </svg>
          </motion.div>
          <p className="text-[18px] font-extrabold mb-0.5" style={{ color: "#E8EDF5", fontFamily: "Poppins" }}>
            25 000 FCFA
          </p>
          <p className="text-[8px]" style={{ color: "#64748B" }}>
            Montant en garde · Sécurisé
          </p>
          <div className="absolute top-2 right-2 flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1 h-1 rounded-full"
                style={{ background: "#8B5CF6" }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 mb-3">
        <div className="space-y-0">
          {[
            { label: "Dépôt confirmé", done: true },
            { label: "Intervention terminée", done: true },
            { label: "Validation en cours", done: false, active: true },
            { label: "Fonds libérés", done: false },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center" style={{ width: 16 }}>
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                  style={{
                    background: s.done ? "#059669" : s.active ? "#8B5CF6" : "#1E2A42",
                    border: s.done || s.active ? "none" : "1px solid #2D3A52",
                    boxShadow: s.active ? "0 0 8px rgba(139,92,246,0.4)" : "none",
                  }}
                />
                {i < 3 && (
                  <div
                    className="w-px flex-1 my-0.5"
                    style={{
                      background: s.done ? "rgba(5,150,105,0.3)" : "rgba(30,42,66,0.8)",
                      minHeight: 12,
                    }}
                  />
                )}
              </div>
              <div className="pb-2.5">
                <span
                  className="text-[8px] font-semibold"
                  style={{ color: s.done ? "#94A3B8" : s.active ? "#A78BFA" : "#475569" }}
                >
                  {s.label}
                </span>
                {s.active && (
                  <motion.div
                    className="flex items-center gap-1 mt-0.5"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <motion.div
                      className="w-3 h-3 rounded-full border border-t-transparent"
                      style={{ borderColor: "#8B5CF6", borderTopColor: "transparent" }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <span className="text-[7px]" style={{ color: "#8B5CF6" }}>En cours...</span>
                  </motion.div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 mb-3">
        <div className="rounded-xl p-3" style={{ background: "#141C2F", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[8px]" style={{ color: "#64748B" }}>Intervention</span>
            <span className="text-[8px] font-bold" style={{ color: "#94A3B8" }}>25 000 FCFA</span>
          </div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[8px]" style={{ color: "#64748B" }}>Frais de service</span>
            <span className="text-[8px] font-bold" style={{ color: "#94A3B8" }}>1 250 FCFA</span>
          </div>
          <div className="h-px my-1.5" style={{ background: "#1E2A42" }} />
          <div className="flex justify-between items-center">
            <span className="text-[8px] font-bold" style={{ color: "#E8EDF5" }}>Total en garde</span>
            <span className="text-[9px] font-extrabold" style={{ color: "#A78BFA" }}>26 250 FCFA</span>
          </div>
        </div>
      </div>
      <div className="flex-1" />
      <div className="px-4 pb-5 pt-2">
        <motion.div
          className="rounded-xl py-3 text-center text-[10px] font-extrabold"
          style={{
            background: "linear-gradient(135deg, #059669, #047857)",
            color: "white",
            boxShadow: "0 4px 20px rgba(5,150,105,0.3)",
          }}
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Valider · Libérer les fonds
        </motion.div>
      </div>
    </div>
  )
}

/* ────────────────────── STATUS BAR (shared) ────────────────────── */
function StatusBar() {
  return (
    <div className="flex items-center justify-between px-5 pt-2.5 pb-1.5" style={{ background: "transparent" }}>
      <span className="text-[8px] font-semibold" style={{ color: "#64748B" }}>9:41</span>
      <div className="flex items-center gap-1">
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
          <rect x="0" y="5" width="2" height="3" rx="0.5" fill="#475569" />
          <rect x="3" y="3.5" width="2" height="4.5" rx="0.5" fill="#475569" />
          <rect x="6" y="2" width="2" height="6" rx="0.5" fill="#475569" />
          <rect x="9" y="0" width="2" height="8" rx="0.5" fill="#64748B" />
        </svg>
        <svg width="16" height="8" viewBox="0 0 16 8" fill="none">
          <rect x="0.5" y="0.5" width="13" height="7" rx="1.5" stroke="#475569" strokeWidth="0.5" />
          <rect x="14" y="2" width="1.5" height="3" rx="0.5" fill="#475569" />
          <rect x="1.5" y="1.5" width="9" height="5" rx="0.5" fill="#475569" />
        </svg>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN — WHITE PORCELAIN iPHONE ON CYAN STUDIO BACKGROUND
   ══════════════════════════════════════════════════════════════════════════════ */
export default function PhoneShowcase() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  })

  /* ── Fixed phone position, scroll-driven screen changes only ── */
  const phoneY = useTransform(
    scrollYProgress,
    [0.05, 0.28, 0.55, 0.75],
    [20, -10, -22, -10],
  )
  const idleY = useTransform(
    scrollYProgress,
    [0.05, 0.16, 0.28],
    [0, -6, 0],
  )

  // Screen crossfade
  const scr1 = useTransform(scrollYProgress, [0.05, 0.28, 0.33, 0.38], [1, 1, 0, 0])
  const scr2 = useTransform(scrollYProgress, [0.30, 0.38, 0.48, 0.53], [0, 1, 1, 0])
  const scr3 = useTransform(scrollYProgress, [0.50, 0.55, 0.75, 0.85], [0, 1, 1, 0.8])

  return (
    <div
      ref={containerRef}
      data-theme-static
      className="relative w-full flex items-center justify-center overflow-hidden"
      style={{ height: "120vh", minHeight: 700 }}
    >
      {/* Step indicators */}
      <div className="absolute left-4 sm:left-12 lg:left-20 top-1/2 -translate-y-1/2 space-y-10 z-10">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.step}
            className="flex items-center gap-3"
            style={{
              opacity: useTransform(
                scrollYProgress,
                [0.08 + i * 0.22, 0.18 + i * 0.22, 0.55 + i * 0.1, 0.65 + i * 0.1],
                [0.2, 1, 1, 0.2],
              ),
              x: useTransform(
                scrollYProgress,
                [0.08 + i * 0.22, 0.18 + i * 0.22],
                [-12, 0],
              ),
            }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{
                background: `${s.color}15`,
                border: `1.5px solid ${s.color}40`,
                color: s.color,
              }}
            >
              {s.step}
            </div>
            <div className="hidden sm:block">
              <p
                className="text-[11px] font-bold"
                style={{ color: "#E8EDF5", fontFamily: "Poppins" }}
              >
                {s.label}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── 3D Phone ── */}
      <motion.div
        className="relative z-10"
        style={{
          perspective: 1400,
          perspectiveOrigin: "50% 45%",
        }}
      >
        <motion.div
          style={{
            rotateY: -18,
            rotateX: 14,
            rotateZ: 3,
            scale: 1,
            y: useTransform([phoneY, idleY] as any, ([a, b]: any) => (a ?? 0) + (b ?? 0)),
            transformStyle: "preserve-3d",
          }}
        >
          {/* ═══════════════════════════════════════════════════
              PHONE CHASSIS — White Porcelain, 0.74 cm thick
              ═══════════════════════════════════════════════════ */}
          <div
            className="relative"
            style={{
              width: 280,
              height: 570,
              transformStyle: "preserve-3d",
            }}
          >
            {/* ── BACK FACE ── */}
            <div
              className="absolute inset-0 rounded-[3.2rem]"
              style={{
                background: "#FFFFFF",
                transform: "translateZ(-20px)",
                backfaceVisibility: "hidden",
                boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.04)",
              }}
            >
              {/* Camera module — white on white */}
              <div
                className="absolute top-5 left-5 w-[68px] h-[68px] rounded-[1.1rem]"
                style={{
                  background: "#F5F5F5",
                  border: "0.5px solid rgba(0,0,0,0.05)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                {[
                  { t: 8, l: 8 },
                  { t: 8, l: 36 },
                  { t: 36, l: 8 },
                ].map((pos, i) => (
                  <div
                    key={i}
                    className="absolute w-[22px] h-[22px] rounded-full"
                    style={{
                      top: pos.t,
                      left: pos.l,
                      background: "radial-gradient(circle at 35% 35%, #222 0%, #0A0A0A 70%)",
                      border: "1.5px solid #E0E0E0",
                    }}
                  >
                    <div
                      className="absolute rounded-full"
                      style={{
                        top: 4,
                        left: 4,
                        width: 8,
                        height: 8,
                        background: "radial-gradient(circle at 40% 30%, rgba(80,120,180,0.4) 0%, transparent 100%)",
                      }}
                    />
                  </div>
                ))}
                <div
                  className="absolute w-3 h-3 rounded-full"
                  style={{ top: 44, left: 40, background: "radial-gradient(circle, #FFF8E1, #FFE082)" }}
                />
              </div>

              {/* MboaTech logo */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="text-[9px] font-bold tracking-[0.25em] uppercase" style={{ color: "#D0D0D0" }}>
                  MboaTech
                </span>
              </div>
            </div>

            {/* ── FRONT FACE — White bezel + flat screen ── */}
            <div
              className="absolute inset-0 rounded-[3.2rem] overflow-hidden"
              style={{
                background: "#FFFFFF",
                boxShadow: `
                  0 20px 50px rgba(0,0,0,0.12),
                  0 6px 16px rgba(0,0,0,0.06)
                `,
                transform: "translateZ(20px)",
                backfaceVisibility: "hidden",
              }}
            >
              {/* White bezel border */}
              <div
                className="absolute inset-0 rounded-[3.2rem] pointer-events-none"
                style={{
                  border: "0.5px solid rgba(0,0,0,0.04)",
                }}
              />

              {/* Flat screen (recessed <1mm into white bezel) */}
              <div
                className="absolute rounded-[2.6rem] overflow-hidden"
                style={{
                  top: 10,
                  left: 10,
                  right: 10,
                  bottom: 10,
                  background: "#0A0F1E",
                  boxShadow: "inset 0 0.5px 2px rgba(0,0,0,0.25), inset 0 0 0.5px rgba(0,0,0,0.15)",
                }}
              >
                {/* Screen content layers */}
                <motion.div className="absolute inset-0" style={{ opacity: scr1 }}>
                  <ScreenTracking />
                </motion.div>
                <motion.div className="absolute inset-0" style={{ opacity: scr2 }}>
                  <ScreenKYC />
                </motion.div>
                <motion.div className="absolute inset-0" style={{ opacity: scr3 }}>
                  <ScreenEscrow />
                </motion.div>
              </div>

              {/* ── Notch (inverted trapezoid shape) ── */}
              <div className="absolute top-[10px] left-1/2 -translate-x-1/2 z-30">
                <div
                  className="flex items-center justify-center gap-1.5"
                  style={{
                    width: 88,
                    height: 20,
                    background: "#0A0F1E",
                    borderBottomLeftRadius: 10,
                    borderBottomRightRadius: 10,
                  }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: "radial-gradient(circle at 35% 35%, #1a2744, #060A14)",
                      border: "0.5px solid rgba(255,255,255,0.06)",
                    }}
                  />
                  <div className="w-7 h-[2.5px] rounded-full" style={{ background: "#060A14" }} />
                  <div
                    className="w-[7px] h-[7px] rounded-full"
                    style={{
                      background: "radial-gradient(circle, #1a2040, #060A14)",
                      border: "0.3px solid rgba(255,255,255,0.04)",
                    }}
                  />
                </div>
              </div>

              {/* Screen glass reflection */}
              <div
                className="absolute rounded-[2.6rem] pointer-events-none"
                style={{
                  top: 10,
                  left: 10,
                  right: 10,
                  bottom: 10,
                  background: "linear-gradient(165deg, rgba(255,255,255,0.06) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.02) 100%)",
                  zIndex: 40,
                }}
              />
            </div>
          </div>
        </motion.div>

        {/* ── Ambient occlusion shadow (upper-left light → shadow under right side) ── */}
        <motion.div
          className="absolute"
          style={{
            width: 220,
            height: 18,
            bottom: -18,
            left: "50%",
            marginLeft: 20,
            background: "radial-gradient(ellipse, rgba(0,30,60,0.12) 0%, transparent 70%)",
            filter: "blur(12px)",
            opacity: useTransform(scrollYProgress, [0.05, 0.3, 0.6], [0.4, 0.6, 0.4]),
          }}
        />
      </motion.div>
    </div>
  )
}
