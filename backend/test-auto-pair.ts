import { gateway } from "./src/services/gateway-auto-pair";

async function main() {
  console.log("Testing auto-pairing gateway...");
  
  try {
    await gateway.ensureAuthenticated();
    console.log("[Test] Auth successful!");
    
    const sessions = await gateway.listSessions();
    console.log("[Test] Sessions:", JSON.stringify(sessions, null, 2));
    
    gateway.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error("[Test] Error:", err.message);
    gateway.disconnect();
    process.exit(1);
  }
}

main();
