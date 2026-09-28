import path from "node:path";
import { stat, mkdir, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

export const imageWidths = [320, 640, 960, 1440, 1920];

export function imageVariants(uploadDir) {
  const pending = new Map();
  return async (req, res, next) => {
    const filename = req.params.filename;
    const width = Number(req.query.w);
    if (!imageWidths.includes(width) || !/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(filename || "")) return next();
    try {
      const original = path.join(uploadDir, filename);
      const info = await stat(original);
      const directory = path.join(uploadDir, ".variants");
      const target = path.join(directory, `${filename}-${info.size}-${Math.trunc(info.mtimeMs)}-${width}.webp`);
      try { await stat(target); }
      catch {
        if (!pending.has(target)) {
          const operation = (async () => {
            await mkdir(directory, { recursive: true });
            const buffer = await sharp(original, { limitInputPixels: 40000000 }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
            const temporary = `${target}.${randomUUID()}.tmp`;
            await writeFile(temporary, buffer);
            await rename(temporary, target);
          })().finally(() => pending.delete(target));
          pending.set(target, operation);
        }
        await pending.get(target);
      }
      res.set("Cache-Control", /^\d+-\d+\./.test(filename) ? "public, max-age=31536000, immutable" : "public, max-age=86400");
      res.type("webp");
      res.sendFile(target, { dotfiles: "allow" }, error => { if (error) next(error); });
    } catch {
      // Preserve the original image if conversion is unsupported or unavailable.
      next();
    }
  };
}
