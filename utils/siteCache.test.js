import test from "node:test";
import assert from "node:assert/strict";
import { createReadCache, siteCache } from "./siteCache.js";
import { notifySiteChanges } from "./siteEvents.js";
import { EventEmitter } from "node:events";

test("concurrent and repeated content requests share one database read", async () => {
  const cache = createReadCache();
  let reads = 0;
  const load = async () => { reads++; return { price: 499 }; };
  const values = await Promise.all(Array.from({ length: 20 }, () => cache.get("services", load)));
  await cache.get("services", load);
  assert.equal(reads, 1);
  assert.ok(values.every(value => value.price === 499));
});

test("successful admin changes invalidate cached site content immediately", async () => {
  siteCache.clear();
  await siteCache.get("services", async () => 499);
  const res = new EventEmitter();
  res.statusCode = 200;
  notifySiteChanges({ method: "PUT", originalUrl: "/api/services/123" }, res, () => {});
  res.emit("finish");
  assert.equal(await siteCache.get("services", async () => 599), 599);
});

test("failed reads retry and an old pending read cannot replace fresh data", async () => {
  const cache = createReadCache();
  await assert.rejects(cache.get("services", () => Promise.reject(new Error("offline"))));
  assert.equal(await cache.get("services", async () => 499), 499);
  cache.clear();
  let finish;
  const old = cache.get("services", () => new Promise(resolve => { finish = resolve; }));
  await Promise.resolve();
  cache.clear();
  await cache.get("services", async () => 599);
  finish(499);
  await old;
  assert.equal(await cache.get("services", async () => 0), 599);
});
