import { storage } from "./storage";
import { PasswordUtils } from "./passwordUtils";

export async function seedDefaultUsers() {
  try {
    // Check if any users exist
    const existingUsers = await storage.getAllUsers();

    if (existingUsers.length === 0) {
      console.log("No users found, creating default admin user...");

      // Create default admin user
      const defaultUser = {
        id: "admin-001",
        email: "admin@hotel.com",
        firstName: "Admin",
        lastName: "User",
        role: "superadmin" as const,
        password: await PasswordUtils.hashPassword("admin123"),
        isActive: true,
        branchId: null,
      };

      await storage.upsertUser(defaultUser);
      console.log("✅ Default admin user created successfully");
      console.log("📧 Login with: admin@hotel.com");
      console.log("🔑 Password: admin123");
    } else {
      console.log(`✅ Found ${existingUsers.length} existing users`);
    }
  } catch (error) {
    console.error("❌ Error seeding users:", error);
    console.log("🔄 Retrying database schema push...");

    // If the error is about missing password column, the schema push might not have worked
    if (error.message && error.message.includes('column "password" does not exist')) {
      console.log("💡 Database schema appears to be missing the password column");
      console.log("Please run: npm run db:push");
    }
  }
}