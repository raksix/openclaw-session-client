import { WebSocket } from "ws";

// Gateway token from environment or config
const GATEWAY_TOKEN = "ocw-gw-token-944c6d9e19b2a8b05ef51f0b2fbea3d4";

async function testGateway() {
  console.log("Testing OpenClaw Gateway connection...");
  console.log("Token:", GATEWAY_TOKEN);
  
  // Try connecting with Bearer token
  const ws = new WebSocket("ws://localhost:18789", {
    headers: {
      "Authorization": `Bearer ${GATEWAY_TOKEN}`
    }
  });
  
  ws.on("open", () => {
    console.log("✅ Connected to gateway!");
    
    // Try to get session list
    const msg = {
      type: "sessions.list",
      token: GATEWAY_TOKEN
    };
    ws.send(JSON.stringify(msg));
  });
  
  ws.on("message", (data) => {
    console.log("📨 Message:", data.toString().substring(0, 500));
  });
  
  ws.on("error", (err) => {
    console.error("❌ Error:", err.message);
  });
  
  ws.on("close", (code, reason) => {
    console.log("❌ Closed:", code, reason?.toString());
  });
  
  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, 8000);
}

testGateway();
