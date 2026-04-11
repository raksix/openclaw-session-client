import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const DEVICE_TOKEN = "xvPayD2bTUz-zyVfZrt8z8xOVVro345tdHEHj8aRcyc";

const ws = new WebSocket(GATEWAY_URL);

ws.on("open", () => {
  console.log("✅ Connected");
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  const type = msg.event || msg.type;
  
  if (type === "connect.challenge") {
    console.log("📨 Got challenge, sending connect with device token...");
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
        auth: { token: DEVICE_TOKEN },
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
    
    // Try sessions.list after successful auth
    if (msg.ok) {
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: "req",
          id: "list-1",
          method: "sessions.list",
          params: {}
        }));
      }, 500);
    }
  } else if (type === "res" && msg.id === "list-1") {
    console.log("📨 Sessions list response:", msg.ok ? "✅ OK" : "❌ FAIL");
    if (msg.error) console.log("Error:", JSON.stringify(msg.error));
    if (msg.result) console.log("Sessions:", JSON.stringify(msg.result).substring(0, 500));
  } else if (type === "event") {
    console.log("📨 Event:", msg.event);
  }
});

ws.on("error", (err) => {
  console.error("❌ Error:", err.message);
});

ws.on("close", () => {
  console.log("❌ Disconnected");
  process.exit(0);
});

setTimeout(() => ws.close(), 15000);
