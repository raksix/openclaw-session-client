import WebSocket from "ws";

const TOKEN = "20lhQwvbOyqyfaIk5JFdq69A+db1CWVZC9gSpU1Cr0w=";

// Try different WebSocket URLs
const urls = [
  "wss://openclaw.fermag.com.tr",
  "wss://openclaw.fermag.com.tr:18789",
  "ws://openclaw.fermag.com.tr:18789",
];

for (const url of urls) {
  console.log(`\n--- Testing: ${url} ---`);
  
  const ws = new WebSocket(url, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });

  const timeout = setTimeout(() => {
    console.log(`[Timeout] ${url}`);
    ws.close();
  }, 5000);

  ws.on("open", () => console.log(`[Connected] ${url}`));
  
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    console.log(`[Msg] ${url}:`, msg.event || msg.type);
    
    if (msg.event === "connect.challenge") {
      console.log(`[Challenge] Got nonce: ${msg.payload?.nonce}`);
      
      // Send auth with token
      const id = "auth-" + Math.random().toString(36).substring(7);
      ws.send(JSON.stringify({
        type: "req",
        id,
        method: "connect",
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: { id: "cli", displayName: "Test", version: "1.0.0", platform: "linux", mode: "backend" },
          auth: { token: TOKEN },
          role: "operator",
        },
      }));
    }
    
    if (msg.type === "res" && msg.id?.startsWith("auth-")) {
      if (msg.ok) {
        console.log(`[Auth Success] ${url}!`);
      } else {
        console.log(`[Auth Failed] ${url}:`, msg.error?.message);
      }
      clearTimeout(timeout);
      ws.close();
    }
  });

  ws.on("error", (err) => {
    console.log(`[Error] ${url}: ${err.message}`);
    clearTimeout(timeout);
  });

  ws.on("close", () => console.log(`[Closed] ${url}`));
}
