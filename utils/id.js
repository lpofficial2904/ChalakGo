export function idOf(value) {
  if (value == null) return "";
  const id = typeof value === "object" && "_id" in value ? value._id : value;
  if (typeof id === "string") return id;
  if (typeof id?.$oid === "string") return id.$oid;
  if (id?.buffer) {
    const bytes = Object.values(id.buffer);
    if (
      bytes.length === 12 &&
      bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
    )
      return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return "";
}
