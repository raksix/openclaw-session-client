import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:4000/ws/live");

let timer;
let done = false;

ws.on("open", () => {
  console.log("[WS] Connected");
  
  // Send chat message
  ws.send(JSON.stringify({
    type: "chat",
    sessionId: "test-123",
    message: "Merhaba! Nasılsın?",
    agentId: "main"
  }));
  
  console.log("[WS] Message sent, waiting for response...");
  
  // Set timeout
  timer = setTimeout(() => {
    if (!done) {
      console.log("TIMEOUT - no response in 90s");
      ws.close();
      process.exit(1);
    }
  }, 90000);
});

let chunks = 0;
ws.on("message", (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log(`[WS] Type: ${msg.type}, Content: ${msg.content?.substring(0, 80) || msg.error || "(empty)"}`);
    
    if (msg.type === "chunk") {
      chunks++;
      console.log(`[WS] Chunk #${chunks}: ${msg.content?.substring(0, 100)}`);
    }
    
    if (msg.type === "complete") {
      done = true;
      clearTimeout(timer);
      console.log(`\n=== FINAL (${chunks} chunks) ===`);
      console.log("Content:", msg.content);
      console.log("Session:", msg.sessionId);
      ws.close();
      process.exit(0);
    }
    
    if (msg.type === "error") {
      done = true;
      clearTimeout(timer);
      console.error("ERROR:", msg.error);
      ws.close();
      process.exit(1);
    }
  } catch (e) {
    console.error("Parse error:", e.message);
    console.error("Raw data:", data.toString().substring(0, 100));
  }
});

ws.on("error", (err) => {
  console.error("[WS] Error:", err.message);
  clearTimeout(timer);
});

ws.on("close", () => {
  console.log("[WS] Closed");
  clearTimeout(timer);
  if (!done) {
    process.exit(1);
  }
});
