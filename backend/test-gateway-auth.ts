import { WebSocket } from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const TOKEN = process.env.OCW_GW_TOKEN || "ocw-gw-token-944c6d9e19b2a8b05ef51f0b2fbea3d4";

console.log("Token from env:", TOKEN);

const ws = new WebSocket(GATEWAY_URL, {
  headers: {
    "Authorization": `Bearer ${TOKEN}`
  }
});

ws.on("open", () => {
  console.log("✅ Connected!");
  
  // After connect challenge, send auth response
  setTimeout(() => {
    // Try sessions.list
    ws.send(JSON.stringify({ type: "sessions.list" }));
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
