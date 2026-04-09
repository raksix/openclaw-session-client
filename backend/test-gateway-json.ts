import { WebSocket } from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASS = "Fe277353";

const ws = new WebSocket(GATEWAY_URL);

ws.on("open", () => {
  console.log("✅ Connected!");
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  console.log("📨 Full message:", JSON.stringify(msg));
  
  if (msg.event === "connect.challenge") {
    // Try different auth formats
    const auths = [
      { type: "auth", password: PASS },
      { type: "auth", pass: PASS },
      { jsonrpc: "2.0", method: "auth", params: { password: PASS }, id: 1 },
      { action: "auth", password: PASS },
    ];
    
    auths.forEach((auth, i) => {
      setTimeout(() => {
        console.log(`Trying auth ${i+1}:`, JSON.stringify(auth));
        ws.send(JSON.stringify(auth));
      }, i * 500);
    });
  }
});

ws.on("error", (err) => {
  console.error("❌ Error:", err.message);
});

ws.on("close", () => {
  console.log("❌ Disconnected");
});

setTimeout(() => ws.close(), 10000);
