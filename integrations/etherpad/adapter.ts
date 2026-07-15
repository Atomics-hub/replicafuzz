import { chromium, type Browser, type Frame, type Page } from "playwright";
import type {
  AdapterRunOptions,
  CanonicalSnapshot,
  ClientHandle,
  InvariantFailure,
  ScheduleStep,
  SemanticAction,
  SyncAdapter,
} from "../../src/types.js";

type EtherpadClient = {
  collabClient?: {
    getCurrentRevisionNumber?: () => number;
    hasUnacceptedCommit?: () => boolean;
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class EtherpadAdapter implements SyncAdapter {
  readonly name = "etherpad-3-browser";
  private readonly expectedTokens = new Map<string, string[]>();
  private readonly actionIssues = new Map<string, string[]>();
  private readonly baseline = new Map<string, string>();
  private readonly runByClient = new WeakMap<ClientHandle, string>();

  private constructor(
    private readonly browser: Browser,
    private readonly origin: string,
  ) {}

  static async create(origin = "http://127.0.0.1:9001"): Promise<EtherpadAdapter> {
    const browser = await chromium.launch({ headless: true });
    return new EtherpadAdapter(browser, origin.replace(/\/$/, ""));
  }

  async reset(options: AdapterRunOptions): Promise<void> {
    // Etherpad's default public configuration does not expose destructive API
    // credentials. A run therefore gets a fresh, UUID-scoped pad instead.
    this.expectedTokens.set(options.runId, []);
    this.actionIssues.set(options.runId, []);
    this.baseline.delete(options.runId);
  }

  async launch(clientId: number, options: AdapterRunOptions): Promise<ClientHandle> {
    const context = await this.browser.newContext({ serviceWorkers: "block" });
    const padId = `replicafuzz-${options.runId.replace(/[^a-zA-Z0-9-]/g, "-")}`;
    const url = `${this.origin}/p/${encodeURIComponent(padId)}`;
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await this.waitUntilReady(page);
    const handle: ClientHandle = { id: clientId, context, page, url };
    this.runByClient.set(handle, options.runId);
    const snapshot = await this.canonicalSnapshot(handle);
    if (!this.baseline.has(options.runId) && snapshot?.document !== undefined) {
      this.baseline.set(options.runId, snapshot.document);
    }
    return handle;
  }

  async relaunch(client: ClientHandle): Promise<void> {
    if (client.page && !client.page.isClosed()) await client.page.close();
    client.page = await client.context.newPage();
    await client.page.goto(client.url, { waitUntil: "domcontentloaded" });
    await this.waitUntilReady(client.page);
  }

  async act(client: ClientHandle, action: SemanticAction): Promise<void> {
    if (action.type !== "append") throw new Error(`Etherpad adapter does not support semantic action ${action.type}`);
    const page = this.livePage(client);
    const editor = (await this.editorFrame(page)).locator("body[contenteditable=true]");
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.insertText(action.text);
    const observed = await editor.innerText();
    const runId = this.runId(client);
    this.expectedTokens.get(runId)!.push(action.text);
    if (!observed.includes(action.text)) {
      this.actionIssues.get(runId)!.push(`issued append ${JSON.stringify(action.text)} had no immediate editor effect`);
    }
  }

  async canonicalSnapshot(client: ClientHandle): Promise<CanonicalSnapshot | null> {
    if (!client.page || client.page.isClosed()) return null;
    try {
      const page = client.page;
      const frame = await this.editorFrame(page);
      const [document, state] = await Promise.all([
        frame.locator("body[contenteditable=true]").innerText(),
        page.evaluate(() => {
          const pad = (window as unknown as { pad?: EtherpadClient }).pad;
          return {
            revision: pad?.collabClient?.getCurrentRevisionNumber?.() ?? -1,
            pending: pad?.collabClient?.hasUnacceptedCommit?.() ? 1 : 0,
          };
        }),
      ]);
      const canonical = document.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
      return { value: canonical.length, pending: state.pending, revision: state.revision, document: canonical };
    } catch {
      return null;
    }
  }

  async waitForQuiescence(clients: ClientHandle[], timeoutMs = 8_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let previous = "";
    let stableReads = 0;
    while (Date.now() < deadline) {
      const snapshots = await Promise.all(clients.map((client) => this.canonicalSnapshot(client)));
      const live = snapshots.filter((snapshot): snapshot is CanonicalSnapshot => snapshot !== null);
      const encoded = JSON.stringify(snapshots);
      const converged = live.length === clients.length
        && live.every((snapshot) => snapshot.pending === 0)
        && live.every((snapshot) => snapshot.document === live[0]!.document)
        && live.every((snapshot) => snapshot.revision === live[0]!.revision);
      stableReads = encoded === previous ? stableReads + 1 : 0;
      if (converged && stableReads >= 2) return;
      previous = encoded;
      await sleep(50);
    }
  }

  async assertInvariants(clients: ClientHandle[]): Promise<InvariantFailure[]> {
    const snapshots = await this.snapshotRecord(clients);
    const live = Object.values(snapshots).filter((snapshot): snapshot is CanonicalSnapshot => snapshot !== null);
    const failures: InvariantFailure[] = [];
    if (live.length !== clients.length) {
      failures.push({ invariant: "all-clients-observable", message: `${clients.length - live.length} client(s) had no observable Etherpad state`, snapshots });
      return failures;
    }
    if (live.some((snapshot) => snapshot.document !== live[0]!.document || snapshot.revision !== live[0]!.revision)) {
      failures.push({ invariant: "canonical-convergence", message: "Etherpad clients disagree on canonical text or collaboration revision", snapshots });
    }
    if (live.some((snapshot) => snapshot.pending !== 0)) {
      failures.push({ invariant: "accepted-commit", message: "one or more Etherpad clients retain an unaccepted local commit", snapshots });
    }
    const runId = this.runId(clients[0]!);
    const document = live[0]!.document ?? "";
    const baseline = this.baseline.get(runId) ?? "";
    for (const issue of this.actionIssues.get(runId) ?? []) {
      failures.push({ invariant: "semantic-action-effect", message: issue, snapshots });
    }
    if (!document.startsWith(baseline)) {
      failures.push({ invariant: "baseline-preserved", message: "the original Etherpad document prefix changed", snapshots });
    }
    let unexplained = document.startsWith(baseline) ? document.slice(baseline.length) : document;
    for (const token of this.expectedTokens.get(runId) ?? []) {
      const occurrences = document.split(token).length - 1;
      if (occurrences !== 1) {
        failures.push({ invariant: "semantic-conservation", message: `token ${JSON.stringify(token)} appears ${occurrences} times instead of once`, snapshots });
      }
      unexplained = unexplained.replace(token, "");
    }
    if (unexplained.length > 0) {
      failures.push({ invariant: "no-unmodeled-text", message: `canonical document contains ${unexplained.length} unmodeled character(s)`, snapshots });
    }
    return failures;
  }

  async control(
    client: ClientHandle,
    control: Exclude<ScheduleStep, { kind: "act" | "pause" | "checkpoint" }>,
  ): Promise<void> {
    if (control.kind === "offline") { await client.context.setOffline(true); return; }
    if (control.kind === "online") { await client.context.setOffline(false); return; }
    if (control.kind === "reload") {
      const page = this.livePage(client);
      await page.reload({ waitUntil: "domcontentloaded" });
      await this.waitUntilReady(page);
      return;
    }
    if (control.kind === "kill") {
      if (client.page && !client.page.isClosed()) await client.page.close();
      client.page = null;
      return;
    }
    if (control.kind === "relaunch") { await this.relaunch(client); return; }
    if (control.kind === "delayTraffic") { await sleep(control.ms); return; }
    throw new Error(`Etherpad adapter honestly does not control ${control.kind}; use a proxy for packet loss or clock injection`);
  }

  async close(clients: ClientHandle[]): Promise<void> {
    await Promise.all(clients.map((client) => client.context.close().catch(() => undefined)));
  }

  async shutdown(): Promise<void> {
    await this.browser.close();
  }

  private livePage(client: ClientHandle): Page {
    if (!client.page || client.page.isClosed()) throw new Error(`client ${client.id + 1} is not running`);
    return client.page;
  }

  private runId(client: ClientHandle): string {
    const runId = this.runByClient.get(client);
    if (!runId) throw new Error(`client ${client.id + 1} has no Etherpad run identity`);
    return runId;
  }

  private async waitUntilReady(page: Page): Promise<void> {
    await page.waitForFunction(() => {
      const pad = (window as unknown as { pad?: EtherpadClient }).pad;
      return typeof pad?.collabClient?.getCurrentRevisionNumber === "function";
    }, undefined, { timeout: 15_000 });
    const frame = await this.editorFrame(page);
    await frame.locator("body[contenteditable=true]").waitFor({ state: "visible", timeout: 10_000 });
  }

  private async editorFrame(page: Page): Promise<Frame> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const frame = page.frame({ name: "ace_inner" });
      if (frame) return frame;
      await sleep(25);
    }
    throw new Error("Etherpad ace_inner editor frame did not appear");
  }

  private async snapshotRecord(clients: ClientHandle[]): Promise<Record<string, CanonicalSnapshot | null>> {
    return Object.fromEntries(await Promise.all(clients.map(async (client) => [`client-${client.id + 1}`, await this.canonicalSnapshot(client)])));
  }
}
