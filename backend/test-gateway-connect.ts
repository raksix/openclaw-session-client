import { WebSocket } from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASSWORD = "Fe277353";

const ws = new WebSocket(GATEWAY_URL);
let seq = 1;

function send(data: object) {
  ws.send(JSON.stringify(data));
  console.log("📤 Sent:", JSON.stringify(data).substring(0, 200));
}

ws.on("open", () => {
  console.log("✅ Connected, waiting for challenge...");
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  console.log("📨 Received:", JSON.stringify(msg).substring(0, 300));
  
  if (msg.event === "connect.challenge") {
    const nonce = msg.payload.nonce;
    console.log("Got nonce:", nonce);
    
    // Send client.connect with password auth
    setTimeout(() => {
      send({
        type: "client.connect",
        seq: seq++,
        params: {
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
          role: "operator",
          scopes: ["operator.read"]
        }
      });
    }, 500);
  }
  
  if (msg.type === "response" && msg.success === true) {
    console.log("✅ Auth successful!");
    
    // Try to list sessions
    setTimeout(() => {
      send({
        type: "sessions.list",
        seq: seq++,
        id: 1
      });
    }, 500);
  }
  
  if (msg.type === "response" && msg.success === false) {
    console.log("❌ Auth failed:", msg.error);
  }
});

ws.on("error", (err) => {
  console.error("❌ Error:", err.message);
});

ws.on("close", () => {
  console.log("❌ Disconnected");
});

setTimeout(() => ws.close(), 15000);
