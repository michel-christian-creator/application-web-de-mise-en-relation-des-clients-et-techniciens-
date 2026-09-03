let onSessionExpired: (() => void) | null = null

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler
}

export function getToken(): string {
  return localStorage.getItem("mboaTechToken") ?? ""
}

export function currentToken(): string {
  return getToken()
}

export function clearAuth() {
  localStorage.removeItem("mboaTechToken")
  localStorage.removeItem("mboaTechUser")
  localStorage.removeItem("mboaTechTechnicianId")
  localStorage.removeItem("mboaTechNav")
}

export function notifySessionExpired() {
  clearAuth()
  if (onSessionExpired) {
    onSessionExpired()
  }
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extra }
  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

export interface ApiResponse<T> {
  ok: boolean
  status: number
  data: T | null
}

export async function api<T = unknown>(
  url: string,
  init: RequestInit = {},
  opts: { handle401?: boolean } = {},
): Promise<ApiResponse<T>> {
  const handle401 = opts.handle401 !== false
  try {
    const response = await fetch(url, init)
    if (response.status === 401 && handle401) {
      notifySessionExpired()
      return { ok: false, status: 401, data: null }
    }
    if (!response.ok) {
      return { ok: false, status: response.status, data: null }
    }
    const text = await response.text()
    const data = text ? (JSON.parse(text) as T) : (null as T | null)
    return { ok: true, status: response.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}
