import WebSocket from "ws";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const GATEWAY_PASSWORD = process.env.OPENCLAW_GATEWAY_PASSWORD || "Fe277353";

let ws: WebSocket | null = null;
let pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

async function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(GATEWAY_URL);

    ws.on("open", () => console.log("[WS] Connected"));
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === "res" && msg.id) {
        const pending = pendingRequests.get(msg.id);
        if (pending) {
          pendingRequests.delete(msg.id);
          if (msg.ok) pending.resolve(msg.result);
          else pending.reject(new Error(msg.error?.message || "Failed"));
        }
      }
      
      if (msg.event === "connect.challenge") {
        console.log("[Challenge]");
        // Use webchat client ID with mode: "chat"
        ws!.send(JSON.stringify({
          type: "req", id: "auth", method: "connect", params: {
            minProtocol: 3, maxProtocol: 3,
            client: { id: "webchat", displayName: "WebChat", version: "1.0.0", platform: "linux", mode: "chat" },
            auth: { password: GATEWAY_PASSWORD },
            role: "user",
          },
        }));
      }
      
      if (msg.event === "agent") return;
      console.log("[WS]", msg.event || msg.type);
    });

    ws.on("error", (err) => reject(err));
    ws.on("close", () => { ws = null; });

    // Wait for auth
    pendingRequests.set("auth", {
      resolve: () => { console.log("[Auth] Success"); resolve(); },
      reject: (e) => reject(e),
    });

    setTimeout(() => {
      pendingRequests.delete("auth");
      reject(new Error("Auth timeout"));
    }, 10000);
  });
}

async function request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error("Not connected");
  }

  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(7);
    pendingRequests.set(id, {
      resolve: (r) => resolve(r as T),
      reject: (e) => reject(e),
    });
    setTimeout(() => { pendingRequests.delete(id); reject(new Error("Timeout")); }, 15000);
    ws!.send(JSON.stringify({ type: "req", id, method, params }));
  });
}

async function main() {
  try {
    await connect();
    
    // Try sessions.list
    try {
      const sessions = await request("sessions.list");
      console.log("[Sessions]", JSON.stringify(sessions, null, 2));
    } catch (e: any) {
      console.log("[Sessions Error]", e.message);
    }

    // Try session.create
    try {
      const result = await request<{ sessionId?: string }>("session.create", { name: "Test Session" });
      console.log("[Create]", JSON.stringify(result));
    } catch (e: any) {
      console.log("[Create Error]", e.message);
    }

    // Try chat history
    try {
      const history = await request("chat.history", { sessionKey: "agent:main:telegram:furkan11:direct:951805081" });
      console.log("[History]", JSON.stringify(history));
    } catch (e: any) {
      console.log("[History Error]", e.message);
    }

    ws?.close();
  } catch (err: any) {
    console.error("[Error]", err.message);
    ws?.close();
  }
}

main();
