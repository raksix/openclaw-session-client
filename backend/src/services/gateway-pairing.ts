import WebSocket from "ws";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const GATEWAY_PASSWORD = process.env.OPENCLAW_GATEWAY_PASSWORD || "Fe277353";

interface PendingRequest {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

let deviceToken: string | null = null;
let gatewayWs: WebSocket | null = null;
let isConnected = false;
let connectResolve: (() => void) | null = null;
let pendingRequests = new Map<string, PendingRequest>();

export async function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isConnected && gatewayWs?.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    connectResolve = resolve;
    gatewayWs = new WebSocket(GATEWAY_URL);

    gatewayWs.on("open", () => console.log("[Gateway] Connected"));
    gatewayWs.on("message", (data) => handleMessage(JSON.parse(data.toString())));
    gatewayWs.on("error", (err) => { console.error("[Gateway] Error:", err.message); reject(err); });
    gatewayWs.on("close", () => { 
      console.log("[Gateway] Disconnected"); 
      isConnected = false; 
      gatewayWs = null; 
    });

    const challengeTimeout = setTimeout(() => reject(new Error("Gateway challenge timeout")), 10000);

    gatewayWs.once("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.event === "connect.challenge") {
        clearTimeout(challengeTimeout);
        authenticateWithDeviceToken(msg.payload?.nonce).then(() => {
          isConnected = true;
          connectResolve?.();
          connectResolve = null;
        }).catch(reject);
      }
    });
  });
}

async function authenticateWithDeviceToken(nonce: string): Promise<void> {
  if (!gatewayWs || gatewayWs.readyState !== WebSocket.OPEN) {
    throw new Error("Gateway not connected");
  }

  // If we have a device token, use it; otherwise use password
  const auth = deviceToken 
    ? { token: deviceToken }
    : { password: GATEWAY_PASSWORD };

  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(7);
    pendingRequests.set(id, {
      resolve: () => { 
        console.log("[Gateway] Authenticated"); 
        resolve(); 
      },
      reject: (e) => reject(e),
    });

    setTimeout(() => { 
      if (pendingRequests.has(id)) { 
        pendingRequests.delete(id); 
        reject(new Error("Auth timeout")); 
      } 
    }, 10000);

    gatewayWs!.send(JSON.stringify({
      type: "req", id, method: "connect", params: {
        minProtocol: 3, maxProtocol: 3,
        client: { id: "cli", displayName: "OpenClaw Session Manager", version: "1.0.0", platform: process.platform || "linux", mode: "backend" },
        auth,
        role: "operator",
      },
    }));
  });
}

function handleMessage(msg: { type?: string; id?: string; event?: string; ok?: boolean; result?: unknown; error?: { message: string; code?: string } }) {
  // Handle auth response
  if (msg.type === "res" && msg.id) {
    const pending = pendingRequests.get(msg.id);
    if (pending) {
      pendingRequests.delete(msg.id);
      if (msg.ok) {
        pending.resolve(msg.result);
      } else {
        // Check if this is a pairing error
        if (msg.error?.code === "PAIRING_REQUIRED" || msg.error?.message?.includes("pairing")) {
          pending.reject(new Error("PAIRING_REQUIRED"));
        } else {
          pending.reject(new Error(msg.error?.message || "Auth failed"));
        }
      }
    }
  }
}

export async function ensurePairing(): Promise<boolean> {
  try {
    await connect();
    return true;
  } catch (err: any) {
    if (err.message === "PAIRING_REQUIRED") {
      console.log("[Gateway] Pairing required, initiating auto-pairing...");
      return await autoPair();
    }
    throw err;
  }
}

async function autoPair(): Promise<boolean> {
  console.log("[Gateway] Starting auto-pairing process...");
  
  // First, try to get pending pairing requests
  await connect();
  
  const pendingList = await request<{ devices: Array<{ deviceId: string; name: string; status: string }> }>("device.pair.list");
  console.log("[Gateway] Pending devices:", JSON.stringify(pendingList));
  
  // If no pending requests, we need to initiate pairing
  // For now, let's try to use the gateway's token endpoint
  // Actually, let's just try to connect with a new device token request
  
  // Close current connection
  disconnect();
  
  // Try connecting with a fresh auth that includes device info
  return await tryDeviceAuth();
}

