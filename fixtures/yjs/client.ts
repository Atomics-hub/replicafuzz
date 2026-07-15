import * as Y from "yjs";
import type { ScheduleStep } from "../../src/types.js";

const query = new URLSearchParams(location.search);
const runId = query.get("runId")!;
const clientId = Number(query.get("client"));
const doc = new Y.Doc();
const increments = doc.getArray<{ opId: string; at: number }>("increments");
let socket: WebSocket | undefined;
let sequence = 0;
let clockSkew = 0;
let synced = false;
let pendingUntil = 0;
let reconnectTimer: number | undefined;
let dropInbound = 0;
let dropOutbound = 0;
const queued: Uint8Array[] = [];

const valueNode = document.querySelector<HTMLOutputElement>("#value")!;
const statusNode = document.querySelector<HTMLElement>("#status")!;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function render(): void {
  valueNode.textContent = String(increments.length);
  statusNode.textContent = `${socket?.readyState === WebSocket.OPEN ? "connected" : "disconnected"}; ${synced ? "synced" : "syncing"}`;
}

function transmit(update: Uint8Array): void {
  if (dropOutbound > 0) { dropOutbound -= 1; return; }
  if (socket?.readyState === WebSocket.OPEN && synced) socket.send(update);
  else queued.push(update);
}

doc.on("update", (update: Uint8Array, origin: unknown) => {
  if (origin !== "remote") transmit(update);
  render();
});

function connect(): void {
  socket = new WebSocket(`${location.origin.replace("http", "ws")}/yjs?runId=${encodeURIComponent(runId)}`);
  socket.binaryType = "arraybuffer";
  synced = false;
  socket.onmessage = (event) => {
    if (dropInbound > 0) { dropInbound -= 1; return; }
    Y.applyUpdate(doc, new Uint8Array(event.data as ArrayBuffer), "remote");
    if (!synced) {
      synced = true;
      while (queued.length) socket!.send(queued.shift()!);
    }
    render();
  };
  socket.onopen = render;
  socket.onclose = () => {
    synced = false;
    render();
    reconnectTimer = window.setTimeout(connect, 30);
  };
}

async function act(action: { type: "increment"; amount: number }): Promise<void> {
  const deadline = Date.now() + 2_000;
  while ((!socket || socket.readyState !== WebSocket.OPEN || !synced) && Date.now() < deadline) await sleep(10);
  if (!socket || socket.readyState !== WebSocket.OPEN || !synced) throw new Error("Yjs target did not become ready");
  increments.push(Array.from({ length: action.amount }, () => ({
    opId: `${clientId}-${++sequence}`,
    at: Date.now() + clockSkew,
  })));
  pendingUntil = performance.now() + 120;
}

window.syncFixture = {
  act,
  snapshot: () => ({
    value: increments.length,
    revision: increments.length,
    pending: synced && queued.length === 0 && performance.now() >= pendingUntil ? 0 : 1,
  }),
  quiescent: () => synced && queued.length === 0 && performance.now() >= pendingUntil,
  setControl: async (control: ScheduleStep) => {
    if (control.kind === "clockSkew") clockSkew = control.ms;
    if (control.kind === "delayTraffic") await sleep(control.ms);
    if (control.kind === "dropNext") {
      if (control.direction === "inbound") dropInbound += 1;
      else dropOutbound += 1;
    }
  },
};

window.addEventListener("beforeunload", () => {
  if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
  socket?.close();
  doc.destroy();
});
document.querySelector<HTMLButtonElement>("#increment")!.onclick = () => void act({ type: "increment", amount: 1 });
connect();
render();
