import WebSocket from "ws";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const GATEWAY_PASSWORD = process.env.OPENCLAW_GATEWAY_PASSWORD || "Fe277353";
const STATE_DIR = process.env.OPENCLAW_STATE_DIR || path.join(process.env.HOME || "/root", ".openclaw");

interface PendingRequest {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

function loadDeviceToken(): string | null {
  try {
    const authPath = path.join(STATE_DIR, "identity", "device-auth.json");
    if (fs.existsSync(authPath)) {
      const auth = JSON.parse(fs.readFileSync(authPath, "utf-8"));
      return auth?.tokens?.operator?.token || null;
    }
  } catch (err) {
    console.log("[Gateway] Could not load device token:", err);
  }
  return null;
}

class GatewayService extends EventEmitter {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private isConnected = false;
  private deviceToken: string | null = null;
  private scopes = ["operator.admin", "operator.approvals", "operator.pairing", "operator.read", "operator.talk.secrets", "operator.write"];

  async connect(): Promise<void> {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    // Load device token on connect
    this.deviceToken = loadDeviceToken();

    return new Promise((resolve, reject) => {
      console.log("[Gateway] Connecting to", GATEWAY_URL);
      this.ws = new WebSocket(GATEWAY_URL);

      this.ws.on("open", () => console.log("[Gateway] Connected"));
      this.ws.on("message", (data) => this.handleMessage(JSON.parse(data.toString())));
      this.ws.on("error", (err) => { 
        console.error("[Gateway] Error:", err.message); 
        this.emit("error", err); 
      });
      this.ws.on("close", () => { 
        console.log("[Gateway] Disconnected"); 
        this.isConnected = false; 
        this.ws = null; 
      });

      const challengeTimeout = setTimeout(() => reject(new Error("Challenge timeout")), 10000);

      this.ws.once("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.event === "connect.challenge") {
          clearTimeout(challengeTimeout);
          this.authenticate(msg.payload?.nonce as string)
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }

  private authenticate(nonce: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error("Not connected"));
        return;
      }

      const id = "auth-" + Math.random().toString(36).substring(7);
      this.pendingRequests.set(id, {
        resolve: () => {
          console.log("[Gateway] Auth success");
          this.isConnected = true;
          resolve();
        },
        reject: (e) => reject(e),
      });

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Auth timeout"));
        }
      }, 10000);

      // Use deviceToken if available, otherwise fall back to password
      const auth: Record<string, string> = { password: GATEWAY_PASSWORD };
      if (this.deviceToken) {
        auth.deviceToken = this.deviceToken;
        console.log("[Gateway] Using device token for auth");
      } else {
        console.log("[Gateway] No device token, using password only");
      }

      this.ws.send(JSON.stringify({
        type: "req", id, method: "connect", params: {
          minProtocol: 3, maxProtocol: 3,
          client: { id: "cli", displayName: "OpenClaw Session Manager", version: "1.0.0", platform: process.platform || "linux", mode: "backend" },
          auth,
          role: "operator",
          scopes: this.scopes,
        },
      }));
    });
  }

  private handleMessage(msg: any) {
    if (msg.type === "res" && msg.id) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.ok) {
          pending.resolve(msg.result);
        } else {
          const errorMsg = msg.error?.message || "Auth failed";
          if (errorMsg.includes("scope-upgrade") || errorMsg.includes("pairing")) {
            pending.reject(new Error("PAIRING_REQUIRED"));
          } else {
            pending.reject(new Error(errorMsg));
          }
        }
      }
    }
  }

  async ensureAuthenticated(): Promise<void> {
    try {
      await this.connect();
    } catch (err: any) {
      if (err.message === "PAIRING_REQUIRED") {
        console.log("[Gateway] Pairing required");
        this.emit("pairing_required");
        throw err;
      }
      throw err;
    }
  }

  async initiatePairing(): Promise<string> {
    console.log("[Gateway] Initiating pairing...");
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(GATEWAY_URL);
      let pairingCode: string | null = null;
      let authed = false;

      ws.on("open", () => console.log("[Pairing] Connected"));
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        console.log("[Pairing] Event:", msg.event || msg.type);

        if (msg.event === "connect.challenge") {
          const deviceToken = loadDeviceToken();
          const auth: Record<string, string> = { password: GATEWAY_PASSWORD };
          if (deviceToken) auth.deviceToken = deviceToken;

          const id = "pair-init";
          ws.send(JSON.stringify({
            type: "req", id, method: "connect", params: {
              minProtocol: 3, maxProtocol: 3,
              client: { id: "cli", displayName: "OpenClaw Session Manager", version: "1.0.0", platform: process.platform || "linux", mode: "backend" },
              auth,
              role: "operator",
              scopes: this.scopes,
            },
          }));
        }

        if (msg.type === "res" && msg.ok) {
          authed = true;
          console.log("[Pairing] Auth OK");
        }

        // Look for pairing pending event
        if (msg.event?.includes("pair") || msg.event?.includes("pending")) {
          pairingCode = msg.payload?.code || msg.payload?.pairingCode || msg.payload?.deviceId || "PENDING";
          console.log("[Pairing] Got code:", pairingCode);
        }
      });

      ws.on("error", (err) => { console.error("[Pairing] Error:", err.message); reject(err); });
      ws.on("close", () => {
        if (pairingCode) {
          resolve(pairingCode);
        } else if (!authed) {
          reject(new Error("Pairing closed"));
        }
      });

      setTimeout(() => {
        if (!pairingCode) {
          ws.close();
          reject(new Error("Pairing timeout"));
        }
      }, 20000);
    });
  }

  async request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    await this.ensureAuthenticated();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(7);
      const timeout = setTimeout(() => { 
        this.pendingRequests.delete(id); 
        reject(new Error("Timeout: " + method)); 
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: (r) => { clearTimeout(timeout); resolve(r as T); },
        reject: (e) => { 
          clearTimeout(timeout); 
          // Check if this is a scope error that requires pairing
          const msg = e.message || "";
          if (msg.includes("scope") || msg.includes("operator") || msg.includes("pairing")) {
            this.emit("pairing_required", method);
            reject(new Error("PAIRING_REQUIRED"));
          } else {
            reject(e);
          }
        },
      });

      this.ws!.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  async listSessions(): Promise<unknown[]> {
    return this.request("sessions.list");
  }

  async sendMessage(content: string, sessionId: string): Promise<string> {
    const result = await this.request<{ message?: string }>("session.message", { sessionId, content });
    return result?.message || "";
  }

  async createSession(name: string): Promise<string> {
    const result = await this.request<{ sessionId?: string }>("session.create", { name });
    return result?.sessionId || "";
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  isPaired(): boolean {
    return this.deviceToken !== null;
  }
}

const gatewayService = new GatewayService();
export { gatewayService, GatewayService };
