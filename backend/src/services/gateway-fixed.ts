import WebSocket from "ws";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const GATEWAY_PASSWORD = process.env.OPENCLAW_GATEWAY_PASSWORD || "Fe277353";
const STATE_DIR = process.env.OPENCLAW_STATE_DIR || path.join(process.env.HOME || "/root", ".openclaw");

interface PendingRequest {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

let gatewayWs: WebSocket | null = null;
let isConnected = false;
let pendingRequests = new Map<string, PendingRequest>();

function loadDeviceIdentity() {
  try {
    const devicePath = path.join(STATE_DIR, "identity", "device.json");
    const authPath = path.join(STATE_DIR, "identity", "device-auth.json");
    
    if (fs.existsSync(devicePath) && fs.existsSync(authPath)) {
      const device = JSON.parse(fs.readFileSync(devicePath, "utf-8"));
      const auth = JSON.parse(fs.readFileSync(authPath, "utf-8"));
      return { device, auth };
    }
  } catch (err) {
    console.log("[Gateway] Could not load device identity:", err);
  }
  return null;
}

function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  token: string;
  nonce: string;
  platform?: string;
}): string {
  const scopes = params.scopes.join(",");
  return [
    "v3",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(Date.now()),
    params.token,
    params.nonce,
    params.platform || "linux",
    "openclaw"
  ].join("|");
}

export async function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isConnected && gatewayWs?.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    gatewayWs = new WebSocket(GATEWAY_URL);

    gatewayWs.on("open", () => console.log("[Gateway] Connected"));
    gatewayWs.on("message", (data) => handleMessage(JSON.parse(data.toString())));
    gatewayWs.on("error", (err) => { console.error("[Gateway] Error:", err.message); reject(err); });
    gatewayWs.on("close", () => { console.log("[Gateway] Disconnected"); isConnected = false; gatewayWs = null; });

    const challengeTimeout = setTimeout(() => reject(new Error("Gateway challenge timeout")), 10000);

    gatewayWs.once("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.event === "connect.challenge") {
        clearTimeout(challengeTimeout);
        authenticateWithDeviceAuth(msg.payload?.nonce).then(() => {
          isConnected = true;
          resolve();
        }).catch(reject);
      }
    });
  });
}

async function authenticateWithDeviceAuth(nonce: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!gatewayWs || gatewayWs.readyState !== WebSocket.OPEN) {
      reject(new Error("Gateway not connected"));
      return;
    }

    const identity = loadDeviceIdentity();
    const scopes = ["operator.admin", "operator.approvals", "operator.pairing", "operator.read", "operator.talk.secrets", "operator.write"];
    
    let authPayload: any = {
      password: GATEWAY_PASSWORD,
    };

    if (identity?.auth?.tokens?.operator?.token) {
      const token = identity.auth.tokens.operator.token;
      const deviceId = identity.device.deviceId;
      
      // Build signed device auth payload
      const signedPayload = buildDeviceAuthPayload({
        deviceId,
        clientId: "cli",
        clientMode: "backend",
        role: "operator",
        scopes,
        token,
        nonce,
        platform: "linux"
      });
      
      authPayload = {
        password: GATEWAY_PASSWORD,
        token: token,
        signedAuth: signedPayload
      };
      
      console.log("[Gateway] Using device token auth");
    } else {
      console.log("[Gateway] No device token found, using password only");
    }

    const id = Math.random().toString(36).substring(7);
    pendingRequests.set(id, {
      resolve: () => { 
        console.log("[Gateway] Auth success"); 
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

    gatewayWs.send(JSON.stringify({
      type: "req", id, method: "connect", params: {
        minProtocol: 3, maxProtocol: 3,
        client: { id: "cli", mode: "backend", displayName: "OpenClaw Session Manager", version: "1.0.0", platform: "linux" },
        auth: authPayload,
        role: "operator",
        scopes,
      },
    }));
  });
}

function handleMessage(msg: { type?: string; id?: string; event?: string; ok?: boolean; result?: unknown; error?: { message: string } }) {
  if (msg.type === "res" && msg.id) {
    const pending = pendingRequests.get(msg.id);
    if (pending) { pendingRequests.delete(msg.id); msg.ok ? pending.resolve(msg.result) : pending.reject(new Error(msg.error?.message || "Request failed")); }
  }
}

export async function listGatewaySessions(): Promise<unknown[]> {
  await connect();
  if (!gatewayWs || gatewayWs.readyState !== WebSocket.OPEN) throw new Error("Gateway not connected");

  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(7);
    const timeout = setTimeout(() => { pendingRequests.delete(id); reject(new Error("Gateway request timeout")); }, 30000);
    pendingRequests.set(id, { resolve: (r) => { clearTimeout(timeout); resolve(r as unknown[]); }, reject: (e) => { clearTimeout(timeout); reject(e); } });
    gatewayWs.send(JSON.stringify({ type: "req", id, method: "sessions.list", params: {} }));
  });
}

export async function sendToGateway(content: string, sessionId: string): Promise<string> {
  await connect();
  if (!gatewayWs || gatewayWs.readyState !== WebSocket.OPEN) throw new Error("Gateway not connected");

  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(7);
    const timeout = setTimeout(() => { pendingRequests.delete(id); reject(new Error("Gateway request timeout")); }, 60000);
    pendingRequests.set(id, { resolve: (r) => { clearTimeout(timeout); resolve(r as string); }, reject: (e) => { clearTimeout(timeout); reject(e); } });
    gatewayWs.send(JSON.stringify({ type: "req", id, method: "session.message", params: { sessionId, content } }));
  });
}

export async function createGatewaySession(name: string): Promise<string> {
  await connect();
  if (!gatewayWs || gatewayWs.readyState !== WebSocket.OPEN) throw new Error("Gateway not connected");

  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(7);
    const timeout = setTimeout(() => { pendingRequests.delete(id); reject(new Error("Gateway request timeout")); }, 30000);
    pendingRequests.set(id, { resolve: (r) => { clearTimeout(timeout); resolve((r as { sessionId?: string })?.sessionId || ""); }, reject: (e) => { clearTimeout(timeout); reject(e); } });
    gatewayWs.send(JSON.stringify({ type: "req", id, method: "session.create", params: { name } }));
  });
}

export function disconnectGateway() { gatewayWs?.close(); gatewayWs = null; isConnected = false; }
