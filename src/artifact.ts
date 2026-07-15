import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ReplayArtifact, ScheduleStep } from "./types.js";

function describe(step: ScheduleStep): string {
  switch (step.kind) {
    case "act": return `client ${step.client + 1} increments by ${step.action.amount}`;
    case "dropNext": return `drop next ${step.direction} message for client ${step.client + 1}`;
    case "delayTraffic": return `delay client ${step.client + 1} traffic by ${step.ms} ms`;
    case "clockSkew": return `skew client ${step.client + 1} application clock by ${step.ms} ms`;
    case "pause": return `wait ${step.ms} ms`;
    case "checkpoint": return `check ${step.label}`;
    default: return `${step.kind} client ${step.client + 1}`;
  }
}

export function renderTimeline(artifact: ReplayArtifact): string {
  const lines = [
    `# SyncFuzz counterexample`,
    ``,
    `- Fixture: \`${artifact.fixture}\``,
    `- Mutant: \`${artifact.mutant ?? "none"}\``,
    `- Seed: \`${artifact.seed}\``,
    `- Replay path: \`${artifact.replayPath}\``,
    `- Shrink: ${artifact.originalSteps} -> ${artifact.minimizedSteps} steps`,
    `- Failure: ${artifact.failure.message}`,
    ``,
    `## Replay`,
    ``,
    "```sh",
    artifact.command,
    "```",
    ``,
    `## Minimal timeline`,
    ``,
  ];
  artifact.schedule.forEach((step, index) => lines.push(`${index + 1}. ${describe(step)}`));
  lines.push(``, `## Final snapshots`, ``, "```json", JSON.stringify(artifact.failure.snapshots, null, 2), "```", ``);
  return lines.join("\n");
}

export async function writeArtifact(artifact: ReplayArtifact, path: string): Promise<{ json: string; markdown: string }> {
  const json = resolve(path);
  const markdown = json.replace(/\.json$/i, ".md");
  await mkdir(dirname(json), { recursive: true });
  await writeFile(json, `${JSON.stringify(artifact, null, 2)}\n`);
  await writeFile(markdown, renderTimeline(artifact));
  return { json, markdown };
}
