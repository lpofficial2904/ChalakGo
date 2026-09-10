const publicApiBase = (
  process.env.PUBLIC_API_URL || "https://chalakgo.onrender.com"
).replace(/\/$/, "");

function normalizeAssetUrl(url) {
  // Old admin sessions could save a local development URL in MongoDB. A visitor
  // on the HTTPS website must instead request the public API's upload route.
  return url.replace(
    /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/uploads\/[^?#]+)([?#].*)?$/i,
    (_match, assetPath, suffix = "") => `${publicApiBase}${assetPath}${suffix}`,
  );
}

export function normalizeAssetUrls(value) {
  if (value instanceof Date) return value.toISOString();
  if (
    value &&
    typeof value === "object" &&
    (value._bsontype === "ObjectId" || value.constructor?.name === "ObjectId")
  )
    return value.toString();
  if (typeof value === "string") return normalizeAssetUrl(value);
  if (Array.isArray(value)) return value.map(normalizeAssetUrls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        normalizeAssetUrls(entry),
      ]),
    );
  }
  return value;
}
