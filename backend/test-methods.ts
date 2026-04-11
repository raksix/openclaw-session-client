import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASSWORD = "Fe277353";

const ws = new WebSocket(GATEWAY_URL);
let authenticated = false;

ws.on("open", () => console.log("[WS] Connected"));
ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  console.log("[WS] Event:", msg.event || msg.type, msg.id || "");
  
  if (msg.type === "res" && msg.id) {
    const pending = pendingRequests.get(msg.id);
    if (pending) { pendingRequests.delete(msg.id); msg.ok ? pending.resolve(msg.result) : pending.reject(new Error(msg.error?.message || "Auth failed")); }
  }
  
  if (msg.event === "connect.challenge") {
    console.log("[Challenge] nonce:", msg.payload?.nonce);
    authenticate(msg.payload?.nonce);
  }
  
  if (msg.event === "agent" && authenticated) {
    console.log("[Agent Event]", JSON.stringify(msg.payload));
  }
});

ws.on("error", (err) => console.error("[Error]", err.message));
ws.on("close", () => { console.log("[Closed]"); process.exit(0); });

const pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function authenticate(nonce: string) {
  const id = "auth-" + Math.random().toString(36).substring(7);
  pendingRequests.set(id, {
    resolve: () => { console.log("[Auth] Başarılı!"); authenticated = true; testMethods(); },
    reject: (e) => { console.error("[Auth] Hata:", e.message); ws.close(); },
  });
  setTimeout(() => { if (pendingRequests.has(id)) { pendingRequests.delete(id); ws.close(); } }, 10000);

  ws.send(JSON.stringify({
    type: "req", id, method: "connect", params: {
      minProtocol: 3, maxProtocol: 3,
      client: { id: "cli", displayName: "Test", version: "1.0.0", platform: "linux", mode: "backend" },
      auth: { password: PASSWORD },
      role: "operator",
    },
  }));
}

function testMethods() {
  // Try different methods
  const methods = ["sessions.list", "session.list", "gateway.sessions", "listSessions"];
  
  for (const method of methods) {
    const id = "test-" + Math.random().toString(36).substring(7);
    pendingRequests.set(id, {
      resolve: (result) => { console.log(`[${method}] Success:`, JSON.stringify(result)?.slice(0, 200)); },
      reject: (e) => { console.log(`[${method}] Hata:`, e.message); },
    });
    setTimeout(() => { if (pendingRequests.has(id)) { pendingRequests.delete(id); } }, 5000);
    ws.send(JSON.stringify({ type: "req", id, method, params: {} }));
  }
  
  // Also try the agent's session method
  setTimeout(() => {
    const id = "agent-" + Math.random().toString(36).substring(7);
    pendingRequests.set(id, {
      resolve: (result) => { console.log("[agent.session] Success:", JSON.stringify(result)?.slice(0, 200)); ws.close(); },
      reject: (e) => { console.log("[agent.session] Hata:", e.message); ws.close(); },
    });
    setTimeout(() => { if (pendingRequests.has(id)) { pendingRequests.delete(id); } }, 5000);
    ws.send(JSON.stringify({ type: "req", id, method: "agent.session", params: {} }));
  }, 2000);
}

setTimeout(() => { console.log("Timeout"); ws.close(); process.exit(0); }, 30000);
