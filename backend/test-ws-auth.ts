import { WebSocket } from "ws";

const url = "ws://localhost:18789";
const token = "ocw-gw-token-944c6d9e19b2a8b05ef51f0b2fbea3d4";

const ws = new WebSocket(url, {
  headers: {
    "Authorization": `Bearer ${token}`
  }
});

ws.on("open", () => {
  console.log("✅ Connected to gateway!");
  
  // Send auth message
  ws.send(JSON.stringify({ 
    type: "auth", 
    token: token 
  }));
  
  // Try to list sessions
  setTimeout(() => {
    ws.send(JSON.stringify({ 
      type: "sessions.list" 
    }));
  }, 1000);
});

ws.on("message", (data) => {
  const msg = data.toString();
  console.log("📨 Received:", msg.substring(0, 500));
});

ws.on("error", (err) => {
  console.error("❌ Error:", err.message);
});

ws.on("close", (code, reason) => {
  console.log("❌ Disconnected:", code, reason?.toString());
});

setTimeout(() => {
  console.log("Timeout - closing");
  ws.close();
}, 10000);
