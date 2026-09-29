import path from "node:path";
import { stat, mkdir, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

export const imageWidths = [96, 160, 320, 640, 960, 1440, 1920];
const pending = new Map();

export async function prepareImageVariants(uploadDir, filename) {
  if (!/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(filename)) return;
  // Sequential sizes keep bulk uploads from saturating the image worker pool.
  for (const width of imageWidths) await variantFile(uploadDir, filename, width);
}

async function variantFile(uploadDir, filename, width) {
  const original = path.join(uploadDir, filename);
  const info = await stat(original);
  const directory = path.join(uploadDir, ".variants");
  const target = path.join(directory, `${filename}-${info.size}-${Math.trunc(info.mtimeMs)}-${width}.webp`);
  try { await stat(target); return target; } catch { /* Generate only missing sizes. */ }
  if (!pending.has(target)) {
    pending.set(target, (async () => {
      await mkdir(directory, { recursive: true });
      const buffer = await sharp(original, { limitInputPixels: 40000000 }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      const temporary = `${target}.${randomUUID()}.tmp`;
      await writeFile(temporary, buffer);
      await rename(temporary, target);
    })().finally(() => pending.delete(target)));
  }
  await pending.get(target);
  return target;
}

export function imageVariants(uploadDir) {
  return async (req, res, next) => {
    const filename = req.params.filename;
    const width = Number(req.query.w);
    if (!imageWidths.includes(width) || !/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(filename || "")) return next();
    try {
      const target = await variantFile(uploadDir, filename, width);
      res.set("Cache-Control", /^\d+-\d+\./.test(filename) ? "public, max-age=31536000, immutable" : "public, max-age=86400");
      res.type("webp");
      res.sendFile(target, { dotfiles: "allow" }, error => { if (error) next(error); });
    } catch {
      // Preserve the original image if conversion is unsupported or unavailable.
      next();
    }
  };
}
