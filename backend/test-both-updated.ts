import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASSWORD = "Fe277353";
const DEVICE_TOKEN = "xvPayD2bTUz-zyVfZrt8z8xOVVro345tdHEHj8aRcyc";

const ws = new WebSocket(GATEWAY_URL);

ws.on("open", () => {
  console.log("✅ Connected");
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  const type = msg.event || msg.type;
  
  if (type === "connect.challenge") {
    console.log("📨 Got challenge, sending with password + token...");
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
        auth: { password: PASSWORD, token: DEVICE_TOKEN },
        role: "operator"
      }
    }));
  } else if (type === "res" && msg.id === "auth-1") {
    console.log("📨 Auth:", msg.ok ? "✅ OK" : "❌ FAIL");
    if (msg.error) console.log("Error:", JSON.stringify(msg.error));
    if (msg.result) {
      console.log("Scopes:", JSON.stringify(msg.result.scopes));
    }
    
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
    console.log("📨 Sessions:", msg.ok ? "✅ OK" : "❌ FAIL");
    if (msg.error) console.log("Error:", JSON.stringify(msg.error));
    if (msg.result) console.log(JSON.stringify(msg.result).substring(0, 500));
    
    // Also try session.message
    if (msg.ok) {
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: "req",
          id: "msg-1",
          method: "session.message",
          params: { sessionId: "69d7d171ee0eecde5c34d984", content: "Merhaba!" }
        }));
      }, 500);
    }
  } else if (type === "res" && msg.id === "msg-1") {
    console.log("📨 Message:", msg.ok ? "✅ OK" : "❌ FAIL");
    if (msg.error) console.log("Error:", JSON.stringify(msg.error));
    if (msg.result) console.log(JSON.stringify(msg.result).substring(0, 500));
  }
});

ws.on("close", () => {
  console.log("❌ Disconnected");
  process.exit(0);
});

setTimeout(() => ws.close(), 15000);
