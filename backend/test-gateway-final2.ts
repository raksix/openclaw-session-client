import { WebSocket } from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASSWORD = "Fe277353";

const ws = new WebSocket(GATEWAY_URL);

function send(method: string, params: object = {}) {
  const id = Math.random().toString(36).substring(7);
  const msg = { type: "req", id, method, params };
  ws.send(JSON.stringify(msg));
  console.log("📤 Sent:", JSON.stringify(msg).substring(0, 300));
}

ws.on("open", () => {
  console.log("✅ Connected");
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  console.log("📨 Received:", JSON.stringify(msg).substring(0, 400));
  
  if (msg.event === "connect.challenge") {
    console.log("Got nonce:", msg.payload.nonce);
    
    setTimeout(() => {
      send("connect", {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "test-client",
          displayName: "Test Client",
          version: "1.0.0",
          platform: "linux",
          mode: "backend"
        },
        auth: {
          password: PASSWORD
        },
        role: "operator"
      });
    }, 500);
  }
  
  if (msg.type === "res" && msg.id) {
    console.log("Response:", msg.success ? "✅ SUCCESS" : "❌ FAIL", msg.error || "");
    if (msg.success) {
      console.log("AUTH RESULT:", JSON.stringify(msg.result).substring(0, 300));
    }
  }
});

ws.on("error", (err) => {
  console.error("❌ Error:", err.message);
});

ws.on("close", () => {
  console.log("❌ Disconnected");
});

setTimeout(() => ws.close(), 15000);
