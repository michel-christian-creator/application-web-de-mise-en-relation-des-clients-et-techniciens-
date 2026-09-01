const cache = new Map<string, { lat: number; lng: number; displayName: string }>()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function nominatimSearch(
  query: string,
  viewbox?: string,
): Promise<{ lat: number; lng: number; display: string } | null> {
  let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=3&accept-language=fr`
  if (viewbox) url += `&viewbox=${viewbox}&bounded=1`
  console.log("[geocode] Recherche:", query, viewbox ? `(viewbox: ${viewbox})` : "")
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      headers: { "User-Agent": "MboaTech/1.0 (https://mboatech.com; contact@mboatech.com)" },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      console.log("[geocode] HTTP error:", res.status)
      return null
    }
    const data = await res.json()
    console.log(
      "[geocode] Résultats:",
      data.length > 0 ? data.map((d: { display_name: string }) => d.display_name).join(" | ") : "vide",
    )
    if (!Array.isArray(data) || data.length === 0) return null
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      display: data[0].display_name,
    }
  } catch (e) {
    console.log("[geocode] Erreur fetch:", e)
    return null
  }
}

async function geocodeWithFallback(
  city: string,
  location: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const cityResult = await nominatimSearch(`${city}, Cameroun`)
  if (!cityResult) return null

  const d = 0.2
  const viewbox = `${cityResult.lng - d},${cityResult.lat + d},${cityResult.lng + d},${cityResult.lat - d}`

  await sleep(1100)

  const r1 = await nominatimSearch(`${location}, ${city}, Cameroun`, viewbox)
  if (r1) return { lat: r1.lat, lng: r1.lng, displayName: r1.display }
  await sleep(1100)

  const r2 = await nominatimSearch(`${location}, Cameroun`, viewbox)
  if (r2) return { lat: r2.lat, lng: r2.lng, displayName: r2.display }
  await sleep(1100)

  const r3 = await nominatimSearch(`${location}, ${city}, Cameroun`)
  if (r3) return { lat: r3.lat, lng: r3.lng, displayName: r3.display }

  return null
}

export async function geocodeLocation(
  city: string,
  location?: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  if (!city && !location) {
    console.log("[geocode] Pas de ville ni location, abandon")
    return null
  }

  const loc = (location || "").trim()
  const key = `${city}|${loc}`
  if (cache.has(key)) {
    console.log("[geocode] Cache hit:", key)
    return cache.get(key)!
  }

  if (loc && city) {
    const result = await geocodeWithFallback(city, loc)
    if (result) {
      cache.set(key, result)
      return result
    }
  }

  if (city) {
    const r = await nominatimSearch(`${city}, Cameroun`)
    if (r) {
      const result = { lat: r.lat, lng: r.lng, displayName: r.display }
      cache.set(key, result)
      return result
    }
  }

  if (loc) {
    const r = await nominatimSearch(`${loc}, Cameroun`)
    if (r) {
      const result = { lat: r.lat, lng: r.lng, displayName: r.display }
      cache.set(key, result)
      return result
    }
  }

  console.log("[geocode] Aucun résultat pour:", key)
  return null
}
