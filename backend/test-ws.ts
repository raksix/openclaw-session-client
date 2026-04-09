import { WebSocket } from "ws";

const url = "ws://localhost:18789";
const ws = new WebSocket(url);

ws.on("open", () => {
  console.log("Connected to gateway!");
  
  // Try to get session list or auth
  ws.send(JSON.stringify({ type: "ping" }));
});

ws.on("message", (data) => {
  console.log("Received:", data.toString());
});

ws.on("error", (err) => {
  console.error("Error:", err.message);
});

ws.on("close", () => {
  console.log("Disconnected");
});

// Timeout
setTimeout(() => {
  console.log("Timeout - closing");
  ws.close();
}, 5000);
