import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASSWORD = "Fe277353";

const ws = new WebSocket(GATEWAY_URL, {
  headers: {
    "Origin": "http://localhost:18789"
  }
});

ws.on("open", () => console.log("[WS] Connected"));
ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === "res" && msg.id === "auth") {
    console.log("[Auth]", msg.ok ? "Başarılı!" : "Hata: " + msg.error?.message);
    if (msg.ok) {
      // Try sessions.list
      ws.send(JSON.stringify({ type: "req", id: "list", method: "sessions.list", params: {} }));
    } else {
      ws.close();
    }
  }
  
  if (msg.id === "list") {
    console.log("[Sessions]", msg.ok ? JSON.stringify(msg.result) : "Hata: " + msg.error?.message);
    ws.close();
  }
  
  if (msg.event === "connect.challenge") {
    console.log("[Challenge]");
    ws.send(JSON.stringify({
      type: "req", id: "auth", method: "connect", params: {
        minProtocol: 3, maxProtocol: 3,
        client: { id: "openclaw-control-ui", displayName: "Control UI", version: "1.0.0", platform: "linux", mode: "ui" },
        auth: { password: PASSWORD },
        role: "operator",
      },
    }));
  }
  
  if (msg.event === "agent") return;
  console.log("[WS]", msg.event || msg.type);
});

ws.on("error", (err) => console.error("[Error]", err.message));
ws.on("close", () => { console.log("[Closed]"); process.exit(0); });

setTimeout(() => { console.log("Timeout"); ws.close(); process.exit(0); }, 15000);
