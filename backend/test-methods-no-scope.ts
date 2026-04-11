import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASSWORD = "Fe277353";

const ws = new WebSocket(GATEWAY_URL);

ws.on("open", () => console.log("[WS] Connected"));
ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === "res" && msg.id === "auth") {
    console.log("[Auth]", msg.ok ? "Başarılı!" : "Hata: " + msg.error?.message);
    if (msg.ok) {
      // Try various methods
      const methods = ["health", "status", "gateway.info", "system.info"];
      for (const method of methods) {
        ws.send(JSON.stringify({ type: "req", id: method, method, params: {} }));
      }
    } else {
      ws.close();
    }
  }
  
  if (msg.type === "res" && msg.id !== "auth") {
    console.log(`[${msg.id}]`, msg.ok ? JSON.stringify(msg.result)?.slice(0, 200) : "Hata: " + msg.error?.message);
  }
  
  if (msg.event === "connect.challenge") {
    console.log("[Challenge] nonce:", msg.payload?.nonce);
    ws.send(JSON.stringify({
      type: "req", id: "auth", method: "connect", params: {
        minProtocol: 3, maxProtocol: 3,
        client: { id: "cli", displayName: "Test", version: "1.0.0", platform: "linux", mode: "backend" },
        auth: { password: PASSWORD },
      },
    }));
  }
  
  if (msg.event === "agent") return;
  console.log("[WS]", msg.event || msg.type, msg.id || "");
});

ws.on("error", (err) => console.error("[Error]", err.message));
ws.on("close", () => { console.log("[Closed]"); process.exit(0); });

setTimeout(() => { console.log("Timeout"); ws.close(); process.exit(0); }, 15000);
