export function parseCoordinate(value, limit) {
  if (typeof value !== 'string' || !value.trim()) throw Object.assign(new Error('Valid latitude and longitude are required.'), { status: 400 })
  const coordinate = Number(value)
  if (!Number.isFinite(coordinate) || Math.abs(coordinate) > limit) throw Object.assign(new Error('Valid latitude and longitude are required.'), { status: 400 })
  return coordinate
}

// One shared limiter/cache per API process. For multiple replicas, route all
// lookups through one geocoding gateway or use a provider with adequate capacity.
export function createReverseGeocoder({ fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map()
  const pending = new Map()
  let nextRequestAt = 0
  let busy = false
  return async (latitude, longitude) => {
    const key = `${latitude},${longitude}`
    const cached = cache.get(key)
    if (cached && cached.expires > now()) return cached.data
    if (pending.has(key)) return pending.get(key)
    if (busy || now() < nextRequestAt) throw Object.assign(new Error('Address lookup is busy. Please retry in a few seconds.'), { status: 429 })
    busy = true
    nextRequestAt = now() + 1100
    const request = (async () => {
      const url = new URL(process.env.NOMINATIM_REVERSE_URL || 'https://nominatim.openstreetmap.org/reverse')
      url.search = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', zoom: '18', layer: 'address', lat: String(latitude), lon: String(longitude), 'accept-language': 'en' })
      const response = await fetchImpl(url, {
        headers: { 'User-Agent': process.env.NOMINATIM_USER_AGENT || 'ChalakGo/1.0 (https://chalakgoo.netlify.app/contact)', Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) {
        if (response.status === 429) nextRequestAt = now() + 60000
        throw Object.assign(new Error('Address lookup is unavailable. Please retry or enter the address manually.'), { status: response.status === 429 ? 429 : 502 })
      }
      const data = await response.json()
      if (data.error || (!data.display_name && !Object.keys(data.address || {}).length)) throw Object.assign(new Error('No mapped address was found for these coordinates. Enter the address manually.'), { status: 404 })
      if (cache.size >= 500) cache.delete(cache.keys().next().value)
      cache.set(key, { data, expires: now() + 300000 })
      return data
    })()
    pending.set(key, request)
    try { return await request } finally { pending.delete(key); busy = false }
  }
}
