const { spawn } = require('child_process');
const WebSocket = require('ws');

const PORT = 4003;
const wss = new WebSocket.Server({ port: PORT });

wss.on("connection", (ws) => {
  console.log("[WS] Client connected");
  
  ws.on("message", (message) => {
    console.log("[WS] Message:", message.toString().substring(0, 100));
    
    try {
      const msg = JSON.parse(message.toString());
      
      if (msg.type === "chat") {
        console.log("[WS] Spawning agent...");
        
        const proc = spawn('openclaw', ['agent', '--agent', 'main', '--message', msg.message || 'test', '--json'], {
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        console.log("[WS] PID:", proc.pid);
        
        let chunks = 0;
        
        proc.stdout.on("data", (data) => {
          chunks++;
          console.log(`[WS] stdout chunk ${chunks}, len=${data.length}`);
          ws.send(JSON.stringify({ type: "chunk", content: data.toString().substring(0, 50) }));
        });
        
        proc.stderr.on("data", (data) => {
          console.log(`[WS] stderr: ${data.toString().substring(0, 50)}`);
        });
        
        proc.on("close", (code) => {
          console.log(`[WS] Done code=${code}, chunks=${chunks}`);
          ws.send(JSON.stringify({ type: "complete", content: `chunks:${chunks}` }));
          ws.close();
        });
        
        proc.on("error", (err) => {
          console.error("[WS] Error:", err.message);
          ws.send(JSON.stringify({ type: "error", error: err.message }));
          ws.close();
        });
      }
    } catch (e) {
      console.error("[WS] Parse error:", e.message);
    }
  });
  
  ws.on("close", () => console.log("[WS] Client disconnected"));
  ws.on("error", (e) => console.error("[WS] Error:", e.message));
});

console.log(`[WS] Node.js server on port ${PORT}`);

setTimeout(() => {
  console.log("[WS] Timeout");
  process.exit(0);
}, 60000);
