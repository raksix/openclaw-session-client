import { WebSocket } from "ws";

// Try without any auth first
const ws = new WebSocket("ws://localhost:18789");

ws.on("open", () => {
  console.log("✅ Connected!");
  
  // Try different message formats
  setTimeout(() => {
    // Try json-rpc style
    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      method: "sessions.list",
      id: 1
    }));
  }, 500);
});

ws.on("message", (data) => {
  console.log("📨:", data.toString().substring(0, 500));
});

ws.on("error", (err) => {
  console.error("❌ Error:", err.message);
});

ws.on("close", () => {
  console.log("❌ Disconnected");
});

setTimeout(() => ws.close(), 8000);
