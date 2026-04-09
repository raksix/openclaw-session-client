import { WebSocket } from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASSWORD = "Fe277353";

const ws = new WebSocket(GATEWAY_URL);

function send(method: string, params: object = {}) {
  const id = Math.random().toString(36).substring(7);
  const msg = { type: "req", id, method, params };
  ws.send(JSON.stringify(msg));
  console.log("📤 Sent:", JSON.stringify(msg).substring(0, 300));
}

ws.on("open", () => {
  console.log("✅ Connected");
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  const type = msg.event || msg.type;
  const short = JSON.stringify(msg).substring(0, 200);
  
  if (type === "connect.challenge") {
    console.log("📨 Got challenge, nonce:", msg.payload.nonce);
    setTimeout(() => {
      send("connect", {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "cli",
          displayName: "Test CLI",
          version: "1.0.0",
          platform: "linux",
          mode: "backend"
        },
        auth: { password: PASSWORD },
        role: "operator"
      });
    }, 500);
  } else if (type === "res") {
    console.log("📨 Response:", msg.ok ? "✅ OK" : "❌ FAIL", short);
  } else if (type === "event") {
    console.log("📨 Event:", msg.event, short);
  } else {
    console.log("📨 Message:", short);
  }
});

ws.on("error", (err) => {
  console.error("❌ Error:", err.message);
});

ws.on("close", () => {
  console.log("❌ Disconnected");
});

setTimeout(() => ws.close(), 10000);
