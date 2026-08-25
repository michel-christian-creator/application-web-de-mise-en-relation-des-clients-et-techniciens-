export interface RouteResult {
  coords: [number, number][]
  distance: string
  duration: string
}

export async function getRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<RouteResult | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.routes || data.routes.length === 0) return null
    const route = data.routes[0]
    const coords: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]],
    )
    const distMeters = route.distance as number
    const durSeconds = route.duration as number
    const distance =
      distMeters >= 1000
        ? `${(distMeters / 1000).toFixed(1)} km`
        : `${Math.round(distMeters)} m`
    const durMin = Math.round(durSeconds / 60)
    const duration =
      durMin >= 60
        ? `${Math.floor(durMin / 60)} h ${String(durMin % 60).padStart(2, "0")} min`
        : `${durMin} min`
    return { coords, distance, duration }
  } catch {
    return null
  }
}
