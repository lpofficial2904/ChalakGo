import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { responseCompression } from "./responseCompression.js";

test("large JSON responses are compressed while live update streams remain unbuffered", async (t) => {
  const app = express();
  const data = { content: "Service description ".repeat(1000) };
  app.use(responseCompression());
  app.get("/api/services", (_req, res) => res.json(data));
  app.get("/api/events", (_req, res) => res.type("text/event-stream").send(`data: ${JSON.stringify(data)}\n\n`));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const result = await fetch(`${url}/api/services`, { headers: { "Accept-Encoding": "gzip" } });
  assert.equal(result.headers.get("content-encoding"), "gzip");
  assert.deepEqual(await result.json(), data);
  const event = await fetch(`${url}/api/events`, { headers: { "Accept-Encoding": "gzip" } });
  assert.equal(event.headers.get("content-encoding"), null);
});
