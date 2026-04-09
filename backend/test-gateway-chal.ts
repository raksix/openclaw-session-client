import { WebSocket } from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASS = "Fe277353";

const ws = new WebSocket(GATEWAY_URL);

let nonce = null;

ws.on("open", () => {
  console.log("✅ Connected!");
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  console.log("📨 Type:", msg.type, "Event:", msg.event);
  
  if (msg.event === "connect.challenge") {
    nonce = msg.payload.nonce;
    console.log("Got nonce:", nonce);
    
    // Try auth with nonce
    setTimeout(() => {
      ws.send(JSON.stringify({ 
        type: "auth", 
        password: PASS,
        nonce: nonce
      }));
    }, 500);
  }
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
