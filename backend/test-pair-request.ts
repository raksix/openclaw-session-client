import { gatewayService } from "./src/services/gateway-manual-pair";

async function main() {
  gatewayService.on("pairing_request", (code: string) => {
    console.log("\n========================================");
    console.log("[!] PAIRING REQUEST - APPROVE WITH:");
    console.log(`    openclaw pairing approve ${code}`);
    console.log("========================================\n");
  });

  try {
    console.log("Testing gateway connection...");
    await gatewayService.ensureAuthenticated();
    console.log("[OK] Authenticated!");
    
    const sessions = await gatewayService.listSessions();
    console.log("[OK] Sessions:", JSON.stringify(sessions, null, 2));
    
    gatewayService.disconnect();
  } catch (err: any) {
    if (err.message.startsWith("PAIRING_REQUIRED:")) {
      const code = err.message.split(":")[1];
      console.log(`\nPairing code: ${code}`);
      console.log("Waiting for approval...\n");
      // After approval, try again
      setTimeout(async () => {
        try {
          await gatewayService.ensureAuthenticated();
          console.log("[OK] Now authenticated!");
          const sessions = await gatewayService.listSessions();
          console.log("[OK] Sessions:", JSON.stringify(sessions, null, 2));
          gatewayService.disconnect();
          process.exit(0);
        } catch (e: any) {
          console.error("[Error after approval]", e.message);
          gatewayService.disconnect();
          process.exit(1);
        }
      }, 5000);
    } else {
      console.error("[Error]", err.message);
      gatewayService.disconnect();
      process.exit(1);
    }
  }
}

main();
