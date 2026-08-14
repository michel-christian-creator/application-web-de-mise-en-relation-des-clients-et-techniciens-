import { useEffect, useRef, useState } from "react"
import { LANGUAGES, tr, useI18n } from "../i18n"

function GlobeIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 12h18M12 3c2.6 2.4 3.9 5.4 3.9 9s-1.3 6.6-3.9 9c-2.6-2.4-3.9-5.4-3.9-9S9.4 5.4 12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function LanguageMenu() {
  const { lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [])

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={tr(lang, "aria.language")}
        title={tr(lang, "aria.language")}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-[#141C2F] px-2.5 text-xs font-semibold text-slate-100"
        style={{ boxShadow: "inset 0 1px 2px rgba(255,255,255,0.04)", fontFamily: "Inter, sans-serif" }}
      >
        <GlobeIcon className="h-4 w-4 text-slate-300" />
        <span>{current.short}</span>
        <ChevronIcon className="h-3 w-3 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#141C2F] py-1.5 shadow-2xl">
          <p
            className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
          >
            {lang === "fr" ? "Langue" : "Language"}
          </p>
          {LANGUAGES.map((l) => {
            const active = l.code === lang
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium"
                style={{
                  background: active ? "rgba(37,99,235,0.18)" : "transparent",
                  color: active ? "#93C5FD" : "#E8EDF5",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <span>{l.label}</span>
                {active && <CheckIcon className="h-3.5 w-3.5 text-[#93C5FD]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
