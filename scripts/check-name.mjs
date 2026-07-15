import { mkdir, writeFile } from "node:fs/promises";

const candidate = "replicafuzz";
const npmResponse = await fetch(`https://registry.npmjs.org/${candidate}`);
const githubResponse = await fetch(`https://api.github.com/search/repositories?q=${candidate}+in:name`, {
  headers: { Accept: "application/vnd.github+json", "User-Agent": "replicafuzz-release-preflight" },
});
if (!githubResponse.ok) throw new Error(`GitHub name search failed: ${githubResponse.status}`);
const github = await githubResponse.json();
const exact = (github.items ?? []).filter((item) => item.name.toLowerCase() === candidate);
const evidence = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  candidate,
  status: npmResponse.status === 404 && exact.length === 0 ? "superficially_clear" : "collision_found",
  npm: { registryStatus: npmResponse.status, packageExists: npmResponse.status !== 404 },
  github: { exactRepositoryNameMatches: exact.map((item) => item.full_name) },
  boundary: "This is a public npm/GitHub collision check only. It is not trademark, company-name, domain, or legal clearance.",
};
await mkdir("evidence", { recursive: true });
await writeFile("evidence/name-check.json", `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
if (evidence.status !== "superficially_clear") process.exitCode = 1;
