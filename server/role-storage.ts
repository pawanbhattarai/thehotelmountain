import { db } from "./db";
import { customRoles, rolePermissions, userCustomRoles, users } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import type { InsertCustomRole, InsertRolePermission, InsertUserCustomRole } from "@shared/schema";

export class RoleStorage {
  // Custom Roles
  async getCustomRoles() {
    return await db.select().from(customRoles).where(eq(customRoles.isActive, true)).orderBy(desc(customRoles.createdAt));
  }

  async getCustomRole(id: number) {
    const [role] = await db.select().from(customRoles).where(eq(customRoles.id, id));
    if (!role) return null;

    const permissions = await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, id));
    return { ...role, permissions };
  }

  async createCustomRole(data: InsertCustomRole) {
    const [role] = await db.insert(customRoles).values(data).returning();
    return role;
  }

  async updateCustomRole(id: number, data: Partial<InsertCustomRole>) {
    const [role] = await db.update(customRoles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customRoles.id, id))
      .returning();
    return role;
  }

  async deleteCustomRole(roleId: number): Promise<void> {
    await db.transaction(async (tx) => {
      // Remove all permissions for this role
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

      // Remove all user assignments for this role
      await tx.delete(userCustomRoles).where(eq(userCustomRoles.roleId, roleId));

      // Delete the role
      await tx.delete(customRoles).where(eq(customRoles.id, roleId));
    });
  }

  async assignRolesToUser(userId: string, roleIds: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      // Remove existing role assignments for this user
      await tx.delete(userCustomRoles).where(eq(userCustomRoles.userId, userId));

      // Add new role assignments
      if (roleIds.length > 0) {
        const assignments = roleIds.map(roleId => ({
          userId,
          roleId,
        }));
        await tx.insert(userCustomRoles).values(assignments);
      }
    });
  }

  async getUserRoles(userId: string): Promise<number[]> {
    const results = await db
      .select({ roleId: userCustomRoles.roleId })
      .from(userCustomRoles)
      .where(eq(userCustomRoles.userId, userId));

    return results.map(r => r.roleId);
  }


  // Role Permissions
  async getRolePermissions(roleId: number) {
    return await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  }

  async setRolePermissions(roleId: number, permissions: Array<{ module: string; permissions: any }>) {
    // Delete existing permissions
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    // Insert new permissions
    if (permissions.length > 0) {
      await db.insert(rolePermissions).values(
        permissions.map(p => ({
          roleId,
          module: p.module,
          permissions: p.permissions,
        }))
      );
    }

    return await this.getRolePermissions(roleId);
  }

  // User Role Assignments
  async getUserCustomRoles(userId: string) {
    return await db.select({
      id: userCustomRoles.id,
      roleId: userCustomRoles.roleId,
      roleName: customRoles.name,
      assignedAt: userCustomRoles.assignedAt,
    })
    .from(userCustomRoles)
    .innerJoin(customRoles, eq(userCustomRoles.roleId, customRoles.id))
    .where(eq(userCustomRoles.userId, userId));
  }

  async assignUserToRole(data: InsertUserCustomRole) {
    const [assignment] = await db.insert(userCustomRoles).values(data).returning();
    return assignment;
  }

  async removeUserFromRole(userId: string, roleId: number) {
    await db
      .delete(userCustomRoles)
      .where(
        and(
          eq(userCustomRoles.userId, userId),
          eq(userCustomRoles.roleId, roleId)
        )
      );
  }

  async getUserPermissions(userId: string) {
    const userRoles = await db.select({
      roleId: userCustomRoles.roleId,
      module: rolePermissions.module,
      permissions: rolePermissions.permissions,
    })
    .from(userCustomRoles)
    .innerJoin(customRoles, eq(userCustomRoles.roleId, customRoles.id))
    .innerJoin(rolePermissions, eq(customRoles.id, rolePermissions.roleId))
    .where(and(
      eq(userCustomRoles.userId, userId),
      eq(customRoles.isActive, true)
    ));

    // Aggregate permissions by module
    const aggregatedPermissions: Record<string, any> = {};
    userRoles.forEach(role => {
      if (!aggregatedPermissions[role.module]) {
        aggregatedPermissions[role.module] = { read: false, write: false, delete: false };
      }

      const modulePerms = role.permissions as any;
      if (modulePerms.read) aggregatedPermissions[role.module].read = true;
      if (modulePerms.write) aggregatedPermissions[role.module].write = true;
      if (modulePerms.delete) aggregatedPermissions[role.module].delete = true;
    });

    return aggregatedPermissions;
  }

  // Available modules for permission assignment
  getAvailableModules() {
    return [
      // Core Hotel Management (PMS)
      { id: 'dashboard', name: 'Dashboard', description: 'Main dashboard and metrics' },
      { id: 'reservations', name: 'Reservations', description: 'Hotel reservation management' },
      { id: 'rooms', name: 'Room Management', description: 'Room and room type management' },
      { id: 'room-types', name: 'Room Types', description: 'Room type configuration and management' },
      { id: 'guests', name: 'Guest Management', description: 'Guest profiles and history' },
      { id: 'billing', name: 'Hotel Billing', description: 'Hotel billing and payments' },
      
      // Restaurant Management (RMS)
      { id: 'restaurant-tables', name: 'Restaurant Tables', description: 'Restaurant table management' },
      { id: 'restaurant-categories', name: 'Menu Categories', description: 'Restaurant menu categories' },
      { id: 'restaurant-dishes', name: 'Menu Dishes', description: 'Restaurant menu dishes' },
      { id: 'restaurant-orders', name: 'Restaurant Orders', description: 'Restaurant order management' },
      { id: 'restaurant-billing', name: 'Restaurant Billing', description: 'Restaurant billing system' },
      { id: 'restaurant-kot', name: 'Kitchen Orders (KOT)', description: 'Kitchen order ticket management' },
      { id: 'restaurant-bot', name: 'Bar Orders (BOT)', description: 'Bar order ticket management' },
      { id: 'restaurant-menu', name: 'QR Menu', description: 'QR code menu access' },
      { id: 'room-orders', name: 'Room Service Orders', description: 'Room service order management' },
      
      // Inventory Management
      { id: 'inventory-stock-categories', name: 'Stock Categories', description: 'Inventory stock categories' },
      { id: 'inventory-stock-items', name: 'Stock Items', description: 'Inventory stock items' },
      { id: 'inventory-measuring-units', name: 'Measuring Units', description: 'Inventory measuring units' },
      { id: 'inventory-suppliers', name: 'Suppliers', description: 'Inventory suppliers management' },
      { id: 'inventory-consumption', name: 'Stock Consumption', description: 'Inventory consumption tracking' },
      { id: 'inventory-dish-ingredients', name: 'Dish Ingredients', description: 'Recipe and ingredient management' },
      { id: 'inventory-purchase-orders', name: 'Purchase Orders', description: 'Purchase order management' },
      { id: 'inventory-stock-receipts', name: 'Stock Receipts', description: 'Stock receipt management' },
      
      // Analytics & Reports
      { id: 'analytics', name: 'PMS Analytics', description: 'Hotel analytics and reports' },
      { id: 'restaurant-analytics', name: 'RMS Analytics', description: 'Restaurant analytics and reports' },
      { id: 'purchase-analytics', name: 'Purchase Analytics', description: 'Purchase and inventory analytics' },
      
      // Administration
      { id: 'branches', name: 'Branch Management', description: 'Multi-branch management' },
      { id: 'users', name: 'User Management', description: 'User account management' },
      { id: 'role-management', name: 'Role Management', description: 'Custom role and permission management' },
      { id: 'tax-management', name: 'Tax/Charges Management', description: 'Tax and charges configuration' },
      { id: 'settings', name: 'System Settings', description: 'Application system settings' },
      { id: 'audit-logs', name: 'Audit Logs', description: 'System audit and security logs' },
      
      // User Features
      { id: 'profile', name: 'User Profile', description: 'User profile management' },
      { id: 'notifications', name: 'Notifications', description: 'Notification management and preferences' },
    ];
  }
}

export const roleStorage = new RoleStorage();