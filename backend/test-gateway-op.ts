import { WebSocket } from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const TOKEN = "xvPayD2bTUz-zyVfZrt8z8xOVVro345tdHEHj8aRcyc";

console.log("Using operator token");

const ws = new WebSocket(GATEWAY_URL, {
  headers: {
    "Authorization": `Bearer ${TOKEN}`
  }
});

ws.on("open", () => {
  console.log("✅ Connected!");
  setTimeout(() => {
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
