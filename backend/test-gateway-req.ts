import { WebSocket } from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASSWORD = "Fe277353";

const ws = new WebSocket(GATEWAY_URL);
let msgId = 1;

function send(type: string, params: object = {}, id?: number) {
  const msg = { type, id: id ?? msgId++, ...params };
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
    const nonce = msg.payload.nonce;
    console.log("Got nonce:", nonce);
    
    // Try "request" style connect
    setTimeout(() => {
      send("request", {
        method: "connect",
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
          role: "operator"
        }
      });
    }, 500);
  }
  
  if (msg.type === "response" && msg.id) {
    console.log("Response to:", msg.id, "success:", msg.success);
    if (msg.success) {
      console.log("✅ AUTH SUCCESS!");
      // Try sessions.list
      setTimeout(() => {
        send("request", { method: "sessions.list" });
      }, 500);
    } else {
      console.log("❌ Error:", msg.error);
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
