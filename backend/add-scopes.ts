import { connectToDatabase } from "./src/db/mongodb";
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "openclaw_session_manager";

async function addScopes() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB_NAME);
  
  // Find admin user
  const user = await db.collection("users").findOne({ username: "admin" });
  
  if (!user) {
    console.log("Admin user not found!");
    process.exit(1);
  }
  
  console.log("Found admin user:", user.username);
  console.log("Current permissions:", JSON.stringify(user.permissions, null, 2));
  console.log("Current scopes:", user.scopes);
  
  // Update user with full scopes
  await db.collection("users").updateOne(
    { username: "admin" },
    { 
      $set: { 
        scopes: ["operator.admin", "operator.read", "operator.write"],
        "permissions.canCreateSession": true,
        "permissions.canDeleteSession": true,
        "permissions.canManageUsers": true,
      }
    }
  );
  
  // Verify update
  const updated = await db.collection("users").findOne({ username: "admin" });
  console.log("\n✅ Updated scopes:", updated?.scopes);
  console.log("✅ Updated permissions:", JSON.stringify(updated?.permissions, null, 2));
  console.log("Done!");
  
  await client.close();
  process.exit(0);
}

addScopes();
