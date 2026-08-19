import { useState, useEffect, useCallback, useRef } from "react"
import { applyTheme } from "../utils/themeOverrides"

type Theme = "dark" | "light"

const STORAGE_KEY = "mboaTechTheme"

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "light" || stored === "dark") return stored
  } catch {}
  return "dark"
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {}

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      applyTheme(theme)
    })

    return () => cancelAnimationFrame(rafRef.current)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"))
  }, [])

  return { theme, toggleTheme, isDark: theme === "dark" }
}
