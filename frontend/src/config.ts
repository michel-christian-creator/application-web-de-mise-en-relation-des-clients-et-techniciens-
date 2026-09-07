const DEFAULT_API_BASE_URL = "http://localhost:8082"

export const APP_ENV =
  (import.meta.env.REACT_APP_ENV as string | undefined) ?? import.meta.env.MODE

export const API_BASE_URL =
  (
    (import.meta.env.REACT_APP_API_URL as string | undefined) ??
    (import.meta.env.VITE_API_URL as string | undefined)
  )?.replace(/\/+$/, "") ?? DEFAULT_API_BASE_URL

export const API_WS_BASE =
  (import.meta.env.REACT_APP_WEBSOCKET_URL as string | undefined) ??
  (import.meta.env.VITE_API_WS_BASE as string | undefined) ??
  API_BASE_URL.replace(/^http/, "ws")
