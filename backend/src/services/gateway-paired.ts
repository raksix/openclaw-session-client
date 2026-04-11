import WebSocket from "ws";
import { EventEmitter } from "events";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const GATEWAY_PASSWORD = process.env.OPENCLAW_GATEWAY_PASSWORD || "Fe277353";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || null;

console.log("[Gateway] ENV - TOKEN:", GATEWAY_TOKEN ? "set (" + GATEWAY_TOKEN.substring(0, 10) + "...)" : "NOT SET");
console.log("[Gateway] ENV - PASSWORD:", GATEWAY_PASSWORD ? "set" : "NOT SET");
const DEVICE_ID_FILE = process.env.OPENCLAW_IDENTITY_DIR || join(process.env.HOME || "/root", ".openclaw", "identity", "device.json");
const DEVICE_TOKEN_FILE = join(process.env.HOME || "/root", ".openclaw", "devices", "paired.json");

interface PendingRequest {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

class GatewayService extends EventEmitter {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private isConnected = false;
  private deviceToken: string | null = null;
  private deviceId: string | null = null;
  private pairingRequested = false;

  constructor() {
    super();
    // Load device identity from ~/.openclaw/identity/device.json
    const identity = this.loadDeviceIdentity();
    if (identity) {
      this.deviceId = identity.deviceId;
      console.log("[Gateway] Loaded device identity:", this.deviceId.substring(0, 16) + "...");
      // Load paired token for this device
      const token = this.loadPairedToken();
      if (token) {
        this.deviceToken = token;
        console.log("[Gateway] Loaded device token");
      }
    } else {
      // Fallback to hardcoded device (for backwards compatibility)
      this.deviceId = "a1974b314a703a3b3c7db2d3d855a064ec60c51d417bf968732c96b0cab8e961";
      this.deviceToken = "ofZa5fR2rLDCVNrUO1xuySnchY1dwSBpUMWDang26VU";
      console.log("[Gateway] Using fallback device ID:", this.deviceId.substring(0, 16) + "...");
    }
  }

  /**
   * Load device identity from ~/.openclaw/identity/device.json
   */
  private loadDeviceIdentity(): { deviceId: string; privateKey: string } | null {
    try {
      if (!existsSync(DEVICE_ID_FILE)) {
        console.log("[Gateway] Device identity file not found:", DEVICE_ID_FILE);
        return null;
      }
      const data = JSON.parse(readFileSync(DEVICE_ID_FILE, "utf-8"));
      return {
        deviceId: data.deviceId,
        privateKey: data.privateKeyPem,
      };
    } catch (err) {
      console.error("[Gateway] Failed to load device identity:", err);
      return null;
    }
  }

