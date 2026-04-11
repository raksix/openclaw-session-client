import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASSWORD = "Fe277353";

const clients = [
  { id: "openclaw-control-ui", mode: "control" },
  { id: "openclaw-control-ui", mode: "ui" },
  { id: "openclaw-control-ui", mode: "control-ui" },
  { id: "openclaw-webchat", mode: "webchat" },
  { id: "openclaw-webchat", mode: "chat" },
];

for (const client of clients) {
  console.log(`\n--- Testing client: ${client.id}, mode: ${client.mode} ---`);
  
  const ws = new WebSocket(GATEWAY_URL);
  let done = false;

  ws.on("open", () => console.log(`[WS] Connected`));
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    
    if (msg.type === "res" && msg.id === "auth") {
      if (msg.ok) {
        console.log(`[Auth] Başarılı!`);
        done = true;
        ws.close();
        process.exit(0);
      } else {
        console.log(`[Auth] Hata:`, msg.error?.message);
        done = true;
        ws.close();
      }
    }
    
    if (msg.event === "connect.challenge") {
      ws.send(JSON.stringify({
        type: "req", id: "auth", method: "connect", params: {
          minProtocol: 3, maxProtocol: 3,
          client: { id: client.id, displayName: "Test", version: "1.0.0", platform: "linux", mode: client.mode },
          auth: { password: PASSWORD },
          role: "operator",
        },
      }));
    }
    
    if (msg.event === "agent") return;
    console.log(`[WS]`, msg.event || msg.type);
  });

  ws.on("error", (err) => { console.error("[Error]", err.message); done = true; });
  ws.on("close", () => { if (!done) console.log("[Closed]"); });
  
  setTimeout(() => { if (!done) { ws.close(); done = true; } }, 5000);
}

setTimeout(() => process.exit(0), 60000);
