import { access, mkdir, readFile, writeFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const proof = JSON.parse(await readFile("outputs/replicafuzz-proof-report.json", "utf8"));
const packageSmoke = JSON.parse(await readFile("work/package-smoke.json", "utf8"));
const yjsEvidence = JSON.parse(await readFile("evidence/yjs-integration.json", "utf8"));
const etherpadEvidence = JSON.parse(await readFile("outputs/replicafuzz-etherpad-proof.json", "utf8"));
const nameEvidence = JSON.parse(await readFile("evidence/name-check.json", "utf8"));

const checks = [];
function check(name, condition, detail) {
  checks.push({ name, status: condition ? "pass" : "fail", detail });
}

check("package-name", packageJson.name === "replicafuzz", packageJson.name);
check("alpha-version", /^0\.1\.0-alpha\.\d+$/.test(packageJson.version), packageJson.version);
check("publishable", packageJson.private === false && packageJson.publishConfig?.access === "public", "public package metadata");
check("repository", packageJson.repository?.url === "git+https://github.com/Atomics-hub/replicafuzz.git", packageJson.repository?.url);
check("license", packageJson.license === "MIT", packageJson.license);
check("proof-gates", proof.gates?.length === 5 && proof.gates.every((gate) => gate.status === "pass"), "five bounded synthetic gates");
check("package-smoke", packageSmoke.status === "passed" && packageSmoke.package === "replicafuzz", packageSmoke.sha256);
check("real-yjs-target", yjsEvidence.status === "passed" && yjsEvidence.library === "yjs", yjsEvidence.claimBoundary);
check(
  "external-etherpad-target",
  etherpadEvidence.target?.name === "Etherpad"
    && etherpadEvidence.campaign?.errors === 0
    && etherpadEvidence.counterexample?.replayed === 5
    && etherpadEvidence.integrationEffort?.elapsedMinutes < 120,
  `${etherpadEvidence.integrationEffort?.elapsedMinutes} minutes; ${etherpadEvidence.counterexample?.replayed}/5 minimized replays`,
);
check("public-name-collision", nameEvidence.status === "superficially_clear", nameEvidence.boundary);

for (const file of [
  "README.md", "LICENSE", "CHANGELOG.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SECURITY.md", "CITATION.cff",
  ".github/workflows/ci.yml", ".github/workflows/proof.yml", "dist/src/cli.js", "dist/evidence/fourth-app-integration.json",
  "dist/integrations/etherpad/adapter.js", "outputs/replicafuzz-etherpad-counterexample.json",
]) {
  try { await access(file); checks.push({ name: `file:${file}`, status: "pass", detail: "present" }); }
  catch { checks.push({ name: `file:${file}`, status: "fail", detail: "missing" }); }
}

const failed = checks.filter((item) => item.status === "fail");
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: failed.length === 0 ? "ready_for_github_alpha" : "blocked",
  publishState: "not_published_by_preflight",
  package: { name: packageJson.name, version: packageJson.version, archiveSha256: packageSmoke.sha256 },
  checks,
  blockers: failed.map((item) => item.name),
  boundaries: [
    "This is an offline publication preflight; it does not create a repository, push, tag, release, or npm package.",
    "The Yjs target is an external sync library in a purpose-built browser fixture, not a third-party production application.",
    "The Etherpad target is one unfamiliar production application under a local default configuration, not broad portability proof.",
    "The five original gates remain synthetic-fixture evidence.",
    "The ReplicaFuzz name check is superficial and is not legal or trademark clearance.",
  ],
};
await mkdir("outputs", { recursive: true });
await writeFile("outputs/replicafuzz-release-preflight.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (failed.length) process.exitCode = 1;
