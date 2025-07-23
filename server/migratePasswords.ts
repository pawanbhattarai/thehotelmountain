import { PasswordUtils } from "./passwordUtils";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function migrateExistingPasswords() {
  try {
    console.log("🔄 Starting password migration...");
    
    // Get all users
    const allUsers = await db.select().from(users);
    
    for (const user of allUsers) {
      // Check if password is already hashed (bcrypt hashes start with $2)
      if (!user.password || user.password.startsWith('$2')) {
        console.log(`✅ User ${user.email} already has hashed password`);
        continue;
      }
      
      // Hash the plain text password
      console.log(`🔐 Hashing password for user: ${user.email}`);
      const hashedPassword = await PasswordUtils.hashPassword(user.password);
      
      // Update the user with hashed password
      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id));
      
      console.log(`✅ Password updated for user: ${user.email}`);
    }
    
    console.log("✅ Password migration completed successfully");
  } catch (error) {
    console.error("❌ Error migrating passwords:", error);
    throw error;
  }
}