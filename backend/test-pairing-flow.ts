import { gatewayService } from "./src/services/gateway-simple";

async function main() {
  gatewayService.on("pairing_required", () => {
    console.log("\n========================================");
    console.log("[!] PAIRING GEREKLI!");
    console.log["Pairing istegini olusturuyorum..."];
    console.log("========================================\n");
  });

  try {
    console.log("Testing gateway connection...");
    await gatewayService.ensureAuthenticated();
    console.log("[OK] Authenticated!");
    
    const sessions = await gatewayService.listSessions();
    console.log("[OK] Sessions:", JSON.stringify(sessions, null, 2));
    
    gatewayService.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error("[Error]", err.message);
    gatewayService.disconnect();
    process.exit(1);
  }
}

main();
