import { useCallback, useEffect, useState } from "react"
import { API_BASE_URL } from "../config"

export type AttestationLevel = "BRONZE" | "SILVER" | "GOLD" | "DIAMOND"

export const ATTESTATION_LEVELS: {
  key: AttestationLevel
  label: string
  threshold: number
  color: string
  icon: string
}[] = [
  { key: "BRONZE", label: "Bronze", threshold: 1, color: "#CD7F32", icon: "🥉" },
  { key: "SILVER", label: "Silver", threshold: 2, color: "#94A3B8", icon: "🥈" },
  { key: "GOLD", label: "Gold", threshold: 3, color: "#D4AF37", icon: "🥇" },
  { key: "DIAMOND", label: "Diamond", threshold: 5, color: "#0EA5E9", icon: "💎" },
]

export function attestationLevelMeta(level: AttestationLevel | null | undefined) {
  return ATTESTATION_LEVELS.find((l) => l.key === level) ?? null
}

export type AttestationHistory = {
  id: number
  attestationNumber: string
  level: AttestationLevel
  interventionCount: number
  avgRating: number
  generatedAt: string
}

export type AttestationEligibility = {
  eligible: boolean
  completedCount: number
  avgRating: number
  minRating: number
  ratingMet: boolean
  currentLevel: AttestationLevel | null
  currentLevelThreshold: number
  nextLevel: AttestationLevel | null
  nextLevelThreshold: number
  interventionsNeeded: number
  lastAttestationNumber: string | null
  lastAttestationLevel: AttestationLevel | null
  reachedLevels?: AttestationLevel[]
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const token = localStorage.getItem("mboaTechToken")
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

export function useAttestation() {
  const [eligibility, setEligibility] = useState<AttestationEligibility | null>(null)
  const [history, setHistory] = useState<AttestationHistory[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [checkRes, historyRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/attestation/check`, {
          headers: authHeaders(),
          credentials: "include",
        }),
        fetch(`${API_BASE_URL}/api/attestation/history`, {
          headers: authHeaders(),
          credentials: "include",
        }),
      ])

      if (checkRes.ok) {
        const data = (await checkRes.json()) as AttestationEligibility
        setEligibility(data)
      }

      if (historyRes.ok) {
        const data = (await historyRes.json()) as AttestationHistory[]
        setHistory(data)
      }
    } catch {
      // silence network errors
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const download = useCallback(
    async (level?: AttestationLevel) => {
      try {
        const query = level ? `?level=${level}` : ""
        const response = await fetch(`${API_BASE_URL}/api/attestation/generate${query}`, {
          method: "POST",
          headers: authHeaders(),
          credentials: "include",
        })

        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new Error(body?.message || "Erreur lors de la génération.")
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `attestation-mboatech${level ? `-${level.toLowerCase()}` : ""}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        refresh()
      } catch (err) {
        console.error("Erreur téléchargement attestation:", err)
        throw err
      }
    },
    [refresh],
  )

  return { eligibility, history, loading, refresh, download }
}
