import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet"
import type { Map } from "leaflet"
import L from "leaflet"
import { geocodeLocation } from "../utils/geocode"
import { getRoute, type RouteResult } from "../utils/route"

interface Props {
  clientCity: string
  clientLocation?: string
  techCity: string
  techLocation?: string
  clientName: string
}

const techIcon = L.divIcon({
  className: "",
  html: `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#2563EB,#1D4ED8);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

const clientIcon = L.divIcon({
  className: "",
  html: `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#059669,#047857);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

function CaptureMap({ onReady }: { onReady: (map: Map) => void }) {
  const map = useMap()
  useEffect(() => {
    onReady(map)
  }, [map, onReady])
  return null
}

function SyncView({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length >= 2) {
      map.fitBounds(positions, { padding: [50, 50], maxZoom: 14 })
    } else if (positions.length === 1) {
      map.setView(positions[0], 14)
    }
  }, [positions, map])
  return null
}

const inputStyle: React.CSSProperties = {
  background: "#141c2f",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#e8edf5",
  fontSize: 13,
  padding: "10px 12px",
  borderRadius: 10,
  width: "100%",
  outline: "none",
  fontFamily: "Inter, sans-serif",
}

const labelStyle: React.CSSProperties = {
  color: "#94A3B8",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 4,
  display: "block",
}

