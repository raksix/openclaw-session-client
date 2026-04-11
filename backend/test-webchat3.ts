import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASSWORD = "Fe277353";

const ws = new WebSocket(GATEWAY_URL);

ws.on("open", () => console.log("[WS] Connected"));
ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === "res" && msg.id) {
    const pending = pendingRequests.get(msg.id);
    if (pending) { pendingRequests.delete(msg.id); msg.ok ? pending.resolve(msg.result) : pending.reject(new Error(msg.error?.message)); }
  }
  
  if (msg.event === "connect.challenge") {
    console.log("[Challenge] nonce:", msg.payload?.nonce);
    authenticate(msg.payload?.nonce);
  }
  
  if (msg.event === "agent") return;
  
  console.log("[WS]", msg.event || msg.type, msg.id || "");
});

ws.on("error", (err) => console.error("[Error]", err.message));
ws.on("close", () => { console.log("[Closed]"); process.exit(0); });

const pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function authenticate(nonce: string) {
  const id = "auth-" + Math.random().toString(36).substring(7);
  pendingRequests.set(id, {
    resolve: () => { console.log("[Auth] Başarılı!"); listSessions(); },
    reject: (e) => { console.error("[Auth] Hata:", e.message); ws.close(); },
  });
  setTimeout(() => { if (pendingRequests.has(id)) { pendingRequests.delete(id); ws.close(); } }, 10000);

  // webchat with mode: "web"
  ws.send(JSON.stringify({
    type: "req", id, method: "connect", params: {
      minProtocol: 3, maxProtocol: 3,
      client: { id: "webchat", displayName: "WebChat", version: "1.0.0", platform: "linux", mode: "web" },
      auth: { password: PASSWORD },
      role: "user",
    },
  }));
}

function listSessions() {
  const id = "list-" + Math.random().toString(36).substring(7);
  pendingRequests.set(id, {
    resolve: (result) => { console.log("[Sessions]", JSON.stringify(result, null, 2)); ws.close(); },
    reject: (e) => { console.error("[List] Hata:", e.message); ws.close(); },
  });
  setTimeout(() => { if (pendingRequests.has(id)) pendingRequests.delete(id); }, 10000);
  ws.send(JSON.stringify({ type: "req", id, method: "sessions.list", params: {} }));
}

setTimeout(() => { console.log("Timeout"); ws.close(); process.exit(0); }, 30000);
