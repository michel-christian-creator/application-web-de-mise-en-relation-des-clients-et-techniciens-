import { motion } from "motion/react"
import type { ReactNode } from "react"

interface StaggerProps {
  children: ReactNode
  className?: string
  staggerDelay?: number
}

export default function Stagger({ children, className, staggerDelay = 0.06 }: StaggerProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: staggerDelay } },
      }}
    >
      {children}
    </motion.div>
  )
}
