import type { ScheduleStep } from "./types.js";

export type ShrinkResult = {
  schedule: ScheduleStep[];
  replayPath: string;
  attempts: number;
};

export async function shrinkSchedule(
  original: ScheduleStep[],
  stillFails: (candidate: ScheduleStep[]) => Promise<boolean>,
): Promise<ShrinkResult> {
  let current = [...original];
  let granularity = 2;
  let attempts = 0;
  const path: string[] = [];

  while (current.length >= 2) {
    const chunkSize = Math.ceil(current.length / granularity);
    let reduced = false;
    for (let start = 0; start < current.length; start += chunkSize) {
      const candidate = current.slice(0, start).concat(current.slice(start + chunkSize));
      if (candidate.length === 0) continue;
      attempts += 1;
      if (await stillFails(candidate)) {
        path.push(`${start}:${Math.min(start + chunkSize, current.length)}`);
        current = candidate;
        granularity = Math.max(2, granularity - 1);
        reduced = true;
        break;
      }
    }
    if (!reduced) {
      if (granularity >= current.length) break;
      granularity = Math.min(current.length, granularity * 2);
    }
  }

  return { schedule: current, replayPath: `ddmin/${path.join(",") || "unreduced"}`, attempts };
}
