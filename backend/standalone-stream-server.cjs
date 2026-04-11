// Standalone WebSocket server for streaming - runs separately from Elysia
const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');

const PORT = process.env.STREAM_PORT || 4002;
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  console.log("[StreamWS] Client connected");
  
  ws.on("message", (message) => {
    console.log("[StreamWS] Message:", message.toString().substring(0, 100));
    
    try {
      const msg = JSON.parse(message.toString());
      
      if (msg.type === "chat") {
        console.log("[StreamWS] Spawning agent for:", msg.message);
        
        const args = [
          "agent",
          "--agent", msg.agentId || "main",
          "--message", msg.message || "test",
          "--json"
        ];
        if (msg.sessionId) {
          args.push("--session-id", msg.sessionId);
        }
        
        const proc = spawn("openclaw", args, {
          stdio: ["ignore", "pipe", "pipe"]
        });
        
        console.log("[StreamWS] PID:", proc.pid);
        
        let chunks = 0;
        let fullOutput = "";
        
        // Send initial status
        ws.send(JSON.stringify({ 
          type: "status", 
          content: "Starting agent...",
          sessionId: msg.sessionId 
        }));
        
        proc.stdout.on("data", (data) => {
          chunks++;
          const text = data.toString();
          fullOutput += text;
          console.log(`[StreamWS] chunk ${chunks}, len=${data.length}`);
          
          // Send chunk to client
          ws.send(JSON.stringify({ 
            type: "chunk", 
            content: text,
            sessionId: msg.sessionId 
          }));
        });
        
        proc.stderr.on("data", (data) => {
          // Gateway error messages - can be ignored or logged
          const text = data.toString();
          if (!text.includes("Gateway agent failed")) {
            console.log(`[StreamWS] stderr: ${text.substring(0, 100)}`);
          }
        });
        
        proc.on("close", (code) => {
          console.log(`[StreamWS] Done code=${code}, chunks=${chunks}`);
          
          if (code === 0) {
            // Parse the JSON response
            try {
              const jsonMatch = fullOutput.match(/\{[\s\S]*"status"[\s\S]*\}/);
              if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                const responseText = result.result?.payloads?.[0]?.text || 
                                     result.result?.text || 
                                     "Response received";
                const sessionId = result.result?.meta?.agentMeta?.sessionId || msg.sessionId;
                
                ws.send(JSON.stringify({ 
                  type: "complete", 
                  content: responseText,
                  sessionId: sessionId,
                  raw: result
                }));
              } else {
                ws.send(JSON.stringify({ 
                  type: "complete", 
                  content: fullOutput || "No response",
                  sessionId: msg.sessionId 
                }));
              }
            } catch (e) {
              console.error("[StreamWS] Parse error:", e.message);
              ws.send(JSON.stringify({ 
                type: "complete", 
                content: fullOutput || "Parse error",
                sessionId: msg.sessionId 
              }));
            }
          } else {
            ws.send(JSON.stringify({ 
              type: "error", 
              error: `Process failed with code ${code}`,
              sessionId: msg.sessionId 
            }));
          }
          
          ws.close();
        });
        
        proc.on("error", (err) => {
          console.error("[StreamWS] Process error:", err.message);
          ws.send(JSON.stringify({ 
            type: "error", 
            error: err.message,
            sessionId: msg.sessionId 
          }));
          ws.close();
        });
        
        // Timeout after 2 minutes
        setTimeout(() => {
          console.log("[StreamWS] Timeout, killing process");
          proc.kill();
          ws.send(JSON.stringify({ 
            type: "error", 
            error: "Timeout after 2 minutes",
            sessionId: msg.sessionId 
          }));
          ws.close();
        }, 120000);
        
      } else if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } catch (e) {
      console.error("[StreamWS] Parse error:", e.message);
      ws.send(JSON.stringify({ type: "error", error: e.message }));
    }
  });
  
  ws.on("close", () => console.log("[StreamWS] Client disconnected"));
  ws.on("error", (e) => console.error("[StreamWS] Error:", e.message));
});

console.log(`[StreamWS] Standalone WebSocket streaming server on port ${PORT}`);
console.log(`[StreamWS] PID: ${process.pid}`);

// Handle process signals
process.on('SIGTERM', () => {
  console.log('[StreamWS] SIGTERM received, shutting down');
  wss.close(() => {
    console.log('[StreamWS] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[StreamWS] SIGINT received, shutting down');
  wss.close(() => {
    console.log('[StreamWS] Server closed');
    process.exit(0);
  });
});
