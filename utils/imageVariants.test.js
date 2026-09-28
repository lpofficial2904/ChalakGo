import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import sharp from "sharp";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { imageVariants } from "./imageVariants.js";

test("upload variants resize to WebP, cache concurrent work and preserve originals", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "chalakgo-image-test-"));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  });
  const filename = "1788866609158-123.png";
  await sharp({ create: { width: 1600, height: 800, channels: 4, background: "#1254af" } }).png().toFile(path.join(directory, filename));
  const app = express();
  app.get("/uploads/:filename", imageVariants(directory));
  app.use("/uploads", express.static(directory));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/uploads/${filename}`;
  const responses = await Promise.all([fetch(`${url}?w=640`), fetch(`${url}?w=640`)]);
  assert.equal(responses[0].status, 200);
  assert.equal(responses[0].headers.get("content-type"), "image/webp");
  assert.match(responses[0].headers.get("cache-control"), /immutable/);
  const bytes = Buffer.from(await responses[0].arrayBuffer());
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 640);
  assert.equal(metadata.height, 320);
  assert.equal((await readdir(path.join(directory, ".variants"))).length, 1);
  assert.equal((await sharp(path.join(directory, filename)).metadata()).width, 1600);
  const invalidWidth = await fetch(`${url}?w=100000`);
  assert.equal(invalidWidth.headers.get("content-type"), "image/png");
  assert.equal((await fetch(url.replace(filename, "missing.png") + "?w=640")).status, 404);
});
