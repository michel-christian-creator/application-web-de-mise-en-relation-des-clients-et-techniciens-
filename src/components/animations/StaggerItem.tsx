import { motion } from "motion/react"
import type { CSSProperties, ReactNode } from "react"

interface StaggerItemProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  hoverY?: number
}

export default function StaggerItem({ children, className, style, hoverY }: StaggerItemProps) {
  return (
    <motion.div
      className={className}
      style={style}
      whileHover={hoverY ? { y: hoverY } : undefined}
      variants={{
        hidden: { opacity: 0, y: 24 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
        },
      }}
    >
      {children}
    </motion.div>
  )
}
