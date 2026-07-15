import { mkdir, readFile, writeFile } from "node:fs/promises";
import { BrowserFixtureAdapter } from "../dist/src/browser-adapter.js";
import { runSchedule } from "../dist/src/runner.js";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const yjsVersion = packageJson.dependencies.yjs.replace(/^[^0-9]*/, "");
const attempts = 10;
const clients = 3;
const results = [];
const started = performance.now();
const adapter = await BrowserFixtureAdapter.create();

try {
  for (let index = 0; index < attempts; index += 1) {
    const schedule = [
      { kind: "act", client: 0, action: { type: "increment", amount: 1 + (index % 2) } },
      { kind: "offline", client: 1 },
      { kind: "act", client: 2, action: { type: "increment", amount: 1 } },
      { kind: "online", client: 1 },
      { kind: "pause", ms: 80 },
      { kind: "reload", client: 1 },
      { kind: "kill", client: 2 },
      { kind: "act", client: 0, action: { type: "increment", amount: 1 } },
      { kind: "relaunch", client: 2 },
      { kind: "pause", ms: 140 },
      { kind: "checkpoint", label: `yjs-run-${index + 1}` },
    ];
    const result = await runSchedule(adapter, { fixture: "yjs", clients, seed: 61_000 + index, schedule });
    results.push({ attempt: index + 1, status: result.status, durationMs: result.durationMs, failures: result.failures, error: result.error });
  }
} finally {
  await adapter.shutdown();
}

const durations = results.map((result) => result.durationMs).sort((a, b) => a - b);
const passed = results.filter((result) => result.status === "passed").length;
const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: passed === attempts ? "passed" : "failed",
  library: "yjs",
  libraryVersion: yjsVersion,
  target: "purpose-built Y.Array counter over ReplicaFuzz WebSocket relay",
  clients,
  attempts,
  passed,
  failed: attempts - passed,
  wallMs: Math.round(performance.now() - started),
  p50RunMs: durations[Math.floor(durations.length * 0.5)],
  p95RunMs: durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))],
  lifecycle: ["offline", "reconnect", "reload", "client death", "relaunch"],
  transportBoundary: "Native Yjs updates cross a purpose-built local WebSocket relay; y-websocket is not used.",
  claimBoundary: "This validates an external CRDT library in a purpose-built browser target, not an unfamiliar third-party production application.",
  results,
};
await mkdir("evidence", { recursive: true });
await writeFile("evidence/yjs-integration.json", `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
if (evidence.status !== "passed") process.exitCode = 1;
