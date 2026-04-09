import { WebSocket } from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";

console.log("Connecting to OpenClaw Gateway at", GATEWAY_URL);

const ws = new WebSocket(GATEWAY_URL);

ws.on("open", () => {
  console.log("✅ Connected to gateway!");
  
  // Test: ping
  ws.send(JSON.stringify({ type: "ping" }));
  
  // Get session list
  setTimeout(() => {
    ws.send(JSON.stringify({ type: "sessions.list" }));
  }, 500);
});

ws.on("message", (data) => {
  console.log("📨 Received:", data.toString().substring(0, 500));
});

ws.on("error", (err) => {
  console.error("❌ Error:", err.message);
});

ws.on("close", () => {
  console.log("❌ Disconnected");
});

setTimeout(() => {
  ws.close();
  process.exit(0);
}, 10000);
