import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const DEVICE_TOKEN = "6hZT2AqxWktG6krxwAe-eZ7WyZeuk9zkjYx21neMuLw";

console.log("Connecting with device token...");

const ws = new WebSocket(GATEWAY_URL);

ws.on("open", () => console.log("[WS] Connected"));
ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === "res" && msg.id === "auth") {
    console.log("[Auth]", msg.ok ? "Başarılı!" : "Hata: " + msg.error?.message);
    if (msg.ok) {
      ws.send(JSON.stringify({ type: "req", id: "list", method: "sessions.list", params: {} }));
    } else {
      ws.close();
    }
  }
  
  if (msg.id === "list") {
    console.log("[Sessions]", msg.ok ? JSON.stringify(msg.result, null, 2) : "Hata: " + msg.error?.message);
    ws.close();
    process.exit(0);
  }
  
  if (msg.event === "connect.challenge") {
    console.log("[Challenge] nonce:", msg.payload?.nonce);
    // Use device token in auth
    ws.send(JSON.stringify({
      type: "req", id: "auth", method: "connect", params: {
        minProtocol: 3, maxProtocol: 3,
        client: { id: "cli", displayName: "Test", version: "1.0.0", platform: "linux", mode: "backend" },
        auth: { token: DEVICE_TOKEN },
        role: "operator",
      },
    }));
  }
  
  if (msg.event === "agent") return;
  console.log("[WS]", msg.event || msg.type, msg.id || "");
});

ws.on("error", (err) => console.error("[Error]", err.message));
ws.on("close", () => { console.log("[Closed]"); process.exit(0); });

setTimeout(() => { console.log("Timeout"); ws.close(); process.exit(0); }, 15000);
