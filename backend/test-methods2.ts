import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASSWORD = "Fe277353";

const ws = new WebSocket(GATEWAY_URL);
let connected = false;

function send(method: string, params: object = {}) {
  if (!connected) return;
  const id = Math.random().toString(36).substring(7);
  const msg = { type: "req", id, method, params };
  ws.send(JSON.stringify(msg));
  console.log("📤 Sent:", method);
}

ws.on("open", () => {
  console.log("✅ Connected");
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  const type = msg.event || msg.type;
  
  if (type === "connect.challenge") {
    console.log("📨 Got challenge");
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
      role: "operator",
      scopes: ["operator.read", "operator.write"]  // Add explicit scopes
    });
  } else if (type === "res" && msg.id) {
    console.log("📨 Response:", msg.ok ? "✅ OK" : "❌ FAIL", "id:", msg.id);
    if (msg.error) console.log("Error:", JSON.stringify(msg.error));
    if (msg.result) console.log("Result:", JSON.stringify(msg.result).substring(0, 500));
    
    // Try methods after connect
    if (msg.ok && !ws._sentMethods) {
      ws._sentMethods = true;
      setTimeout(() => {
        send("sessions.list");
        setTimeout(() => send("session.create", { name: "Test" }), 1000);
      }, 500);
    }
  } else if (type === "event") {
    console.log("📨 Event:", msg.event, JSON.stringify(msg.payload).substring(0, 200));
  }
});

ws.on("error", (err) => {
  console.error("❌ Error:", err.message);
});

ws.on("close", () => {
  console.log("❌ Disconnected");
});

setTimeout(() => ws.close(), 15000);

(ws as any)._sentMethods = false;
