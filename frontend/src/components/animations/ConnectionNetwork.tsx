import { useRef } from "react"
import { motion, useScroll, useTransform } from "motion/react"

const NODES = [
  { x: 50, y: 50, size: 18, delay: 0 },
  { x: 15, y: 25, size: 8, delay: 0.3 },
  { x: 85, y: 20, size: 9, delay: 0.5 },
  { x: 10, y: 70, size: 7, delay: 0.7 },
  { x: 90, y: 75, size: 8, delay: 0.4 },
  { x: 30, y: 12, size: 6, delay: 0.6 },
  { x: 70, y: 10, size: 7, delay: 0.8 },
  { x: 25, y: 88, size: 8, delay: 0.2 },
  { x: 75, y: 90, size: 6, delay: 0.9 },
  { x: 5, y: 48, size: 7, delay: 0.35 },
  { x: 95, y: 45, size: 8, delay: 0.55 },
  { x: 40, y: 5, size: 6, delay: 0.75 },
  { x: 60, y: 95, size: 7, delay: 0.45 },
  { x: 8, y: 10, size: 5, delay: 0.65 },
  { x: 92, y: 12, size: 6, delay: 0.85 },
]

export default function ConnectionNetwork() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  })

  const lineProgress = useTransform(scrollYProgress, [0.1, 0.6], [0, 1])
  const nodeOpacity = useTransform(scrollYProgress, [0.05, 0.3], [0, 1])
  const centerScale = useTransform(scrollYProgress, [0, 0.3], [0.6, 1])
  const glowOpacity = useTransform(scrollYProgress, [0.15, 0.5], [0, 0.8])
  const pulsePhase = useTransform(scrollYProgress, [0.2, 0.8], [0, 3])

  return (
    <div
      ref={containerRef}
      className="relative w-full flex items-center justify-center overflow-hidden"
      style={{ height: "70vh", minHeight: 500 }}
    >
      {/* Background radial glow */}
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: glowOpacity,
          background:
            "radial-gradient(circle at 50% 50%, rgba(37,99,235,0.15) 0%, rgba(37,99,235,0.03) 40%, transparent 70%)",
        }}
      />

      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full"
        style={{ overflow: "visible" }}
      >
        <defs>
          <radialGradient id="centerGrad" cx="40%" cy="35%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="50%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </radialGradient>
          <radialGradient id="nodeGrad" cx="40%" cy="35%">
            <stop offset="0%" stopColor="#93C5FD" />
            <stop offset="100%" stopColor="#2563EB" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="bigGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines */}
        {NODES.slice(1).map((node, i) => (
          <motion.line
            key={`line-${i}`}
            x1={NODES[0].x}
            y1={NODES[0].y}
            x2={node.x}
            y2={node.y}
            stroke="#2563EB"
            strokeWidth="0.3"
            strokeLinecap="round"
            style={{
              opacity: useTransform(
                scrollYProgress,
                [0.1 + node.delay * 0.3, 0.3 + node.delay * 0.3],
                [0, 0.6],
              ),
              pathLength: useTransform(
                scrollYProgress,
                [0.1 + node.delay * 0.2, 0.4 + node.delay * 0.2],
                [0, 1],
              ),
            }}
            filter="url(#glow)"
          />
        ))}

        {/* Animated pulse circles traveling along lines */}
        {NODES.slice(1).map((node, i) => (
          <motion.circle
            key={`pulse-${i}`}
            r="0.6"
            fill="#60A5FA"
            filter="url(#glow)"
            style={{
              cx: useTransform(
                scrollYProgress,
                [0.15 + i * 0.04, 0.45 + i * 0.04],
                [NODES[0].x, node.x],
              ),
              cy: useTransform(
                scrollYProgress,
                [0.15 + i * 0.04, 0.45 + i * 0.04],
                [NODES[0].y, node.y],
              ),
              opacity: useTransform(
                scrollYProgress,
                [0.12 + i * 0.04, 0.2 + i * 0.04, 0.4 + i * 0.04, 0.48 + i * 0.04],
                [0, 1, 1, 0],
              ),
            }}
          />
        ))}

        {/* Outer nodes */}
        {NODES.slice(1).map((node, i) => (
          <motion.g
            key={`node-${i}`}
            style={{
              opacity: useTransform(
                scrollYProgress,
                [0.15 + node.delay * 0.4, 0.35 + node.delay * 0.4],
                [0, 1],
              ),
            }}
          >
            {/* Outer glow ring */}
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={node.size * 0.8}
              fill="none"
              stroke="#2563EB"
              strokeWidth="0.15"
              style={{
                opacity: useTransform(
                  scrollYProgress,
                  [0.2 + i * 0.03, 0.5 + i * 0.03],
                  [0, 0.3],
                ),
                scale: useTransform(
                  pulsePhase,
                  [0, 1, 2, 3],
                  [1, 1.3, 1, 1.2],
                ),
              }}
            />
            <circle
              cx={node.x}
              cy={node.y}
              r={node.size * 0.35}
              fill="url(#nodeGrad)"
              filter="url(#glow)"
            />
            <circle
              cx={node.x}
              cy={node.y}
              r={node.size * 0.15}
              fill="#E8EDF5"
              opacity="0.8"
            />
          </motion.g>
        ))}

        {/* Center sphere */}
        <motion.g style={{ scale: centerScale, transformOrigin: "50px 50px" }}>
          {/* Outer glow */}
          <circle cx="50" cy="50" r="10" fill="#2563EB" opacity="0.08" filter="url(#bigGlow)" />
          <circle cx="50" cy="50" r="7" fill="#2563EB" opacity="0.12" filter="url(#bigGlow)" />
          {/* Main sphere */}
          <circle cx="50" cy="50" r="5" fill="url(#centerGrad)" filter="url(#glow)" />
          {/* Inner highlight */}
          <circle cx="48.5" cy="48" r="2" fill="#E8EDF5" opacity="0.25" />
          {/* Pulsing ring */}
          <motion.circle
            cx="50"
            cy="50"
            r="6"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="0.3"
            style={{
              scale: useTransform(
                scrollYProgress,
                [0.2, 0.5, 0.8],
                [1, 1.4, 1.1],
              ),
              opacity: useTransform(
                scrollYProgress,
                [0.2, 0.4, 0.7],
                [0, 0.5, 0.2],
              ),
            }}
            filter="url(#glow)"
          />
        </motion.g>
      </svg>

      {/* Labels */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none"
        style={{
          top: "72%",
          opacity: useTransform(scrollYProgress, [0.5, 0.7], [0, 1]),
        }}
      >
        <p
          className="text-xs sm:text-sm font-bold tracking-widest uppercase"
          style={{ color: "#2563EB", fontFamily: "Poppins, sans-serif" }}
        >
          MboaTech
        </p>
        <p className="text-[10px] sm:text-xs mt-1" style={{ color: "#94A3B8" }}>
          Votre demande est distribuée instantanément
        </p>
      </motion.div>
    </div>
  )
}
