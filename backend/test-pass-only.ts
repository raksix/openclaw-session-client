import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASSWORD = "Fe277353";

const ws = new WebSocket(GATEWAY_URL);

ws.on("open", () => console.log("✅ Connected"));

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  const type = msg.event || msg.type;
  
  if (type === "connect.challenge") {
    ws.send(JSON.stringify({
      type: "req", id: "auth", method: "connect",
      params: {
        minProtocol: 3, maxProtocol: 3,
        client: { id: "cli", displayName: "Test", version: "1.0.0", platform: "linux", mode: "backend" },
        auth: { password: PASSWORD },
        role: "operator"
      }
    }));
  } else if (type === "res" && msg.id === "auth") {
    console.log("Auth:", msg.ok ? "✅" : "❌", msg.error ? JSON.stringify(msg.error) : "");
    if (msg.result) console.log("Scopes:", JSON.stringify(msg.result.scopes));
    
    if (msg.ok) {
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "req", id: "list", method: "sessions.list", params: {} }));
      }, 500);
    }
  } else if (type === "res" && msg.id === "list") {
    console.log("Sessions:", msg.ok ? "✅" : "❌", msg.error ? JSON.stringify(msg.error) : "");
    if (msg.result) console.log(JSON.stringify(msg.result).substring(0, 300));
  }
});

ws.on("close", () => { console.log("❌ Disconnected"); process.exit(0); });
setTimeout(() => ws.close(), 10000);
