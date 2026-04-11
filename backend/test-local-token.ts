import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const TOKEN = "20lhQwvbOyqyfaIk5JFdq69A+db1CWVZC9gSpU1Cr0w=";

const ws = new WebSocket(GATEWAY_URL, {
  headers: {
    'Authorization': `Bearer ${TOKEN}`
  }
});

const pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

ws.on("open", () => {
  console.log("[WS] Connected to local gateway");
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  console.log("[WS] Event:", msg.event || msg.type, msg.id || "");
  
  // Handle auth response
  if (msg.type === "res" && msg.id) {
    const pending = pendingRequests.get(msg.id);
    if (pending) {
      pendingRequests.delete(msg.id);
      if (msg.ok) {
        pending.resolve(msg.result);
      } else {
        pending.reject(new Error(msg.error?.message || "Request failed"));
      }
    }
  }
  
  // Handle challenge
  if (msg.event === "connect.challenge") {
    console.log("[WS] Got challenge, nonce:", msg.payload?.nonce);
    authenticate(msg.payload?.nonce);
  }
});

ws.on("error", (err) => {
  console.error("[WS] Error:", err.message);
});

ws.on("close", () => {
  console.log("[WS] Disconnected");
});

function authenticate(nonce: string) {
  const id = "auth-" + Math.random().toString(36).substring(7);
  
  pendingRequests.set(id, {
    resolve: () => {
      console.log("[Auth] Success!");
      listSessions();
    },
    reject: (e) => {
      console.error("[Auth] Failed:", e.message);
      ws.close();
    },
  });

  setTimeout(() => {
    if (pendingRequests.has(id)) {
      pendingRequests.delete(id);
      console.error("[Auth] Timeout");
      ws.close();
    }
  }, 10000);

  const authParams = {
    type: "req",
    id,
    method: "connect",
    params: {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "cli",
        displayName: "Test Client",
        version: "1.0.0",
        platform: "linux",
        mode: "backend",
      },
      auth: { token: TOKEN },
      role: "operator",
    },
  };

  ws.send(JSON.stringify(authParams));
}

function listSessions() {
  const id = "list-" + Math.random().toString(36).substring(7);
  
  pendingRequests.set(id, {
    resolve: (result) => {
      console.log("[List] Sessions:", JSON.stringify(result, null, 2));
      ws.close();
      process.exit(0);
    },
    reject: (e) => {
      console.error("[List] Failed:", e.message);
      ws.close();
      process.exit(1);
    },
  });

  const request = {
    type: "req",
    id,
    method: "sessions.list",
    params: {},
  };

  ws.send(JSON.stringify(request));
}

setTimeout(() => {
  console.log("Test timeout");
  ws.close();
  process.exit(0);
}, 15000);
