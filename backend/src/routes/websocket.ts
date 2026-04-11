import { Elysia } from "elysia";
import { spawn } from "child_process";
import { WebSocketServer, WebSocket } from "ws";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";

interface ChatMessage {
  type: "chat" | "ping";
  sessionId?: string;
  message?: string;
  agentId?: string;
}

interface StreamChunk {
  type: "chunk" | "complete" | "error";
  content?: string;
  sessionId?: string;
}

// Store active connections
const connections = new Map<WebSocket, { gatewayWs?: WebSocket; pendingRequests?: Map<string, any> }>();

export const wsRoutes = new Elysia({ prefix: "/ws" })
  .ws("/live", {
    open(ws) {
      console.log("[WS] Client connected");
      connections.set(ws, { pendingRequests: new Map() });
      ws.send(JSON.stringify({ type: "connected", message: "WebSocket ready" }));
    },
    
    message(ws, message) {
      console.log("[WS] Message received, type:", typeof message);
      try {
        let msg: ChatMessage;
        if (typeof message === "string") {
          msg = JSON.parse(message);
        } else if (typeof message === "object" && message !== null) {
          msg = message as ChatMessage;
        } else {
          ws.send(JSON.stringify({ type: "error", error: "Invalid message type" }));
          return;
        }
        
        console.log("[WS] Parsed message:", msg);
        
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
        
        if (msg.type === "chat") {
          handleChat(ws, msg);
          return;
        }
      } catch (err) {
        console.error("[WS] Parse error:", err);
        ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
      }
    },
    
    close(ws) {
      console.log("[WS] Client disconnected");
      connections.delete(ws);
    },
    
    error(ws, error) {
      console.error("[WS] Error:", error);
      connections.delete(ws);
    }
  });

async function handleChat(ws: WebSocket, msg: ChatMessage) {
  const { sessionId, message, agentId = "main" } = msg;
  
  if (!message) {
    ws.send(JSON.stringify({ type: "error", error: "Message required" }));
    return;
  }
  
  console.log(`[WS] handleChat called: session=${sessionId}, agent=${agentId}`);
  
  // Send processing status
  ws.send(JSON.stringify({ type: "status", content: "Starting agent...", sessionId }));
  
  // Spawn process
  const args = [
    "agent",
    "--agent", agentId,
    "--message", message,
    "--json"
  ];
  if (sessionId) {
    args.push("--session-id", sessionId);
  }
  
  console.log(`[WS] Spawning: openclaw ${args.join(" ")}`);
  
  // Use sh -c to spawn so stdin/stdout works properly in Bun/Elysia context
  const proc = spawn("sh", ["-c", `openclaw ${args.join(" ")}`], {
    stdio: "pipe"
  });
  
  let stdout = "";
  let stderr = "";
  let finished = false;
  
  console.log("[WS] Setting up stdout handler, PID:", proc.pid);
  
  // Handle stdout - stream chunks to client
  proc.stdout?.on("data", (data) => {
    const text = data.toString();
    console.log("[WS] stdout data received, length:", data.length);
    stdout += text;
    
    ws.send(JSON.stringify({
      type: "chunk",
      content: text,
      sessionId
    }));
  });
  
  // Handle stderr
  proc.stderr?.on("data", (data) => {
    stderr += data.toString();
    console.log(`[WS] stderr data: ${data.toString().substring(0, 50)}`);
  });
  
  // Handle completion
  proc.on("close", (code) => {
    console.log(`[WS] Process closed with code ${code}`);
    finished = true;
    
    if (code === 0) {
      try {
        const jsonMatch = stdout.match(/\{[\s\S]*"status"[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          const responseText = result.result?.payloads?.[0]?.text || 
                               result.result?.text || 
                               "Response received";
          
          ws.send(JSON.stringify({
            type: "complete",
            content: responseText,
            sessionId: result.result?.meta?.agentMeta?.sessionId || sessionId,
            raw: result
          }));
        } else {
          ws.send(JSON.stringify({
            type: "complete",
            content: stdout || "No response",
            sessionId
          }));
        }
      } catch (e) {
        console.error("[WS] Parse error:", e);
        ws.send(JSON.stringify({
          type: "complete",
          content: stdout || "Parse error",
          sessionId
        }));
      }
    } else {
      ws.send(JSON.stringify({
        type: "error",
        error: `Process failed: ${stderr || "Unknown error"}`,
        sessionId
      }));
    }
    
    proc.disconnect();
  });
  
  proc.on("error", (err) => {
    console.error(`[WS] Process error:`, err);
    if (!finished) {
      ws.send(JSON.stringify({
        type: "error",
        error: err.message,
        sessionId
      }));
    }
  });
  
  console.log("[WS] handleChat returning, waiting for proc...");
  
  // Timeout after 2 minutes
  setTimeout(() => {
    if (!finished) {
      console.log("[WS] Timeout, killing process");
      proc.kill();
      ws.send(JSON.stringify({
        type: "error",
        error: "Timeout after 2 minutes",
        sessionId
      }));
    }
  }, 120000);
}
