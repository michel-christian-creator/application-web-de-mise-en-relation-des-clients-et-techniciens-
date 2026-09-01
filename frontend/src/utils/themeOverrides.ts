type Theme = "dark" | "light"

const DARK_TO_LIGHT_BG: Record<string, string> = {
  "#070D1A": "#f0f4f8",
  "#0b1120": "#f0f4f8",
  "#0B1120": "#f0f4f8",
  "#071127": "#f8fafc",
  "#0F172A": "#f1f5f9",
  "#0f172a": "#f1f5f9",
  "#111827": "#f8fafc",
  "#141C2F": "#ffffff",
  "#141c2f": "#ffffff",
  "#1E2A42": "#e2e8f0",
  "#1e2a42": "#e2e8f0",
  "#1E3A6A": "#dbeafe",
  "#1e3a6a": "#dbeafe",
  "#1E293B": "#e2e8f0",
  "#1e293b": "#e2e8f0",
  "#0F1629": "#f1f5f9",
  "#0f1629": "#f1f5f9",
  "#1A2236": "#f1f5f9",
  "#1a2236": "#f1f5f9",
  "#0A0F1E": "#f8fafc",
  "#0a0f1e": "#f8fafc",
  "#060A14": "#f1f5f9",
  "#060a14": "#f1f5f9",
  "#030712": "#f8fafc",
  "#090D16": "#f1f5f9",
}

const DARK_TO_LIGHT_TEXT: Record<string, string> = {
  "#E8EDF5": "#1a1a2e",
  "#e8edf5": "#1a1a2e",
  "#F1F5F9": "#1e293b",
  "#f1f5f9": "#1e293b",
  "#CBD5E1": "#475569",
  "#cbd5e1": "#475569",
  "#D9FAEE": "#065f46",
  "#d9faee": "#065f46",
  "#D0D0D0": "#475569",
  "#d0d0d0": "#475569",
  "#F87171": "#dc2626",
  "#f87171": "#dc2626",
  "#93C5FD": "#3b82f6",
  "#93c5fd": "#3b82f6",
  "#94A3B8": "#64748b",
  "#94a3b8": "#64748b",
  "#64748B": "#475569",
  "#64748b": "#475569",
  "#0B1120": "#f0f4f8",
  "#0b1120": "#f0f4f8",
}

const DARK_TO_LIGHT_BORDER: Record<string, string> = {
  "#1E2A42": "#e2e8f0",
  "#1e2a42": "#e2e8f0",
  "#141C2F": "#ffffff",
  "#141c2f": "#ffffff",
}

const ALL_BG_COLORS = new Set(Object.keys(DARK_TO_LIGHT_BG))
const ALL_TEXT_COLORS = new Set(Object.keys(DARK_TO_LIGHT_TEXT))
const ALL_BORDER_COLORS = new Set(Object.keys(DARK_TO_LIGHT_BORDER))

function normalizeHex(hex: string): string {
  if (hex.startsWith("#")) {
    const h = hex.slice(1)
    if (h.length === 6) {
      return "#" + h.toUpperCase()
    }
  }
  return hex.toUpperCase()
}

