import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import mongoose from "mongoose";
import { Router, apiErrorHandler } from "./router.js";
import { normalizeAssetUrls } from "./assets.js";
import { idOf } from "../../admin/utils/id.js";

test("new admin forms have no record ID; existing IDs survive JSON serialization", () => {
  assert.equal(idOf({ title: "New page", slug: "new-page" }), "");
  assert.equal(idOf(undefined), "");
  const id = new mongoose.Types.ObjectId();
  const record = normalizeAssetUrls({
    _id: id,
    updatedAt: new Date("2026-09-10T00:00:00Z"),
  });
  assert.equal(idOf(record), id.toString());
  assert.equal(record.updatedAt, "2026-09-10T00:00:00.000Z");
  assert.equal(
    idOf({ _id: { buffer: Object.assign({}, id.id) } }),
    id.toString(),
  );
  assert.equal(idOf({ _id: {} }), "");
});

test("failed admin writes return JSON and subsequent requests still work", async () => {
  const app = express();
  const router = Router();
  router.put("/invalid", async () => {
    throw new mongoose.Error.CastError("ObjectId", "[object Object]", "_id");
  });
  router.post("/duplicate", async () => {
    throw Object.assign(new Error("Duplicate"), { code: 11000 });
  });
  router.get("/failure", async () => {
    throw new Error("private database details");
  });
  router.get("/healthy", async (_req, res) => res.json({ ok: true }));
  app.use(router);
  app.use(apiErrorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [path, method, status] of [
      ["invalid", "PUT", 400],
      ["duplicate", "POST", 409],
      ["failure", "GET", 500],
    ]) {
      const response = await fetch(`${base}/${path}`, { method });
      assert.equal(response.status, status);
      assert.equal(typeof (await response.json()).message, "string");
    }
    assert.deepEqual(await (await fetch(`${base}/healthy`)).json(), {
      ok: true,
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
