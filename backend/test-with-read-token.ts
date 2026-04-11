import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const TOKEN = "MS4VJMYWzVrFTqVDZtrZsSCqBX-UTVbCzJbNaUUlnc4";

console.log("=== Token Auth Test (operator.read only) ===\n");

const ws = new WebSocket(GATEWAY_URL);

ws.on("open", () => console.log("[WS] Connected"));
ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.event === "agent") return;
  console.log("[MSG]", msg.event || msg.type, msg.id || "", msg.ok === undefined ? "" : msg.ok ? "OK" : "FAIL");
  
  if (msg.event === "connect.challenge") {
    console.log("\n[1] Authenticating with token...\n");
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
        auth: { token: TOKEN },
        role: "operator",
      },
    }));
  }
  
  if (msg.id === "auth" && msg.type === "res") {
    if (msg.ok) {
      console.log("[OK] Auth successful!\n");
      console.log("[2] Listing sessions...\n");
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
    console.log("\n[RESULT]", msg.ok ? "SUCCESS" : "FAILED");
    if (msg.ok) {
      console.log("Sessions:", JSON.stringify(msg.result, null, 2));
    } else {
      console.log("Error:", msg.error?.message);
    }
    ws.close();
    process.exit(0);
  }
});

ws.on("error", (err) => console.error("[Error]", err.message));
ws.on("close", () => { console.log("\n[Closed]"); process.exit(0); });

setTimeout(() => { console.log("Timeout"); ws.close(); process.exit(0); }, 15000);
