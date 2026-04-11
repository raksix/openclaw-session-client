import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASSWORD = "Fe277353";

const ws = new WebSocket(GATEWAY_URL);

ws.on("open", () => {
  console.log("✅ Connected");
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  const type = msg.event || msg.type;
  
  if (type === "connect.challenge") {
    console.log("📨 Got challenge, sending connect...");
    ws.send(JSON.stringify({
      type: "req",
      id: "auth-1",
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "cli",
          displayName: "Test CLI",
          version: "1.0.0",
          platform: "linux",
          mode: "backend"
        },
        auth: { password: PASSWORD },
        role: "operator"
      }
    }));
  } else if (type === "res" && msg.id === "auth-1") {
    console.log("📨 Auth response:", msg.ok ? "✅ OK" : "❌ FAIL");
    if (msg.error) console.log("Error:", JSON.stringify(msg.error));
    if (msg.result) {
      console.log("Result:", JSON.stringify(msg.result).substring(0, 500));
      console.log("Auth info:", JSON.stringify(msg.result.auth));
      console.log("Scopes:", JSON.stringify(msg.result.scopes));
    }
  } else if (type === "res") {
    console.log("📨 Response:", msg.ok ? "✅ OK" : "❌ FAIL", "method:", msg.result?.method || "unknown");
    if (msg.error) console.log("Error:", JSON.stringify(msg.error));
    if (msg.result) console.log("Result:", JSON.stringify(msg.result).substring(0, 300));
  } else if (type === "event") {
    console.log("📨 Event:", msg.event, JSON.stringify(msg.payload).substring(0, 200));
  }
});

ws.on("error", (err) => {
  console.error("❌ Error:", err.message);
});

ws.on("close", () => {
  console.log("❌ Disconnected");
  process.exit(0);
});

setTimeout(() => ws.close(), 10000);
