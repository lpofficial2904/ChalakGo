const liveApiOrigin = 'https://chalakgo.onrender.com'

export function normalizeAssetUrls(value) {
  if (typeof value === 'string') {
    return value.replace(/^https?:\/\/localhost(?::\d+)?/, liveApiOrigin)
  }
  if (Array.isArray(value)) return value.map(normalizeAssetUrls)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalizeAssetUrls(entry)]))
  }
  return value
}
