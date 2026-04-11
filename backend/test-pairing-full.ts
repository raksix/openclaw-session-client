import { gatewayService } from "./src/services/gateway-simple";

async function main() {
  gatewayService.on("pairing_required", (method: string) => {
    console.log("\n========================================");
    console.log("[!] PAIRING GEREKLI - " + method + " icin");
    console.log("[!] Pairing istegi olusturuluyor...\n");
    
    // Initiate pairing
    gatewayService.initiatePairing()
      .then((code) => {
        console.log("\n========================================");
        console.log("[!] PAIRING KODU ALINDI:");
        console.log("    " + code);
        console.log("\nOnaylamak icin su komutu calistir:");
        console.log("    openclaw devices approve <kod>");
        console.log("========================================\n");
      })
      .catch((err) => {
        console.error("[Pairing Error]", err.message);
      });
  });

  try {
    console.log("[1] Gateway baglantisi deneniyor...");
    await gatewayService.ensureAuthenticated();
    console.log("[OK] Authenticated!");
    
    console.log("[2] Sessionlar getiriliyor...");
    const sessions = await gatewayService.listSessions();
    console.log("[OK] Sessions:", JSON.stringify(sessions, null, 2));
    
    gatewayService.disconnect();
    console.log("\n[SUCCESS] Gateway erisimi basarili!");
    process.exit(0);
  } catch (err: any) {
    console.error("\n[ERROR]", err.message);
    if (err.message === "PAIRING_REQUIRED") {
      console.log("\nPairing bekleniyor... Onayladiktan sonra tekrar deneyin.");
    }
    // Keep running to listen for pairing
    setTimeout(() => {
      gatewayService.disconnect();
      process.exit(1);
    }, 60000);
  }
}

main();
