import { spawn } from "child_process";
import { WebSocketServer } from "ws";

const PORT = 4002;

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  console.log("[WS] Client connected");
  
  ws.on("message", (message) => {
    console.log("[WS] Message received:", message.toString().substring(0, 50));
    try {
      const msg = JSON.parse(message.toString());
      
      if (msg.type === "chat") {
        console.log("[WS] Spawning agent...");
        const proc = spawn("openclaw", ["agent", "--agent", "main", "--message", msg.message || "test", "--json"], {
          stdio: "pipe"
        });
        
        let stdout = "";
        let stderr = "";
        
        proc.stdout?.on("data", (data) => {
          console.log("[WS] stdout data:", data.length);
          stdout += data.toString();
          ws.send(JSON.stringify({ type: "chunk", content: data.toString().substring(0, 50) }));
        });
        
        proc.stderr?.on("data", (data) => {
          console.log("[WS] stderr data:", data.length);
          stderr += data.toString();
        });
        
        proc.on("close", (code) => {
          console.log("[WS] Process closed:", code);
          if (code === 0) {
            ws.send(JSON.stringify({ type: "complete", content: stdout.substring(0, 100) }));
          } else {
            ws.send(JSON.stringify({ type: "error", error: stderr.substring(0, 100) }));
          }
          ws.close();
        });
        
        proc.on("error", (err) => {
          console.error("[WS] Process error:", err.message);
          ws.send(JSON.stringify({ type: "error", error: err.message }));
        });
      }
    } catch (e) {
      console.error("[WS] Parse error:", e.message);
    }
  });
  
  ws.on("close", () => console.log("[WS] Client disconnected"));
});

console.log(`[WS] Standalone server on port ${PORT}`);