function extractHexFromValue(value: string): string | null {
  const m = value.match(/#([0-9A-Fa-f]{6})/)
  return m ? "#" + m[1] : null
}

function overrideElementStyles(el: Element) {
  const html = el as HTMLElement
  if (html.closest("[data-theme-static]")) return
  const style = html.style
  if (!style || style.length === 0) return

  let changed = false
  const overrides: Record<string, string> = {}

  for (let i = 0; i < style.length; i++) {
    const prop = style[i]
    const val = style.getPropertyValue(prop)

    const hex = extractHexFromValue(val)
    if (hex) {
      const upper = normalizeHex(hex)

      if ((prop === "background" || prop === "background-color") && ALL_BG_COLORS.has(hex)) {
        overrides["background-color"] = DARK_TO_LIGHT_BG[hex] || DARK_TO_LIGHT_BG[upper] || ""
        changed = true
      }

      if (prop === "color" && ALL_TEXT_COLORS.has(hex)) {
        overrides["color"] = DARK_TO_LIGHT_TEXT[hex] || DARK_TO_LIGHT_TEXT[upper] || ""
        changed = true
      }

      if (prop === "border-color" && ALL_BORDER_COLORS.has(hex)) {
        overrides["border-color"] = DARK_TO_LIGHT_BORDER[hex] || DARK_TO_LIGHT_BORDER[upper] || ""
        changed = true
      }

      if (prop === "border" || prop === "border-left" || prop === "border-right" || prop === "border-top" || prop === "border-bottom") {
        if (hex && ALL_BORDER_COLORS.has(hex)) {
          const lightColor = DARK_TO_LIGHT_BORDER[hex] || DARK_TO_LIGHT_BORDER[normalizeHex(hex)] || ""
          if (lightColor) {
            overrides[prop] = val.replace(hex, lightColor).replace(hex.toUpperCase(), lightColor)
            changed = true
          }
        }
      }
    }

    if (!hex && prop === "color" && val === "#F1F5F9") {
      overrides["color"] = "#1e293b"
      changed = true
    }

    if (!hex && (prop === "border" || prop === "border-color" || prop === "borderTop" || prop === "borderBottom" || prop === "borderLeft" || prop === "borderRight")) {
      if (val.includes("rgba(255,255,255")) {
        const lightVal = val
          .replace(/rgba\(255,\s*255,\s*255,\s*0\.04\)/g, "rgba(0,0,0,0.04)")
          .replace(/rgba\(255,255,255,0\.04\)/g, "rgba(0,0,0,0.04)")
          .replace(/rgba\(255,255,255,0\.05\)/g, "rgba(0,0,0,0.05)")
          .replace(/rgba\(255,255,255,0\.06\)/g, "rgba(0,0,0,0.06)")
          .replace(/rgba\(255,255,255,0\.08\)/g, "rgba(0,0,0,0.08)")
          .replace(/rgba\(255,255,255,0\.1\)/g, "rgba(0,0,0,0.08)")
          .replace(/rgba\(255,255,255,0\.12\)/g, "rgba(0,0,0,0.1)")
          .replace(/rgba\(255,255,255,0\.15\)/g, "rgba(0,0,0,0.1)")
          .replace(/rgba\(255,255,255,0\.2\)/g, "rgba(0,0,0,0.12)")
          .replace(/rgba\( 255, 255, 255, 0\.04\)/g, "rgba(0,0,0,0.04)")
          .replace(/rgba\( 255, 255, 255, 0\.05\)/g, "rgba(0,0,0,0.05)")
          .replace(/rgba\( 255, 255, 255, 0\.06\)/g, "rgba(0,0,0,0.06)")
          .replace(/rgba\( 255, 255, 255, 0\.08\)/g, "rgba(0,0,0,0.08)")
          .replace(/rgba\( 255, 255, 255, 0\.1\)/g, "rgba(0,0,0,0.08)")
          .replace(/rgba\( 255, 255, 255, 0\.15\)/g, "rgba(0,0,0,0.1)")
          .replace(/rgba\( 255, 255, 255, 0\.2\)/g, "rgba(0,0,0,0.12)")
        if (lightVal !== val) {
          overrides[prop] = lightVal
          changed = true
        }
      }
    }

    if (!hex && prop === "background" && val.includes("rgba(255,255,255")) {
      const lightVal = val
        .replace(/rgba\(255,255,255,0\.04\)/g, "rgba(0,0,0,0.04)")
        .replace(/rgba\(255,255,255,0\.05\)/g, "rgba(0,0,0,0.05)")
        .replace(/rgba\(255,255,255,0\.06\)/g, "rgba(0,0,0,0.06)")
        .replace(/rgba\(255,255,255,0\.08\)/g, "rgba(0,0,0,0.08)")
        .replace(/rgba\(255,255,255,0\.1\)/g, "rgba(0,0,0,0.08)")
        .replace(/rgba\(255,255,255,0\.12\)/g, "rgba(0,0,0,0.1)")
        .replace(/rgba\(255,255,255,0\.15\)/g, "rgba(0,0,0,0.1)")
        .replace(/rgba\(255,255,255,0\.2\)/g, "rgba(0,0,0,0.12)")
        .replace(/rgba\( 255, 255, 255, 0\.04\)/g, "rgba(0,0,0,0.04)")
        .replace(/rgba\( 255, 255, 255, 0\.06\)/g, "rgba(0,0,0,0.06)")
        .replace(/rgba\( 255, 255, 255, 0\.08\)/g, "rgba(0,0,0,0.08)")
        .replace(/rgba\( 255, 255, 255, 0\.1\)/g, "rgba(0,0,0,0.08)")
        .replace(/rgba\( 255, 255, 255, 0\.15\)/g, "rgba(0,0,0,0.1)")
      if (lightVal !== val) {
        overrides["background-color"] = lightVal
        changed = true
      }
    }

    if (!hex && prop === "color" && val.includes("rgba(255,255,255")) {
      const lightVal = val
        .replace(/rgba\(255,255,255,0\.15\)/g, "rgba(0,0,0,0.15)")
        .replace(/rgba\( 255, 255, 255, 0\.15\)/g, "rgba(0,0,0,0.15)")
      if (lightVal !== val) {
        overrides["color"] = lightVal
        changed = true
      }
    }
  }

  if (changed) {
    for (const [prop, val] of Object.entries(overrides)) {
      html.style.setProperty(prop, val, "important")
    }
  }
}

function restoreElementStyles(el: Element) {
  const html = el as HTMLElement
  const style = html.style
  if (!style || style.length === 0) return

  const propsToCheck = ["background-color", "color", "border-color", "border", "border-left", "border-right", "border-top", "border-bottom"]
  for (const prop of propsToCheck) {
    const priority = style.getPropertyPriority(prop)
    if (priority === "important") {
      style.removeProperty(prop)
    }
  }
}

let observer: MutationObserver | null = null

function walkAndOverride(root: Document | Element) {
  const els = root.querySelectorAll("*")
  els.forEach(overrideElementStyles)
}

function walkAndRestore(root: Document | Element) {
  const els = root.querySelectorAll("*")
  els.forEach(restoreElementStyles)
}

export function applyTheme(theme: Theme) {
  if (theme === "light") {
    walkAndOverride(document)

    if (observer) observer.disconnect()
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) {
            overrideElementStyles(node)
            node.querySelectorAll("*").forEach(overrideElementStyles)
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  } else {
    walkAndRestore(document)
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }
}
