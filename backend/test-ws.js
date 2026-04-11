import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:4000/ws");

ws.on("open", () => {
  console.log("[WS] Connected");
  
  // Send auth
  ws.send(JSON.stringify({ type: "auth" }));
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  console.log("[WS] Received:", JSON.stringify(msg, null, 2));
  
  if (msg.type === "auth" && msg.result === "authenticated") {
    console.log("[WS] Authenticated! Sending chat message...");
    
    // Send chat message
    ws.send(JSON.stringify({
      type: "chat",
      sessionId: "69d91786c164fa974a052cf2", // Test session ID
      content: "Selam!",
      agentId: "main"
    }));
  }
  
  if (msg.type === "result" && msg.result) {
    console.log("[WS] Chat result:", msg.result);
    ws.close();
  }
});

ws.on("error", (err) => {
  console.error("[WS] Error:", err.message);
});

ws.on("close", () => {
  console.log("[WS] Closed");
});
