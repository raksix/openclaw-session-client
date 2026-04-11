import WebSocket from "ws";

const GATEWAY_URL = "ws://77.90.41.67:18789";
const TOKEN = "PTzQOahKwO81gmrxsvYA2EKBgs2gJ6nqCFQUcdMVD6o";

console.log("Connecting to", GATEWAY_URL);

const ws = new WebSocket(GATEWAY_URL, {
  headers: {
    "Authorization": `Bearer ${TOKEN}`
  }
});

ws.on("open", () => console.log("[WS] Connected"));
ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === "res" && msg.id === "auth") {
    console.log("[Auth]", msg.ok ? "Başarılı!" : "Hata: " + msg.error?.message);
    if (msg.ok) {
      ws.send(JSON.stringify({ type: "req", id: "list", method: "sessions.list", params: {} }));
    } else {
      ws.close();
    }
  }
  
  if (msg.id === "list") {
    console.log("[Sessions]", msg.ok ? JSON.stringify(msg.result, null, 2) : "Hata: " + msg.error?.message);
    ws.close();
    process.exit(0);
  }
  
  if (msg.event === "connect.challenge") {
    console.log("[Challenge] nonce:", msg.payload?.nonce);
  }
  
  if (msg.event === "agent") return;
  console.log("[WS]", msg.event || msg.type, msg.id || "");
});

ws.on("error", (err) => console.error("[Error]", err.message));
ws.on("close", () => { console.log("[Closed]"); process.exit(0); });

setTimeout(() => { console.log("Timeout"); ws.close(); process.exit(0); }, 15000);
