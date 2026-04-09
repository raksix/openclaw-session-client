import { WebSocket } from "ws";

const url = "ws://localhost:18789";
const token = "ocw-gw-token-944c6d9e19b2a8b05ef51f0b2fbea3d4";

// Try with query param
const ws = new WebSocket(`${url}?token=${token}`);

ws.on("open", () => {
  console.log("✅ Connected!");
  setTimeout(() => {
    ws.send(JSON.stringify({ type: "sessions.list" }));
  }, 500);
});

ws.on("message", (data) => {
  console.log("📨:", data.toString().substring(0, 500));
});

ws.on("error", (err) => {
  console.error("❌ Error:", err.message);
});

ws.on("close", (code, reason) => {
  console.log("❌ Disconnected:", code, reason?.toString());
});

setTimeout(() => {
  ws.close();
  process.exit(0);
}, 8000);