async function tryDeviceAuth(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(GATEWAY_URL);
    
    ws.on("open", () => console.log("[Pairing] Connected"));
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      console.log("[Pairing] Message:", msg.event || msg.type, msg.id || "");
      
      if (msg.event === "connect.challenge") {
        // Send connect with device token request
        const id = Math.random().toString(36).substring(7);
        ws.send(JSON.stringify({
          type: "req", id, method: "connect", params: {
            minProtocol: 3, maxProtocol: 3,
            client: { id: "cli", displayName: "OpenClaw Session Manager", version: "1.0.0", platform: process.platform || "linux", mode: "backend" },
            auth: { password: GATEWAY_PASSWORD },
            role: "operator",
          },
        }));
      }
      
      if (msg.type === "res" && msg.id) {
        if (msg.ok) {
          console.log("[Pairing] Auth success!");
          deviceToken = (msg.result as { token?: string })?.token || null;
          ws.close();
          resolve(true);
        } else {
          // Check for pairing requirement
          if (msg.error?.message?.includes("scope-upgrade")) {
            console.log("[Pairing] Scope upgrade required, attempting with scopes...");
            // Try with explicit scopes request
            attemptWithScopes(ws);
          } else {
            console.log("[Pairing] Auth failed:", msg.error?.message);
            ws.close();
            reject(new Error(msg.error?.message));
          }
        }
      }
    });
    
    ws.on("error", (err) => { console.error("[Pairing] Error:", err.message); reject(err); });
    ws.on("close", () => { console.log("[Pairing] Closed"); });
    
    setTimeout(() => { ws.close(); reject(new Error("Pairing timeout")); }, 30000);
  });
}

function attemptWithScopes(ws: WebSocket) {
  const id = Math.random().toString(36).substring(7);
  pendingRequests.set(id, {
    resolve: (r) => { console.log("[Scopes] Success:", r); },
    reject: (e) => { console.error("[Scopes] Failed:", e.message); },
  });
  
  // Request specific scopes
  ws.send(JSON.stringify({
    type: "req", id, method: "connect", params: {
      minProtocol: 3, maxProtocol: 3,
      client: { id: "cli", displayName: "OpenClaw Session Manager", version: "1.0.0", platform: process.platform || "linux", mode: "backend" },
      auth: { password: GATEWAY_PASSWORD },
      role: "operator",
      scopes: ["operator.admin", "operator.approvals", "operator.pairing", "operator.read", "operator.talk.secrets", "operator.write"],
    },
  }));
}

async function request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  await connect();
  
  if (!gatewayWs || gatewayWs.readyState !== WebSocket.OPEN) {
    throw new Error("Gateway not connected");
  }

  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(7);
    const timeout = setTimeout(() => { pendingRequests.delete(id); reject(new Error("Request timeout")); }, 30000);
    
    pendingRequests.set(id, { 
      resolve: (r) => { clearTimeout(timeout); resolve(r as T); }, 
      reject: (e) => { clearTimeout(timeout); reject(e); } 
    });
    
    gatewayWs!.send(JSON.stringify({ type: "req", id, method, params }));
  });
}

export async function listSessions(): Promise<unknown[]> {
  await connect();
  return await request("sessions.list");
}

export async function sendMessage(content: string, sessionId: string): Promise<string> {
  await connect();
  const result = await request<{ message?: string }>("session.message", { sessionId, content });
  return result?.message || "";
}

export async function createSession(name: string): Promise<string> {
  await connect();
  const result = await request<{ sessionId?: string }>("session.create", { name });
  return result?.sessionId || "";
}

export function disconnect() {
  gatewayWs?.close();
  gatewayWs = null;
  isConnected = false;
}

export function getDeviceToken(): string | null {
  return deviceToken;
}
