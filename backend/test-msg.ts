import { sendToGateway, listGatewaySessions, connect } from "./src/services/gateway";

async function test() {
  try {
    console.log("Connecting to gateway...");
    await connect();
    console.log("Connected!");
    
    console.log("Listing sessions...");
    const sessions = await listGatewaySessions();
    console.log("Sessions:", JSON.stringify(sessions, null, 2));
    
    console.log("Sending message...");
    const reply = await sendToGateway("Merhaba!", "69d7d171ee0eecde5c34d984");
    console.log("Reply:", reply);
    
    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}

test();
