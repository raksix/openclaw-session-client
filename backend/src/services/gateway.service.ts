import { WebSocket } from "ws";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const GATEWAY_PASSWORD = process.env.OPENCLAW_GATEWAY_PASSWORD || "Fe277353";

interface GatewayMessage {
  type: string;
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  event?: string;
  payload?: Record<string, unknown>;
  result?: unknown;
  ok?: boolean;
  error?: { code: string; message: string };
}

type MessageHandler = (msg: GatewayMessage) => void;

class OpenClawGateway {
  private ws: WebSocket | null = null;
  private messageHandler: MessageHandler | null = null;
  private isConnected = false;
  private pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor(password?: string) {
    this.password = password || GATEWAY_PASSWORD;
  }

  private password: string = GATEWAY_PASSWORD;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(GATEWAY_URL);

      this.ws.on("open", () => {
        console.log("[Gateway] Connected");
      });

      this.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString()) as GatewayMessage;
        this.handleMessage(msg);
      });

      this.ws.on("error", (err) => {
        console.error("[Gateway] Error:", err.message);
        reject(err);
      });

      this.ws.on("close", () => {
        console.log("[Gateway] Disconnected");
        this.isConnected = false;
      });

      // Wait for connect.challenge then send auth
      const challengeTimeout = setTimeout(() => {
        reject(new Error("Gateway challenge timeout"));
      }, 10000);

      const originalHandler = this.messageHandler;
      this.messageHandler = (msg) => {
        if (msg.event === "connect.challenge") {
          clearTimeout(challengeTimeout);
          const nonce = msg.payload?.nonce as string;
          this.sendConnect(nonce);
          this.messageHandler = originalHandler;
        }
      };

      // Resolve after successful connect
      const connectTimeout = setTimeout(() => {
        reject(new Error("Gateway connect timeout"));
      }, 15000);

      const originalHandler2 = this.messageHandler;
      this.messageHandler = (msg) => {
        if (msg.type === "res" && msg.id === "connect") {
          clearTimeout(connectTimeout);
          if (msg.ok) {
            this.isConnected = true;
            console.log("[Gateway] Authenticated successfully");
            resolve();
          } else {
            reject(new Error(msg.error?.message || "Auth failed"));
          }
          this.messageHandler = originalHandler2;
        }
      };
    });
  }

  private sendConnect(nonce: string): void {
    this.send("connect", {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "cli",
        displayName: "OpenClaw Session Manager",
        version: "1.0.0",
        platform: process.platform || "linux",
        mode: "backend"
      },
      auth: { password: this.password },
      role: "operator"
    }, "connect");
  }

  send(method: string, params: Record<string, unknown> = {}, id?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Gateway not connected");
    }
    const msgId = id || Math.random().toString(36).substring(7);
    const frame = { type: "req", id: msgId, method, params };
    this.ws.send(JSON.stringify(frame));
  }

  private handleMessage(msg: GatewayMessage): void {
    // Handle responses to our requests
    if (msg.type === "res" && msg.id) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.ok) {
          pending.resolve(msg.result);
        } else {
          pending.reject(new Error(msg.error?.message || "Request failed"));
        }
      }
    }

    // Pass to registered handler
    if (this.messageHandler) {
      this.messageHandler(msg);
    }
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  async request<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Gateway not connected");
    }
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(7);
      this.pendingRequests.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.send(method, params, id);

      setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

export { OpenClawGateway };
export type { GatewayMessage };
