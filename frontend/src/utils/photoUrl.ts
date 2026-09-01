import { API_BASE_URL } from "../config"

export function resolvePhotoUrl(url?: string | null): string {
  if (!url) return ""
  if (/^(https?:|blob:|data:)/i.test(url)) return url
  if (url.startsWith("/")) return `${API_BASE_URL}${url}`
  return url
}
