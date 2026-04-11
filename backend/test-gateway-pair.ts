import { GatewayService } from "./src/services/gateway-paired";

async function main() {
  console.log("=== Gateway Pairing Test ===\n");
  
  const gateway = new GatewayService();
  
  gateway.on("pairing_required", () => {
    console.log("\n[!!] PAIRING REQUIRED!");
    console.log("Please approve in another terminal:");
    console.log("  openclaw devices list");
    console.log("  openclaw devices approve <request-id>");
    console.log("");
  });
  
  gateway.on("error", (err) => {
    console.error("[Gateway Error]:", err.message);
  });
  
  try {
    console.log("[1] Connecting to gateway...");
    await gateway.connect();
    console.log("[OK] Connected!");
    
    console.log("\n[2] Testing sessions.list...");
    const sessions = await gateway.listSessions();
    console.log("[OK] Sessions:", JSON.stringify(sessions, null, 2));
    
  } catch (err: any) {
    if (err.message === "PAIRING_REQUIRED") {
      console.log("\n[!!] Pairing required - starting pairing flow...");
      
      try {
        const result = await gateway.initiatePairing();
        console.log("\n[OK] Pairing completed:", result);
        
        // Retry the operation
        console.log("\n[3] Retrying sessions.list...");
        const sessions = await gateway.listSessions();
        console.log("[OK] Sessions:", JSON.stringify(sessions, null, 2));
        
      } catch (pairErr: any) {
        console.error("\n[ERROR] Pairing failed:", pairErr.message);
        console.log("\nAfter approving, run this script again!");
      }
    } else {
      console.error("\n[ERROR]:", err.message);
    }
  }
  
  process.exit(0);
}

main();