  /**
   * Load existing device token from paired.json
   */
  private loadPairedToken(): string | null {
    try {
      if (!existsSync(DEVICE_TOKEN_FILE)) {
        return null;
      }
      const data = JSON.parse(readFileSync(DEVICE_TOKEN_FILE, "utf-8"));
      // Find token for OUR device ID specifically
      const ourDevice = data[this.deviceId || ""];
      if (ourDevice?.tokens?.operator?.token) {
        console.log("[Gateway] Found paired token for our device:", this.deviceId?.substring(0, 8));
        return ourDevice.tokens.operator.token;
      }
      // Fallback: find any device with operator token
      for (const [deviceId, device] of Object.entries(data)) {
        const d = device as any;
        if (d.tokens?.operator?.token) {
          console.log("[Gateway] Found fallback token for device:", deviceId.substring(0, 8));
          return d.tokens.operator.token;
        }
      }
      return null;
    } catch (err) {
      console.error("[Gateway] Failed to load paired token:", err);
      return null;
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    // Load paired token first, env var is fallback
    if (!this.deviceToken) {
      this.deviceToken = this.loadPairedToken();
    }

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

      const authParams: any = {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "cli",
          displayName: "OpenClaw Session Manager",
          version: "1.0.0",
          platform: process.platform || "linux",
          mode: "cli",
        },
        auth: {},
        role: "operator",
      };

      // Try password auth first (simpler)
      console.log("[Gateway] Using password auth");
      authParams.auth = { password: GATEWAY_PASSWORD };

      this.ws.send(JSON.stringify({
        type: "req",
        id,
        method: "connect",
        params: authParams,
      }));
    });
  }

  private handleMessage(msg: any) {
    try {
      // Handle challenge
      if (msg.event === "connect.challenge") {
        console.log("[Gateway] Challenge received");
        return;
      }

      // Handle response to our requests
      if (msg.type === "res" && msg.id) {
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          if (msg.ok) {
            pending.resolve(msg.result);
          } else {
            const errorMsg = msg.error?.message || msg.error || "Request failed";
            console.log("[Gateway] Request failed:", errorMsg);
            pending.reject(new Error(errorMsg));
          }
        }
      }
    } catch (err) {
      console.error("[Gateway] handleMessage error:", err);
    }
  }

  async ensureAuthenticated(): Promise<void> {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      await this.connect();
    } catch (err: any) {
      if (err.message?.includes("scope") || err.message?.includes("pairing")) {
        console.log("[Gateway] Pairing required - please approve via CLI:");
        console.log("  openclaw devices list");
        console.log("  openclaw devices approve <request-id>");
        this.emit("pairing_required");
        throw new Error("PAIRING_REQUIRED");
      }
      throw err;
    }
  }

  async initiatePairing(): Promise<string> {
    console.log("[Gateway] Initiating pairing flow...");

    // First connect with password to get a connection
    // Then request scopes that require pairing
    // The gateway will create a pending pairing request
    // We poll for the pairing request ID

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(GATEWAY_URL);
      let resolved = false;

      ws.on("open", () => console.log("[Pairing] Connected"));
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        console.log("[Pairing] Event:", msg.event || msg.type, msg.id || "");

        if (msg.event === "connect.challenge") {
          // Authenticate with password
          const id = "auth-" + Math.random().toString(36).substring(7);
          ws.send(JSON.stringify({
            type: "req",
            id,
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: "cli",
                displayName: "OpenClaw Session Manager",
                version: "1.0.0",
                platform: process.platform || "linux",
                mode: "cli",
              },
              auth: { password: GATEWAY_PASSWORD },
              role: "operator",
              // Request scopes that require pairing
              scopes: [
                "operator.admin",
                "operator.approvals",
                "operator.pairing",
                "operator.read",
                "operator.talk.secrets",
                "operator.write",
              ],
            },
          }));
        }

        if (msg.type === "res" && msg.id?.startsWith("auth-")) {
          if (!msg.ok) {
            const errorMsg = msg.error?.message || "Auth failed";
            console.log("[Pairing] Auth failed:", errorMsg);
            
            // Check if this error contains a pairing requirement
            if (errorMsg.includes("scope-upgrade") || errorMsg.includes("pairing")) {
              // The gateway should have created a pending request
              // Let's try to get sessions anyway to trigger the pairing flow
              console.log("[Pairing] Pairing required - waiting for approval...");
              
              // Poll for pending requests by trying to call a method
              // This is a hack but it might work
              setTimeout(() => {
                ws.send(JSON.stringify({
                  type: "req",
                  id: "list-" + Math.random().toString(36).substring(7),
                  method: "sessions.list",
                  params: {},
                }));
              }, 2000);
            }
          } else {
            console.log("[Pairing] Auth success");
          }
        }

        // Check for error responses
        if (msg.type === "res" && msg.id?.startsWith("list-")) {
          if (!msg.ok) {
            const errorMsg = msg.error?.message || "";
            console.log("[Pairing] List failed:", errorMsg);
            
            if (errorMsg.includes("scope-upgrade")) {
              // Pairing is now pending - user needs to approve
              // The pending request should appear in `openclaw devices list`
              console.log("[Pairing] Pairing request pending!");
              console.log("[Pairing] Please approve via: openclaw devices list && openclaw devices approve <id>");
              
              // Wait for user to approve
              this.waitForPairingApproval(ws, resolve, reject);
              resolved = true;
            }
          } else {
            console.log("[Pairing] Sessions listed successfully!");
            ws.close();
            resolve("paired");
          }
        }
      });

      ws.on("error", (err) => {
        console.error("[Pairing] Error:", err.message);
        if (!resolved) reject(err);
      });

      ws.on("close", () => {
        console.log("[Pairing] Disconnected");
        if (!resolved) reject(new Error("Pairing connection closed"));
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        if (!resolved) {
          ws.close();
          reject(new Error("Pairing timeout - please approve quickly"));
        }
      }, 120000);
    });
  }

  private waitForPairingApproval(ws: WebSocket, resolve: (v: string) => void, reject: (e: Error) => void) {
    let resolved = false;
    
    // Poll sessions.list every 5 seconds
    const pollInterval = setInterval(() => {
      console.log("[Pairing] Polling for approval...");
      ws.send(JSON.stringify({
        type: "req",
        id: "poll-" + Math.random().toString(36).substring(7),
        method: "sessions.list",
        params: {},
      }));
    }, 5000);

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === "res" && msg.id?.startsWith("poll-")) {
        if (msg.ok) {
          // Success! Pairing was approved
          clearInterval(pollInterval);
          resolved = true;
          console.log("[Pairing] Pairing approved! Gateway connected.");
          
          // Get the token from paired.json
          const token = this.loadPairedToken();
          if (token) {
            this.deviceToken = token;
            resolve(token);
          } else {
            resolve("paired");
          }
        }
        // If not ok, still waiting
      }
    });

    // Also listen for close
    ws.on("close", () => {
      clearInterval(pollInterval);
      if (!resolved) {
        reject(new Error("Connection closed during pairing wait"));
      }
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
        reject(new Error(`Timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: (r) => { clearTimeout(timeout); resolve(r as T); },
        reject: (e) => { clearTimeout(timeout); reject(e); },
      });

      this.ws!.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  async listSessions(): Promise<unknown[]> {
    return this.request("sessions.list");
  }

  async sendMessage(sessionKey: string, content: string): Promise<string> {
    // sessions.send uses sessionKey and content
    const result = await this.request<{ message?: string }>("sessions.send", { sessionKey, content });
    return result?.message || "";
  }

  async createSession(params: {
    agentId?: string;
    channel?: string;
    channelPeer?: string;
    channelContext?: string;
  }): Promise<string> {
    // sessions.create uses agentId, channel, channelPeer, channelContext
    const result = await this.request<{ sessionKey?: string }>("sessions.create", params);
    return result?.sessionKey || "";
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

// Singleton
const gatewayService = new GatewayService();
export { gatewayService };
export { GatewayService };
