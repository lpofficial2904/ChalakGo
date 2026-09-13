import { spawn } from "node:child_process";
import "./config/env.js";
import { fileURLToPath } from "node:url";

const port = process.env.PORT || 5500;

async function isChalakGoApiRunning() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(1_000),
    });
    const body = await response.json();
    return response.ok && body?.ok === true;
  } catch {
    return false;
  }
}

if (await isChalakGoApiRunning()) {
  console.log(`ChalakGo API is already running at http://localhost:${port}.`);
  process.exit(0);
}

const server = spawn(process.execPath, ["--watch", "server.js"], {
  stdio: "inherit",
  cwd: fileURLToPath(new URL(".", import.meta.url)),
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.kill(signal));
}

server.once("exit", (code) => process.exit(code ?? 0));
