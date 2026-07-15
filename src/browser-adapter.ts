import { chromium, type Browser } from "playwright";
import { startFixtureServer, type FixtureServer } from "../fixtures/server.js";
import type {
  AdapterRunOptions,
  CanonicalSnapshot,
  ClientHandle,
  InvariantFailure,
  ScheduleStep,
  SemanticAction,
  SyncAdapter,
} from "./types.js";

declare global {
  interface Window {
    syncFixture: {
      act(action: SemanticAction): Promise<void>;
      snapshot(): CanonicalSnapshot;
      quiescent(): boolean;
      setControl(control: ScheduleStep): Promise<void>;
    };
  }
}

export class BrowserFixtureAdapter implements SyncAdapter {
  readonly name = "playwright-browser-fixture";
  private expectedByRun = new Map<string, number>();

  private constructor(
    private readonly browser: Browser,
    private readonly server: FixtureServer,
  ) {}

  static async create(): Promise<BrowserFixtureAdapter> {
    const [browser, server] = await Promise.all([chromium.launch({ headless: true }), startFixtureServer()]);
    return new BrowserFixtureAdapter(browser, server);
  }

  async reset(options: AdapterRunOptions): Promise<void> {
    this.expectedByRun.set(options.runId, 0);
    const response = await fetch(`${this.server.origin}/reset?runId=${encodeURIComponent(options.runId)}`, { method: "POST" });
    if (!response.ok) throw new Error(`reset failed: ${response.status}`);
  }

  async launch(clientId: number, options: AdapterRunOptions): Promise<ClientHandle> {
    const context = await this.browser.newContext({ serviceWorkers: "block" });
    const url = this.urlFor(clientId, options);
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.syncFixture));
    return { id: clientId, context, page, url };
  }

  async relaunch(client: ClientHandle): Promise<void> {
    if (client.page && !client.page.isClosed()) await client.page.close();
    client.page = await client.context.newPage();
    await client.page.goto(client.url);
    await client.page.waitForFunction(() => Boolean(window.syncFixture));
  }

  async act(client: ClientHandle, action: SemanticAction): Promise<void> {
    const page = this.livePage(client);
    await page.evaluate((input) => window.syncFixture.act(input), action);
    const runId = new URL(client.url).searchParams.get("runId")!;
    this.expectedByRun.set(runId, (this.expectedByRun.get(runId) ?? 0) + action.amount);
  }

  async canonicalSnapshot(client: ClientHandle): Promise<CanonicalSnapshot | null> {
    if (!client.page || client.page.isClosed()) return null;
    try {
      return await client.page.evaluate(() => window.syncFixture.snapshot());
    } catch {
      return null;
    }
  }

  async waitForQuiescence(clients: ClientHandle[], timeoutMs = 750): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let previous = "";
    let stableReads = 0;
    while (Date.now() < deadline) {
      const snapshots = await Promise.all(clients.map((client) => this.canonicalSnapshot(client)));
      const encoded = JSON.stringify(snapshots);
      const quiescent = snapshots.every((snapshot) => snapshot === null || snapshot.pending === 0);
      stableReads = encoded === previous ? stableReads + 1 : 0;
      if (quiescent && stableReads >= 2) return;
      previous = encoded;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  async assertInvariants(clients: ClientHandle[]): Promise<InvariantFailure[]> {
    const snapshots = await this.snapshotRecord(clients);
    const live = Object.values(snapshots).filter((snapshot): snapshot is CanonicalSnapshot => snapshot !== null);
    const failures: InvariantFailure[] = [];
    if (live.length !== clients.length) {
      failures.push({ invariant: "all-clients-observable", message: `${clients.length - live.length} client(s) had no observable state`, snapshots });
    }
    if (live.length > 1 && live.some((snapshot) => snapshot.value !== live[0]!.value || snapshot.revision !== live[0]!.revision)) {
      failures.push({ invariant: "canonical-convergence", message: "clients disagree on canonical value or revision", snapshots });
    }
    const runId = new URL(clients[0]!.url).searchParams.get("runId")!;
    const expected = this.expectedByRun.get(runId) ?? 0;
    if (live.some((snapshot) => snapshot.value !== expected)) {
      failures.push({ invariant: "semantic-model", message: `canonical value differs from accepted semantic total ${expected}`, snapshots });
    }
    if (live.some((snapshot) => snapshot.pending !== 0)) {
      failures.push({ invariant: "quiescent-outbox", message: "one or more clients retained pending operations after quiescence", snapshots });
    }
    if (live.some((snapshot) => snapshot.value < 0)) {
      failures.push({ invariant: "non-negative-counter", message: "counter became negative", snapshots });
    }
    return failures;
  }

  async control(
    client: ClientHandle,
    control: Exclude<ScheduleStep, { kind: "act" | "pause" | "checkpoint" }>,
    options: AdapterRunOptions,
  ): Promise<void> {
    if (control.kind === "offline") { await client.context.setOffline(true); return; }
    if (control.kind === "online") { await client.context.setOffline(false); return; }
    if (control.kind === "reload") { await this.livePage(client).reload(); await this.livePage(client).waitForFunction(() => Boolean(window.syncFixture)); return; }
    if (control.kind === "kill") { if (client.page && !client.page.isClosed()) await client.page.close(); client.page = null; return; }
    if (control.kind === "relaunch") { await this.relaunch(client); return; }
    await this.livePage(client).evaluate((input) => window.syncFixture.setControl(input), control);
  }

  async close(clients: ClientHandle[]): Promise<void> {
    await Promise.all(clients.map((client) => client.context.close().catch(() => undefined)));
  }

  async shutdown(): Promise<void> {
    await Promise.all([this.browser.close(), this.server.close()]);
  }

  private livePage(client: ClientHandle) {
    if (!client.page || client.page.isClosed()) throw new Error(`client ${client.id + 1} is not running`);
    return client.page;
  }

  private urlFor(clientId: number, options: AdapterRunOptions): string {
    const query = new URLSearchParams({ fixture: options.fixture, runId: options.runId, client: String(clientId) });
    if (options.mutant) query.set("mutant", options.mutant);
    return `${this.server.origin}/fixture?${query}`;
  }

  private async snapshotRecord(clients: ClientHandle[]): Promise<Record<string, CanonicalSnapshot | null>> {
    return Object.fromEntries(await Promise.all(clients.map(async (client) => [`client-${client.id + 1}`, await this.canonicalSnapshot(client)])));
  }
}
