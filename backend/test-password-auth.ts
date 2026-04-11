import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const PASSWORD = "Fe277353";

console.log("=== Simple Password Auth Test ===\n");

const ws = new WebSocket(GATEWAY_URL);

ws.on("open", () => console.log("[WS] Connected"));
ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  
  // Ignore agent events
  if (msg.event === "agent") return;
  
  console.log("[MSG]", msg.event || msg.type, msg.id || "", msg.ok === undefined ? "" : msg.ok ? "OK" : "FAIL");
  
  if (msg.event === "connect.challenge") {
    console.log("\n[1] Received challenge, authenticating with password...\n");
    ws.send(JSON.stringify({
      type: "req",
      id: "auth",
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "cli",
          displayName: "Backend Test",
          version: "1.0.0",
          platform: "linux",
          mode: "backend",
        },
        auth: { password: PASSWORD },
        role: "operator",
      },
    }));
  }
  
  if (msg.id === "auth" && msg.type === "res") {
    if (msg.ok) {
      console.log("[OK] Auth successful!\n");
      console.log("[2] Requesting sessions.list...\n");
      ws.send(JSON.stringify({
        type: "req",
        id: "list",
        method: "sessions.list",
        params: {},
      }));
    } else {
      console.log("[FAIL] Auth failed:", msg.error?.message);
      ws.close();
    }
  }
  
  if (msg.id === "list" && msg.type === "res") {
    if (msg.ok) {
      console.log("[OK] Sessions:", JSON.stringify(msg.result, null, 2));
    } else {
      console.log("[FAIL] List failed:", msg.error?.message);
      
      // Check if pairing required
      if (msg.error?.message.includes("scope") || msg.error?.message.includes("pairing")) {
        console.log("\n[!] Pairing required!");
        console.log("[!] Please run in another terminal:");
        console.log("    openclaw devices list");
        console.log("    openclaw devices approve <request-id>");
      }
    }
    ws.close();
    process.exit(0);
  }
});

ws.on("error", (err) => console.error("[Error]", err.message));
ws.on("close", () => { console.log("\n[Closed]"); process.exit(0); });

setTimeout(() => { console.log("Timeout"); ws.close(); process.exit(0); }, 30000);
