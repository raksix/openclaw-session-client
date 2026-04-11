import WebSocket from "ws";
import { EventEmitter } from "events";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const GATEWAY_PASSWORD = process.env.OPENCLAW_GATEWAY_PASSWORD || "Fe277353";

interface PendingRequest {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

class GatewayService extends EventEmitter {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private isConnected = false;
  private deviceToken: string | null = null;
  private pairingRequested = false;

  constructor() {
    super();
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      console.log("[Gateway] Connecting to", GATEWAY_URL);
      this.ws = new WebSocket(GATEWAY_URL);

      this.ws.on("open", () => console.log("[Gateway] Connected"));
      this.ws.on("message", (data) => this.handleMessage(JSON.parse(data.toString())));
      this.ws.on("error", (err) => { console.error("[Gateway] Error:", err.message); this.emit("error", err); });
      this.ws.on("close", () => { console.log("[Gateway] Disconnected"); this.isConnected = false; this.ws = null; });

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

      this.ws.send(JSON.stringify({
        type: "req", id, method: "connect", params: {
          minProtocol: 3, maxProtocol: 3,
          client: { id: "cli", displayName: "OpenClaw Session Manager", version: "1.0.0", platform: process.platform || "linux", mode: "backend" },
          auth: { password: GATEWAY_PASSWORD },
          role: "operator",
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
          // Check if pairing required
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
        console.log("[Gateway] Pairing required - sending pairing request...");
        const pairingCode = await this.initiatePairing();
        this.emit("pairing_request", pairingCode);
        throw new Error(`PAIRING_REQUIRED:${pairingCode}`);
      }
      throw err;
    }
  }

  private async initiatePairing(): Promise<string> {
    // Disconnect first
    this.disconnect();

    // Create a new connection to initiate pairing
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(GATEWAY_URL);
      let pairingCode: string | null = null;

      ws.on("open", () => console.log("[Pairing] Connected to gateway"));
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        console.log("[Pairing] Event:", msg.event || msg.type, msg.id || "");

        if (msg.event === "connect.challenge") {
          // Send pairing request
          const id = "pair-" + Math.random().toString(36).substring(7);
          
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error("Pairing timeout - no pending request generated"));
          }, 15000);

          ws.send(JSON.stringify({
            type: "req", id, method: "connect", params: {
              minProtocol: 3, maxProtocol: 3,
              client: { id: "cli", displayName: "OpenClaw Session Manager", version: "1.0.0", platform: process.platform || "linux", mode: "backend" },
              auth: { password: GATEWAY_PASSWORD },
              role: "operator",
              pairing: {
                requestedScopes: ["operator.admin", "operator.approvals", "operator.pairing", "operator.read", "operator.talk.secrets", "operator.write"],
              },
            },
          }));

          // The gateway should respond with a pairing code or pending status
          // We need to wait for a "device.pair.pending" or similar event
        }

        // Look for pairing pending event with the code
        if (msg.event === "device.pair.pending" || msg.event === "pairing.pending") {
          clearTimeout(timeout);
          pairingCode = msg.payload?.code || msg.payload?.pairingCode || msg.payload?.deviceId;
          console.log("[Pairing] Got pairing code:", pairingCode);
          ws.close();
          resolve(pairingCode);
        }

        // Or check if there's a response to our pair request
        if (msg.type === "res" && msg.id?.startsWith("pair-")) {
          if (!msg.ok) {
            clearTimeout(timeout);
            console.log("[Pairing] Failed:", msg.error?.message);
            ws.close();
            reject(new Error(msg.error?.message));
          }
        }
      };

      ws.on("error", (err) => { console.error("[Pairing] Error:", err.message); reject(err); });
      ws.on("close", () => {
        if (!pairingCode) reject(new Error("Pairing closed without code"));
      });

      setTimeout(() => {
        if (!pairingCode) {
          ws.close();
          reject(new Error("Pairing timeout"));
        }
      }, 30000);
    });
  }

  async request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    await this.ensureAuthenticated();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(7);
      const timeout = setTimeout(() => { this.pendingRequests.delete(id); reject(new Error(`Timeout: ${method}`)); }, 30000);

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

// Singleton
const gatewayService = new GatewayService();
export { gatewayService };
export { GatewayService };
