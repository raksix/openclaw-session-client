import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASSWORD = "Fe277353";

const modes = ["cli", "chat", "operator", "ui"];

for (const mode of modes) {
  console.log(`\n--- Testing mode: ${mode} ---`);
  
  const ws = new WebSocket(GATEWAY_URL);
  let done = false;

  ws.on("open", () => console.log(`[WS] Connected`));
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    
    if (msg.type === "res" && msg.id) {
      const pending = pendingRequests.get(msg.id);
      if (pending) { pendingRequests.delete(msg.id); msg.ok ? pending.resolve(msg.result) : pending.reject(new Error(msg.error?.message)); }
    }
    
    if (msg.event === "connect.challenge") {
      console.log(`[Challenge]`);
      ws.send(JSON.stringify({
        type: "req", id: "auth", method: "connect", params: {
          minProtocol: 3, maxProtocol: 3,
          client: { id: "webchat", displayName: "WebChat", version: "1.0.0", platform: "linux", mode },
          auth: { password: PASSWORD },
          role: "user",
        },
      }));
    }
    
    if (msg.event === "agent") return;
    
    console.log(`[WS]`, msg.event || msg.type, msg.id || "");
    if (msg.type === "res" && msg.id === "auth") {
      if (msg.ok) {
        console.log(`[Auth] Başarılı with mode: ${mode}!`);
      } else {
        console.log(`[Auth] Hata:`, msg.error?.message);
      }
      done = true;
      ws.close();
    }
  });

  ws.on("error", (err) => console.error("[Error]", err.message));
  ws.on("close", () => { if (!done) console.log("[Closed]"); });
  
  const pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  
  setTimeout(() => { if (!done) { ws.close(); done = true; } }, 5000);
}

setTimeout(() => process.exit(0), 30000);
