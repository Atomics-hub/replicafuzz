import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error("package smoke must run through pnpm");

const temporary = await mkdtemp(join(tmpdir(), "replicafuzz-package-smoke-"));
const packed = join(temporary, "packed");
const consumer = join(temporary, "consumer");
await mkdir(packed);
await mkdir(consumer);

function pnpm(args, cwd = process.cwd()) {
  const result = spawnSync(process.execPath, [pnpmCli, ...args], { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`pnpm ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

try {
  pnpm(["pack", "--pack-destination", packed]);
  const archives = (await readdir(packed)).filter((file) => file.endsWith(".tgz"));
  if (archives.length !== 1) throw new Error(`expected one package archive, found ${archives.length}`);
  const archive = join(packed, archives[0]);
  await writeFile(join(consumer, "package.json"), '{"name":"replicafuzz-package-smoke","private":true}\n');
  pnpm(["add", "--ignore-scripts", archive], consumer);
  const cli = resolve(consumer, "node_modules/replicafuzz/dist/src/cli.js");
  const result = spawnSync(process.execPath, [cli, "help"], { cwd: consumer, encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.includes("replicafuzz <")) {
    throw new Error(`installed CLI smoke failed\n${result.stdout}\n${result.stderr}`);
  }
  const bytes = await readFile(archive);
  const evidence = {
    schemaVersion: 1,
    status: "passed",
    package: "replicafuzz",
    archive: archives[0],
    sizeBytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    installedCommand: "replicafuzz help",
  };
  await mkdir("work", { recursive: true });
  await writeFile("work/package-smoke.json", `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
