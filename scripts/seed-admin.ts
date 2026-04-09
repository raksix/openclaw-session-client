/**
 * Seed Script: Create Initial Admin User
 * 
 * Run this script to create the first admin user.
 * Usage: bun run scripts/seed-admin.ts
 */

import { connectToDatabase, COLLECTIONS, closeDatabase } from "../backend/src/db/mongodb";
import { createUser, hashPassword } from "../backend/src/services/auth.service";
import { createAdminPermissions } from "../backend/src/db/schemas";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@openclaw.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123change";

async function seedAdmin() {
  console.log("🔧 Starting admin user seed...\n");
  
  try {
    // Connect to database
    await connectToDatabase();
    console.log("✓ Connected to MongoDB\n");
    
    // Check if admin already exists
    const { getDb } = await import("../backend/src/db/mongodb");
    const db = getDb();
    
    const existingAdmin = await db.collection(COLLECTIONS.USERS).findOne({
      $or: [
        { username: ADMIN_USERNAME },
        { email: ADMIN_EMAIL },
        { role: "admin" },
      ],
    });
    
    if (existingAdmin) {
      console.log("⚠️  An admin user already exists:");
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Email: ${existingAdmin.email}\n`);
      console.log("To create a new admin, either:");
      console.log("  1. Delete the existing admin user from the database");
      console.log("  2. Change the ADMIN_USERNAME or ADMIN_EMAIL environment variables\n");
      
      await closeDatabase();
      return;
    }
    
    // Create admin user
    const admin = await createUser({
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: "admin",
      permissions: createAdminPermissions(),
    });
    
    console.log("✅ Admin user created successfully!\n");
    console.log("📋 Admin Credentials:");
    console.log("─".repeat(40));
    console.log(`   Username: ${ADMIN_USERNAME}`);
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log("─".repeat(40));
    console.log("\n⚠️  IMPORTANT: Change the password immediately after first login!");
    console.log("\n🔐 You can login at http://localhost:3000/login\n");
    
    await closeDatabase();
    
  } catch (error) {
    console.error("❌ Failed to seed admin user:", error);
    process.exit(1);
  }
}

seedAdmin();
