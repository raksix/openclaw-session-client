import WebSocket from "ws";
import { readFileSync, existsSync } from "fs";
import { createHmac, randomBytes } from "crypto";
import { join } from "path";

const GATEWAY_URL = "ws://127.0.0.1:18789";

// Load device identity
const devicePath = join(process.env.HOME || "/root", ".openclaw", "identity", "device.json");
const device = existsSync(devicePath) ? JSON.parse(readFileSync(devicePath, "utf-8")) : null;

// Load paired token
const tokenPath = join(process.env.HOME || "/root", ".openclaw", "devices", "paired.json");
const tokenData = existsSync(tokenPath) ? JSON.parse(readFileSync(tokenPath, "utf-8")) : {};
const deviceId = device?.id || "a1974b314a703a3b5c8f1d6e2a4b7c9f";
const deviceToken = tokenData[deviceId]?.tokens?.operator?.token || "ofZa5fR2rLDCVNrUO1xuySnchY1dwSBpUMWDang26VU";

console.log("[Device] ID:", deviceId?.substring(0, 10));
console.log("[Token] Loaded:", deviceToken?.substring(0, 10) + "...");

const ws = new WebSocket(GATEWAY_URL);

ws.on("open", () => {
  console.log("[Gateway] Connected");
});

ws.on("message", (data) => {
  const msg = data.toString();
  try {
    const parsed = JSON.parse(msg);
    console.log("[Gateway] Event:", parsed.event || parsed.type);
    
    if (parsed.event === "connect.challenge") {
      const nonce = parsed.payload?.nonce;
      console.log("[Gateway] Nonce:", nonce?.substring(0, 20));
      
      // Create auth with token
      const authToken = deviceToken;
      
      console.log("[Gateway] Sending auth with token...");
      ws.send(JSON.stringify({
        type: "req",
        id: "auth-test",
        method: "connect",
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: "cli",
            displayName: "Test Client",
            version: "1.0.0",
            platform: "linux",
            mode: "cli",
          },
          auth: { token: authToken },
          role: "operator",
        }
      }));
    }
    
    if (parsed.type === "res" && parsed.id === "auth-test") {
      console.log("[Gateway] Auth response - ok:", parsed.ok);
      if (!parsed.ok) {
        console.log("[Gateway] Error:", parsed.error);
      }
      setTimeout(() => {
        ws.close();
        process.exit(0);
      }, 1000);
    }
  } catch (e) {
    console.log("[Gateway] Raw:", msg.substring(0, 100));
  }
});

ws.on("error", (err) => {
  console.error("[Gateway] Error:", err.message);
});

ws.on("close", () => {
  console.log("[Gateway] Closed");
});

setTimeout(() => {
  console.log("Timeout");
  ws.close();
  process.exit(0);
}, 10000);