export default function ItineraryMap({
  clientCity,
  clientLocation,
  techCity,
  techLocation,
  clientName,
}: Props) {
  const [techInput, setTechInput] = useState(
    [techLocation, techCity].filter(Boolean).join(", "),
  )
  const [clientInput, setClientInput] = useState(
    [clientLocation, clientCity || techCity].filter(Boolean).join(", "),
  )

  const [techPos, setTechPos] = useState<[number, number] | null>(null)
  const [clientPos, setClientPos] = useState<[number, number] | null>(null)
  const [techDisplayName, setTechDisplayName] = useState("")
  const [clientDisplayName, setClientDisplayName] = useState("")
  const [route, setRoute] = useState<RouteResult | null>(null)
  const [status, setStatus] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const mapRef = useRef<Map | null>(null)

  const locate = useCallback(async () => {
    setError(null)
    setRoute(null)
    setTechPos(null)
    setClientPos(null)
    setTechDisplayName("")
    setClientDisplayName("")

    const techQuery = techInput.trim()
    const clientQuery = clientInput.trim()

    if (!techQuery) {
      setError("Renseignez votre position.")
      return
    }
    if (!clientQuery) {
      setError("Renseignez la position du client.")
      return
    }

    setSearched(true)

    setStatus(`Recherche de votre position (${techQuery})…`)
    const t = await geocodeLocation(techQuery, undefined)
    if (!t) {
      setError(`Position introuvable : "${techQuery}". Essayez avec plus de détails (ex: quartier, ville).`)
      setStatus("")
      return
    }
    setTechPos([t.lat, t.lng])
    setTechDisplayName(t.displayName)

    setStatus(`Recherche du client (${clientQuery})…`)
    const c = await geocodeLocation(clientQuery, undefined)
    if (!c) {
      setError(`Position introuvable : "${clientQuery}". Essayez avec plus de détails (ex: quartier, ville).`)
      setStatus("")
      return
    }
    setClientPos([c.lat, c.lng])
    setClientDisplayName(c.displayName)

    setStatus("Calcul de l'itinéraire…")
    const r = await getRoute(t, c)
    if (!r) {
      setError("Calcul de l'itinéraire impossible. Vérifiez votre connexion.")
      setStatus("")
      return
    }
    setRoute(r)
    setStatus("")
  }, [techInput, clientInput])

  useEffect(() => {
    locate()
  }, [])

  const positions = useMemo(() => {
    const p: [number, number][] = []
    if (techPos) p.push(techPos)
    if (clientPos) p.push(clientPos)
    return p
  }, [techPos, clientPos])

  const center: [number, number] = techPos ?? clientPos ?? [3.848, 11.502]

  const onMapReady = useCallback((map: Map) => {
    mapRef.current = map
  }, [])

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <label style={labelStyle}>
            <span style={{ color: "#3B82F6" }}>●</span> Votre position
          </label>
          <input
            type="text"
            value={techInput}
            onChange={(e) => setTechInput(e.target.value)}
            placeholder="ex: Akwa, Douala"
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter") locate()
            }}
          />
        </div>
        <div>
          <label style={labelStyle}>
            <span style={{ color: "#059669" }}>●</span> Position du client
          </label>
          <input
            type="text"
            value={clientInput}
            onChange={(e) => setClientInput(e.target.value)}
            placeholder="ex: Bastos, Yaoundé"
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter") locate()
            }}
          />
        </div>
      </div>

      <button
        onClick={locate}
        disabled={!!status}
        style={{
          width: "100%",
          padding: "10px 0",
          marginBottom: 12,
          borderRadius: 10,
          border: "none",
          background: status ? "#1E2A42" : "linear-gradient(135deg, #2563EB, #1D4ED8)",
          color: status ? "#64748B" : "#fff",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "Inter, sans-serif",
          cursor: status ? "default" : "pointer",
          boxShadow: status ? "none" : "0 2px 10px rgba(37,99,235,0.3)",
        }}
      >
        {status ? "Recherche…" : "Localiser et calculer l'itinéraire"}
      </button>

      {error && (
        <div
          style={{
            padding: "12px",
            textAlign: "center",
            color: "#F87171",
            fontSize: 12,
            background: "rgba(239,68,68,0.08)",
            borderRadius: 10,
            border: "1px solid rgba(239,68,68,0.2)",
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          height: 350,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.06)",
          position: "relative",
        }}
      >
        {status && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(15,23,42,0.85)",
              pointerEvents: "none",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: "3px solid rgba(37,99,235,0.3)",
                  borderTopColor: "#2563EB",
                  borderRadius: "50%",
                  animation: "itinerary-spin 0.8s linear infinite",
                  margin: "0 auto 10px",
                }}
              />
              <p style={{ color: "#94A3B8", fontSize: 12 }}>{status}</p>
            </div>
          </div>
        )}

        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
          zoomControl={true}
          dragging={true}
          doubleClickZoom={true}
          touchZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CaptureMap onReady={onMapReady} />
          <SyncView positions={positions} />
          {techPos && (
            <Marker position={techPos} icon={techIcon}>
              <Popup>
                <div style={{ fontSize: 12, lineHeight: 1.4, maxWidth: 220 }}>
                  <strong style={{ color: "#2563EB" }}>Technicien</strong><br />
                  {techDisplayName}
                </div>
              </Popup>
            </Marker>
          )}
          {clientPos && (
            <Marker position={clientPos} icon={clientIcon}>
              <Popup>
                <div style={{ fontSize: 12, lineHeight: 1.4, maxWidth: 220 }}>
                  <strong style={{ color: "#059669" }}>Client · {clientName}</strong><br />
                  {clientDisplayName}
                </div>
              </Popup>
            </Marker>
          )}
          {route && (
            <Polyline
              positions={route.coords}
              pathOptions={{ color: "#F59E0B", weight: 5, opacity: 0.9 }}
            />
          )}
        </MapContainer>
      </div>

      {route && !status && (
        <div style={{ display: "flex", gap: 16, justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#64748B", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Distance
            </p>
            <p style={{ color: "#E8EDF5", fontSize: 15, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
              {route.distance}
            </p>
          </div>
          <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#64748B", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Durée estimée
            </p>
            <p style={{ color: "#E8EDF5", fontSize: 15, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
              {route.duration}
            </p>
          </div>
        </div>
      )}

      {!status && !error && searched && (
        <div style={{ display: "flex", justifyContent: "center", gap: 20, padding: "6px 0 0", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB" }} />
            <span style={{ color: "#94A3B8", fontSize: 11 }}>Technicien{techDisplayName ? ` · ${techDisplayName}` : ""}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669" }} />
            <span style={{ color: "#94A3B8", fontSize: 11 }}>Client · {clientName}{clientDisplayName ? ` · ${clientDisplayName}` : ""}</span>
          </div>
        </div>
      )}

      <style>{`@keyframes itinerary-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
