import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import { WebSocketServer, WebSocket } from "ws";

type StoredState = {
  value: number;
  revision: number;
  applied: Set<string>;
  operationCount: number;
  wsClients: Map<number, WebSocket>;
  sseClients: Map<number, ServerResponse>;
};

export type FixtureServer = {
  origin: string;
  close(): Promise<void>;
};

const page = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sync fixture</title>
  <style>
    :root{font:16px/1.45 system-ui;color:#17202a;background:#f5f7fa}body{max-width:42rem;margin:4rem auto;padding:0 1rem}
    main{background:white;border:1px solid #dfe6ee;border-radius:12px;padding:2rem;box-shadow:0 12px 30px #17202a12}
    output{font:700 4rem/1 monospace;display:block;margin:1rem 0}button{font:inherit;padding:.7rem 1rem}code{background:#eef2f6;padding:.15rem .3rem}
  </style>
</head>
<body><main><h1 id="fixture"></h1><p>Client <code id="client"></code></p><output id="value">0</output><p id="status">starting</p><button id="increment">Increment</button></main>
<script type="module">
const query = new URLSearchParams(location.search);
const fixture = query.get('fixture');
const runId = query.get('runId');
const clientId = Number(query.get('client'));
const mutant = query.get('mutant') || '';
const valueNode = document.querySelector('#value');
const statusNode = document.querySelector('#status');
document.querySelector('#fixture').textContent = fixture + ' counter';
document.querySelector('#client').textContent = String(clientId + 1);
let state = { value: 0, revision: 0, pending: 0 };
let socket;
let source;
let pollTimer;
let sequence = 0;
let clockSkew = 0;
const control = { inboundDelay: 0, outboundDelay: 0, dropInbound: 0, dropOutbound: 0 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function render(){ valueNode.textContent=String(state.value); statusNode.textContent='revision '+state.revision+'; pending '+state.pending; }
async function accept(snapshot){
  if(control.dropInbound>0){control.dropInbound--;return;}
  if(control.inboundDelay) await sleep(control.inboundDelay);
  state.value=snapshot.value;state.revision=snapshot.revision;state.pending=0;render();
  if(fixture==='storage') localStorage.setItem('syncfuzz-state',JSON.stringify(snapshot));
}
function op(amount){return {type:'op',opId:clientId+'-'+(++sequence),clientId,delta:amount,at:Date.now()+clockSkew};}
async function sendHttp(payload){
  if(control.dropOutbound>0){control.dropOutbound--;return;}
  if(control.outboundDelay) await sleep(control.outboundDelay);
  await fetch('/op?fixture='+fixture+'&runId='+encodeURIComponent(runId)+'&mutant='+encodeURIComponent(mutant),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
}
async function act(action){
  state.pending++;render();const payload=op(action.amount);
  if(fixture==='websocket'){
    while(!socket || socket.readyState!==WebSocket.OPEN) await sleep(5);
    if(control.dropOutbound>0){control.dropOutbound--;return;}
    if(control.outboundDelay) await sleep(control.outboundDelay);
    socket.send(JSON.stringify(payload));
  } else await sendHttp(payload);
}
function connectWebSocket(){
  socket=new WebSocket(location.origin.replace('http','ws')+'/ws?runId='+encodeURIComponent(runId)+'&client='+clientId+'&mutant='+encodeURIComponent(mutant));
  socket.onmessage=(event)=>accept(JSON.parse(event.data));
  socket.onopen=()=>{statusNode.textContent='connected';};
  socket.onclose=()=>{statusNode.textContent='disconnected';setTimeout(connectWebSocket,30);};
}
function connectSse(){
  source=new EventSource('/events?runId='+encodeURIComponent(runId)+'&client='+clientId+'&mutant='+encodeURIComponent(mutant));
  source.onmessage=(event)=>accept(JSON.parse(event.data));
}
async function poll(){
  try{const response=await fetch('/state?fixture='+fixture+'&runId='+encodeURIComponent(runId)+'&client='+clientId+'&mutant='+encodeURIComponent(mutant));if(response.ok)await accept(await response.json());}catch{}
}
if(fixture==='websocket')connectWebSocket();
else if(fixture==='sse')connectSse();
else {
  if(fixture==='storage'){const saved=localStorage.getItem('syncfuzz-state');if(saved)accept(JSON.parse(saved));}
  pollTimer=setInterval(poll,25);poll();
}
document.querySelector('#increment').onclick=()=>act({type:'increment',amount:1});
window.syncFixture={
  act,
  snapshot:()=>({value:state.value,pending:state.pending,revision:state.revision}),
  quiescent:()=>state.pending===0,
  setControl:async(next)=>{
    if(next.kind==='delayTraffic'){control.inboundDelay=next.ms;control.outboundDelay=next.ms;}
    if(next.kind==='dropNext')control[next.direction==='inbound'?'dropInbound':'dropOutbound']++;
    if(next.kind==='clockSkew')clockSkew=next.ms;
  }
};
render();
</script></body></html>`;

function newState(): StoredState {
  return { value: 0, revision: 0, applied: new Set(), operationCount: 0, wsClients: new Map(), sseClients: new Map() };
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function alteredSnapshot(state: StoredState, mutant: string, clientId: number): { value: number; revision: number } {
  if (mutant.endsWith("stale-client-2") && clientId === 1) return { value: Math.max(0, state.value - 1), revision: Math.max(0, state.revision - 1) };
  if (mutant.endsWith("skew-client-3") && clientId === 2) return { value: state.value + 1, revision: state.revision };
  if (mutant.endsWith("revision-skew-client-1") && clientId === 0) return { value: state.value, revision: state.revision + 1 };
  return { value: state.value, revision: state.revision };
}

function publish(state: StoredState, mutant: string): void {
  for (const [clientId, socket] of state.wsClients) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(alteredSnapshot(state, mutant, clientId)));
  }
  for (const [clientId, response] of state.sseClients) {
    response.write(`data: ${JSON.stringify(alteredSnapshot(state, mutant, clientId))}\n\n`);
  }
}

function applyOperation(state: StoredState, mutant: string, clientId: number, delta: number, opId: string): void {
  if (state.applied.has(opId)) return;
  state.applied.add(opId);
  state.operationCount += 1;
  const first = state.operationCount === 1;
  if ((mutant.endsWith("drop-first-outbound") && first) || (mutant.endsWith("ignore-client-2") && clientId === 1)) {
    publish(state, mutant);
    return;
  }
  let appliedDelta = delta;
  if (mutant.endsWith("duplicate-first-op") && first) appliedDelta *= 2;
  if (mutant.endsWith("reverse-first-op") && first) appliedDelta *= -1;
  if (mutant.endsWith("zero-first-op") && first) appliedDelta = 0;
  state.value += appliedDelta;
  state.revision += 1;
  publish(state, mutant);
}

export async function startFixtureServer(port = 0): Promise<FixtureServer> {
  const states = new Map<string, StoredState>();
  const stateFor = (runId: string): StoredState => {
    let state = states.get(runId);
    if (!state) { state = newState(); states.set(runId, state); }
    return state;
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const runId = url.searchParams.get("runId") ?? "default";
    const mutant = url.searchParams.get("mutant") ?? "";
    if (url.pathname === "/fixture") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(page);
      return;
    }
    if (url.pathname === "/reset" && request.method === "POST") {
      const previous = states.get(runId);
      previous?.sseClients.forEach((client) => client.end());
      previous?.wsClients.forEach((client) => client.close());
      states.set(runId, newState());
      json(response, 200, { ok: true });
      return;
    }
    if (url.pathname === "/op" && request.method === "POST") {
      const body = await readJson(request);
      applyOperation(stateFor(runId), mutant, Number(body.clientId), Number(body.delta), String(body.opId));
      json(response, 202, { accepted: true });
      return;
    }
    if (url.pathname === "/state") {
      const clientId = Number(url.searchParams.get("client") ?? 0);
      json(response, 200, alteredSnapshot(stateFor(runId), mutant, clientId));
      return;
    }
    if (url.pathname === "/events") {
      const clientId = Number(url.searchParams.get("client") ?? 0);
      response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      const state = stateFor(runId);
      state.sseClients.set(clientId, response);
      response.write(`data: ${JSON.stringify(alteredSnapshot(state, mutant, clientId))}\n\n`);
      request.on("close", () => state.sseClients.delete(clientId));
      return;
    }
    json(response, 404, { error: "not found" });
  });

  const sockets = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/ws") { socket.destroy(); return; }
    sockets.handleUpgrade(request, socket, head, (ws) => {
      const runId = url.searchParams.get("runId") ?? "default";
      const mutant = url.searchParams.get("mutant") ?? "";
      const clientId = Number(url.searchParams.get("client") ?? 0);
      const state = stateFor(runId);
      state.wsClients.set(clientId, ws);
      ws.send(JSON.stringify(alteredSnapshot(state, mutant, clientId)));
      ws.on("message", (raw) => {
        const body = JSON.parse(raw.toString()) as { clientId: number; delta: number; opId: string };
        applyOperation(state, mutant, body.clientId, body.delta, body.opId);
      });
      ws.on("close", () => state.wsClients.delete(clientId));
    });
  });

  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not bind TCP");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    async close() {
      sockets.clients.forEach((client) => client.terminate());
      states.forEach((state) => state.sseClients.forEach((client) => client.end()));
      server.close();
      await once(server, "close");
    },
  };
}
