import type { BrowserContext, Page } from "playwright";

export type FixtureName = "websocket" | "sse" | "rest" | "storage" | "yjs";

export type SemanticAction = {
  type: "increment";
  amount: number;
};

export type ScheduleStep =
  | { kind: "act"; client: number; action: SemanticAction }
  | { kind: "offline"; client: number }
  | { kind: "online"; client: number }
  | { kind: "reload"; client: number }
  | { kind: "kill"; client: number }
  | { kind: "relaunch"; client: number }
  | { kind: "delayTraffic"; client: number; ms: number }
  | { kind: "dropNext"; client: number; direction: "inbound" | "outbound" }
  | { kind: "clockSkew"; client: number; ms: number }
  | { kind: "pause"; ms: number }
  | { kind: "checkpoint"; label: string };

export type CanonicalSnapshot = {
  value: number;
  pending: number;
  revision: number;
};

export type ClientHandle = {
  id: number;
  context: BrowserContext;
  page: Page | null;
  url: string;
};

export type InvariantFailure = {
  invariant: string;
  message: string;
  snapshots: Record<string, CanonicalSnapshot | null>;
};

export type AdapterRunOptions = {
  fixture: FixtureName;
  clients: number;
  runId: string;
  mutant?: string;
};

export interface SyncAdapter {
  readonly name: string;
  reset(options: AdapterRunOptions): Promise<void>;
  launch(clientId: number, options: AdapterRunOptions): Promise<ClientHandle>;
  relaunch(client: ClientHandle, options: AdapterRunOptions): Promise<void>;
  act(client: ClientHandle, action: SemanticAction): Promise<void>;
  canonicalSnapshot(client: ClientHandle): Promise<CanonicalSnapshot | null>;
  waitForQuiescence(clients: ClientHandle[], timeoutMs?: number): Promise<void>;
  assertInvariants(clients: ClientHandle[]): Promise<InvariantFailure[]>;
  control(client: ClientHandle, control: Exclude<ScheduleStep, { kind: "act" | "pause" | "checkpoint" }>, options: AdapterRunOptions): Promise<void>;
  close(clients: ClientHandle[]): Promise<void>;
}

export type TimelineEntry = {
  index: number;
  elapsedMs: number;
  step: ScheduleStep;
  snapshots?: Record<string, CanonicalSnapshot | null>;
  note?: string;
};

export type RunResult = {
  status: "passed" | "failed" | "error";
  seed: number;
  fixture: FixtureName;
  mutant?: string;
  runId: string;
  durationMs: number;
  schedule: ScheduleStep[];
  timeline: TimelineEntry[];
  failures: InvariantFailure[];
  error?: string;
};

export type ReplayArtifact = {
  schemaVersion: 1;
  createdAt: string;
  command: string;
  seed: number;
  replayPath: string;
  fixture: FixtureName;
  mutant?: string;
  clients: number;
  originalSteps: number;
  minimizedSteps: number;
  schedule: ScheduleStep[];
  failure: InvariantFailure;
  timeline: TimelineEntry[];
};
