import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { prepareImageVariants } from "./imageVariants.js";

const directory = fileURLToPath(new URL("../uploads/", import.meta.url));
let count = 0;
for (const entry of await readdir(directory, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.(png|jpe?g|webp)$/i.test(entry.name)) continue;
  try { await prepareImageVariants(directory, entry.name); count++; }
  catch (error) { console.error(entry.name, error.message); process.exitCode = 1; }
}
console.log(`Prepared responsive WebP sizes for ${count} images. Originals preserved.`);
