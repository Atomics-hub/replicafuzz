import { mkdir, readFile, writeFile } from "node:fs/promises";

const option = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const synthetic = JSON.parse(await readFile("outputs/replicafuzz-proof-report.json", "utf8"));
const etherpad = JSON.parse(await readFile("outputs/replicafuzz-etherpad-proof.json", "utf8"));
const preflight = JSON.parse(await readFile("outputs/replicafuzz-release-preflight.json", "utf8"));
const sourceRef = option("source-ref", `v${packageJson.version}`);
const githubRelease = option("github-release", "not_verified_by_report_generator");
const npmStatus = option("npm-status", "not_verified_by_report_generator");
const npmUrl = option("npm-url", "not_supplied");
const npmBoundary = option(
  "npm-boundary",
  "Publication state was not supplied to the report generator and must be independently verified.",
);
const trustedPublishing = option("trusted-publishing", "not_verified_by_report_generator");

const syntheticGate = (name) => synthetic.gates.find((gate) => gate.name === name);
const gates = [
  {
    id: 1,
    name: "Fault detection",
    status: syntheticGate("Fault detection")?.status ?? "fail",
    evidence: syntheticGate("Fault detection")?.evidence,
    boundary: "Disclosed seeded mutants across three purpose-built transport fixtures.",
  },
  {
    id: 2,
    name: "Replay stability",
    status: syntheticGate("Replay stability")?.status === "pass" && etherpad.counterexample?.replayed === 5 ? "pass" : "fail",
    evidence: `${synthetic.measurements.replay.reproduced}/${synthetic.measurements.replay.attempted} synthetic minimized failures and ${etherpad.counterexample?.replayed}/5 Etherpad minimized replays reproduced.`,
    boundary: "Local Chromium and one machine; not a cross-platform flake estimate.",
  },
  {
    id: 3,
    name: "Fourth-app integration",
    status: etherpad.integrationEffort?.elapsedMinutes < 120 ? "pass" : "fail",
    evidence: `Unmodified Etherpad ${etherpad.target.version} integrated end to end in ${etherpad.integrationEffort?.elapsedMinutes} minutes.`,
    boundary: "One unfamiliar production application under a local default configuration.",
  },
  {
    id: 4,
    name: "PR runtime",
    status: syntheticGate("PR runtime")?.status ?? "fail",
    evidence: syntheticGate("PR runtime")?.evidence,
    boundary: "Synthetic WebSocket fixture campaign, local four-worker measurement.",
  },
  {
    id: 5,
    name: "Novel actionable failure",
    status: etherpad.counterexample?.minimizedSteps === 3
      && etherpad.counterexample?.replayed === 5
      && etherpad.sourceTestAudit?.equivalentRealNetworkReconnectTypingTestFound === false ? "pass" : "fail",
    evidence: "Etherpad reconnect UI-readiness failure shrank from 8 to 3 steps and replayed 5/5; targeted upstream source-test review found no equivalent real-network reconnect-then-type case.",
    boundary: "Actionable candidate, not a maintainer-confirmed upstream bug; source-test search was targeted rather than exhaustive.",
  },
];

const allPassed = gates.every((gate) => gate.status === "pass");
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  package: { name: packageJson.name, version: packageJson.version },
  sourceRef,
  status: allPassed ? "technical_gates_passed_bounded" : "technical_gates_incomplete",
  verdict: allPassed
    ? "All five technical falsification gates pass within their stated local evidence boundaries. This does not prove broad portability, maintainer-confirmed bug status, customer demand, or a business."
    : "At least one technical falsification gate remains incomplete.",
  gates,
  externalTarget: {
    target: etherpad.target,
    campaign: etherpad.campaign,
    integrationEffort: etherpad.integrationEffort,
    counterexample: etherpad.counterexample,
    sourceTestAudit: etherpad.sourceTestAudit,
  },
  publication: {
    repository: "https://github.com/Atomics-hub/replicafuzz",
    githubRelease,
    npm: npmStatus,
    npmUrl,
    npmBoundary,
    trustedPublishing,
  },
  releasePreflight: { status: preflight.status, blockers: preflight.blockers },
  remainingClaimsNotProven: [
    "broad portability across several unrelated production applications",
    "maintainer confirmation that the Etherpad finding is an upstream defect",
    "hosted-service reliability or security",
    "customer demand, pricing, or commercial viability",
    "trademark or legal clearance for the ReplicaFuzz name",
  ],
};

const markdown = `# ReplicaFuzz final proof report\n\nGenerated: ${report.generatedAt}\n\n## Verdict\n\n${report.verdict}\n\n## Pass-or-kill gates\n\n${gates.map((gate) => `${gate.id}. **${gate.name}: ${gate.status.toUpperCase()}** — ${gate.evidence}\n   Boundary: ${gate.boundary}`).join("\n")}\n\n## Publication\n\n- Repository: ${report.publication.repository}\n- GitHub release: ${githubRelease}\n- npm: ${npmStatus}\n- npm URL: ${npmUrl}\n- npm boundary: ${report.publication.npmBoundary}\n- Trusted publishing: ${trustedPublishing}\n\n## Remaining unproven claims\n\n${report.remainingClaimsNotProven.map((item) => `- ${item}`).join("\n")}\n`;

await mkdir("outputs", { recursive: true });
await writeFile("outputs/replicafuzz-final-proof-report.json", `${JSON.stringify(report, null, 2)}\n`);
await writeFile("outputs/replicafuzz-final-proof-report.md", markdown);
console.log(JSON.stringify({ status: report.status, gates: gates.map(({ id, status }) => ({ id, status })) }, null, 2));
if (!allPassed) process.exitCode = 1;
