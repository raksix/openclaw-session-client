import { WebSocket } from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASS = "Fe277353";

console.log("Trying password:", PASS);

const ws = new WebSocket(GATEWAY_URL);

ws.on("open", () => {
  console.log("✅ Connected!");
  
  // Send auth with password
  setTimeout(() => {
    ws.send(JSON.stringify({ 
      type: "auth", 
      password: PASS 
    }));
  }, 500);
});

ws.on("message", (data) => {
  console.log("📨 Received:", data.toString().substring(0, 800));
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
