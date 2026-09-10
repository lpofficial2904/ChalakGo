import { randomUUID } from "node:crypto";
const clients = new Set();
let revision = randomUUID();
export function siteEvents(_req, res) {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ revision })}\n\n`);
  clients.add(res);
  const timer = setInterval(() => res.write(": heartbeat\n\n"), 25000);
  res.on("close", () => {
    clearInterval(timer);
    clients.delete(res);
  });
}
export function notifySiteChanges(req, res, next) {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method))
    res.once("finish", () => {
      if (
        res.statusCode >= 200 &&
        res.statusCode < 300 &&
        /^\/api\/(settings|pages|blogs|services|reviews)(\/|$)/.test(
          req.originalUrl,
        )
      ) {
        revision = randomUUID();
        for (const client of clients)
          client.write(`data: ${JSON.stringify({ revision })}\n\n`);
      }
    });
  next();
}
