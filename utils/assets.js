export function normalizeAssetUrls(value) {
  if (value && typeof value === 'object' && (value._bsontype === 'ObjectId' || value.constructor?.name === 'ObjectId')) return value.toString()
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(normalizeAssetUrls)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalizeAssetUrls(entry)]))
  }
  return value
}
