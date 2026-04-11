import WebSocket from "ws";
import { EventEmitter } from "events";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const GATEWAY_PASSWORD = process.env.OPENCLAW_GATEWAY_PASSWORD || "Fe277353";

interface GatewayMessage {
  type?: string;
  id?: string;
  method?: string;
  event?: string;
  payload?: Record<string, unknown>;
  ok?: boolean;
  result?: unknown;
  error?: { code?: string; message: string };
}

class AutoPairingGateway extends EventEmitter {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private isConnected = false;
  private deviceToken: string | null = null;
  private pairingInfo: { deviceId?: string; token?: string } | null = null;

  constructor() {
    super();
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      console.log("[Gateway] Connecting to", GATEWAY_URL);
      this.ws = new WebSocket(GATEWAY_URL);

      this.ws.on("open", () => {
        console.log("[Gateway] Connected");
      });

      this.ws.on("message", (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });

      this.ws.on("error", (err) => {
        console.error("[Gateway] Error:", err.message);
        this.emit("error", err);
        reject(err);
      });

      this.ws.on("close", () => {
        console.log("[Gateway] Disconnected");
        this.isConnected = false;
        this.ws = null;
      });

      // Wait for challenge
      const challengeTimeout = setTimeout(() => {
        reject(new Error("Challenge timeout"));
      }, 10000);

      this.ws.once("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.event === "connect.challenge") {
          clearTimeout(challengeTimeout);
          this.authenticate(msg.payload?.nonce as string)
            .then(() => {
              this.isConnected = true;
              resolve();
            })
            .catch((err) => {
              reject(err);
            });
        }
      });
    });
  }

  private async authenticate(nonce: string): Promise<void> {
    if (!this.ws) throw new Error("Not connected");

    // Try with existing device token first, then password
    const auth = this.deviceToken
      ? { token: this.deviceToken }
      : { password: GATEWAY_PASSWORD };

    return new Promise((resolve, reject) => {
      const id = "auth-" + Math.random().toString(36).substring(7);

      this.pendingRequests.set(id, {
        resolve: (result) => {
          console.log("[Gateway] Auth success");
          // If result contains a token, save it
          const res = result as { token?: string; deviceId?: string };
          if (res?.token) {
            this.deviceToken = res.token;
            console.log("[Gateway] Device token received");
          }
          resolve();
        },
        reject: (e) => {
          console.log("[Gateway] Auth failed:", e.message);
          reject(e);
        },
      });

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Auth timeout"));
        }
      }, 10000);

      this.ws!.send(JSON.stringify({
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
            mode: "backend",
          },
          auth,
          role: "operator",
        },
      }));
    });
  }

  private handleMessage(msg: GatewayMessage) {
    // Handle response to our requests
    if (msg.type === "res" && msg.id) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.ok) {
          pending.resolve(msg.result);
        } else {
          // Check for pairing requirement
          if (this.isPairingRequiredError(msg.error)) {
            pending.reject(new Error("PAIRING_REQUIRED"));
          } else {
            pending.reject(new Error(msg.error?.message || "Request failed"));
          }
        }
      }
    }

    // Emit events
    if (msg.event) {
      this.emit(msg.event, msg.payload);
    }
  }

  private isPairingRequiredError(error?: { code?: string; message: string }): boolean {
    if (!error) return false;
    const msg = error.message || "";
    return (
      msg.includes("pairing") ||
      msg.includes("scope-upgrade") ||
      msg.includes("device identity") ||
      error.code === "PAIRING_REQUIRED"
    );
  }

  async ensureAuthenticated(): Promise<void> {
    try {
      await this.connect();
    } catch (err: any) {
      if (err.message === "PAIRING_REQUIRED") {
        console.log("[Gateway] Pairing required, initiating...");
        await this.initiatePairing();
        // Retry connection with new token
        await this.connect();
      } else {
        throw err;
      }
    }
  }

  private async initiatePairing(): Promise<void> {
    console.log("[Gateway] Starting automatic pairing process...");

    // Close existing connection if any
    this.disconnect();

    // For OpenClaw, pairing usually requires:
    // 1. A pairing request initiated
    // 2. Approval (either auto or manual)
    // 3. A token received

    // Let's try to get a pairing token first by connecting with special params
    await this.requestPairingToken();
  }

  private async requestPairingToken(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(GATEWAY_URL);
      let authed = false;

      ws.on("open", () => console.log("[Pairing] Connected"));
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.event === "connect.challenge") {
          // Send pairing request
          const id = "pair-" + Math.random().toString(36).substring(7);
          this.pendingRequests.set(id, {
            resolve: (result) => {
              console.log("[Pairing] Token received:", JSON.stringify(result));
              const res = result as { token?: string; deviceId?: string };
              if (res?.token) {
                this.deviceToken = res.token;
                this.pairingInfo = { token: res.token, deviceId: res.deviceId };
              }
              authed = true;
              ws.close();
              resolve();
            },
            reject: (e) => {
              console.log("[Pairing] Failed:", e.message);
              ws.close();
              reject(e);
            },
          });

          setTimeout(() => {
            if (this.pendingRequests.has(id)) {
              this.pendingRequests.delete(id);
              reject(new Error("Pairing timeout"));
            }
          }, 20000);

          // Try with pairing scope request
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
                mode: "backend",
              },
              auth: { password: GATEWAY_PASSWORD },
              role: "operator",
              pairing: { requestedScopes: ["operator.admin", "operator.approvals", "operator.pairing", "operator.read", "operator.talk.secrets", "operator.write"] },
            },
          }));
        }

        if (msg.type === "res" && authed) {
          const pending = this.pendingRequests.get(msg.id);
          if (pending) {
            this.pendingRequests.delete(msg.id);
            if (msg.ok) pending.resolve(msg.result);
            else pending.reject(new Error(msg.error?.message));
          }
        }
      });

      ws.on("error", (err) => {
        console.error("[Pairing] Error:", err.message);
        reject(err);
      });

      ws.on("close", () => {
        if (!authed) reject(new Error("Pairing closed without auth"));
      });
    });
  }

  private async request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    await this.ensureAuthenticated();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(7);
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: (r) => {
          clearTimeout(timeout);
          resolve(r as T);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
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

  getToken(): string | null {
    return this.deviceToken;
  }
}

// Singleton instance
const gateway = new AutoPairingGateway();

export { gateway, AutoPairingGateway };
export type { GatewayMessage };
