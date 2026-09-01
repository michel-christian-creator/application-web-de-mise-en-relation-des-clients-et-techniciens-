import { motion } from "motion/react"
import type { ReactNode } from "react"

interface FadeInProps {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  inView?: boolean
}

export default function FadeIn({
  children,
  delay = 0,
  y = 24,
  className,
  inView = false,
}: FadeInProps) {
  const transition = { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const }
  const target = { opacity: 1, y: 0 }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      {...(inView
        ? { whileInView: target, viewport: { once: true, margin: "-60px" } }
        : { animate: target })}
      transition={transition}
    >
      {children}
    </motion.div>
  )
}
