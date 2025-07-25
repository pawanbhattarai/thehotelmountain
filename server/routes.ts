import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { restaurantStorage } from "./restaurant-storage";
import { inventoryStorage } from "./inventory-storage";
import { dishIngredientsStorage } from "./dish-ingredients-storage";
import { roleStorage } from "./role-storage";
import { NotificationService } from "./notifications";
import { PasswordUtils } from "./passwordUtils";
import {
  sanitizeInput,
  authRateLimit,
  generalRateLimit,
  strictRateLimit,
  validateEmail,
  validatePhone,
} from "./security";
import helmet from "helmet";
import {
  insertBranchSchema,
  insertRoomSchema,
  insertRoomTypeSchema,
  insertGuestSchema,
  insertReservationSchema,
  insertReservationRoomSchema,
  insertPaymentSchema,
  insertUserSchema,
  insertHotelSettingsSchema,
  insertPushSubscriptionSchema,
  insertRestaurantTableSchema,
  insertMenuCategorySchema,
  insertMenuDishSchema,
  insertRestaurantOrderSchema,
  insertRestaurantOrderItemSchema,
  insertRestaurantBillSchema,
  insertTaxSchema,
  updateTaxSchema,
  insertMeasuringUnitSchema,
  insertStockCategorySchema,
  insertSupplierSchema,
  insertStockItemSchema,
  insertStockConsumptionSchema,
  insertDishIngredientSchema,
  insertPrinterConfigurationSchema,
} from "@shared/schema";
import { QRService } from "./qr-service";
import { uploadIdDocument } from "./fileUpload";
import { eq, sql, and } from "drizzle-orm";
import {
  restaurantOrderItems,
  restaurantOrders,
  reservations,
  guests,
  printerConfigurations,
} from "@shared/schema";
import { db } from "./db";
import { z } from "zod";
import { broadcastChange } from "./middleware/websocket";
import { wsManager } from "./websocket";
import {
  enforceBranchIsolation,
  getBranchFilter,
  canAccessBranch,
} from "./middleware/branchIsolation";
import { auditMiddleware } from "./auditMiddleware";
import {
  sseManager,
  broadcastDataUpdate,
  broadcastUserUpdate,
  broadcastNotification,
} from "./sse";

// Helper function to broadcast both WebSocket and SSE for backward compatibility
function broadcastDataChange(
  type: string,
  action: string,
  data: any,
  branchId?: string,
) {
  // Keep WebSocket for backward compatibility
  broadcastChange(type, action, data);

  // Add SSE broadcast
  const sseType = `${type}_${action}`;
  console.log(`📡 Broadcasting SSE: ${sseType} to branch ${branchId || "all"}`);
  if (branchId) {
    broadcastDataUpdate(sseType, data, branchId);
  } else {
    broadcastDataUpdate(sseType, data);
  }
}

// Helper function to check user permissions based on role and branch
function checkBranchPermissions(
  userRole: string,
  userBranchId: number | null,
  targetBranchId?: number,
): boolean {
  if (userRole === "superadmin") {
    return true;
  }

  if (!targetBranchId) return true; // For operations that don't specify a branch

  if (userRole === "branch-admin" || userRole === "custom") {
    return userBranchId === targetBranchId;
  }

  return false;
}

// Helper function to check user permissions for specific actions
async function checkUserPermission(
  userId: string,
  module: string,
  action: "read" | "write" | "delete",
): Promise<boolean> {
  try {
    const user = await storage.getUser(userId);
    if (!user) return false;

    // Superadmin has all permissions
    if (user.role === "superadmin") {
      return true;
    }

    // Built-in roles permissions
    if (user.role === "branch-admin") {
      // Branch admin has most permissions except user management and some settings
      const restrictedModules = ["users", "branches", "settings"];
      if (restrictedModules.includes(module)) return false;
      
      // Branch admin has full access to room-types
      if (module === "room-types") return true;
      
      return true;
    }

    if (user.role === "front-desk") {
      // Front desk has limited permissions
      const allowedModules = [
        "dashboard",
        "reservations",
        "rooms",
        "guests",
        "billing",
      ];
      if (!allowedModules.includes(module)) return false;

      // Front desk can't delete most things
      if (action === "delete" && !["reservations"].includes(module))
        return false;
      return true;
    }

    // For custom roles, check specific permissions
    if (user.role === "custom") {
      const userPermissions = await roleStorage.getUserPermissions(userId);
      return userPermissions[module]?.[action] || false;
    }

    return false;
  } catch (error) {
    console.error("Error checking user permission:", error);
    return false;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Import session with ES6 syntax
  const session = (await import("express-session")).default;
  const path = (await import("path")).default;
  const fs = (await import("fs")).default;

  // Serve PWA assets with proper MIME types (before other routes)
  app.get("/manifest.json", async (req, res) => {
    try {
      const manifestPath = path.resolve(
        process.cwd(),
        "public",
        "manifest.json",
      );
      const manifestContent = await fs.promises.readFile(manifestPath, "utf-8");
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.status(200).send(manifestContent);
      console.log("✅ Manifest served successfully");
    } catch (e) {
      console.error("❌ Failed to serve manifest.json:", e);
      res.status(404).json({ message: "Manifest not found" });
    }
  });

  app.get("/favic-trans-icon.png", async (req, res) => {
    try {
      const iconPath = path.resolve(process.cwd(), "favic-trans-icon.png");
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.sendFile(iconPath);
      console.log("✅ Icon served successfully");
    } catch (e) {
      console.error("❌ Failed to serve favic-trans-icon.png:", e);
      res.status(404).json({ message: "Icon not found" });
    }
  });
  // Trust proxy for rate limiting in Replit environment
  app.set("trust proxy", 1);

  // Security middleware - relaxed for development
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP in development
      hsts: false, // Disable HSTS in development
    }),
  );

  // Apply rate limiting only to specific sensitive API routes
  // Skip general rate limiting in development to avoid blocking the application

  // Auth middleware for session handling
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "your-secret-key",
      resave: false,
      saveUninitialized: false,
      rolling: true, // Reset maxAge on every request
      cookie: {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days - persistent until logout
      },
    }),
  );

  // Add audit middleware to track all API operations
  app.use("/api", auditMiddleware);

  // SSE (Server-Sent Events) endpoint for real-time updates
  app.get("/api/sse", (req: any, res) => {
    // Optional: Add basic authentication check if needed
    if (req.session && req.session.user) {
      const clientId = sseManager.addClient(req, res);

      // Update client with user info
      sseManager.updateClientAuth(
        clientId,
        req.session.user.id,
        req.session.user.branchId,
      );
    } else {
      // Allow anonymous connections for guest orders
      sseManager.addClient(req, res);
    }
  });

  // SSE authentication endpoint to update client info
  app.post("/api/sse/auth", (req: any, res) => {
    const { clientId } = req.body;

    if (req.session && req.session.user && clientId) {
      sseManager.updateClientAuth(
        clientId,
        req.session.user.id,
        req.session.user.branchId,
      );
    }

    res.json({ success: true });
  });

  // Test SSE endpoint
  app.post("/api/sse/test", (req: any, res) => {
    console.log("📡 SSE Test endpoint called");
    const { type, data } = req.body;

    // Broadcast a test message
    console.log("📡 Broadcasting test message:", {
      type: type || "branches_created",
      data: data || { test: "data" },
    });
    broadcastDataUpdate(type || "branches_created", data || { test: "data" });

    res.json({ success: true, message: "Test broadcast sent" });
  });

  // Custom auth middleware
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.session && req.session.user) {
      req.user = req.session.user; // Add user to request object
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  };

  // Combined auth and branch isolation middleware
  const requireAuthWithBranchIsolation = [
    isAuthenticated,
    enforceBranchIsolation,
  ];

  // Auth routes with rate limiting
  app.post("/api/auth/login", authRateLimit, async (req: any, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }

      // Get user by email
      const user = await storage.getUserByEmail(email);

      if (!user || !user.isActive) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Compare password using bcrypt
      const isPasswordValid = await PasswordUtils.comparePassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Set session
      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
      };

      res.json({
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          branchId: user.branchId,
        },
      });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Branch routes
  app.get("/api/branches", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const branches = await storage.getBranches();

      // Filter branches based on user role
      if (user.role === "superadmin") {
        // Superadmin sees all branches including inactive ones
        res.json(branches);
      } else {
        // Regular users only see active branches and their own branch if active
        const activeBranches = branches.filter(
          (b) => b.isActive && b.id === user.branchId,
        );
        res.json(activeBranches);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ message: "Failed to fetch branches" });
    }
  });

  app.post("/api/branches", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check write permission for branches module
      const hasWritePermission = await checkUserPermission(
        req.session.user.id,
        "branches",
        "write",
      );
      if (!hasWritePermission) {
        return res
          .status(403)
          .json({ message: "You do not have permission to create branches" });
      }

      // Sanitize input data
      const sanitizedBody = sanitizeInput(req.body);
      const branchData = insertBranchSchema.parse(sanitizedBody);

      // Additional validation
      if (branchData.email && !validateEmail(branchData.email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      if (branchData.phone && !validatePhone(branchData.phone)) {
        return res.status(400).json({ message: "Invalid phone format" });
      }

      const branch = await storage.createBranch(branchData);
      broadcastDataChange("branches", "created", branch); // Broadcast to all clients
      res.status(201).json(branch);
    } catch (error) {
      console.error("Error creating branch:", error);
      res.status(500).json({ message: "Failed to create branch" });
    }
  });

  app.put("/api/branches/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check write permission for branches module
      const hasWritePermission = await checkUserPermission(
        req.session.user.id,
        "branches",
        "write",
      );
      if (!hasWritePermission) {
        return res
          .status(403)
          .json({ message: "You do not have permission to update branches" });
      }

      const branchId = parseInt(req.params.id);
      const branchData = insertBranchSchema.partial().parse(req.body);
      const branch = await storage.updateBranch(branchId, branchData);
      broadcastDataChange("branches", "updated", branch); // Broadcast to all clients
      res.json(branch);
    } catch (error) {
      console.error("Error updating branch:", error);
      res.status(500).json({ message: "Failed to update branch" });
    }
  });

  app.delete("/api/branches/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user || user.role !== "superadmin") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const branchId = parseInt(req.params.id);
      const branch = await storage.getBranch(branchId);

      if (!branch) {
        return res.status(404).json({ message: "Branch not found" });
      }

      if (branch.isActive) {
        // First click: deactivate the branch
        const updatedBranch = await storage.updateBranch(branchId, {
          isActive: false,
        });
        broadcastDataChange("branches", "updated", updatedBranch); // Broadcast to all clients
        res.json({
          action: "deactivated",
          message: "Branch deactivated successfully",
        });
      } else {
        // Second click: permanently delete the branch
        await storage.deleteBranch(branchId);
        broadcastDataChange("branches", "deleted", { id: branchId }); // Broadcast to all clients
        res.json({ action: "deleted", message: "Branch deleted permanently" });
      }
    } catch (error) {
      console.error("Error updating branch:", error);
      res.status(500).json({ message: "Failed to update branch" });
    }
  });

  // User management routes
  app.get("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user || user.role !== "superadmin") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const users = await storage.getAllUsersWithCustomRoles();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check write permission for users module
      const hasWritePermission = await checkUserPermission(
        req.session.user.id,
        "users",
        "write",
      );
      if (!hasWritePermission) {
        return res
          .status(403)
          .json({ message: "You do not have permission to create users" });
      }

      const { customRoleIds, ...userData } = req.body;
      const validatedUserData = insertUserSchema.parse(userData);
      
      // Hash password if provided
      if (validatedUserData.password) {
        // Validate password strength
        const passwordValidation = PasswordUtils.validatePasswordStrength(validatedUserData.password);
        if (!passwordValidation.isValid) {
          return res.status(400).json({ message: passwordValidation.message });
        }
        
        validatedUserData.password = await PasswordUtils.hashPassword(validatedUserData.password);
      }
      
      const newUser = await storage.upsertUser(validatedUserData);

      // Handle custom role assignments
      if (customRoleIds && customRoleIds.length > 0) {
        await roleStorage.assignRolesToUser(newUser.id, customRoleIds);
      }

      // Get user with custom roles for response
      const userWithRoles = await storage.getUserWithCustomRoles(newUser.id);

      // Broadcast to all superadmins, and to branch users if user belongs to a branch
      broadcastDataChange(
        "users",
        "created",
        userWithRoles,
        userWithRoles.branchId?.toString(),
      );
      res.status(201).json(userWithRoles);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check write permission for users module
      const hasWritePermission = await checkUserPermission(
        req.session.user.id,
        "users",
        "write",
      );
      if (!hasWritePermission) {
        return res
          .status(403)
          .json({ message: "You do not have permission to update users" });
      }

      const userId = req.params.id;
      const { customRoleIds, ...userData } = req.body;
      const validatedUserData = insertUserSchema.partial().parse(userData);
      
      // Hash password if provided
      if (validatedUserData.password) {
        // Validate password strength
        const passwordValidation = PasswordUtils.validatePasswordStrength(validatedUserData.password);
        if (!passwordValidation.isValid) {
          return res.status(400).json({ message: passwordValidation.message });
        }
        
        validatedUserData.password = await PasswordUtils.hashPassword(validatedUserData.password);
      }
      
      const updatedUser = await storage.updateUser(userId, validatedUserData);

      // Handle custom role assignments
      if (customRoleIds !== undefined) {
        await roleStorage.assignRolesToUser(userId, customRoleIds);
      }

      // Get user with custom roles for response
      const userWithRoles = await storage.getUserWithCustomRoles(userId);

      broadcastDataChange(
        "users",
        "updated",
        userWithRoles,
        userWithRoles.branchId?.toString(),
      ); // Broadcast change
      res.json(userWithRoles);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user || user.role !== "superadmin") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Check delete permission for users module
      const hasDeletePermission = await checkUserPermission(
        req.session.user.id,
        "users",
        "delete",
      );
      if (!hasDeletePermission) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions to delete users" });
      }

      const userId = req.params.id;
      await storage.updateUser(userId, { isActive: false });
      broadcastDataChange("users", "deleted", { id: userId }); // Broadcast change
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Room routes
  app.get("/api/rooms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) {
        console.error("❌ User not found during rooms fetch");
        return res.status(401).json({ message: "User not found" });
      }

      const { branchId: queryBranchId, status } = req.query;
      let branchId =
        user.role === "superadmin"
          ? queryBranchId
            ? parseInt(queryBranchId as string)
            : undefined
          : user.branchId!;

      console.log("🔍 Fetching rooms with filters:", {
        branchId,
        status,
        userRole: user.role,
        queryBranchId: queryBranchId,
      });

      // Validate branchId if provided
      if (queryBranchId && isNaN(parseInt(queryBranchId as string))) {
        console.error("❌ Invalid branchId provided:", queryBranchId);
        return res.status(400).json({ message: "Invalid branch ID" });
      }

      const rooms = await storage.getRooms(branchId, status as string);
      console.log("✅ Rooms found:", rooms?.length || 0);

      // Ensure we always return a valid JSON response
      const response = rooms || [];

      // Set proper headers
      res.setHeader("Content-Type", "application/json");
      return res.status(200).json(response);
    } catch (error) {
      console.error("❌ Error fetching rooms:", error);
      // Make sure we return JSON even on error
      res.setHeader("Content-Type", "application/json");
      return res.status(500).json({
        message: "Failed to fetch rooms",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/rooms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check write permission for rooms module
      const hasWritePermission = await checkUserPermission(
        req.session.user.id,
        "rooms",
        "write",
      );
      if (!hasWritePermission) {
        return res
          .status(403)
          .json({ message: "You do not have permission to create rooms" });
      }

      const roomData = insertRoomSchema.parse(req.body);

      if (
        !checkBranchPermissions(user.role, user.branchId, roomData.branchId)
      ) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this branch" });
      }

      const room = await storage.createRoom(roomData);
      // Broadcast to all superadmins, and to branch users if room belongs to a branch
      broadcastDataChange("rooms", "created", room, room.branchId?.toString());
      res.status(201).json(room);
    } catch (error) {
      console.error("Error creating room:", error);
      res.status(500).json({ message: "Failed to create room" });
    }
  });

  app.put("/api/rooms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check write permission for rooms module
      const hasWritePermission = await checkUserPermission(
        req.session.user.id,
        "rooms",
        "write",
      );
      if (!hasWritePermission) {
        return res
          .status(403)
          .json({ message: "You do not have permission to update rooms" });
      }

      const roomId = parseInt(req.params.id);
      const roomData = insertRoomSchema.partial().parse(req.body);

      // Check if user has permission for the room's branch
      const existingRoom = await storage.getRoom(roomId);
      if (
        !existingRoom ||
        !checkBranchPermissions(user.role, user.branchId, existingRoom.branchId)
      ) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this room" });
      }

      const room = await storage.updateRoom(roomId, roomData);
      // Broadcast to all superadmins, and to branch users if room belongs to a branch
      broadcastDataChange("rooms", "updated", room, room.branchId?.toString());
      res.json(room);
    } catch (error) {
      console.error("Error updating room:", error);
      res.status(500).json({ message: "Failed to update room" });
    }
  });

  app.delete("/api/rooms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user || !["superadmin", "branch-admin"].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Check delete permission for rooms module
      const hasDeletePermission = await checkUserPermission(
        req.session.user.id,
        "rooms",
        "delete",
      );
      if (!hasDeletePermission) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions to delete rooms" });
      }

      const roomId = parseInt(req.params.id);

      // Check if user has permission for the room's branch
      const existingRoom = await storage.getRoom(roomId);
      if (
        !existingRoom ||
        !checkBranchPermissions(user.role, user.branchId, existingRoom.branchId)
      ) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this room" });
      }

      await storage.updateRoom(roomId, { isActive: false });
      broadcastDataChange("rooms", "deleted", { id: roomId }); // Broadcast change
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting room:", error);
      res.status(500).json({ message: "Failed to delete room" });
    }
  });

  app.post("/api/rooms/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user || !["superadmin", "branch-admin"].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { rooms } = req.body;

      // Validate each room and check branch permissions
      const validatedRooms = rooms.map((room: any) => {
        const validatedRoom = insertRoomSchema.parse(room);

        // Check if user has permission for the room's branch
        if (
          !checkBranchPermissions(
            user.role,
            user.branchId,
            validatedRoom.branchId,
          )
        ) {
          throw new Error(
            `Insufficient permissions for branch ${validatedRoom.branchId}`,
          );
        }

        return validatedRoom;
      });

      const createdRooms = await storage.createRoomsBulk(validatedRooms);

      // Broadcast changes for each created room
      createdRooms.forEach((room) => {
        broadcastDataChange(
          "rooms",
          "created",
          room,
          room.branchId?.toString(),
        );
      });

      res.status(201).json(createdRooms);
    } catch (error) {
      console.error("Error creating rooms in bulk:", error);
      res.status(500).json({ message: "Failed to create rooms in bulk" });
    }
  });

  app.patch("/api/rooms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const roomId = parseInt(req.params.id);
      const existingRoom = await storage.getRoom(roomId);

      if (!existingRoom) {
        return res.status(404).json({ message: "Room not found" });
      }

      if (
        !checkBranchPermissions(user.role, user.branchId, existingRoom.branchId)
      ) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this branch" });
      }

      const roomData = insertRoomSchema.partial().parse(req.body);
      const room = await storage.updateRoom(roomId, roomData);
      broadcastDataChange("rooms", "updated", room, room.branchId?.toString()); // Broadcast change

      // Send maintenance notification if room status changed to maintenance
      if (
        roomData.status &&
        (roomData.status === "maintenance" ||
          roomData.status === "out-of-order")
      ) {
        try {
          console.log(
            `🔧 Room ${existingRoom.number} status changed to ${roomData.status}, sending notification...`,
          );

          const branch = await storage.getBranch(existingRoom.branchId);
          const roomType = await storage.getRoomType(existingRoom.roomTypeId);

          if (branch && roomType) {
            console.log(
              `📨 Sending maintenance notification for room ${existingRoom.number} at branch ${branch.name}`,
            );
            await NotificationService.sendMaintenanceNotification(
              { ...existingRoom, roomType },
              branch,
              roomData.status,
            );
            console.log(
              `Maintenance notification sent for room ${existingRoom.number}`,
            );
          } else {
            console.warn(
              ` Missing branch or room type data for maintenance notification`,
            );
          }
        } catch (notificationError) {
          console.error(
            "Failed to send maintenance notification:",
            notificationError,
          );
        }
      }

      res.json(room);
    } catch (error) {
      console.error("Error updating room:", error);
      res.status(500).json({ message: "Failed to update room" });
    }
  });

  // Room type routes
  app.get("/api/room-types", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check read permission for room-types module
      const hasReadPermission = await checkUserPermission(
        req.session.user.id,
        "room-types",
        "read",
      );
      if (!hasReadPermission) {
        return res
          .status(403)
          .json({ message: "You do not have permission to view room types" });
      }

      // For superadmin, return all room types. For branch users, return room types for their branch + unassigned ones
      const branchId = user.role === "superadmin" ? undefined : user.branchId!;
      const roomTypes = await storage.getRoomTypes(branchId);
      res.json(roomTypes);
    } catch (error) {
      console.error("Error fetching room types:", error);
      res.status(500).json({ message: "Failed to fetch room types" });
    }
  });

  app.post("/api/room-types", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check write permission for room-types module
      const hasWritePermission = await checkUserPermission(
        req.session.user.id,
        "room-types",
        "write",
      );
      if (!hasWritePermission) {
        return res
          .status(403)
          .json({ message: "You do not have permission to create room types" });
      }

      const roomTypeData = insertRoomTypeSchema.parse(req.body);
      const roomType = await storage.createRoomType(roomTypeData);
      broadcastDataChange(
        "room-types",
        "created",
        roomType,
        roomType.branchId?.toString(),
      ); // Broadcast change
      res.status(201).json(roomType);
    } catch (error) {
      console.error("Error creating room type:", error);
      res.status(500).json({ message: "Failed to create room type" });
    }
  });

  app.patch("/api/room-types/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check write permission for room-types module
      const hasWritePermission = await checkUserPermission(
        req.session.user.id,
        "room-types",
        "write",
      );
      if (!hasWritePermission) {
        return res
          .status(403)
          .json({ message: "You do not have permission to update room types" });
      }

      const roomTypeId = parseInt(req.params.id);
      const roomTypeData = insertRoomTypeSchema.partial().parse(req.body);
      const roomType = await storage.updateRoomType(roomTypeId, roomTypeData);
      broadcastDataChange(
        "room-types",
        "updated",
        roomType,
        roomType.branchId?.toString(),
      ); // Broadcast change
      res.json(roomType);
    } catch (error) {
      console.error("Error updating room type:", error);
      res.status(500).json({ message: "Failed to update room type" });
    }
  });

  app.delete("/api/room-types/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user || user.role !== "superadmin") {
        return res.status(403).json({
          message:
            "Insufficient permissions. Only superadmin can delete room types.",
        });
      }

      // Check delete permission for room-types module
      const hasDeletePermission = await checkUserPermission(
        req.session.user.id,
        "room-types",
        "delete",
      );
      if (!hasDeletePermission) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions to delete room types" });
      }

      const roomTypeId = parseInt(req.params.id);
      await storage.updateRoomType(roomTypeId, { isActive: false });
      broadcastDataChange("room-types", "deleted", { id: roomTypeId }); // Broadcast change
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting room type:", error);
      res.status(500).json({ message: "Failed to delete room type" });
    }
  });

  app.post("/api/room-types/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check write permission for room-types module
      const hasWritePermission = await checkUserPermission(
        req.session.user.id,
        "room-types",
        "write",
      );
      if (!hasWritePermission) {
        return res
          .status(403)
          .json({ message: "You do not have permission to create room types" });
      }

      const { roomTypes } = req.body;

      // Validate each room type
      const validatedRoomTypes = roomTypes.map((roomType: any) => {
        return insertRoomTypeSchema.parse({
          ...roomType,
          basePrice: parseFloat(roomType.basePrice).toString(),
        });
      });

      const createdRoomTypes =
        await storage.createRoomTypesBulk(validatedRoomTypes);

      // Broadcast changes for each created room type
      createdRoomTypes.forEach((roomType) => {
        broadcastDataChange(
          "room-types",
          "created",
          roomType,
          roomType.branchId?.toString(),
        );
      });

      res.status(201).json(createdRoomTypes);
    } catch (error) {
      console.error("Error creating room types in bulk:", error);
      res.status(500).json({ message: "Failed to create room types in bulk" });
    }
  });

  // Guest routes
  app.get("/api/guests", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const { phone } = req.query;

      if (phone) {
        console.log("🔍 Searching for guest by phone:", phone);
        // Search guest by phone number - this returns any guest with this phone number from any branch
        const guest = await storage.findGuestByPhone(phone as string);
        console.log(
          "📱 Guest found:",
          guest ? `${guest.firstName} ${guest.lastName}` : "Not found",
        );
        return res.json(guest || null);
      }

      // Guests are now centrally accessible to all users
      const guests = await storage.getGuests();
      res.json(guests);
    } catch (error) {
      console.error("Error fetching guests:", error);
      res.status(500).json({ message: "Failed to fetch guests" });
    }
  });

  app.get("/api/guests/search", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const query = req.query.q as string;
      if (!query) return res.json([]);

      // Search all guests regardless of branch
      const guests = await storage.searchGuests(query);
      res.json(guests);
    } catch (error) {
      console.error("Error searching guests:", error);
      res.status(500).json({ message: "Failed to search guests" });
    }
  });

  app.post("/api/guests", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check write permission for guests module
      const hasWritePermission = await checkUserPermission(
        req.session.user.id,
        "guests",
        "write",
      );
      if (!hasWritePermission) {
        return res
          .status(403)
          .json({ message: "You do not have permission to create guests" });
      }

      // Apply sanitization fix for remaining XSS vulnerability
      const sanitizedBody = sanitizeInput(req.body);
      const guestData = insertGuestSchema.parse(sanitizedBody);

      // Additional validation
      if (guestData.email && !validateEmail(guestData.email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      if (guestData.phone && !validatePhone(guestData.phone)) {
        return res.status(400).json({ message: "Invalid phone format" });
      }

      // Check if guest with this phone number already exists
      if (guestData.phone) {
        const existingGuest = await storage.findGuestByPhone(guestData.phone);
        if (existingGuest) {
          return res.status(409).json({
            message: "Guest with this phone number already exists",
            guest: existingGuest,
          });
        }
      }

      const guest = await storage.createGuest(guestData);
      broadcastDataChange("guests", "created", guest); // Broadcast change
      res.status(201).json(guest);
    } catch (error) {
      console.error("Error creating guest:", error);
      res.status(500).json({ message: "Failed to create guest" });
    }
  });

  app.put("/api/guests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check write permission for guests module
      const hasWritePermission = await checkUserPermission(
        req.session.user.id,
        "guests",
        "write",
      );
      if (!hasWritePermission) {
        return res
          .status(403)
          .json({ message: "You do not have permission to update guests" });
      }

      const guestId = req.params.id;
      const guestData = insertGuestSchema.partial().parse(req.body);

      // Guests are centrally accessible, no branch permission check needed
      const existingGuest = await storage.getGuest(guestId);
      if (!existingGuest) {
        return res.status(404).json({ message: "Guest not found" });
      }

      const guest = await storage.updateGuest(guestId, guestData);
      broadcastDataChange("guests", "updated", guest); // Broadcast change
      res.json(guest);
    } catch (error) {
      console.error("Error updating guest:", error);
      res.status(500).json({ message: "Failed to update guest" });
    }
  });

  app.delete("/api/guests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check delete permission for guests module
      const hasDeletePermission = await checkUserPermission(
        req.session.user.id,
        "guests",
        "delete",
      );
      if (!hasDeletePermission) {
        return res
          .status(403)
          .json({ message: "You do not have permission to delete guests" });
      }

      const guestId = req.params.id;

      // Guests are centrally accessible, no branch permission check needed
      const existingGuest = await storage.getGuest(guestId);
      if (!existingGuest) {
        return res.status(404).json({ message: "Guest not found" });
      }

      // Instead of hard delete, we'll mark as inactive
      await storage.updateGuest(guestId, { isActive: false });
      broadcastDataChange("guests", "deleted", { id: guestId }); // Broadcast change
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting guest:", error);
      res.status(500).json({ message: "Failed to delete guest" });
    }
  });

  // Guest ID document routes
  app.post(
    "/api/guests/:id/upload-id",
    isAuthenticated,
    uploadIdDocument.single("idDocument"),
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const guestId = req.params.id;
        const existingGuest = await storage.getGuest(guestId);

        if (!existingGuest) {
          return res.status(404).json({ message: "Guest not found" });
        }

        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        // Update guest with file information
        await storage.updateGuest(guestId, {
          idDocumentPath: req.file.path,
          idDocumentOriginalName: req.file.originalname,
          idDocumentSize: req.file.size,
          idDocumentMimeType: req.file.mimetype,
        });

        res.json({ message: "ID document uploaded successfully" });
      } catch (error) {
        console.error("Error uploading ID document:", error);
        res.status(500).json({ message: "Failed to upload ID document" });
      }
    },
  );

  app.get(
    "/api/guests/:id/id-document",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const guestId = req.params.id;
        const guest = await storage.getGuest(guestId);

        if (!guest || !guest.idDocumentPath) {
          return res.status(404).json({ message: "ID document not found" });
        }

        // Check if file exists
        const { existsSync, createReadStream } = await import("fs");
        const { resolve } = await import("path");
        const filePath = resolve(guest.idDocumentPath);

        if (!existsSync(filePath)) {
          return res.status(404).json({ message: "File not found on disk" });
        }

        // Set appropriate headers for inline viewing
        const mimeType = guest.idDocumentMimeType || "application/octet-stream";
        const fileName = guest.idDocumentOriginalName || "id-document";

        res.setHeader("Content-Type", mimeType);
        res.setHeader("Cache-Control", "public, max-age=3600");

        // Use inline disposition but include filename for proper extension handling
        res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

        // Set additional headers to ensure browser displays the file
        res.setHeader("X-Frame-Options", "SAMEORIGIN");
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'self'; img-src 'self' data:; object-src 'self';",
        );

        // Stream the file
        const fileStream = createReadStream(filePath);
        fileStream.pipe(res);
      } catch (error) {
        console.error("Error serving ID document:", error);
        res.status(500).json({ message: "Failed to serve ID document" });
      }
    },
  );

  app.delete(
    "/api/guests/:id/id-document",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const guestId = req.params.id;
        const guest = await storage.getGuest(guestId);

        if (!guest || !guest.idDocumentPath) {
          return res.status(404).json({ message: "ID document not found" });
        }

        // Delete file from disk
        const { existsSync, unlinkSync } = await import("fs");
        const { resolve } = await import("path");
        const filePath = resolve(guest.idDocumentPath);

        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }

        // Update guest to remove file information
        await storage.updateGuest(guestId, {
          idDocumentPath: null,
          idDocumentOriginalName: null,
          idDocumentSize: null,
          idDocumentMimeType: null,
        });

        res.json({ message: "ID document deleted successfully" });
      } catch (error) {
        console.error("Error deleting ID document:", error);
        res.status(500).json({ message: "Failed to delete ID document" });
      }
    },
  );

  // Reservation routes
  app.post(
    "/api/reservations",
    isAuthenticated,
    uploadIdDocument.single("idDocument"),
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        // Parse the request body - handle both JSON and FormData
        let requestData = req.body;
        let guestData, reservationData, roomsData;

        // If it's FormData (multipart/form-data), parse JSON strings
        if (
          req.headers["content-type"] &&
          req.headers["content-type"].includes("multipart/form-data")
        ) {
          try {
            guestData = req.body.guest ? JSON.parse(req.body.guest) : undefined;
            reservationData = req.body.reservation
              ? JSON.parse(req.body.reservation)
              : undefined;
            roomsData = req.body.rooms ? JSON.parse(req.body.rooms) : undefined;
          } catch (error) {
            console.error("Error parsing FormData JSON:", error);
            return res
              .status(400)
              .json({ message: "Invalid JSON in form data" });
          }
        } else {
          // Regular JSON body
          guestData = requestData.guest;
          reservationData = requestData.reservation;
          roomsData = requestData.rooms;
        }

        console.log("🔍 Debug reservation creation request:", {
          user: { id: user.id, role: user.role, branchId: user.branchId },
          requestData: JSON.stringify(requestData, null, 2),
          guestData: JSON.stringify(guestData, null, 2),
          reservationData: JSON.stringify(reservationData, null, 2),
          roomsData: JSON.stringify(roomsData, null, 2),
        });

        if (!reservationData || !reservationData.branchId) {
          return res
            .status(400)
            .json({ message: "Reservation data or branchId is missing" });
        }

        if (
          !checkBranchPermissions(
            user.role,
            user.branchId,
            reservationData.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this branch" });
        }

        // Check if guest already exists by phone number
        let guest;
        if (guestData.phone) {
          const existingGuests = await storage.searchGuests(guestData.phone);
          if (existingGuests.length > 0) {
            guest = existingGuests[0];
          }
        }

        // Create new guest if not found
        if (!guest) {
          guest = await storage.createGuest({
            ...guestData,
            branchId: reservationData.branchId,
          });
        }

        // Handle file upload if provided
        if (req.file) {
          try {
            await storage.updateGuest(guest.id, {
              idDocumentPath: req.file.path,
              idDocumentOriginalName: req.file.originalname,
            });
          } catch (fileError) {
            console.error("Error saving file info:", fileError);
          }
        }

        // Generate confirmation number
        const confirmationNumber = `RES${Date.now().toString().slice(-8)}`;
        const reservationWithConfirmation = {
          ...reservationData,
          guestId: guest.id,
          confirmationNumber,
          createdById: user.id,
        };

        // Convert datetime strings to Date objects preserving exact user input time
        const roomsDataWithDates = roomsData.map((room: any) => {
          // Create Date object that represents the EXACT local time without timezone shifting
          const parseAsExactLocalTime = (dateTimeStr: string) => {
            console.log(`🕐 Input datetime: "${dateTimeStr}"`);
            
            // Parse components manually
            const [datePart, timePart] = dateTimeStr.split('T');
            const [year, month, day] = datePart.split('-').map(Number);
            const [hour, minute] = timePart.split(':').map(Number);
            
            // CRITICAL: Use UTC constructor with our local components to avoid timezone shift
            const exactDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
            
            console.log(`🕐 Exact UTC date: "${exactDate.toISOString()}" - stores exactly ${hour}:${minute.toString().padStart(2, '0')}`);
            
            return exactDate;
          };
          
          return {
            ...room,
            checkInDate: parseAsExactLocalTime(room.checkInDate),
            checkOutDate: parseAsExactLocalTime(room.checkOutDate),
          };
        });

        const reservation = await storage.createReservation(
          reservationWithConfirmation,
          roomsDataWithDates,
        );
        broadcastChange("reservations", "created", reservation); // Broadcast change
        broadcastDataUpdate(
          "reservations_created",
          reservation,
          reservation.branchId.toString(),
        ); // SSE broadcast

        // Update room status to reserved
        for (const roomData of roomsData) {
          await storage.updateRoom(roomData.roomId, { status: "reserved" });
        }

        // Send new reservation notification
        try {
          const branch = await storage.getBranch(reservationData.branchId);
          const room = await storage.getRoom(roomsData[0].roomId);
          const roomType = await storage.getRoomType(room?.roomTypeId || 0);

          if (branch && room && roomType) {
            await NotificationService.sendNewReservationNotification(
              guest,
              { ...room, roomType },
              branch,
              reservation.id,
              roomsDataWithDates[0].checkInDate,
              roomsDataWithDates[0].checkOutDate,
            );
            console.log(
              `📧 New reservation notification sent for reservation ${reservation.id}`,
            );
          }
        } catch (notificationError) {
          console.error(
            "Failed to send new reservation notification:",
            notificationError,
          );
        }

        res.status(201).json(reservation);
      } catch (error) {
        console.error("Error creating reservation:", error);
        res.status(500).json({ message: "Failed to create reservation" });
      }
    },
  );

  app.get("/api/reservations", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // For superadmin, return all reservations. For branch users, return reservations for their branch
      const branchId = user.role === "superadmin" ? undefined : user.branchId!;
      const reservations = await storage.getReservations(branchId);
      res.json(reservations);
    } catch (error) {
      console.error("Error fetching reservations:", error);
      res.status(500).json({ message: "Failed to fetch reservations" });
    }
  });

  app.get("/api/reservations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const reservation = await storage.getReservation(req.params.id);

      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }

      if (
        !checkBranchPermissions(user.role, user.branchId, reservation.branchId)
      ) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this branch" });
      }

      res.json(reservation);
    } catch (error) {
      console.error("Error fetching reservation:", error);
      res.status(500).json({ message: "Failed to fetch reservation" });
    }
  });

  const createReservationSchema = z.object({
    guest: insertGuestSchema,
    reservation: insertReservationSchema.omit({
      guestId: true,
      confirmationNumber: true,
      createdById: true,
    }),
    rooms: z.array(
      insertReservationRoomSchema.omit({
        reservationId: true,
      }),
    ),
  });

  app.post("/api/reservations", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check write permission for reservations module
      const hasWritePermission = await checkUserPermission(
        req.session.user.id,
        "reservations",
        "write",
      );
      if (!hasWritePermission) {
        return res.status(403).json({
          message: "You do not have permission to create reservations",
        });
      }

      // Parse the request body first without validation that requires generated fields
      const requestData = req.body;
      const guestData = requestData.guest;
      let reservationData = requestData.reservation;
      const roomsData = requestData.rooms;

      console.log(
        "📝 Received reservation data:",
        JSON.stringify(reservationData, null, 2),
      );

      // For custom role users, automatically set their assigned branchId
      if (user.role === "custom") {
        if (!user.branchId) {
          return res.status(403).json({
            message: "Custom role user must have a branch assignment",
          });
        }

        // Override branchId with user's assigned branch for custom role users
        reservationData = {
          ...reservationData,
          branchId: user.branchId,
        };

        console.log(
          "🏨 Custom role user - setting branchId to:",
          user.branchId,
          "for user:",
          user.id,
        );
      } else if (
        !checkBranchPermissions(
          user.role,
          user.branchId,
          reservationData.branchId,
        )
      ) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this branch" });
      }

      // Check if guest already exists by phone number
      let guest;
      if (guestData.phone) {
        const existingGuests = await storage.searchGuests(guestData.phone);
        if (existingGuests.length > 0) {
          guest = existingGuests[0];
        }
      }

      // Create new guest if not found
      if (!guest) {
        guest = await storage.createGuest({
          ...guestData,
          branchId: reservationData.branchId, // This will now have the correct branchId for custom users
        });
      }

      // Calculate taxes dynamically
      const subtotal = roomsData.reduce((sum: number, room: any) => {
        return sum + parseFloat(room.totalAmount);
      }, 0);

      let totalTaxAmount = 0;
      let appliedTaxes = [];

      // Get active reservation taxes
      const activeTaxes = await restaurantStorage.getActiveReservationTaxes();
      console.log("Active reservation taxes:", activeTaxes);

      if (activeTaxes && activeTaxes.length > 0) {
        activeTaxes.forEach((tax: any) => {
          const taxRate = parseFloat(tax.rate) || 0;
          const taxAmount = (subtotal * taxRate) / 100;
          totalTaxAmount += taxAmount;
          appliedTaxes.push({
            taxId: tax.id,
            taxName: tax.taxName,
            rate: taxRate,
            amount: parseFloat(taxAmount.toFixed(2)),
          });
          console.log(
            `Applied tax: ${tax.taxName} (${taxRate}%) = Rs.${taxAmount.toFixed(2)}`,
          );
        });
      }

      const finalTotalAmount = subtotal + totalTaxAmount;
      console.log(
        `Reservation total calculation: Subtotal=${subtotal}, Taxes=${totalTaxAmount}, Final=${finalTotalAmount}`,
      );

      // Generate confirmation number
      const confirmationNumber = `RES${Date.now().toString().slice(-8)}`;
      const reservationWithConfirmation = {
        ...reservationData,
        guestId: guest.id,
        confirmationNumber,
        createdById: user.id,
        totalAmount: finalTotalAmount.toString(),
        appliedTaxes: JSON.stringify(appliedTaxes),
        taxAmount: totalTaxAmount.toString(),
        branchId: reservationData.branchId, // Ensure branchId is preserved
      };

      console.log(
        "🏨 Creating reservation with branchId:",
        reservationWithConfirmation.branchId,
        "for user:",
        user.id,
        "role:",
        user.role,
        "totalAmount:",
        reservationWithConfirmation.totalAmount,
        "finalTotalAmount:",
        finalTotalAmount,
        "subtotal:",
        subtotal,
      );

      // Convert datetime strings to Date objects for database storage
      const roomsDataWithDates = roomsData.map((room: any) => ({
        ...room,
        checkInDate: new Date(room.checkInDate),
        checkOutDate: new Date(room.checkOutDate),
      }));

      const reservation = await storage.createReservation(
        reservationWithConfirmation,
        roomsDataWithDates,
      );
      broadcastChange("reservations", "created", reservation); // Broadcast change
      broadcastDataUpdate(
        "reservations_created",
        reservation,
        reservation.branchId.toString(),
      ); // SSE broadcast

      // Update room status to reserved
      for (const roomData of roomsData) {
        await storage.updateRoom(roomData.roomId, { status: "reserved" });
      }

      // Send new reservation notification
      try {
        const branch = await storage.getBranch(reservationData.branchId);
        const room = await storage.getRoom(roomsData[0].roomId);
        const roomType = await storage.getRoomType(room?.roomTypeId || 0);

        if (branch && room && roomType) {
          await NotificationService.sendNewReservationNotification(
            guest,
            { ...room, roomType },
            branch,
            reservation.id,
            roomsDataWithDates[0].checkInDate,
            roomsDataWithDates[0].checkOutDate,
          );
          console.log(
            `📧 New reservation notification sent for reservation ${reservation.id}`,
          );
        }
      } catch (notificationError) {
        console.error(
          "Failed to send new reservation notification:",
          notificationError,
        );
      }

      res.status(201).json(reservation);
    } catch (error) {
      console.error("Error creating reservation:", error);
      res.status(500).json({ message: "Failed to create reservation" });
    }
  });

  app.patch("/api/reservations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check write permission for reservations module
      const hasWritePermission = await checkUserPermission(
        req.session.user.id,
        "reservations",
        "write",
      );
      if (!hasWritePermission) {
        return res.status(403).json({
          message: "You do not have permission to update reservations",
        });
      }

      const reservationId = req.params.id;
      const existingReservation = await storage.getReservation(reservationId);

      if (!existingReservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }

      if (
        !checkBranchPermissions(
          user.role,
          user.branchId,
          existingReservation.branchId,
        )
      ) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this branch" });
      }

      // Prevent editing reservations after checkout
      if (
        existingReservation.status === "checked-out" ||
        existingReservation.status === "cancelled"
      ) {
        return res.status(403).json({
          message: "Cannot edit reservation after checkout or cancellation",
        });
      }

      const { guest, reservation, rooms } = req.body;

      // Handle comprehensive reservation update
      if (guest || reservation || rooms) {
        // Update guest information if provided
        if (guest && existingReservation.guestId) {
          const guestUpdateData = { ...guest };
          delete guestUpdateData.id; // Remove ID from update data
          await storage.updateGuest(
            existingReservation.guestId,
            guestUpdateData,
          );
        }

        // Update reservation information if provided
        if (reservation && Object.keys(reservation).length > 0) {
          const reservationUpdateData = { ...reservation };
          // Convert numeric fields to strings if they're numbers
          if (
            reservationUpdateData.paidAmount &&
            typeof reservationUpdateData.paidAmount === "number"
          ) {
            reservationUpdateData.paidAmount =
              reservationUpdateData.paidAmount.toString();
          }
          if (
            reservationUpdateData.totalAmount &&
            typeof reservationUpdateData.totalAmount === "number"
          ) {
            reservationUpdateData.totalAmount =
              reservationUpdateData.totalAmount.toString();
          }
          if (
            reservationUpdateData.taxAmount &&
            typeof reservationUpdateData.taxAmount === "number"
          ) {
            reservationUpdateData.taxAmount =
              reservationUpdateData.taxAmount.toString();
          }

          const validatedReservationData = insertReservationSchema
            .partial()
            .parse(reservationUpdateData);
          if (Object.keys(validatedReservationData).length > 0) {
            await storage.updateReservation(
              reservationId,
              validatedReservationData,
            );
          }
        }

        // Handle room updates - comprehensive room management
        if (rooms && Array.isArray(rooms)) {
          // Get current room reservations
          const currentRoomReservations = existingReservation.reservationRooms;
          const currentRoomIds = currentRoomReservations.map((rr) => rr.id);
          const incomingRoomIds = rooms
            .filter((room) => room.id)
            .map((room) => room.id);

          // Remove rooms that are no longer in the list
          const roomsToRemove = currentRoomReservations.filter(
            (rr) => !incomingRoomIds.includes(rr.id),
          );
          for (const roomToRemove of roomsToRemove) {
            await storage.deleteReservationRoom(roomToRemove.id);
            // Update room status back to available
            await storage.updateRoom(roomToRemove.roomId, {
              status: "available",
            });
          }

          // Process each room in the incoming data
          for (const roomData of rooms) {
            // Create Date object that represents the EXACT local time without timezone shifting
            const parseAsExactLocalTime = (dateTimeStr: string) => {
              console.log(`🕐 Input datetime: "${dateTimeStr}"`);
              
              // Parse components manually
              const [datePart, timePart] = dateTimeStr.split('T');
              const [year, month, day] = datePart.split('-').map(Number);
              const [hour, minute] = timePart.split(':').map(Number);
              
              // CRITICAL: Use UTC constructor with our local components to avoid timezone shift
              const exactDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
              
              console.log(`🕐 Exact UTC date: "${exactDate.toISOString()}" - stores exactly ${hour}:${minute.toString().padStart(2, '0')}`);
              
              return exactDate;
            };
            
            // Debug: Log the incoming room data for editing
            console.log(`🔧 EDIT: Processing room data:`, {
              id: roomData.id,
              checkInDate: roomData.checkInDate,
              checkOutDate: roomData.checkOutDate,
              hasDateTimeFields: !!(roomData.checkInDate && roomData.checkOutDate)
            });

            const roomPayload = {
              reservationId,
              roomId: roomData.roomId,
              checkInDate: roomData.checkInDate ? parseAsExactLocalTime(roomData.checkInDate) : undefined,
              checkOutDate: roomData.checkOutDate ? parseAsExactLocalTime(roomData.checkOutDate) : undefined,
              adults: roomData.adults,
              children: roomData.children,
              ratePerNight: roomData.ratePerNight,
              totalAmount: roomData.totalAmount,
              specialRequests: roomData.specialRequests || "",
            };

            // Remove undefined fields to avoid overwriting with null
            Object.keys(roomPayload).forEach(key => {
              if (roomPayload[key] === undefined) {
                delete roomPayload[key];
              }
            });

            if (roomData.id) {
              // Update existing room reservation
              await storage.updateReservationRoom(roomData.id, roomPayload);
            } else {
              // Add new room reservation
              await storage.createReservationRoom(roomPayload);
              // Update room status to reserved
              await storage.updateRoom(roomData.roomId, { status: "reserved" });
            }
          }
        }

        // Get updated reservation data
        const updatedReservation = await storage.getReservation(reservationId);
        broadcastChange("reservations", "updated", updatedReservation);
        broadcastDataUpdate(
          "reservations_updated",
          updatedReservation,
          updatedReservation.branchId.toString(),
        ); // SSE broadcast
        return res.json(updatedReservation);
      } else {
        // Handle simple status updates (legacy behavior)
        const bodyData = req.body;
        // Convert numeric fields to strings if they're numbers
        if (bodyData.paidAmount && typeof bodyData.paidAmount === "number") {
          bodyData.paidAmount = bodyData.paidAmount.toString();
        }
        if (bodyData.totalAmount && typeof bodyData.totalAmount === "number") {
          bodyData.totalAmount = bodyData.totalAmount.toString();
        }
        if (bodyData.taxAmount && typeof bodyData.taxAmount === "number") {
          bodyData.taxAmount = bodyData.taxAmount.toString();
        }
        const validatedData = insertReservationSchema.partial().parse(bodyData);
        const reservation = await storage.updateReservation(
          reservationId,
          validatedData,
        );
        broadcastChange("reservations", "updated", reservation); // Broadcast change
        broadcastDataUpdate(
          "reservations_updated",
          reservation,
          reservation.branchId.toString(),
        ); // SSE broadcast

        // Handle status change notifications for legacy updates
        if (validatedData.status) {
          for (const roomReservation of existingReservation.reservationRooms) {
            let newRoomStatus;
            switch (validatedData.status) {
              case "checked-in":
                newRoomStatus = "occupied";
                break;
              case "checked-out":
                newRoomStatus = "available";
                break;
              case "cancelled":
                newRoomStatus = "available";
                break;
              case "confirmed":
              case "pending":
                newRoomStatus = "reserved";
                break;
              default:
                newRoomStatus = "reserved";
            }
            await storage.updateRoom(roomReservation.roomId, {
              status: newRoomStatus,
            });
            broadcastChange("rooms", "updated", {
              id: roomReservation.roomId,
              status: newRoomStatus,
            });
            // Broadcast room updates via SSE for real-time availability
            broadcastDataUpdate(
              "rooms_updated",
              { id: roomReservation.roomId, status: newRoomStatus },
              existingReservation.branchId.toString()
            );
          }

          // Send notifications for status changes
          try {
            console.log(
              `Reservation ${reservationId} status changed to ${validatedData.status}, sending notification...`,
            );

            const branch = await storage.getBranch(
              existingReservation.branchId,
            );
            const firstRoom = existingReservation.reservationRooms[0];

            if (branch && firstRoom) {
              if (validatedData.status === "checked-in") {
                console.log(
                  `Sending check-in notification for reservation ${reservationId}`,
                );
                await NotificationService.sendCheckInNotification(
                  existingReservation.guest,
                  firstRoom.room,
                  branch,
                  reservationId,
                );
                console.log(
                  `Check-in notification sent for reservation ${reservationId}`,
                );
              } else if (validatedData.status === "checked-out") {
                console.log(
                  `Sending check-out notification for reservation ${reservationId}`,
                );
                await NotificationService.sendCheckOutNotification(
                  existingReservation.guest,
                  firstRoom.room,
                  branch,
                  reservationId,
                );
                console.log(
                  `Check-out notification sent for reservation ${reservationId}`,
                );
              }
            } else {
              console.warn(
                `Missing branch or room data for status change notification`,
              );
            }
          } catch (notificationError) {
            console.error(
              "Failed to send status change notification:",
              notificationError,
            );
          }
        }

        res.json(reservation);
      }
    } catch (error) {
      console.error("Error updating reservation:", error);
      res.status(500).json({ message: "Failed to update reservation" });
    }
  });

  app.delete(
    "/api/reservations/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        // Check delete permission for reservations module
        const hasDeletePermission = await checkUserPermission(
          req.session.user.id,
          "reservations",
          "delete",
        );
        if (!hasDeletePermission) {
          return res.status(403).json({
            message: "You do not have permission to delete reservations",
          });
        }

        const reservationId = req.params.id;
        const existingReservation = await storage.getReservation(reservationId);

        if (!existingReservation) {
          return res.status(404).json({ message: "Reservation not found" });
        }

        if (
          !checkBranchPermissions(
            user.role,
            user.branchId,
            existingReservation.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this branch" });
        }

        // Cancel the reservation and free up rooms
        await storage.updateReservation(reservationId, { status: "cancelled" });
        broadcastChange("reservations", "deleted", { id: reservationId }); // Broadcast change
        broadcastDataUpdate(
          "reservations_deleted",
          { id: reservationId },
          reservation.branchId.toString(),
        ); // SSE broadcast

        // Update room status back to available
        for (const roomReservation of existingReservation.reservationRooms) {
          await storage.updateRoom(roomReservation.roomId, {
            status: "available",
          });
          broadcastChange("rooms", "updated", {
            id: roomReservation.roomId,
            status: "available",
          });
          // Broadcast room status update for real-time availability
          broadcastDataUpdate(
            "rooms_updated",
            { id: roomReservation.roomId, status: "available" },
            existingReservation.branchId.toString()
          );
        }

        res.status(204).send();
      } catch (error) {
        console.error("Error cancelling reservation:", error);
        res.status(500).json({ message: "Failed to cancel reservation" });
      }
    },
  );

  // Payment routes
  app.get(
    "/api/reservations/:id/payments",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const reservationId = req.params.id;
        const reservation = await storage.getReservation(reservationId);

        if (!reservation) {
          return res.status(404).json({ message: "Reservation not found" });
        }

        if (
          !checkBranchPermissions(
            user.role,
            user.branchId,
            reservation.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this branch" });
        }

        const payments = await storage.getPaymentsByReservation(reservationId);
        res.json(payments);
      } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).json({ message: "Failed to fetch payments" });
      }
    },
  );

  app.post(
    "/api/reservations/:id/payments",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const reservationId = req.params.id;
        const reservation = await storage.getReservation(reservationId);

        if (!reservation) {
          return res.status(404).json({ message: "Reservation not found" });
        }

        if (
          !checkBranchPermissions(
            user.role,
            user.branchId,
            reservation.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this branch" });
        }

        const paymentData = insertPaymentSchema.parse({
          ...req.body,
          reservationId,
          processedById: user.id,
          // Handle empty due date properly
          dueDate:
            req.body.dueDate && req.body.dueDate.trim() !== ""
              ? req.body.dueDate
              : null,
        });

        const payment = await storage.createPayment(paymentData);

        console.log(
          `🔥 Payment created: ${payment.id} - Type: ${paymentData.paymentType} - Amount: Rs. ${paymentData.amount}`,
        );

        // Handle guest credit balance management
        const guest = await storage.getGuest(reservation.guestId);
        if (guest) {
          if (paymentData.paymentType === "credit") {
            // Credit payment: add to guest credit balance (promise to pay later)
            const currentCredit = parseFloat(
              guest.creditBalance?.toString() || "0",
            );
            const paymentAmount = parseFloat(paymentData.amount.toString());
            const newCreditBalance = currentCredit + paymentAmount;

            await storage.updateGuest(reservation.guestId, {
              creditBalance: newCreditBalance.toString(),
            });

            console.log(
              `💳 Added Rs. ${paymentAmount} to guest ${guest.firstName} ${guest.lastName} credit balance (promise to pay later). New balance: Rs. ${newCreditBalance}`,
            );
            broadcastChange("guests", "updated", {
              id: reservation.guestId,
              creditBalance: newCreditBalance,
            });
          } else {
            // Actual payments (cash, card, etc.) - reduce credit balance if guest has outstanding credit
            const currentCredit = parseFloat(
              guest.creditBalance?.toString() || "0",
            );
            if (currentCredit > 0) {
              const paymentAmount = parseFloat(paymentData.amount.toString());
              const creditReduction = Math.min(currentCredit, paymentAmount);
              const newCreditBalance = currentCredit - creditReduction;

              await storage.updateGuest(reservation.guestId, {
                creditBalance: newCreditBalance.toString(),
              });

              console.log(
                `💰 Reduced Rs. ${creditReduction} from guest ${guest.firstName} ${guest.lastName} credit balance due to actual payment. New balance: Rs. ${newCreditBalance}`,
              );
              broadcastChange("guests", "updated", {
                id: reservation.guestId,
                creditBalance: newCreditBalance,
              });
            }
          }
        }

        // Calculate payment amounts for proper tracking
        const allPayments =
          await storage.getPaymentsByReservation(reservationId);

        // Actual cash/card payments (excludes credit promises)
        const actualPaid = allPayments
          .filter((p) => p.status === "completed" && p.paymentType !== "credit")
          .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

        // Credit promises (amounts promised to pay later)
        const creditPromised = allPayments
          .filter((p) => p.status === "completed" && p.paymentType === "credit")
          .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

        // Total settlement (actual + promised) for checkout logic
        const totalSettled = actualPaid + creditPromised;
        const totalAmount = parseFloat(reservation.totalAmount.toString());

        console.log(`💰 Payment summary for reservation ${reservationId}:`);
        console.log(`   Total Amount: Rs. ${totalAmount}`);
        console.log(`   Actual Paid (Cash/Card): Rs. ${actualPaid}`);
        console.log(`   Credit Promised: Rs. ${creditPromised}`);
        console.log(`   Total Settled: Rs. ${totalSettled}`);
        console.log(`   Current Status: ${reservation.status}`);
        console.log(`   Payment Type: ${paymentData.paymentType}`);

        // Update reservation paid amount (only actual payments, not credit promises)
        const updatedReservation = await storage.updateReservation(
          reservationId,
          {
            paidAmount: actualPaid.toString(),
          },
        );

        console.log(`🔍 Checking auto-checkout conditions:`);
        console.log(
          `   Total Settled >= Total Amount: ${totalSettled >= totalAmount}`,
        );
        console.log(`   Current Status: ${reservation.status}`);
        console.log(
          `   Can auto-checkout: ${reservation.status === "checked-in" || reservation.status === "confirmed"}`,
        );

        // Check if payment is complete (including credit promises) and automatically check out
        const currentReservation = await storage.getReservation(reservationId);
        if (!currentReservation) {
          console.log(`❌ Current reservation not found for auto-checkout check`);
          return res.status(201).json(payment);
        }

        // Calculate the actual total amount after discount for auto-checkout logic
        let actualTotalAmount = parseFloat(currentReservation.totalAmount.toString());
        
        // Apply discount if present
        if (currentReservation.discountType && currentReservation.discountValue) {
          const discountValue = parseFloat(currentReservation.discountValue.toString()) || 0;
          let discount = 0;
          
          if (currentReservation.discountType === "percentage") {
            discount = (actualTotalAmount * discountValue) / 100;
          } else if (currentReservation.discountType === "fixed") {
            discount = discountValue;
          }
          
          // Ensure discount doesn't exceed total amount
          discount = Math.min(discount, actualTotalAmount);
          actualTotalAmount = Math.max(0, actualTotalAmount - discount);
          
          console.log(`💰 Auto-checkout calculation with discount:`);
          console.log(`   Original Total: Rs. ${currentReservation.totalAmount}`);
          console.log(`   Discount (${currentReservation.discountType}): Rs. ${discount}`);
          console.log(`   Final Total After Discount: Rs. ${actualTotalAmount}`);
        }

        // Round to avoid floating point precision issues
        const roundedSettled = Math.round(totalSettled * 100) / 100;
        const roundedActualTotal = Math.round(actualTotalAmount * 100) / 100;

        console.log(`🔍 Final auto-checkout comparison:`);
        console.log(`   Total Settled: Rs. ${roundedSettled}`);
        console.log(`   Total After Discount: Rs. ${roundedActualTotal}`);
        console.log(`   Settled >= Total: ${roundedSettled >= roundedActualTotal}`);

        if (
          roundedSettled >= roundedActualTotal &&
          currentReservation &&
          (currentReservation.status === "checked-in" ||
            currentReservation.status === "confirmed")
        ) {
          console.log(
            `💰 Payment complete for reservation ${reservationId} (Actual: Rs. ${actualPaid}, Total Settled: Rs. ${roundedSettled}, Final Total After Discount: Rs. ${roundedActualTotal}). Auto-checking out...`,
          );

          // Auto-checkout the reservation
          await storage.updateReservation(reservationId, {
            status: "checked-out",
          });

          // Update room status to available
          for (const roomReservation of reservation.reservationRooms) {
            await storage.updateRoom(roomReservation.roomId, {
              status: "available",
            });
            // Broadcast room status update for real-time availability
            broadcastDataUpdate(
              "rooms_updated",
              { id: roomReservation.roomId, status: "available" },
              reservation.branchId.toString()
            );
          }

          // Send checkout notification
          try {
            const branch = await storage.getBranch(reservation.branchId);
            const firstRoom = reservation.reservationRooms[0];

            if (branch && firstRoom) {
              await NotificationService.sendCheckOutNotification(
                reservation.guest,
                firstRoom.room,
                branch,
                reservationId,
              );
              console.log(
                `✅ Auto-checkout notification sent for reservation ${reservationId}`,
              );
            }
          } catch (notificationError) {
            console.error(
              "Failed to send auto-checkout notification:",
              notificationError,
            );
          }

          broadcastChange("reservations", "updated", {
            id: reservationId,
            status: "checked-out",
            paidAmount: actualPaid,
            totalSettled: roundedSettled,
            finalTotal: roundedActualTotal,
          });
          broadcastDataUpdate(
            "reservations_updated",
            { id: reservationId, status: "checked-out" },
            reservation.branchId.toString(),
          ); // SSE broadcast
        } else if (actualPaid > totalAmount) {
          // Handle overpayment as credit (only for actual payments, not credit promises)
          const creditAmount = actualPaid - totalAmount;
          const updatedGuest = await storage.getGuest(reservation.guestId);
          if (updatedGuest) {
            const currentCredit = parseFloat(
              updatedGuest.creditBalance?.toString() || "0",
            );

            await storage.updateGuest(reservation.guestId, {
              creditBalance: (currentCredit + creditAmount).toString(),
            });

            console.log(
              `💳 Added Rs. ${creditAmount} credit to guest ${updatedGuest.firstName} ${updatedGuest.lastName}`,
            );
            broadcastChange("guests", "updated", {
              id: reservation.guestId,
              creditBalance: currentCredit + creditAmount,
            });
          }
        }

        broadcastChange("payments", "created", payment);
        broadcastDataUpdate(
          "payments_created",
          payment,
          reservation.branchId.toString(),
        ); // SSE broadcast
        broadcastChange("reservations", "updated", {
          id: reservationId,
          paidAmount: actualPaid,
        });
        broadcastDataUpdate(
          "reservations_updated",
          { id: reservationId, paidAmount: actualPaid },
          reservation.branchId.toString(),
        ); // SSE broadcast
        res.status(201).json(payment);
      } catch (error) {
        console.error("Error creating payment:", error);
        res.status(500).json({ message: "Failed to create payment" });
      }
    },
  );

  app.get(
    "/api/reservations/:id/with-payments",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const reservationId = req.params.id;
        const reservation =
          await storage.getReservationWithPayments(reservationId);

        if (!reservation) {
          return res.status(404).json({ message: "Reservation not found" });
        }

        if (
          !checkBranchPermissions(
            user.role,
            user.branchId,
            reservation.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this branch" });
        }

        res.json(reservation);
      } catch (error) {
        console.error("Error fetching reservation with payments:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch reservation with payments" });
      }
    },
  );

  app.patch(
    "/api/payments/:id/status",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const paymentId = parseInt(req.params.id);
        const { status } = req.body;

        const payment = await storage.updatePaymentStatus(paymentId, status);

        // Update reservation's paid amount when payment status changes
        if (payment) {
          const allPayments = await storage.getPaymentsByReservation(
            payment.reservationId,
          );

          // Actual cash/card payments (excludes credit promises)
          const actualPaid = allPayments
            .filter(
              (p) => p.status === "completed" && p.paymentType !== "credit",
            )
            .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

          // Credit promises (amounts promised to pay later)
          const creditPromised = allPayments
            .filter(
              (p) => p.status === "completed" && p.paymentType === "credit",
            )
            .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

          // Total settlement (actual + promised) for checkout logic
          const totalSettled = actualPaid + creditPromised;

          const reservation = await storage.getReservation(
            payment.reservationId,
          );
          if (!reservation) {
            return res.status(404).json({ message: "Reservation not found" });
          }

          const totalAmount = parseFloat(reservation.totalAmount.toString());

          await storage.updateReservation(payment.reservationId, {
            paidAmount: actualPaid.toString(),
          });

          // Calculate the actual total amount after discount for auto-checkout logic
          let actualTotalAmount = parseFloat(reservation.totalAmount.toString());
          
          // Apply discount if present
          if (reservation.discountType && reservation.discountValue) {
            const discountValue = parseFloat(reservation.discountValue.toString()) || 0;
            let discount = 0;
            
            if (reservation.discountType === "percentage") {
              discount = (actualTotalAmount * discountValue) / 100;
            } else if (reservation.discountType === "fixed") {
              discount = discountValue;
            }
            
            // Ensure discount doesn't exceed total amount
            discount = Math.min(discount, actualTotalAmount);
            actualTotalAmount = Math.max(0, actualTotalAmount - discount);
          }

          // Check if payment is complete (including credit) and automatically check out
          const roundedSettled = Math.round(totalSettled * 100) / 100;
          const roundedActualTotal = Math.round(actualTotalAmount * 100) / 100;

          if (
            roundedSettled >= roundedActualTotal &&
            reservation.status === "checked-in"
          ) {
            console.log(
              `💰 Payment complete for reservation ${payment.reservationId} (Total Settled: Rs. ${roundedSettled}, Final Total After Discount: Rs. ${roundedActualTotal}). Auto-checking out...`,
            );

            // Auto-checkout the reservation
            await storage.updateReservation(payment.reservationId, {
              status: "checked-out",
            });

            // Update room status to available
            for (const roomReservation of reservation.reservationRooms) {
              await storage.updateRoom(roomReservation.roomId, {
                status: "available",
              });
            }

            // Send checkout notification
            try {
              const branch = await storage.getBranch(reservation.branchId);
              const firstRoom = reservation.reservationRooms[0];

              if (branch && firstRoom) {
                await NotificationService.sendCheckOutNotification(
                  reservation.guest,
                  firstRoom.room,
                  branch,
                  payment.reservationId,
                );
                console.log(
                  `✅ Auto-checkout notification sent for reservation ${payment.reservationId}`,
                );
              }
            } catch (notificationError) {
              console.error(
                "Failed to send auto-checkout notification:",
                notificationError,
              );
            }

            broadcastChange("reservations", "updated", {
              id: payment.reservationId,
              status: "checked-out",
              paidAmount: actualPaid,
              totalSettled: roundedSettled,
              finalTotal: roundedActualTotal,
            });
            broadcastDataUpdate(
              "reservations_updated",
              { id: payment.reservationId, status: "checked-out" },
              reservation.branchId.toString(),
            ); // SSE broadcast
          } else if (actualPaid > totalAmount) {
            // Handle overpayment as credit (only for actual payments, not credit promises)
            const creditAmount = actualPaid - totalAmount;
            const guest = await storage.getGuest(reservation.guestId);
            if (guest) {
              const currentCredit = parseFloat(
                guest.creditBalance?.toString() || "0",
              );

              await storage.updateGuest(reservation.guestId, {
                creditBalance: (currentCredit + creditAmount).toString(),
              });

              console.log(
                `💳 Added Rs. ${creditAmount} credit to guest ${guest.firstName} ${guest.lastName}`,
              );
              broadcastChange("guests", "updated", {
                id: reservation.guestId,
                creditBalance: currentCredit + creditAmount,
              });
            }
            broadcastChange("reservations", "updated", {
              id: payment.reservationId,
              paidAmount: actualPaid,
            });
            broadcastDataUpdate(
              "reservations_updated",
              { id: payment.reservationId, paidAmount: actualPaid },
              reservation.branchId.toString(),
            ); // SSE broadcast
          } else {
            broadcastChange("reservations", "updated", {
              id: payment.reservationId,
              paidAmount: actualPaid,
            });
            broadcastDataUpdate(
              "reservations_updated",
              { id: payment.reservationId, paidAmount: actualPaid },
              reservation.branchId.toString(),
            ); // SSE broadcast
          }
        }

        broadcastChange("payments", "updated", payment);
        broadcastDataUpdate(
          "payments_updated",
          payment,
          reservation.branchId.toString(),
        ); // SSE broadcast
        res.json(payment);
      } catch (error) {
        console.error("Error updating payment status:", error);
        res.status(500).json({ message: "Failed to update payment status" });
      }
    },
  );

  // Dashboard metrics
  app.get("/api/dashboard/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const branchId = user.role === "superadmin" ? undefined : user.branchId!;
      const metrics = await storage.getDashboardMetrics(branchId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Today's reservations
  app.get(
    "/api/dashboard/today-reservations",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const limit = parseInt(req.query.limit as string) || 5;
        const reservations = await storage.getTodayReservations(
          branchId,
          limit,
        );
        res.json(reservations);
      } catch (error) {
        console.error("Error fetching today's reservations:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch today's reservations" });
      }
    },
  );

  // Today's restaurant orders
  app.get(
    "/api/restaurant/dashboard/today-orders",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const limit = parseInt(req.query.limit as string) || 5;
        const orders = await restaurantStorage.getTodayOrders(branchId, limit);
        res.json(orders);
      } catch (error) {
        console.error("Error fetching today's orders:", error);
        res.status(500).json({ message: "Failed to fetch today's orders" });
      }
    },
  );

  // Super admin dashboard metrics
  app.get(
    "/api/dashboard/super-admin-metrics",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user || user.role !== "superadmin") {
          return res.status(403).json({ message: "Insufficient permissions" });
        }

        const metrics = await storage.getSuperAdminDashboardMetrics();
        res.json(metrics);
      } catch (error) {
        console.error("Error fetching super admin metrics:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch super admin metrics" });
      }
    },
  );

  // Advanced Analytics Endpoints
  app.get("/api/analytics/revenue", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const branchId = user.role === "superadmin" ? undefined : user.branchId!;
      const period = req.query.period || "30d";
      const analytics = await storage.getRevenueAnalytics(
        branchId,
        period as string,
      );
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching revenue analytics:", error);
      res.status(500).json({ message: "Failed to fetch revenue analytics" });
    }
  });

  app.get(
    "/api/analytics/occupancy",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const period = req.query.period || "30d";
        const analytics = await storage.getOccupancyAnalytics(
          branchId,
          period as string,
        );
        res.json(analytics);
      } catch (error) {
        console.error("Error fetching occupancy analytics:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch occupancy analytics" });
      }
    },
  );

  app.get("/api/analytics/guests", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const branchId = user.role === "superadmin" ? undefined : user.branchId!;
      const analytics = await storage.getGuestAnalytics(branchId);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching guest analytics:", error);
      res.status(500).json({ message: "Failed to fetch guest analytics" });
    }
  });

  app.get("/api/analytics/rooms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const branchId = user.role === "superadmin" ? undefined : user.branchId!;
      const analytics = await storage.getRoomPerformanceAnalytics(branchId);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching room performance analytics:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch room performance analytics" });
    }
  });

  app.get(
    "/api/analytics/operations",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const analytics = await storage.getOperationalAnalytics(branchId);
        res.json(analytics);
      } catch (error) {
        console.error("Error fetching operational analytics:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch operational analytics" });
      }
    },
  );

  // Custom Role Management Routes
  app.get("/api/roles", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user || user.role !== "superadmin") {
        return res
          .status(403)
          .json({ message: "Only superadmins can access role management" });
      }

      const roles = await roleStorage.getCustomRoles();

      // Get permissions for each role
      const rolesWithPermissions = await Promise.all(
        roles.map(async (role) => {
          const permissions = await roleStorage.getRolePermissions(role.id);
          return { ...role, permissions };
        }),
      );

      res.json(rolesWithPermissions);
    } catch (error) {
      console.error("Error fetching custom roles:", error);
      res.status(500).json({ message: "Failed to fetch custom roles" });
    }
  });

  app.get(
    "/api/roles/modules/available",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user || user.role !== "superadmin") {
          return res
            .status(403)
            .json({ message: "Only superadmins can access modules" });
        }

        const modules = roleStorage.getAvailableModules();
        res.json(modules);
      } catch (error) {
        console.error("Error fetching available modules:", error);
        res.status(500).json({ message: "Failed to fetch available modules" });
      }
    },
  );

  app.post("/api/roles", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user || user.role !== "superadmin") {
        return res
          .status(403)
          .json({ message: "Only superadmins can create roles" });
      }

      const { name, description, permissions } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Role name is required" });
      }

      // Create the role
      const role = await roleStorage.createCustomRole({
        name: name.trim(),
        description: description || "",
      });

      // Set permissions if provided
      if (permissions && permissions.length > 0) {
        await roleStorage.setRolePermissions(role.id, permissions);
      }

      // Return role with permissions
      const roleWithPermissions = await roleStorage.getCustomRole(role.id);
      broadcastDataChange("roles", "created", roleWithPermissions);
      res.status(201).json(roleWithPermissions);
    } catch (error) {
      console.error("Error creating custom role:", error);
      res.status(500).json({ message: "Failed to create custom role" });
    }
  });

  app.put("/api/roles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user || user.role !== "superadmin") {
        return res
          .status(403)
          .json({ message: "Only superadmins can update roles" });
      }

      const roleId = parseInt(req.params.id);
      const { name, description, permissions } = req.body;

      // Update the role
      await roleStorage.updateCustomRole(roleId, {
        name: name?.trim(),
        description,
      });

      // Update permissions if provided
      if (permissions !== undefined) {
        await roleStorage.setRolePermissions(roleId, permissions);
      }

      // Return updated role with permissions
      const roleWithPermissions = await roleStorage.getCustomRole(roleId);
      broadcastDataChange("roles", "updated", roleWithPermissions);
      res.json(roleWithPermissions);
    } catch (error) {
      console.error("Error updating custom role:", error);
      res.status(500).json({ message: "Failed to update custom role" });
    }
  });

  app.delete("/api/roles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user || user.role !== "superadmin") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Check delete permission for role management
      const hasDeletePermission = await checkUserPermission(
        req.session.user.id,
        "users",
        "delete",
      );
      if (!hasDeletePermission) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions to delete roles" });
      }

      const roleId = parseInt(req.params.id);
      await roleStorage.deleteCustomRole(roleId);
      broadcastDataChange("roles", "deleted", { id: roleId });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom role:", error);
      res.status(500).json({ message: "Failed to delete custom role" });
    }
  });

  // Inventory Bulk Operations
  app.post(
    "/api/inventory/stock-categories/bulk",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { categories } = req.body;
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const results = [];
        for (const category of categories) {
          const validatedData = insertStockCategorySchema.parse(category);
          const newCategory =
            await inventoryStorage.createStockCategory(validatedData);
          results.push(newCategory);
        }

        res.status(201).json(results);
      } catch (error) {
        console.error("Error creating stock categories in bulk:", error);
        res
          .status(500)
          .json({ message: "Failed to create stock categories in bulk" });
      }
    },
  );

  app.post(
    "/api/inventory/measuring-units/bulk",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { units } = req.body;
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const results = [];
        for (const unit of units) {
          const validatedData = insertMeasuringUnitSchema.parse(unit);
          const newUnit =
            await inventoryStorage.createMeasuringUnit(validatedData);
          results.push(newUnit);
        }

        res.status(201).json(results);
      } catch (error) {
        console.error("Error creating measuring units in bulk:", error);
        res
          .status(500)
          .json({ message: "Failed to create measuring units in bulk" });
      }
    },
  );

  app.post(
    "/api/inventory/suppliers/bulk",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { suppliers } = req.body;
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const results = [];
        for (const supplier of suppliers) {
          const validatedData = insertSupplierSchema.parse(supplier);
          const newSupplier =
            await inventoryStorage.createSupplier(validatedData);
          results.push(newSupplier);
        }

        res.status(201).json(results);
      } catch (error) {
        console.error("Error creating suppliers in bulk:", error);
        res.status(500).json({ message: "Failed to create suppliers in bulk" });
      }
    },
  );

  app.post(
    "/api/inventory/stock-items/bulk",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { items } = req.body;
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const results = [];
        for (const item of items) {
          // Ensure branchId is set properly
          const itemWithBranch = {
            ...item,
            branchId:
              user.role === "superadmin"
                ? item.branchId || user.branchId
                : user.branchId,
          };

          // Check permissions
          if (
            !checkBranchPermissions(
              user.role,
              user.branchId,
              itemWithBranch.branchId,
            )
          ) {
            return res.status(403).json({
              message: "Insufficient permissions for one or more items",
            });
          }

          const validatedData = insertStockItemSchema.parse(itemWithBranch);
          const newItem = await inventoryStorage.createStockItem(validatedData);
          results.push(newItem);
        }

        res.status(201).json(results);
      } catch (error) {
        console.error("Error creating stock items in bulk:", error);
        res
          .status(500)
          .json({ message: "Failed to create stock items in bulk" });
      }
    },
  );

  // Restaurant Analytics Endpoints
  app.get(
    "/api/restaurant/analytics/revenue",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const period = req.query.period || "30d";
        const analytics = await restaurantStorage.getRevenueAnalytics(
          branchId,
          period as string,
        );
        res.json(analytics);
      } catch (error) {
        console.error("Error fetching restaurant revenue analytics:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch restaurant revenue analytics" });
      }
    },
  );

  app.get(
    "/api/restaurant/analytics/orders",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const period = req.query.period || "30d";
        const analytics = await restaurantStorage.getOrderAnalytics(
          branchId,
          period as string,
        );
        res.json(analytics);
      } catch (error) {
        console.error("Error fetching restaurant order analytics:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch restaurant order analytics" });
      }
    },
  );

  app.get(
    "/api/restaurant/analytics/dishes",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const analytics = await restaurantStorage.getDishAnalytics(branchId);
        res.json(analytics);
      } catch (error) {
        console.error("Error fetching restaurant dish analytics:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch restaurant dish analytics" });
      }
    },
  );

  app.get(
    "/api/restaurant/analytics/tables",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const analytics = await restaurantStorage.getTableAnalytics(branchId);
        res.json(analytics);
      } catch (error) {
        console.error("Error fetching restaurant table analytics:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch restaurant table analytics" });
      }
    },
  );

  app.get(
    "/api/restaurant/analytics/operations",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const analytics =
          await restaurantStorage.getOperationalAnalytics(branchId);
        res.json(analytics);
      } catch (error) {
        console.error(
          "Error fetching restaurant operational analytics:",
          error,
        );
        res.status(500).json({
          message: "Failed to fetch restaurant operational analytics",
        });
      }
    },
  );

  // Hotel settings - public endpoint for guest access
  app.get("/api/hotel-settings", async (req: any, res) => {
    try {
      const { branchId } = req.query;
      const targetBranchId = branchId
        ? parseInt(branchId as string)
        : undefined;

      const settings = await storage.getHotelSettings(targetBranchId);
      res.json(settings || {});
    } catch (error) {
      console.error("Error fetching hotel settings:", error);
      res.status(500).json({ message: "Failed to fetch hotel settings" });
    }
  });

  app.post("/api/hotel-settings", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user || user.role !== "superadmin") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const settingsData = insertHotelSettingsSchema.parse(req.body);
      const settings = await storage.upsertHotelSettings(settingsData);
      broadcastChange("hotel-settings", "created", settings); // Broadcast change
      res.json(settings);
    } catch (error) {
      console.error("Error saving hotel settings:", error);
      res.status(500).json({ message: "Failed to save hotel settings" });
    }
  });

  app.put("/api/hotel-settings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user || user.role !== "superadmin") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const settingsData = insertHotelSettingsSchema.parse(req.body);
      const settings = await storage.upsertHotelSettings(settingsData);
      broadcastChange("hotel-settings", "updated", settings); // Broadcast change
      res.json(settings);
    } catch (error) {
      console.error("Error updating hotel settings:", error);
      res.status(500).json({ message: "Failed to update hotel settings" });
    }
  });

  // Profile management
  app.get("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      res.json(user);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.put("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const updateData = insertUserSchema.partial().parse(req.body);
      const updatedUser = await storage.updateUser(user.id, updateData);
      broadcastChange("profile", "updated", updatedUser); // Broadcast change
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Room availability
  app.get("/api/rooms/availability", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const { branchId, checkIn, checkOut } = req.query;

      if (!branchId || !checkIn || !checkOut) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const targetBranchId = parseInt(branchId as string);

      if (!checkBranchPermissions(user.role, user.branchId, targetBranchId)) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this branch" });
      }

      const availableRooms = await storage.getAvailableRooms(
        targetBranchId,
        checkIn as string,
        checkOut as string,
      );
      res.json(availableRooms);
    } catch (error) {
      console.error("Error fetching room availability:", error);
      res.status(500).json({ message: "Failed to fetch room availability" });
    }
  });

  // Push notification routes
  app.get("/api/notifications/vapid-key", async (req, res) => {
    res.json({ publicKey: NotificationService.getVapidPublicKey() });
  });

  app.post(
    "/api/notifications/subscribe",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) {
          console.error(" User not found during subscription");
          return res.status(401).json({ message: "User not found" });
        }

        console.log(
          `👤 User subscribing: ${user.id} (${user.email}) - Role: ${user.role}, Branch: ${user.branchId}`,
        );

        // Only allow admin users to subscribe to notifications
        if (user.role !== "superadmin" && user.role !== "branch-admin") {
          console.warn(
            ` Non-admin user ${user.id} (${user.role}) tried to subscribe to notifications`,
          );
          return res.status(403).json({
            message: "Only admin users can subscribe to notifications",
          });
        }

        const { endpoint, p256dh, auth } = req.body;

        if (!endpoint || !p256dh || !auth) {
          console.error(" Missing subscription data:", {
            endpoint: !!endpoint,
            p256dh: !!p256dh,
            auth: !!auth,
            endpointType: typeof endpoint,
            p256dhType: typeof p256dh,
            authType: typeof auth,
          });
          return res
            .status(400)
            .json({ message: "Missing required subscription data" });
        }

        // Validate subscription data format
        if (
          typeof endpoint !== "string" ||
          typeof p256dh !== "string" ||
          typeof auth !== "string"
        ) {
          console.error(" Invalid subscription data types");
          return res
            .status(400)
            .json({ message: "Invalid subscription data format" });
        }

        console.log(
          `📝 Creating push subscription for user ${user.id} (${user.email}):`,
          {
            endpoint: endpoint.substring(0, 50) + "...",
            endpointLength: endpoint.length,
            p256dhLength: p256dh.length,
            authLength: auth.length,
            userRole: user.role,
            branchId: user.branchId,
          },
        );

        // Check if subscription already exists
        try {
          const existingSubscription = await storage.getPushSubscription(
            user.id,
            endpoint,
          );
          if (existingSubscription) {
            console.log(
              `♻️ Push subscription already exists for user ${user.id}, returning existing`,
            );

            // Verify it's still in the admin subscriptions list
            const allSubscriptions = await storage.getAllAdminSubscriptions();
            const isInAdminList = allSubscriptions.some(
              (sub) => sub.userId === user.id && sub.endpoint === endpoint,
            );
            console.log(` Subscription found in admin list: ${isInAdminList}`);

            return res.json(existingSubscription);
          }
        } catch (error) {
          console.error(" Error checking existing subscription:", error);
          // Continue with creating new subscription
        }

        // Create new subscription
        const subscription = await storage.createPushSubscription({
          userId: user.id,
          endpoint,
          p256dh,
          auth,
        });

        console.log(
          ` Push subscription created successfully for user ${user.id} (${user.email})`,
        );

        // Verify the subscription was saved and is accessible
        try {
          const allSubscriptions = await storage.getAllAdminSubscriptions();
          console.log(
            ` Total admin subscriptions after creation: ${allSubscriptions.length}`,
          );

          const userSubscriptions = allSubscriptions.filter(
            (sub) => sub.userId === user.id,
          );
          console.log(
            `👤 Subscriptions for user ${user.id}: ${userSubscriptions.length}`,
          );

          const adminUsers = allSubscriptions.map((sub) => ({
            userId: sub.userId,
            email: sub.user?.email,
            role: sub.user?.role,
          }));
          console.log(`👥 All subscribed admin users:`, adminUsers);

          // Double-check the newly created subscription is in the list
          const newSubInList = allSubscriptions.some(
            (sub) => sub.userId === user.id && sub.endpoint === endpoint,
          );
          console.log(` New subscription found in admin list: ${newSubInList}`);

          if (!newSubInList) {
            console.error(
              ` CRITICAL: New subscription not found in admin list!`,
            );
          }
        } catch (verifyError) {
          console.error(" Error verifying subscription creation:", verifyError);
        }

        res.json({
          ...subscription,
          message: "Subscription created successfully",
        });
      } catch (error) {
        console.error(" Error creating push subscription:", error);
        res.status(500).json({
          message: "Failed to create push subscription",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  app.delete(
    "/api/notifications/unsubscribe",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const { endpoint } = req.body;

        if (!endpoint) {
          return res.status(400).json({ message: "Missing endpoint" });
        }

        await storage.deletePushSubscription(user.id, endpoint);
        console.log(` Push subscription deleted for user ${user.id}`);
        res.json({ message: "Unsubscribed successfully" });
      } catch (error) {
        console.error("Error deleting push subscription:", error);
        res.status(500).json({ message: "Failed to unsubscribe" });
      }
    },
  );

  // Debug subscriptions endpoint
  app.get("/api/notifications/debug/subscriptions", async (req: any, res) => {
    try {
      const allSubscriptions = await storage.getAllPushSubscriptions();
      const adminSubscriptions = await storage.getAllAdminSubscriptions();

      res.json({
        total: allSubscriptions.length,
        adminSubscriptions: adminSubscriptions.length,
      });
    } catch (error: any) {
      console.error("❌ Debug subscriptions endpoint error:", error);
      res.status(500).json({
        error: error?.message || "Unknown error occurred",
      });
    }
  });

  // Test notifications endpoint (for debugging)
  app.post("/api/notifications/test", async (req: any, res) => {
    try {
      console.log("🧪 Test notification endpoint called");

      // Import the test function
      const { testNotifications } = await import("./test-notifications");
      const result = await testNotifications();

      console.log("📋 Test result:", result);

      // Always return JSON
      res.setHeader("Content-Type", "application/json");
      res.status(200).json(result);
    } catch (error: any) {
      console.error("❌ Test notification endpoint error:", error);

      // Ensure we return JSON even on error
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({
        success: false,
        error: error?.message || "Unknown error occurred",
        details:
          process.env.NODE_ENV === "development" ? error?.stack : undefined,
      });
    }
  });

  // Printer Configuration Routes
  app.get("/api/printer-configurations", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const branchId = user.role === "superadmin" ? undefined : user.branchId!;
      const configurations = await db
        .select()
        .from(printerConfigurations)
        .where(branchId ? eq(printerConfigurations.branchId, branchId) : undefined)
        .orderBy(printerConfigurations.printerType);

      res.json(configurations);
    } catch (error) {
      console.error("Error fetching printer configurations:", error);
      res.status(500).json({ message: "Failed to fetch printer configurations" });
    }
  });

  app.post("/api/printer-configurations", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      console.log("Received printer config request:", req.body);

      // Set branchId: for superadmin use provided branchId or default to 1, for others use their branchId
      const branchId = user.role === "superadmin" 
        ? (req.body.branchId || user.branchId || 1)
        : (user.branchId || 1);

      // Prepare data for validation
      const dataToValidate = {
        ...req.body,
        branchId,
      };

      console.log("Data to validate:", dataToValidate);

      const configData = insertPrinterConfigurationSchema.parse(dataToValidate);

      console.log("Validated config data:", configData);

      if (
        !checkBranchPermissions(user.role, user.branchId, configData.branchId)
      ) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this branch" });
      }

      // Check if a configuration with the same printer type already exists for this branch
      const existingConfig = await db
        .select()
        .from(printerConfigurations)
        .where(
          and(
            eq(printerConfigurations.branchId, configData.branchId),
            eq(printerConfigurations.printerType, configData.printerType)
          )
        )
        .limit(1);

      if (existingConfig.length > 0) {
        return res.status(409).json({ 
          message: `A ${configData.printerType} printer configuration already exists for this branch. Please edit the existing configuration instead.`
        });
      }

      const configuration = await db
        .insert(printerConfigurations)
        .values(configData)
        .returning();

      console.log("Printer configuration created successfully:", configuration[0]);
      res.status(201).json(configuration[0]);
    } catch (error) {
      console.error("Error creating printer configuration:", error);
      
      // Check if it's a validation error
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid printer configuration data",
          details: error.errors
        });
      }
      
      res.status(500).json({ 
        message: "Failed to create printer configuration",
        error: error.message 
      });
    }
  });

  app.put("/api/printer-configurations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const configId = parseInt(req.params.id);
      
      console.log("Updating printer config:", configId, req.body);

      const existingConfig = await db
        .select()
        .from(printerConfigurations)
        .where(eq(printerConfigurations.id, configId))
        .limit(1);

      if (!existingConfig.length) {
        return res.status(404).json({ message: "Printer configuration not found" });
      }

      if (
        !checkBranchPermissions(user.role, user.branchId, existingConfig[0].branchId)
      ) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this configuration" });
      }

      // Remove the id from the update data
      const { id, ...updateData } = req.body;
      
      const configData = insertPrinterConfigurationSchema.partial().parse(updateData);

      console.log("Validated update data:", configData);

      const [updatedConfig] = await db
        .update(printerConfigurations)
        .set({ ...configData, updatedAt: sql`NOW()` })
        .where(eq(printerConfigurations.id, configId))
        .returning();

      console.log("Printer configuration updated successfully:", updatedConfig);
      res.json(updatedConfig);
    } catch (error) {
      console.error("Error updating printer configuration:", error);
      
      // Check if it's a validation error
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid printer configuration data",
          details: error.errors
        });
      }
      
      res.status(500).json({ 
        message: "Failed to update printer configuration",
        error: error.message 
      });
    }
  });

  app.delete("/api/printer-configurations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const configId = parseInt(req.params.id);

      const existingConfig = await db
        .select()
        .from(printerConfigurations)
        .where(eq(printerConfigurations.id, configId))
        .limit(1);

      if (!existingConfig.length) {
        return res.status(404).json({ message: "Printer configuration not found" });
      }

      if (
        !checkBranchPermissions(user.role, user.branchId, existingConfig[0].branchId)
      ) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this configuration" });
      }

      await db
        .delete(printerConfigurations)
        .where(eq(printerConfigurations.id, configId));

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting printer configuration:", error);
      res.status(500).json({ message: "Failed to delete printer configuration" });
    }
  });

  app.post("/api/printer-configurations/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const configId = parseInt(req.params.id);

      const existingConfig = await db
        .select()
        .from(printerConfigurations)
        .where(eq(printerConfigurations.id, configId))
        .limit(1);

      if (!existingConfig.length) {
        return res.status(404).json({ message: "Printer configuration not found" });
      }

      if (
        !checkBranchPermissions(user.role, user.branchId, existingConfig[0].branchId)
      ) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this configuration" });
      }

      const config = existingConfig[0];

      // Test printer connection
      try {
        const net = await import("net");
        const client = new net.Socket();
        
        const testConnection = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            client.destroy();
            reject(new Error("Connection timeout"));
          }, config.connectionTimeout || 5000);

          client.connect(config.port || 9100, config.ipAddress, () => {
            clearTimeout(timeout);
            client.destroy();
            resolve(true);
          });

          client.on("error", (err) => {
            clearTimeout(timeout);
            client.destroy();
            reject(err);
          });
        });

        await testConnection;

        // Update connection status
        await db
          .update(printerConfigurations)
          .set({
            connectionStatus: "connected",
            lastTestPrint: sql`NOW()`,
            errorMessage: null,
            updatedAt: sql`NOW()`
          })
          .where(eq(printerConfigurations.id, configId));

        res.json({ success: true, message: "Printer connection successful" });
      } catch (error: any) {
        // Update connection status with error
        await db
          .update(printerConfigurations)
          .set({
            connectionStatus: "error",
            errorMessage: error.message,
            updatedAt: sql`NOW()`
          })
          .where(eq(printerConfigurations.id, configId));

        res.json({ 
          success: false, 
          error: error.message || "Connection failed",
          message: "Failed to connect to printer"
        });
      }
    } catch (error) {
      console.error("Error testing printer connection:", error);
      res.status(500).json({ message: "Failed to test printer connection" });
    }
  });

  // Enhanced Network Printer Discovery and Testing Endpoints
  app.get("/api/printer-configurations/discover", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Import network printer bridge dynamically to avoid circular imports
      const { networkPrinterBridge } = await import('./network-printer-bridge');
      
      const ipRange = req.query.ipRange || '192.168.1';
      
      console.log(`🔍 Discovering network printers in range ${ipRange}.100-200...`);
      
      const discoveredPrinters = await networkPrinterBridge.discoverNetworkPrinters(ipRange);
      
      // Get detailed information for each discovered printer
      const printerDetails = await Promise.all(
        discoveredPrinters.map(async (ip) => {
          const testResult = await networkPrinterBridge.testPrinterConnection(ip, 9100, 5000);
          return {
            ipAddress: ip,
            port: 9100,
            isOnline: testResult.success,
            responseTime: testResult.responseTime,
            message: testResult.message,
            suggestedName: `Thermal Printer ${ip.split('.').pop()}`
          };
        })
      );

      res.json({
        success: true,
        searchRange: `${ipRange}.100-200`,
        foundCount: discoveredPrinters.length,
        printers: printerDetails
      });
    } catch (error) {
      console.error("Error discovering network printers:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to discover network printers",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post("/api/printer-configurations/enhanced-test", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const { ipAddress, port = 9100, timeout = 10000 } = req.body;
      
      if (!ipAddress) {
        return res.status(400).json({ 
          success: false, 
          message: "IP address is required" 
        });
      }

      console.log(`🧪 Testing enhanced printer connection to ${ipAddress}:${port}...`);

      // Import network printer bridge dynamically
      const { networkPrinterBridge } = await import('./network-printer-bridge');
      
      const testResult = await networkPrinterBridge.testPrinterConnection(
        ipAddress, 
        port, 
        timeout
      );

      if (testResult.success) {
        console.log(`✅ Enhanced printer test successful: ${ipAddress}:${port} (${testResult.responseTime}ms)`);
      } else {
        console.log(`❌ Enhanced printer test failed: ${ipAddress}:${port} - ${testResult.message}`);
      }

      res.json({
        success: testResult.success,
        message: testResult.message,
        responseTime: testResult.responseTime,
        ipAddress,
        port,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error in enhanced printer test:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to test printer connection",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Add printer diagnosis endpoint
  app.post("/api/printer-configurations/diagnose", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const { ipAddress } = req.body;
      
      if (!ipAddress) {
        return res.status(400).json({ 
          success: false, 
          message: "IP address is required" 
        });
      }

      console.log(`🔍 Diagnosing printer at ${ipAddress}...`);

      const { networkPrinterBridge } = await import('./network-printer-bridge');
      
      // Test multiple ports commonly used by printers
      const portsToTest = [9100, 515, 631, 80, 443, 8080];
      const results = [];

      for (const port of portsToTest) {
        const result = await networkPrinterBridge.testPrinterConnection(ipAddress, port, 3000);
        results.push({
          port,
          success: result.success,
          message: result.message,
          responseTime: result.responseTime
        });
        console.log(`Port ${port}: ${result.success ? '✅' : '❌'} ${result.message}`);
      }

      const successfulPorts = results.filter(r => r.success);

      res.json({
        success: successfulPorts.length > 0,
        ipAddress,
        results,
        summary: {
          totalPorts: portsToTest.length,
          successfulPorts: successfulPorts.length,
          recommendedPorts: successfulPorts.map(r => r.port)
        },
        message: successfulPorts.length > 0 
          ? `Found printer on ports: ${successfulPorts.map(r => r.port).join(', ')}`
          : `No printer services found on common ports`
      });
    } catch (error) {
      console.error("Error in printer diagnosis:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to diagnose printer",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/printer-configurations/queue-status", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Import network printer bridge dynamically
      const { networkPrinterBridge } = await import('./network-printer-bridge');
      
      const queueStatus = networkPrinterBridge.getQueueStatus();

      res.json({
        success: true,
        queueCount: queueStatus.jobCount,
        pendingJobs: queueStatus.jobs.map(job => ({
          id: job.id,
          printerType: job.printerType,
          timestamp: job.timestamp,
          retries: job.retries,
          printerName: job.printerConfig.printerName,
          ipAddress: job.printerConfig.ipAddress
        }))
      });
    } catch (error) {
      console.error("Error getting print queue status:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to get queue status",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post("/api/printer-configurations/test-print", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const { configId, testContent } = req.body;
      
      if (!configId) {
        return res.status(400).json({ 
          success: false, 
          message: "Printer configuration ID is required" 
        });
      }

      // Get printer configuration
      const config = await storage.getPrinterConfiguration(configId);
      if (!config) {
        return res.status(404).json({ 
          success: false, 
          message: "Printer configuration not found" 
        });
      }

      // Check permissions
      if (user.role !== "superadmin" && user.branchId !== config.branchId) {
        return res.status(403).json({ 
          success: false, 
          message: "Insufficient permissions" 
        });
      }

      const content = testContent || `
TEST PRINT
${config.printerName}
${config.printerType.toUpperCase()} Printer Test
==========================================
Date: ${new Date().toLocaleString()}
IP: ${config.ipAddress}:${config.port}
Paper: ${config.paperWidth}mm
==========================================
This is a test print to verify
your thermal printer is working
correctly with the restaurant
management system.

✓ Connection successful
✓ Print formatting correct  
✓ Ready for operation

Thank you!
`;

      // Import network printer bridge and send test print
      const { networkPrinterBridge } = await import('./network-printer-bridge');
      
      const testPrintJob = {
        id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        printerType: config.printerType as 'kot' | 'bot' | 'billing',
        content,
        printerConfig: config,
        timestamp: new Date(),
        retries: 0
      };

      console.log(`🖨️  Sending test print to ${config.printerName} (${config.ipAddress}:${config.port})`);

      const result = await networkPrinterBridge.sendPrintJobToNetwork(testPrintJob);
      
      if (result.success) {
        console.log(`✅ Test print successful to ${config.printerName}`);
      } else {
        console.log(`❌ Test print failed to ${config.printerName}: ${result.message}`);
      }

      res.json({
        success: result.success,
        message: result.message,
        printerName: config.printerName,
        ipAddress: config.ipAddress,
        port: config.port,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error sending test print:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to send test print",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // QR Order System Routes
  app.get("/api/order/info/:token", async (req: any, res) => {
    try {
      const token = req.params.token;

      // Validate QR token and get location info
      const locationInfo = await QRService.validateQRToken(token);
      if (!locationInfo) {
        return res.status(404).json({ message: "Invalid QR code" });
      }

      // Check hotel opening hours FIRST - before any other processing
      const hotelSettings = await storage.getHotelSettings(locationInfo.branchId);
      if (hotelSettings && hotelSettings.openingTime && hotelSettings.closingTime) {
        const now = new Date();
        const timeZone = hotelSettings.timeZone || "Asia/Kathmandu";
        
        // Get current time in hotel's timezone
        const currentTime = new Intl.DateTimeFormat("en-GB", {
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(now);

        // Convert 12-hour format to 24-hour format if needed
        const convertTo24Hour = (timeStr: string): string => {
          if (!timeStr) return timeStr;
          
          // Check if time contains AM/PM
          const ampmMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (ampmMatch) {
            let hours = parseInt(ampmMatch[1]);
            const minutes = ampmMatch[2];
            const ampm = ampmMatch[3].toUpperCase();
            
            if (ampm === 'AM') {
              if (hours === 12) hours = 0; // 12:XX AM becomes 00:XX
            } else {
              if (hours !== 12) hours += 12; // PM hours except 12:XX PM
            }
            
            return `${hours.toString().padStart(2, '0')}:${minutes}`;
          }
          
          // Already in 24-hour format or invalid format
          return timeStr;
        };

        const openingTime24 = convertTo24Hour(hotelSettings.openingTime);
        const closingTime24 = convertTo24Hour(hotelSettings.closingTime);

        // Convert times to minutes for comparison
        const timeToMinutes = (timeStr: string) => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        };

        const currentMinutes = timeToMinutes(currentTime);
        const openingMinutes = timeToMinutes(openingTime24);
        const closingMinutes = timeToMinutes(closingTime24);

        let isOpen = false;
        if (closingMinutes > openingMinutes) {
          // Normal hours (e.g., 06:00 - 23:00)
          isOpen = currentMinutes >= openingMinutes && currentMinutes <= closingMinutes;
        } else {
          // Overnight hours (e.g., 22:00 - 06:00)
          isOpen = currentMinutes >= openingMinutes || currentMinutes <= closingMinutes;
        }

        if (!isOpen) {
          return res.status(423).json({
            message: "We are Currently Closed. Please Proceed During Opening Hours",
            openingTime: hotelSettings.openingTime,
            closingTime: hotelSettings.closingTime,
            currentTime,
            isOpen: false
          });
        }
      }

      // Check for active reservation if it's a room
      let activeReservation = null;
      if (locationInfo.type === "room") {
        activeReservation = await storage.getActiveReservationByRoom(
          locationInfo.id,
        );

        // If no active reservation, return limited info
        if (!activeReservation) {
          return res.json({
            location: locationInfo,
            hasActiveReservation: false,
            message:
              "This room has no active reservation. Please contact the front desk.",
          });
        }
      }

      // Get menu data for the branch
      const categories = await restaurantStorage.getMenuCategories(
        locationInfo.branchId,
      );
      const dishes = await restaurantStorage.getMenuDishes(
        locationInfo.branchId,
      );

      const response = {
        location: locationInfo,
        hasActiveReservation:
          locationInfo.type === "table" ? true : !!activeReservation,
        activeReservation: activeReservation
          ? {
              id: activeReservation.id,
              confirmationNumber: activeReservation.confirmationNumber,
              status: activeReservation.status,
              guest: {
                firstName: activeReservation.guest.firstName,
                lastName: activeReservation.guest.lastName,
                phone: activeReservation.guest.phone,
                email: activeReservation.guest.email,
              },
            }
          : null,
        menu: {
          categories,
          dishes,
        },
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching order info:", error);
      res.status(500).json({ message: "Failed to fetch order information" });
    }
  });

  // Phone verification endpoint for room orders
  app.post("/api/order/verify-phone/:token", async (req: any, res) => {
    try {
      const token = req.params.token;
      const { phone } = req.body;

      if (!phone || typeof phone !== "string") {
        return res.status(400).json({ message: "Phone number is required" });
      }

      // Validate QR token and get location info
      const locationInfo = await QRService.validateQRToken(token);
      if (!locationInfo) {
        return res.status(404).json({ message: "Invalid QR code" });
      }

      // Check hotel opening hours
      const hotelSettings = await storage.getHotelSettings();
      if (hotelSettings && hotelSettings.openingTime && hotelSettings.closingTime) {
        const now = new Date();
        const timeZone = hotelSettings.timeZone || "Asia/Kathmandu";
        
        // Get current time in hotel's timezone
        const currentTime = new Intl.DateTimeFormat("en-GB", {
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(now);

        // Convert 12-hour format to 24-hour format if needed
        const convertTo24Hour = (timeStr: string): string => {
          if (!timeStr) return timeStr;
          
          // Check if time contains AM/PM
          const ampmMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (ampmMatch) {
            let hours = parseInt(ampmMatch[1]);
            const minutes = ampmMatch[2];
            const ampm = ampmMatch[3].toUpperCase();
            
            if (ampm === 'AM') {
              if (hours === 12) hours = 0; // 12:XX AM becomes 00:XX
            } else {
              if (hours !== 12) hours += 12; // PM hours except 12:XX PM
            }
            
            return `${hours.toString().padStart(2, '0')}:${minutes}`;
          }
          
          // Already in 24-hour format or invalid format
          return timeStr;
        };

        const openingTime24 = convertTo24Hour(hotelSettings.openingTime);
        const closingTime24 = convertTo24Hour(hotelSettings.closingTime);

        // Convert times to minutes for comparison
        const timeToMinutes = (timeStr: string) => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        };

        const currentMinutes = timeToMinutes(currentTime);
        const openingMinutes = timeToMinutes(openingTime24);
        const closingMinutes = timeToMinutes(closingTime24);

        let isOpen = false;
        if (closingMinutes > openingMinutes) {
          // Normal hours (e.g., 06:00 - 23:00)
          isOpen = currentMinutes >= openingMinutes && currentMinutes <= closingMinutes;
        } else {
          // Overnight hours (e.g., 22:00 - 06:00)
          isOpen = currentMinutes >= openingMinutes || currentMinutes <= closingMinutes;
        }

        if (!isOpen) {
          return res.status(423).json({
            message: "We are Currently Closed. Please Proceed During Opening Hours",
            openingTime: hotelSettings.openingTime,
            closingTime: hotelSettings.closingTime,
            currentTime,
            isOpen: false
          });
        }
      }

      // Only allow phone verification for room orders
      if (locationInfo.type !== "room") {
        return res.status(400).json({
          message: "Phone verification only required for room orders",
        });
      }

      // Check for active reservation
      const activeReservation = await storage.getActiveReservationByRoom(
        locationInfo.id,
      );
      if (!activeReservation) {
        return res.status(404).json({
          message:
            "No active reservation found for this room. Please contact the front desk.",
        });
      }

      // Normalize phone numbers for comparison (remove spaces, dashes, etc.)
      const normalizePhone = (phoneNumber: string) => {
        return phoneNumber.replace(/\D/g, "").slice(-10); // Take last 10 digits
      };

      const inputPhone = normalizePhone(phone);
      const reservationPhone = normalizePhone(activeReservation.guest.phone);

      if (inputPhone !== reservationPhone) {
        return res.status(400).json({
          message:
            "Phone number does not match the reservation. Please contact the front desk if you need assistance.",
        });
      }

      // Phone verified successfully, return menu data
      const categories = await restaurantStorage.getMenuCategories(
        locationInfo.branchId,
      );
      const dishes = await restaurantStorage.getMenuDishes(
        locationInfo.branchId,
      );

      const response = {
        verified: true,
        location: locationInfo,
        activeReservation: {
          id: activeReservation.id,
          confirmationNumber: activeReservation.confirmationNumber,
          status: activeReservation.status,
          guest: {
            firstName: activeReservation.guest.firstName,
            lastName: activeReservation.guest.lastName,
            phone: activeReservation.guest.phone,
            email: activeReservation.guest.email,
          },
        },
        menu: {
          categories,
          dishes,
        },
      };

      res.json(response);
    } catch (error) {
      console.error("Error verifying phone:", error);
      res.status(500).json({ message: "Failed to verify phone number" });
    }
  });

  app.get("/api/order/existing/:token", async (req: any, res) => {
    try {
      const token = req.params.token;

      // Validate QR token and get location info
      const locationInfo = await QRService.validateQRToken(token);
      if (!locationInfo) {
        return res.status(404).json({ message: "Invalid QR code" });
      }

      // Find existing order for this location
      let existingOrder = null;

      if (locationInfo.type === "table") {
        // For tables, find the most recent active order
        const orders = await restaurantStorage.getRestaurantOrders(
          locationInfo.branchId,
        );
        existingOrder = orders.find(
          (order) =>
            order.tableId === locationInfo.id &&
            order.status !== "completed" &&
            order.status !== "cancelled",
        );
      } else if (locationInfo.type === "room") {
        // For rooms, find order associated with active reservation
        const activeReservation = await storage.getActiveReservationByRoom(
          locationInfo.id,
        );
        if (activeReservation) {
          const orders = await restaurantStorage.getRestaurantOrders(
            locationInfo.branchId,
          );
          existingOrder = orders.find(
            (order) =>
              order.reservationId === activeReservation.id &&
              order.status !== "completed" &&
              order.status !== "cancelled",
          );
        }
      }

      if (existingOrder) {
        // Get order items
        const items = await restaurantStorage.getRestaurantOrderItems(
          existingOrder.id,
        );

        res.json({
          id: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
          status: existingOrder.status,
          customerName: existingOrder.customerName,
          customerPhone: existingOrder.customerPhone,
          notes: existingOrder.notes,
          createdAt: existingOrder.createdAt,
          items,
        });
      } else {
        res.status(404).json({ message: "No existing order found" });
      }
    } catch (error) {
      console.error("Error fetching existing order:", error);
      res.status(500).json({ message: "Failed to fetch existing order" });
    }
  });

  app.post("/api/order/submit/:token", async (req: any, res) => {
    try {
      const token = req.params.token;
      const { items, customerName, customerPhone, notes } = req.body;

      // Validate QR token
      const locationInfo = await QRService.validateQRToken(token);
      if (!locationInfo) {
        return res.status(404).json({ message: "Invalid QR code" });
      }

      // Check hotel opening hours
      const hotelSettings = await storage.getHotelSettings(locationInfo.branchId);
      if (hotelSettings && hotelSettings.openingTime && hotelSettings.closingTime) {
        const now = new Date();
        const timeZone = hotelSettings.timeZone || "Asia/Kathmandu";
        
        // Get current time in hotel's timezone
        const currentTime = new Intl.DateTimeFormat("en-GB", {
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(now);

        // Convert 12-hour format to 24-hour format if needed
        const convertTo24Hour = (timeStr: string): string => {
          if (!timeStr) return timeStr;
          
          // Check if time contains AM/PM
          const ampmMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (ampmMatch) {
            let hours = parseInt(ampmMatch[1]);
            const minutes = ampmMatch[2];
            const ampm = ampmMatch[3].toUpperCase();
            
            if (ampm === 'AM') {
              if (hours === 12) hours = 0; // 12:XX AM becomes 00:XX
            } else {
              if (hours !== 12) hours += 12; // PM hours except 12:XX PM
            }
            
            return `${hours.toString().padStart(2, '0')}:${minutes}`;
          }
          
          // Already in 24-hour format or invalid format
          return timeStr;
        };

        const openingTime24 = convertTo24Hour(hotelSettings.openingTime);
        const closingTime24 = convertTo24Hour(hotelSettings.closingTime);

        // Convert times to minutes for comparison
        const timeToMinutes = (timeStr: string) => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        };

        const currentMinutes = timeToMinutes(currentTime);
        const openingMinutes = timeToMinutes(openingTime24);
        const closingMinutes = timeToMinutes(closingTime24);

        let isOpen = false;
        if (closingMinutes > openingMinutes) {
          // Normal hours (e.g., 06:00 - 23:00)
          isOpen = currentMinutes >= openingMinutes && currentMinutes <= closingMinutes;
        } else {
          // Overnight hours (e.g., 22:00 - 06:00)
          isOpen = currentMinutes >= openingMinutes || currentMinutes <= closingMinutes;
        }

        if (!isOpen) {
          return res.status(423).json({
            message: "We are Currently Closed. Please Proceed During Opening Hours",
            openingTime: hotelSettings.openingTime,
            closingTime: hotelSettings.closingTime,
            currentTime,
            isOpen: false
          });
        }
      }

      // For rooms, ensure there's an active reservation
      if (locationInfo.type === "room") {
        const activeReservation = await storage.getActiveReservationByRoom(
          locationInfo.id,
        );
        if (!activeReservation) {
          return res.status(400).json({
            message:
              "No active reservation found for this room. Please contact front desk.",
          });
        }

        // Calculate total
        const dishes = await restaurantStorage.getMenuDishes(
          locationInfo.branchId,
        );
        let totalAmount = 0;
        const orderItems = items.map((item: any) => {
          const dish = dishes.find((d) => d.id === item.dishId);
          if (!dish) throw new Error(`Dish ${item.dishId} not found`);

          const itemTotal = parseFloat(dish.price) * item.quantity;
          totalAmount += itemTotal;

          return {
            dishId: item.dishId,
            quantity: item.quantity,
            unitPrice: dish.price,
            totalPrice: itemTotal.toFixed(2),
            specialInstructions: item.specialInstructions || null,
          };
        });

        // Create order
        const orderNumber = `ORD-${Date.now()}`;
        const order = await restaurantStorage.createRestaurantOrder(
          {
            orderNumber,
            branchId: locationInfo.branchId,
            tableId: null,
            roomId: locationInfo.id,
            reservationId: activeReservation.id,
            orderType: "room_service",
            status: "pending",
            subtotal: totalAmount.toFixed(2),
            totalAmount: totalAmount.toFixed(2),
            customerName: `${activeReservation.guest.firstName} ${activeReservation.guest.lastName}`,
            customerPhone: activeReservation.guest.phone,
            notes,
            createdById: null,
          },
          orderItems,
        );

        res.json({
          orderId: order.id,
          orderNumber: order.orderNumber,
          message: "Order placed successfully",
        });
      } else {
        // Table order
        if (!customerName || !customerPhone) {
          return res.status(400).json({
            message: "Customer name and phone are required for table orders",
          });
        }

        // Calculate total
        const dishes = await restaurantStorage.getMenuDishes(
          locationInfo.branchId,
        );
        let totalAmount = 0;
        const orderItems = items.map((item: any) => {
          const dish = dishes.find((d) => d.id === item.dishId);
          if (!dish) throw new Error(`Dish ${item.dishId} not found`);

          const itemTotal = parseFloat(dish.price) * item.quantity;
          totalAmount += itemTotal;

          return {
            dishId: item.dishId,
            quantity: item.quantity,
            unitPrice: dish.price,
            totalPrice: itemTotal.toFixed(2),
            specialInstructions: item.specialInstructions || null,
          };
        });

        // Update table status to occupied
        await restaurantStorage.updateRestaurantTable(locationInfo.id, {
          status: "occupied",
        });

        // Create order
        const orderNumber = `ORD-${Date.now()}`;
        const order = await restaurantStorage.createRestaurantOrder(
          {
            orderNumber,
            branchId: locationInfo.branchId,
            tableId: locationInfo.id,
            roomId: null,
            reservationId: null,
            orderType: "dine_in",
            status: "pending",
            subtotal: totalAmount.toFixed(2),
            totalAmount: totalAmount.toFixed(2),
            customerName,
            customerPhone,
            notes,
            createdById: null,
          },
          orderItems,
        );

        res.json({
          orderId: order.id,
          orderNumber: order.orderNumber,
          message: "Order placed successfully",
        });
      }
    } catch (error) {
      console.error("Error submitting order:", error);
      res.status(500).json({
        message: error.message || "Failed to submit order",
      });
    }
  });

  app.get("/api/order/existing/:token", async (req: any, res) => {
    try {
      const token = req.params.token;

      // Validate QR token
      const locationInfo = await QRService.validateQRToken(token);
      if (!locationInfo) {
        return res.status(404).json({ message: "Invalid QR code" });
      }

      // For rooms, check if there's an active reservation
      if (locationInfo.type === "room") {
        const activeReservation = await storage.getActiveReservationByRoom(
          locationInfo.id,
        );
        if (!activeReservation) {
          return res
            .status(404)
            .json({ message: "No active reservation found" });
        }

        // Find existing orders for this reservation
        const orders = await restaurantStorage.getRestaurantOrders(
          locationInfo.branchId,
        );
        const roomOrder = orders.find(
          (order) =>
            order.orderType === "room" &&
            order.reservationId === activeReservation.id &&
            order.status !== "completed",
        );

        if (!roomOrder) {
          return res.status(404).json({ message: "No existing order found" });
        }

        // Get order items
        const items = await restaurantStorage.getRestaurantOrderItems(
          roomOrder.id,
        );

        return res.json({
          id: roomOrder.id,
          orderNumber: roomOrder.orderNumber,
          status: roomOrder.status,
          totalAmount: roomOrder.totalAmount,
          customerName: roomOrder.customerName,
          customerPhone: roomOrder.customerPhone,
          notes: roomOrder.notes,
          createdAt: roomOrder.createdAt,
          items: items.map((item) => ({
            dishId: item.dishId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            specialInstructions: item.specialInstructions,
            dish: item.dish,
          })),
        });
      }

      // For tables, use existing logic
      const tables = await restaurantStorage.getRestaurantTables(
        locationInfo.branchId,
      );
      const table = tables.find((t) => t.qrToken === token);
      if (!table) {
        return res.status(404).json({ message: "Table not found" });
      }

      const orders = await restaurantStorage.getRestaurantOrders(
        locationInfo.branchId,
      );
      const tableOrder = orders.find(
        (order) => order.tableId === table.id && order.status !== "completed",
      );

      if (!tableOrder) {
        return res.status(404).json({ message: "No existing order found" });
      }

      const items = await restaurantStorage.getRestaurantOrderItems(
        tableOrder.id,
      );

      res.json({
        id: tableOrder.id,
        orderNumber: tableOrder.orderNumber,
        status: tableOrder.status,
        totalAmount: tableOrder.totalAmount,
        customerName: tableOrder.customerName,
        customerPhone: tableOrder.customerPhone,
        notes: tableOrder.notes,
        createdAt: tableOrder.createdAt,
        items: items.map((item) => ({
          dishId: item.dishId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          specialInstructions: item.specialInstructions,
          dish: item.dish,
        })),
      });
    } catch (error) {
      console.error("Error fetching existing order:", error);
      res.status(500).json({ message: "Failed to fetch existing order" });
    }
  });



  app.put("/api/order/update/:orderId", async (req: any, res) => {
    try {
      const orderId = req.params.orderId;
      const { items, notes } = req.body;

      // Get existing order
      const existingOrder = await restaurantStorage.getRestaurantOrder(orderId);
      if (!existingOrder) {
        return res.status(404).json({ message: "Order not found" });
      }

      // For room orders, check if reservation is still active
      if (existingOrder.orderType === "room" && existingOrder.reservationId) {
        const reservation = await storage.getReservation(
          existingOrder.reservationId,
        );
        if (!reservation || reservation.status !== "checked-in") {
          return res.status(400).json({
            message: "Cannot modify order - guest has checked out",
          });
        }
      }

      // Check if order can be modified (within 2 minutes or status is pending)
      const orderAge =
        (new Date().getTime() - new Date(existingOrder.createdAt).getTime()) /
        (1000 * 60);
      if (orderAge > 2 && existingOrder.status !== "pending") {
        return res.status(400).json({
          message:
            "Order cannot be modified after 2 minutes or if already confirmed",
        });
      }

      // Calculate new total
      const dishes = await restaurantStorage.getMenuDishes(
        existingOrder.branchId,
      );
      let totalAmount = 0;
      const orderItems = items.map((item: any) => {
        const dish = dishes.find((d) => d.id === item.dishId);
        if (!dish) throw new Error(`Dish ${item.dishId} not found`);

        const itemTotal = parseFloat(dish.price) * item.quantity;
        totalAmount += itemTotal;

        return {
          dishId: item.dishId,
          quantity: item.quantity,
          unitPrice: dish.price,
          totalPrice: itemTotal.toString(),
          specialInstructions: item.specialInstructions || "",
        };
      });

      // Update order
      await restaurantStorage.updateRestaurantOrder(orderId, {
        subtotal: totalAmount.toString(),
        totalAmount: totalAmount.toString(),
        notes: notes || existingOrder.notes,
      });

      // Replace order items
      await restaurantStorage.replaceOrderItems(orderId, orderItems);

      res.json({
        orderId: orderId,
        orderNumber: existingOrder.orderNumber,
        message: "Order updated successfully",
      });
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  app.post("/api/order/clear/:token", async (req: any, res) => {
    try {
      const token = req.params.token;

      // Validate QR token
      const locationInfo = await QRService.validateQRToken(token);
      if (!locationInfo) {
        return res.status(404).json({ message: "Invalid QR code" });
      }

      if (locationInfo.type === "table") {
        // Clear table orders
        const orders = await restaurantStorage.getRestaurantOrders(
          locationInfo.branchId,
        );
        const tableOrders = orders.filter(
          (order) => order.tableId === locationInfo.id,
        );

        for (const order of tableOrders) {
          await restaurantStorage.updateRestaurantOrderStatus(
            order.id,
            "completed",
          );
        }
      }

      res.json({ message: "Orders cleared successfully" });
    } catch (error) {
      console.error("Error clearing orders:", error);
      res.status(500).json({ message: "Failed to clear orders" });
    }
  });

  // Notification history routes
  app.get(
    "/api/notifications/history",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        // Only allow admin users to view notification history
        if (user.role !== "superadmin" && user.role !== "branch-admin") {
          return res.status(403).json({
            message: "Only admin users can view notification history",
          });
        }

        const limit = parseInt(req.query.limit as string) || 50;
        const notifications = await storage.getNotificationHistory(
          user.id,
          limit,
        );

        res.json(notifications);
      } catch (error) {
        console.error("Error fetching notification history:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch notification history" });
      }
    },
  );

  app.patch(
    "/api/notifications/history/:id/read",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const notificationId = parseInt(req.params.id);
        await storage.markNotificationAsRead(notificationId, user.id);

        res.json({ message: "Notification marked as read" });
      } catch (error) {
        console.error("Error marking notification as read:", error);
        res
          .status(500)
          .json({ message: "Failed to mark notification as read" });
      }
    },
  );

  app.patch(
    "/api/notifications/history/read-all",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        await storage.markAllNotificationsAsRead(user.id);

        res.json({ message: "All notifications marked as read" });
      } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res
          .status(500)
          .json({ message: "Failed to mark all notifications as read" });
      }
    },
  );

  app.get(
    "/api/notifications/unread-count",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        // Only allow admin users to view unread count
        if (user.role !== "superadmin" && user.role !== "branch-admin") {
          return res
            .status(403)
            .json({ message: "Only admin users can view notification count" });
        }

        const count = await storage.getUnreadNotificationCount(user.id);

        res.json({ count });
      } catch (error) {
        console.error("Error fetching unread notification count:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch unread notification count" });
      }
    },
  );

  // Restaurant Management System (RMS) Routes

  // Restaurant Tables
  app.get("/api/restaurant/tables", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const branchId = user.role === "superadmin" ? undefined : user.branchId!;
      const tables = await restaurantStorage.getRestaurantTables(branchId);
      res.json(tables);
    } catch (error) {
      console.error("Error fetching restaurant tables:", error);
      res.status(500).json({ message: "Failed to fetch restaurant tables" });
    }
  });

  app.post("/api/restaurant/tables", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const tableData = insertRestaurantTableSchema.parse({
        ...req.body,
        qrToken: req.body.qrToken || crypto.randomUUID(),
      });

      if (
        !checkBranchPermissions(user.role, user.branchId, tableData.branchId)
      ) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this branch" });
      }

      const table = await restaurantStorage.createRestaurantTable(tableData);
      broadcastDataChange(
        "restaurant-tables",
        "created",
        table,
        table.branchId?.toString(),
      );
      res.status(201).json(table);
    } catch (error) {
      console.error("Error creating restaurant table:", error);
      res.status(500).json({ message: "Failed to create restaurant table" });
    }
  });

  // Bulk create tables
  app.post(
    "/api/restaurant/tables/bulk",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const { tables } = req.body;
        if (!Array.isArray(tables) || tables.length === 0) {
          return res.status(400).json({ message: "Tables array is required" });
        }

        const validatedTables = tables.map((table) =>
          insertRestaurantTableSchema.parse({
            ...table,
            qrToken: table.qrToken || crypto.randomUUID(),
          }),
        );

        // Check permissions for all tables
        for (const table of validatedTables) {
          if (
            !checkBranchPermissions(user.role, user.branchId, table.branchId)
          ) {
            return res.status(403).json({
              message: "Insufficient permissions for one or more tables",
            });
          }
        }

        const createdTables =
          await restaurantStorage.createRestaurantTablesBulk(validatedTables);

        // Broadcast each created table
        for (const table of createdTables) {
          broadcastDataChange(
            "restaurant-tables",
            "created",
            table,
            table.branchId?.toString(),
          );
        }

        res.status(201).json(createdTables);
      } catch (error) {
        console.error("Error creating restaurant tables in bulk:", error);
        res.status(500).json({ message: "Failed to create restaurant tables" });
      }
    },
  );

  app.put(
    "/api/restaurant/tables/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const tableId = parseInt(req.params.id);
        const tableData = insertRestaurantTableSchema.partial().parse(req.body);

        const existingTable =
          await restaurantStorage.getRestaurantTable(tableId);
        if (
          !existingTable ||
          !checkBranchPermissions(
            user.role,
            user.branchId,
            existingTable.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this table" });
        }

        const table = await restaurantStorage.updateRestaurantTable(
          tableId,
          tableData,
        );
        broadcastDataChange(
          "restaurant-tables",
          "updated",
          table,
          table.branchId?.toString(),
        );
        res.json(table);
      } catch (error) {
        console.error("Error updating restaurant table:", error);
        res.status(500).json({ message: "Failed to update restaurant table" });
      }
    },
  );

  app.delete(
    "/api/restaurant/tables/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        // Check delete permission for restaurant-tables module
        const hasDeletePermission = await checkUserPermission(
          req.session.user.id,
          "restaurant-tables",
          "delete",
        );
        if (!hasDeletePermission) {
          return res.status(403).json({
            message: "Insufficient permissions to delete restaurant tables",
          });
        }

        const tableId = parseInt(req.params.id);

        const existingTable =
          await restaurantStorage.getRestaurantTable(tableId);
        if (
          !existingTable ||
          !checkBranchPermissions(
            user.role,
            user.branchId,
            existingTable.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this table" });
        }

        await restaurantStorage.deleteRestaurantTable(tableId);
        broadcastDataChange(
          "restaurant-tables",
          "deleted",
          { id: tableId },
          existingTable.branchId?.toString(),
        );
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting restaurant table:", error);
        res.status(500).json({ message: "Failed to delete restaurant table" });
      }
    },
  );

  // Menu Categories
  app.get(
    "/api/restaurant/categories",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const categories = await restaurantStorage.getMenuCategories(branchId);
        res.json(categories);
      } catch (error) {
        console.error("Error fetching menu categories:", error);
        res.status(500).json({ message: "Failed to fetch menu categories" });
      }
    },
  );

  app.post(
    "/api/restaurant/categories",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        // Sanitize input data
        const sanitizedBody = sanitizeInput(req.body);
        const categoryData = insertMenuCategorySchema.parse(sanitizedBody);

        if (
          !checkBranchPermissions(
            user.role,
            user.branchId,
            categoryData.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this branch" });
        }

        const category =
          await restaurantStorage.createMenuCategory(categoryData);
        broadcastDataChange(
          "restaurant-categories",
          "created",
          category,
          category.branchId?.toString(),
        );
        res.status(201).json(category);
      } catch (error) {
        console.error("Error creating menu category:", error);
        res.status(500).json({ message: "Failed to create menu category" });
      }
    },
  );

  // Bulk create categories
  app.post(
    "/api/restaurant/categories/bulk",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const { categories } = req.body;
        if (!Array.isArray(categories) || categories.length === 0) {
          return res
            .status(400)
            .json({ message: "Categories array is required" });
        }

        const validatedCategories = categories.map((category) =>
          insertMenuCategorySchema.parse(category),
        );

        // Check permissions for all categories
        for (const category of validatedCategories) {
          if (
            !checkBranchPermissions(user.role, user.branchId, category.branchId)
          ) {
            return res.status(403).json({
              message: "Insufficient permissions for one or more categories",
            });
          }
        }

        const createdCategories =
          await restaurantStorage.createMenuCategoriesBulk(validatedCategories);

        // Broadcast each created category
        for (const category of createdCategories) {
          broadcastDataChange(
            "restaurant-categories",
            "created",
            category,
            category.branchId?.toString(),
          );
        }

        res.status(201).json(createdCategories);
      } catch (error) {
        console.error("Error creating menu categories in bulk:", error);
        res.status(500).json({ message: "Failed to create menu categories" });
      }
    },
  );

  app.put(
    "/api/restaurant/categories/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const categoryId = parseInt(req.params.id);
        const categoryData = insertMenuCategorySchema.partial().parse(req.body);

        const existingCategory =
          await restaurantStorage.getMenuCategory(categoryId);
        if (
          !existingCategory ||
          !checkBranchPermissions(
            user.role,
            user.branchId,
            existingCategory.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this category" });
        }

        const category = await restaurantStorage.updateMenuCategory(
          categoryId,
          categoryData,
        );
        broadcastDataChange(
          "restaurant-categories",
          "updated",
          category,
          category.branchId?.toString(),
        );
        res.json(category);
      } catch (error) {
        console.error("Error updating menu category:", error);
        res.status(500).json({ message: "Failed to update menu category" });
      }
    },
  );

  app.delete(
    "/api/restaurant/categories/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        // Check delete permission for restaurant-categories module
        const hasDeletePermission = await checkUserPermission(
          req.session.user.id,
          "restaurant-categories",
          "delete",
        );
        if (!hasDeletePermission) {
          return res.status(403).json({
            message: "Insufficient permissions to delete menu categories",
          });
        }

        const categoryId = parseInt(req.params.id);

        const existingCategory =
          await restaurantStorage.getMenuCategory(categoryId);
        if (
          !existingCategory ||
          !checkBranchPermissions(
            user.role,
            user.branchId,
            existingCategory.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this category" });
        }

        await restaurantStorage.deleteMenuCategory(categoryId);
        broadcastDataChange(
          "restaurant-categories",
          "deleted",
          { id: categoryId },
          existingCategory.branchId?.toString(),
        );
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting menu category:", error);
        res.status(500).json({ message: "Failed to delete menu category" });
      }
    },
  );

  // Menu Dishes
  app.get("/api/restaurant/dishes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const branchId = user.role === "superadmin" ? undefined : user.branchId!;
      const categoryId = req.query.categoryId
        ? parseInt(req.query.categoryId as string)
        : undefined;
      const dishes = await restaurantStorage.getMenuDishes(
        branchId,
        categoryId,
      );
      res.json(dishes);
    } catch (error) {
      console.error("Error fetching menu dishes:", error);
      res.status(500).json({ message: "Failed to fetch menu dishes" });
    }
  });

  app.post("/api/restaurant/dishes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Sanitize input data
      const sanitizedBody = sanitizeInput(req.body);
      const dishData = insertMenuDishSchema.parse(sanitizedBody);

      if (
        !checkBranchPermissions(user.role, user.branchId, dishData.branchId)
      ) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this branch" });
      }

      const dish = await restaurantStorage.createMenuDish(dishData);
      broadcastDataChange(
        "restaurant-dishes",
        "created",
        dish,
        dish.branchId?.toString(),
      );
      res.status(201).json(dish);
    } catch (error) {
      console.error("Error creating menu dish:", error);
      res.status(500).json({ message: "Failed to create menu dish" });
    }
  });

  // Bulk create dishes
  app.post(
    "/api/restaurant/dishes/bulk",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const { dishes } = req.body;
        if (!Array.isArray(dishes) || dishes.length === 0) {
          return res.status(400).json({ message: "Dishes array is required" });
        }

        const validatedDishes = dishes.map((dish) =>
          insertMenuDishSchema.parse(dish),
        );

        // Check permissions for all dishes
        for (const dish of validatedDishes) {
          if (
            !checkBranchPermissions(user.role, user.branchId, dish.branchId)
          ) {
            return res.status(403).json({
              message: "Insufficient permissions for one or more dishes",
            });
          }
        }

        const createdDishes =
          await restaurantStorage.createMenuDishesBulk(validatedDishes);

        // Broadcast each created dish
        for (const dish of createdDishes) {
          broadcastDataChange(
            "restaurant-dishes",
            "created",
            dish,
            dish.branchId?.toString(),
          );
        }

        res.status(201).json(createdDishes);
      } catch (error) {
        console.error("Error creating menu dishes in bulk:", error);
        res.status(500).json({ message: "Failed to create menu dishes" });
      }
    },
  );

  app.get(
    "/api/restaurant/dishes/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const dishId = parseInt(req.params.id);
        const dish = await restaurantStorage.getMenuDish(dishId);

        if (!dish) {
          return res.status(404).json({ message: "Dish not found" });
        }

        if (!checkBranchPermissions(user.role, user.branchId, dish.branchId)) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this dish" });
        }

        res.json(dish);
      } catch (error) {
        console.error("Error fetching menu dish:", error);
        res.status(500).json({ message: "Failed to fetch menu dish" });
      }
    },
  );

  app.put(
    "/api/restaurant/dishes/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const dishId = parseInt(req.params.id);
        const dishData = insertMenuDishSchema.partial().parse(req.body);

        const existingDish = await restaurantStorage.getMenuDish(dishId);
        if (
          !existingDish ||
          !checkBranchPermissions(
            user.role,
            user.branchId,
            existingDish.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this dish" });
        }

        const dish = await restaurantStorage.updateMenuDish(dishId, dishData);
        broadcastDataChange(
          "restaurant-dishes",
          "updated",
          dish,
          dish.branchId?.toString(),
        );
        res.json(dish);
      } catch (error) {
        console.error("Error updating menu dish:", error);
        res.status(500).json({ message: "Failed to update menu dish" });
      }
    },
  );

  app.delete(
    "/api/restaurant/dishes/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        // Check delete permission for restaurant-dishes module
        const hasDeletePermission = await checkUserPermission(
          req.session.user.id,
          "restaurant-dishes",
          "delete",
        );
        if (!hasDeletePermission) {
          return res.status(403).json({
            message: "Insufficient permissions to delete menu dishes",
          });
        }

        const dishId = parseInt(req.params.id);

        const existingDish = await restaurantStorage.getMenuDish(dishId);
        if (
          !existingDish ||
          !checkBranchPermissions(
            user.role,
            user.branchId,
            existingDish.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this dish" });
        }

        await restaurantStorage.deleteMenuDish(dishId);
        broadcastDataChange(
          "restaurant-dishes",
          "deleted",
          { id: dishId },
          existingDish.branchId?.toString(),
        );
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting menu dish:", error);
        res.status(500).json({ message: "Failed to delete menu dish" });
      }
    },
  );

  // Room Orders - Simple implementation
  app.get(
    "/api/restaurant/orders/room",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const status = req.query.status as string;

        // Get all restaurant orders with room type
        const orders = await restaurantStorage.getRestaurantOrders(
          branchId,
          status,
        );

        // Filter for room orders only
        const roomOrders = orders.filter((order) => order.orderType === "room");

        // Get items for each order and flatten dish names
        const ordersWithItems = await Promise.all(
          roomOrders.map(async (order) => {
            const items = await restaurantStorage.getRestaurantOrderItems(
              order.id,
            );
            // Flatten dish name from nested dish object
            const itemsWithDishNames = items.map(item => ({
              ...item,
              dishName: item.dish?.name || `Dish ${item.dishId}`
            }));
            return { ...order, items: itemsWithDishNames };
          }),
        );

        res.json(ordersWithItems);
      } catch (error) {
        console.error("Error fetching room orders:", error);
        res.status(500).json({ message: "Failed to fetch room orders" });
      }
    },
  );

  // Get all room orders (alias route for billing page)
  app.get("/api/room-orders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const branchId = user.role === "superadmin" ? undefined : user.branchId!;
      const status = req.query.status as string;

      // Get all restaurant orders with room type
      const orders = await restaurantStorage.getRestaurantOrders(branchId, status);

      // Filter for room orders only
      const roomOrders = orders.filter((order) => order.orderType === "room");

      // Get items for each order and flatten dish names
      const ordersWithItems = await Promise.all(
        roomOrders.map(async (order) => {
          const items = await restaurantStorage.getRestaurantOrderItems(order.id);
          // Flatten dish name from nested dish object
          const itemsWithDishNames = items.map(item => ({
            ...item,
            dishName: item.dish?.name || `Dish ${item.dishId}`
          }));
          return { ...order, items: itemsWithDishNames };
        }),
      );

      res.json(ordersWithItems);
    } catch (error) {
      console.error("Error fetching room orders:", error);
      res.status(500).json({ message: "Failed to fetch room orders" });
    }
  });

  // Get room orders for a specific reservation
  app.get(
    "/api/reservations/:reservationId/room-orders",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const { reservationId } = req.params;

        // Get all room orders for this reservation
        const orders = await db
          .select()
          .from(restaurantOrders)
          .where(
            eq(restaurantOrders.reservationId, reservationId)
          );

        // Get items for each order with dish details
        const ordersWithItems = await Promise.all(
          orders.map(async (order) => {
            const items = await db
              .select({
                id: restaurantOrderItems.id,
                dishId: restaurantOrderItems.dishId,
                quantity: restaurantOrderItems.quantity,
                unitPrice: restaurantOrderItems.unitPrice,
                totalPrice: restaurantOrderItems.totalPrice,
                specialInstructions: restaurantOrderItems.specialInstructions,
                dishName: sql`(SELECT name FROM menu_dishes WHERE id = ${restaurantOrderItems.dishId})`,
              })
              .from(restaurantOrderItems)
              .where(eq(restaurantOrderItems.orderId, order.id));
            
            return { ...order, items };
          }),
        );

        res.json(ordersWithItems);
      } catch (error) {
        console.error("Error fetching reservation room orders:", error);
        res.status(500).json({ message: "Failed to fetch reservation room orders" });
      }
    },
  );

  app.post(
    "/api/restaurant/orders/room",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const { order: orderData, items: itemsData } = req.body;

        if (
          !orderData ||
          !itemsData ||
          !Array.isArray(itemsData) ||
          itemsData.length === 0
        ) {
          return res
            .status(400)
            .json({ message: "Order data and items are required" });
        }

        // Set defaults for room order
        const orderNumber = `RM${Date.now().toString().slice(-8)}`;
        const branchId = orderData.branchId || user.branchId || 1;

        const orderWithDefaults = {
          ...orderData,
          orderNumber,
          branchId,
          orderType: "room" as any,
          createdById: user.id,
          tableId: null, // Room orders don't have tables
        };

        // Create the order
        const order = await restaurantStorage.createRestaurantOrder(
          orderWithDefaults,
          itemsData,
        );

        // Broadcast room order creation
        broadcastDataChange(
          "restaurant-orders",
          "created",
          order,
          order.branchId?.toString(),
        );

        res.status(201).json({
          id: order.id,
          orderNumber: order.orderNumber,
          message: "Room order created successfully",
        });
      } catch (error) {
        console.error("Error creating room order:", error);
        res.status(500).json({
          message: "Failed to create room order",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Restaurant Orders

  app.get("/api/restaurant/orders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const branchId = user.role === "superadmin" ? undefined : user.branchId!;
      const status = req.query.status as string;
      const orders = await restaurantStorage.getRestaurantOrders(
        branchId,
        status,
      );

      // Get order items for each order
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await restaurantStorage.getRestaurantOrderItems(
            order.id,
          );
          return { ...order, items };
        }),
      );

      res.json(ordersWithItems);
    } catch (error) {
      console.error("Error fetching restaurant orders:", error);
      res.status(500).json({ message: "Failed to fetch restaurant orders" });
    }
  });

  app.get(
    "/api/restaurant/orders/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const order = await restaurantStorage.getRestaurantOrder(req.params.id);
        if (!order) {
          return res.status(404).json({ message: "Order not found" });
        }

        if (!checkBranchPermissions(user.role, user.branchId, order.branchId)) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this order" });
        }

        const items = await restaurantStorage.getRestaurantOrderItems(order.id);
        res.json({ ...order, items });
      } catch (error) {
        console.error("Error fetching restaurant order:", error);
        res.status(500).json({ message: "Failed to fetch restaurant order" });
      }
    },
  );

  const createOrderSchema = z.object({
    order: insertRestaurantOrderSchema.omit({
      id: true,
      orderNumber: true,
      createdById: true,
    }),
    items: z.array(
      insertRestaurantOrderItemSchema.omit({
        id: true,
        orderId: true,
      }),
    ),
  });

  app.post("/api/restaurant/orders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const { order: orderData, items: itemsData } = createOrderSchema.parse(
        req.body,
      );

      if (
        !checkBranchPermissions(user.role, user.branchId, orderData.branchId)
      ) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this branch" });
      }

      let finalOrder;

      // Check if there's an existing active order for this table
      const existingOrder = await restaurantStorage.getActiveOrderForTable(
        orderData.tableId!,
        orderData.branchId!
      );

      if (existingOrder) {
        console.log("Found existing active order for table:", existingOrder.id);
        
        // Calculate new totals by adding the new items to existing total
        const currentSubtotal = parseFloat(existingOrder.subtotal || "0");
        const newItemsSubtotal = parseFloat(orderData.subtotal);
        const newSubtotal = (currentSubtotal + newItemsSubtotal).toString();
        
        const currentTotal = parseFloat(existingOrder.totalAmount || "0");
        const newItemsTotal = parseFloat(orderData.totalAmount);
        const newTotal = (currentTotal + newItemsTotal).toString();

        // Add items to existing order
        finalOrder = await restaurantStorage.addItemsToExistingOrder(
          existingOrder.id,
          itemsData,
          newSubtotal,
          newTotal
        );
        
        console.log("Items added to existing order:", finalOrder.id);
      } else {
        console.log("No existing active order found, creating new order");
        
        // Generate order number
        const orderNumber = `ORD${Date.now().toString().slice(-8)}`;
        const orderWithNumber = {
          ...orderData,
          orderNumber,
          createdById: user.id,
        };

        finalOrder = await restaurantStorage.createRestaurantOrder(
          orderWithNumber,
          itemsData,
        );
        
        console.log("New order created:", finalOrder.id);
      }

      // Broadcast order update/creation
      wsManager.broadcastDataUpdate(
        "restaurant-orders",
        orderData.branchId?.toString(),
      );
      wsManager.broadcastDataUpdate(
        "restaurant-dashboard",
        orderData.branchId?.toString(),
      );

      res.status(201).json(finalOrder);
    } catch (error) {
      console.error("Error creating/updating restaurant order:", error);
      res.status(500).json({ message: "Failed to create/update restaurant order" });
    }
  });

  // Complete order update endpoint - handles all modifications including deletions
  const updateOrderSchema = z.object({
    order: insertRestaurantOrderSchema.omit({
      id: true,
      orderNumber: true,
      createdById: true,
    }).partial(),
    items: z.array(
      insertRestaurantOrderItemSchema.omit({
        id: true,
        orderId: true,
      }),
    ),
  });

  app.put("/api/restaurant/orders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const orderId = req.params.id;
      const { order: orderData, items: itemsData } = updateOrderSchema.parse(req.body);

      // Get existing order to check permissions and modification rules
      const existingOrder = await restaurantStorage.getRestaurantOrder(orderId);
      if (!existingOrder) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (!checkBranchPermissions(user.role, user.branchId, existingOrder.branchId)) {
        return res.status(403).json({ message: "Insufficient permissions for this order" });
      }

      // For room orders, check if reservation is still active
      if (existingOrder.orderType === "room" && existingOrder.reservationId) {
        const reservation = await storage.getReservation(existingOrder.reservationId);
        if (!reservation || reservation.status !== "checked-in") {
          return res.status(400).json({
            message: "Cannot modify order - guest has checked out",
          });
        }
      }

      // Check if order can be modified (only prevent if status is completed/cancelled)
      if (existingOrder.status === "completed" || existingOrder.status === "cancelled") {
        return res.status(400).json({
          message: "Cannot modify completed or cancelled orders",
        });
      }

      // Calculate new total from all items
      const dishes = await restaurantStorage.getMenuDishes(existingOrder.branchId);
      let totalAmount = 0;
      const validatedItems = itemsData.map((item: any) => {
        const dish = dishes.find((d) => d.id === item.dishId);
        if (!dish) throw new Error(`Dish ${item.dishId} not found`);

        const itemTotal = parseFloat(dish.price) * item.quantity;
        totalAmount += itemTotal;

        return {
          dishId: item.dishId,
          quantity: item.quantity,
          unitPrice: dish.price,
          totalPrice: itemTotal.toString(),
          specialInstructions: item.specialInstructions || "",
          status: item.status || "pending",
        };
      });

      // Update order with new totals
      await restaurantStorage.updateRestaurantOrder(orderId, {
        subtotal: totalAmount.toString(),
        totalAmount: totalAmount.toString(),
        notes: orderData.notes !== undefined ? orderData.notes : existingOrder.notes,
      });

      // Replace all order items (this handles additions, deletions, and modifications)
      await restaurantStorage.replaceOrderItems(orderId, validatedItems);

      // Get updated order with items
      const updatedOrder = await restaurantStorage.getRestaurantOrder(orderId);
      const updatedItems = await restaurantStorage.getRestaurantOrderItems(orderId);

      // Broadcast order update
      wsManager.broadcastDataUpdate(
        "restaurant-orders",
        existingOrder.branchId?.toString(),
      );
      wsManager.broadcastDataUpdate(
        "restaurant-dashboard",
        existingOrder.branchId?.toString(),
      );

      res.json({
        ...updatedOrder,
        items: updatedItems,
        message: "Order updated successfully",
      });
    } catch (error) {
      console.error("Error updating restaurant order:", error);
      res.status(500).json({ message: "Failed to update restaurant order" });
    }
  });

  // Room Orders API
  app.post(
    "/api/restaurant/orders/room",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const { order: orderData, items: itemsData } = createOrderSchema.parse(
          req.body,
        );

        if (
          !checkBranchPermissions(user.role, user.branchId, orderData.branchId)
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this branch" });
        }

        let finalOrder;

        // For room orders, check by roomId instead of tableId
        if (orderData.roomId) {
          // Check if there's an existing pending order for this room
          const existingOrder = await db
            .select()
            .from(restaurantOrders)
            .where(
              and(
                eq(restaurantOrders.roomId, orderData.roomId),
                eq(restaurantOrders.branchId, orderData.branchId!),
                eq(restaurantOrders.status, "pending")
              )
            )
            .orderBy(desc(restaurantOrders.createdAt))
            .limit(1);

          if (existingOrder.length > 0) {
            console.log("Found existing pending room order:", existingOrder[0].id);
            
            // Calculate new totals
            const currentSubtotal = parseFloat(existingOrder[0].subtotal || "0");
            const newItemsSubtotal = parseFloat(orderData.subtotal);
            const newSubtotal = (currentSubtotal + newItemsSubtotal).toString();
            
            const currentTotal = parseFloat(existingOrder[0].totalAmount || "0");
            const newItemsTotal = parseFloat(orderData.totalAmount);
            const newTotal = (currentTotal + newItemsTotal).toString();

            // Add items to existing order
            finalOrder = await restaurantStorage.addItemsToExistingOrder(
              existingOrder[0].id,
              itemsData,
              newSubtotal,
              newTotal
            );
            
            console.log("Items added to existing room order:", finalOrder.id);
          } else {
            console.log("No existing pending room order found, creating new order");
            
            // Generate order number
            const orderNumber = `ROD${Date.now().toString().slice(-8)}`;
            const orderWithNumber = {
              ...orderData,
              orderNumber,
              createdById: user.id,
              orderType: "room",
            };

            finalOrder = await restaurantStorage.createRestaurantOrder(
              orderWithNumber,
              itemsData,
            );
            
            console.log("New room order created:", finalOrder.id);
          }
        } else {
          // Fallback for orders without roomId
          const orderNumber = `ROD${Date.now().toString().slice(-8)}`;
          const orderWithNumber = {
            ...orderData,
            orderNumber,
            createdById: user.id,
            orderType: "room",
          };

          finalOrder = await restaurantStorage.createRestaurantOrder(
            orderWithNumber,
            itemsData,
          );
        }

        // Broadcast order update/creation
        wsManager.broadcastDataUpdate(
          "restaurant-orders",
          orderData.branchId?.toString(),
        );
        wsManager.broadcastDataUpdate(
          "restaurant-dashboard",
          orderData.branchId?.toString(),
        );

        res.status(201).json(finalOrder);
      } catch (error) {
        console.error("Error creating/updating room order:", error);
        res.status(500).json({ message: "Failed to create/update room order" });
      }
    },
  );

  app.patch(
    "/api/restaurant/orders/:id/status",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const orderId = req.params.id;
        const { status } = req.body;

        const existingOrder =
          await restaurantStorage.getRestaurantOrder(orderId);
        if (!existingOrder) {
          return res.status(404).json({ message: "Order not found" });
        }

        if (
          !checkBranchPermissions(
            user.role,
            user.branchId,
            existingOrder.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this order" });
        }

        const order = await restaurantStorage.updateRestaurantOrderStatus(
          orderId,
          status,
          user.id,
        );

        // Note: Stock consumption is now handled during bill creation to avoid duplicates
        // Orders marked as 'completed' via billing process already have consumption processed

        // Broadcast order status update
        wsManager.broadcastDataUpdate(
          "restaurant-orders",
          existingOrder.branchId?.toString(),
        );
        wsManager.broadcastDataUpdate(
          "restaurant-kot",
          existingOrder.branchId?.toString(),
        );
        wsManager.broadcastDataUpdate(
          "restaurant-dashboard",
          existingOrder.branchId?.toString(),
        );
        if (status === "completed") {
          wsManager.broadcastDataUpdate(
            "inventory-consumption",
            existingOrder.branchId?.toString(),
          );
        }

        res.json(order);
      } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ message: "Failed to update order status" });
      }
    },
  );

  // KOT Management
  app.get("/api/restaurant/kot", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const branchId = user.role === "superadmin" ? undefined : user.branchId!;
      const status = req.query.status as string;

      const kotTickets = await restaurantStorage.getKotTickets(
        branchId,
        status,
      );
      res.json(kotTickets);
    } catch (error) {
      console.error("Error fetching KOT tickets:", error);
      res.status(500).json({ message: "Failed to fetch KOT tickets" });
    }
  });

  app.post(
    "/api/restaurant/orders/:id/kot",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const orderId = req.params.id;
        const existingOrder =
          await restaurantStorage.getRestaurantOrder(orderId);

        if (!existingOrder) {
          return res.status(404).json({ message: "Order not found" });
        }

        if (
          !checkBranchPermissions(
            user.role,
            user.branchId,
            existingOrder.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this order" });
        }

        const kotData = await restaurantStorage.generateKOT(orderId, user.id);

        // Broadcast new KOT creation
        wsManager.broadcastDataUpdate(
          "restaurant-kot",
          existingOrder.branchId?.toString(),
        );
        wsManager.broadcastDataUpdate(
          "restaurant-orders",
          existingOrder.branchId?.toString(),
        );

        res.json(kotData);
      } catch (error) {
        console.error("Error generating KOT:", error);
        res
          .status(500)
          .json({ message: error.message || "Failed to generate KOT" });
      }
    },
  );

  app.patch(
    "/api/restaurant/kot/:id/status",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const kotId = parseInt(req.params.id);
        const { status } = req.body;

        if (!status || !["preparing", "ready", "served"].includes(status)) {
          return res.status(400).json({ message: "Invalid status" });
        }

        const kotTicket = await restaurantStorage.updateKotStatus(
          kotId,
          status,
          user.id,
        );

        // Broadcast KOT status update
        wsManager.broadcastDataUpdate("restaurant-kot");
        wsManager.broadcastDataUpdate("restaurant-orders");

        res.json(kotTicket);
      } catch (error) {
        console.error("Error updating KOT status:", error);
        res.status(500).json({ message: "Failed to update KOT status" });
      }
    },
  );

  app.patch(
    "/api/restaurant/kot/:id/print",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const kotId = parseInt(req.params.id);
        const kotTicket = await restaurantStorage.markKotPrinted(kotId);
        res.json(kotTicket);
      } catch (error) {
        console.error("Error marking KOT as printed:", error);
        res.status(500).json({ message: "Failed to mark KOT as printed" });
      }
    },
  );

  app.post(
    "/api/restaurant/orders/:id/kot-bot",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const orderId = req.params.id;
        const existingOrder =
          await restaurantStorage.getRestaurantOrder(orderId);

        if (!existingOrder) {
          return res.status(404).json({ message: "Order not found" });
        }

        if (
          !checkBranchPermissions(
            user.role,
            user.branchId,
            existingOrder.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this order" });
        }

        const result = await restaurantStorage.generateKOTAndBOT(
          orderId,
          user.id,
        );

        // Broadcast updates for both KOT and BOT
        if (result.kotGenerated) {
          wsManager.broadcastDataUpdate(
            "restaurant-kot",
            existingOrder.branchId?.toString(),
          );
        }
        if (result.botGenerated) {
          wsManager.broadcastDataUpdate(
            "restaurant-bot",
            existingOrder.branchId?.toString(),
          );
        }
        wsManager.broadcastDataUpdate(
          "restaurant-orders",
          existingOrder.branchId?.toString(),
        );

        res.json(result);
      } catch (error) {
        console.error("Error generating KOT/BOT:", error);
        res
          .status(500)
          .json({ message: error.message || "Failed to generate KOT/BOT" });
      }
    },
  );

  app.post(
    "/api/restaurant/orders/:id/bot",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const orderId = req.params.id;
        const existingOrder =
          await restaurantStorage.getRestaurantOrder(orderId);

        if (!existingOrder) {
          return res.status(404).json({ message: "Order not found" });
        }

        if (
          !checkBranchPermissions(
            user.role,
            user.branchId,
            existingOrder.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this order" });
        }

        const botData = await restaurantStorage.generateBOT(orderId, user.id);

        // Broadcast new BOT creation
        wsManager.broadcastDataUpdate(
          "restaurant-bot",
          existingOrder.branchId?.toString(),
        );
        wsManager.broadcastDataUpdate(
          "restaurant-orders",
          existingOrder.branchId?.toString(),
        );

        res.json(botData);
      } catch (error) {
        console.error("Error generating BOT:", error);
        res
          .status(500)
          .json({ message: error.message || "Failed to generate BOT" });
      }
    },
  );

  // BOT Management
  app.get("/api/restaurant/bot", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const branchId = user.role === "superadmin" ? undefined : user.branchId!;
      const status = req.query.status as string;

      const botTickets = await restaurantStorage.getBotTickets(
        branchId,
        status,
      );
      res.json(botTickets);
    } catch (error) {
      console.error("Error fetching BOT tickets:", error);
      res.status(500).json({ message: "Failed to fetch BOT tickets" });
    }
  });

  app.patch(
    "/api/restaurant/bot/:id/status",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const botId = parseInt(req.params.id);
        const { status } = req.body;

        if (!status || !["preparing", "ready", "served"].includes(status)) {
          return res.status(400).json({ message: "Invalid status" });
        }

        const botTicket = await restaurantStorage.updateBotStatus(
          botId,
          status,
          user.id,
        );

        // Broadcast BOT status update
        wsManager.broadcastDataUpdate("restaurant-bot");
        wsManager.broadcastDataUpdate("restaurant-orders");

        res.json(botTicket);
      } catch (error) {
        console.error("Error updating BOT status:", error);
        res.status(500).json({ message: "Failed to update BOT status" });
      }
    },
  );

  app.patch(
    "/api/restaurant/bot/:id/print",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const botId = parseInt(req.params.id);
        const botTicket = await restaurantStorage.markBotPrinted(botId);
        res.json(botTicket);
      } catch (error) {
        console.error("Error marking BOT as printed:", error);
        res.status(500).json({ message: "Failed to mark BOT as printed" });
      }
    },
  );

  // Dish Ingredients Management
  app.get(
    "/api/restaurant/dishes/:dishId/ingredients",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const dishId = parseInt(req.params.dishId);
        const ingredients =
          await dishIngredientsStorage.getDishIngredients(dishId);
        res.json(ingredients);
      } catch (error) {
        console.error("Error fetching dish ingredients:", error);
        res.status(500).json({ message: "Failed to fetch dish ingredients" });
      }
    },
  );

  app.put(
    "/api/restaurant/dishes/:dishId/ingredients",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const dishId = parseInt(req.params.dishId);
        const ingredients = req.body.ingredients || [];

        // Validate each ingredient
        const validatedIngredients = ingredients.map((ingredient: any) =>
          insertDishIngredientSchema.parse({ ...ingredient, dishId }),
        );

        const result = await dishIngredientsStorage.updateDishIngredientsBulk(
          dishId,
          validatedIngredients,
        );
        res.json(result);
      } catch (error) {
        console.error("Error updating dish ingredients:", error);
        res.status(500).json({ message: "Failed to update dish ingredients" });
      }
    },
  );

  app.get(
    "/api/restaurant/dishes/:dishId/cost-calculation",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const dishId = parseInt(req.params.dishId);
        const costCalculation =
          await dishIngredientsStorage.getDishCostCalculation(dishId);
        res.json(costCalculation);
      } catch (error) {
        console.error("Error calculating dish cost:", error);
        res.status(500).json({ message: "Failed to calculate dish cost" });
      }
    },
  );

  // Restaurant Bills
  app.get("/api/restaurant/bills", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const branchId = user.role === "superadmin" ? undefined : user.branchId!;
      const bills = await restaurantStorage.getRestaurantBills(branchId);
      res.json(bills);
    } catch (error) {
      console.error("Error fetching restaurant bills:", error);
      res.status(500).json({ message: "Failed to fetch restaurant bills" });
    }
  });

  app.post("/api/restaurant/bills", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const billData = insertRestaurantBillSchema.parse({
        ...req.body,
        billNumber: `BILL${Date.now().toString().slice(-8)}`,
        createdById: user.id,
      });

      if (
        !checkBranchPermissions(user.role, user.branchId, billData.branchId)
      ) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions for this branch" });
      }

      // Check if bill already exists for this order
      const existingBills = await restaurantStorage.getRestaurantBills(
        billData.branchId,
      );
      const duplicateBill = existingBills.find(
        (bill: any) => bill.orderId === billData.orderId,
      );

      if (duplicateBill) {
        return res
          .status(400)
          .json({ message: "Bill already exists for this order" });
      }

      // Verify order exists and is in correct status
      const order = await restaurantStorage.getRestaurantOrder(
        billData.orderId,
      );
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Ensure this is a table order, not a room order
      if (order.orderType !== "dine-in") {
        return res.status(400).json({
          message:
            "Restaurant billing is only available for table orders. Room orders should be billed through hotel billing.",
        });
      }

      if (
        !["pending", "confirmed", "preparing", "ready", "served"].includes(
          order.status,
        )
      ) {
        return res
          .status(400)
          .json({ message: "Order must be active to create bill" });
      }

      const bill = await restaurantStorage.createRestaurantBill(billData);

      // Process stock consumption for this order
      try {
        const orderItems = await restaurantStorage.getRestaurantOrderItems(
          billData.orderId,
        );

        for (const item of orderItems) {
          await dishIngredientsStorage.processDishConsumption(
            item.dishId,
            parseInt(item.quantity),
            billData.orderId,
            item.id,
            billData.branchId,
            user.id,
          );
        }

        console.log(
          `✅ Stock consumption processed for ${orderItems.length} items in order ${billData.orderId}`,
        );
      } catch (consumptionError) {
        console.error("⚠️ Stock consumption failed:", consumptionError);
        // Continue with bill creation even if consumption fails
        // This prevents blocking the billing process for stock issues
      }

      // Update order status to completed after successful billing
      await restaurantStorage.updateRestaurantOrderStatus(
        billData.orderId,
        "completed",
        user.id,
      );

      // Broadcast new bill creation
      wsManager.broadcastDataUpdate(
        "restaurant-bills",
        billData.branchId?.toString(),
      );
      wsManager.broadcastDataUpdate(
        "restaurant-dashboard",
        billData.branchId?.toString(),
      );
      wsManager.broadcastDataUpdate(
        "restaurant-orders",
        billData.branchId?.toString(),
      );
      wsManager.broadcastDataUpdate(
        "inventory-consumption",
        billData.branchId?.toString(),
      );

      res.status(201).json(bill);
    } catch (error) {
      console.error("Error creating restaurant bill:", error);
      res.status(500).json({ message: "Failed to create restaurant bill" });
    }
  });

  app.put(
    "/api/restaurant/bills/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const billId = req.params.id;
        const billData = insertRestaurantBillSchema.partial().parse(req.body);

        const existingBill = await restaurantStorage.getRestaurantBill(billId);
        if (!existingBill) {
          return res.status(404).json({ message: "Bill not found" });
        }

        if (
          !checkBranchPermissions(
            user.role,
            user.branchId,
            existingBill.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this bill" });
        }

        const bill = await restaurantStorage.updateRestaurantBill(
          billId,
          billData,
        );

        // Broadcast bill update
        wsManager.broadcastDataUpdate(
          "restaurant-bills",
          existingBill.branchId?.toString(),
        );
        wsManager.broadcastDataUpdate(
          "restaurant-dashboard",
          existingBill.branchId?.toString(),
        );

        res.json(bill);
      } catch (error) {
        console.error("Error updating restaurant bill:", error);
        res.status(500).json({ message: "Failed to update restaurant bill" });
      }
    },
  );

  // Delete restaurant bill
  app.delete(
    "/api/restaurant/bills/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        // Check delete permission for restaurant-billing module
        const hasDeletePermission = await checkUserPermission(
          req.session.user.id,
          "restaurant-billing",
          "delete",
        );
        if (!hasDeletePermission) {
          return res.status(403).json({
            message: "Insufficient permissions to delete restaurant bills",
          });
        }

        const billId = req.params.id;
        const existingBill = await restaurantStorage.getRestaurantBill(billId);

        if (!existingBill) {
          return res.status(404).json({ message: "Bill not found" });
        }

        if (
          !checkBranchPermissions(
            user.role,
            user.branchId,
            existingBill.branchId,
          )
        ) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions for this branch" });
        }

        await restaurantStorage.deleteBill(billId);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting restaurant bill:", error);
        res.status(500).json({ message: "Failed to delete restaurant bill" });
      }
    },
  );

  // Clean up duplicate bills (admin only)
  app.post(
    "/api/restaurant/bills/cleanup-duplicates",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user || user.role !== "superadmin") {
          return res
            .status(403)
            .json({ message: "Only superadmin can clean up duplicate bills" });
        }

        // This is a one-time cleanup for existing duplicate bills
        // In production, you'd want more sophisticated logic here
        res.json({ message: "Cleanup endpoint available for superadmin use" });
      } catch (error) {
        console.error("Error cleaning up duplicate bills:", error);
        res.status(500).json({ message: "Failed to clean up duplicate bills" });
      }
    },
  );

  // Tax/Charges Management API Routes
  app.get("/api/taxes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Only allow superadmin and branch-admin to access tax management
      if (!["superadmin", "branch-admin"].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const taxes = await restaurantStorage.getTaxes();
      res.json(taxes);
    } catch (error) {
      console.error("Error fetching taxes:", error);
      res.status(500).json({ message: "Failed to fetch taxes" });
    }
  });

  app.get("/api/taxes/active", isAuthenticated, async (req: any, res) => {
    try {
      const taxes = await restaurantStorage.getActiveTaxes();
      res.json(taxes);
    } catch (error) {
      console.error("Error fetching active taxes:", error);
      res.status(500).json({ message: "Failed to fetch active taxes" });
    }
  });

  app.get("/api/taxes/reservation", isAuthenticated, async (req: any, res) => {
    try {
      const taxes = await restaurantStorage.getActiveReservationTaxes();
      res.json(taxes);
    } catch (error) {
      console.error("Error fetching reservation taxes:", error);
      res.status(500).json({ message: "Failed to fetch reservation taxes" });
    }
  });

  app.get("/api/taxes/order", isAuthenticated, async (req: any, res) => {
    try {
      const taxes = await restaurantStorage.getActiveOrderTaxes();
      res.json(taxes);
    } catch (error) {
      console.error("Error fetching order taxes:", error);
      res.status(500).json({ message: "Failed to fetch order taxes" });
    }
  });

  // Backward compatibility endpoint for taxes and charges
  app.get("/api/taxes-and-charges", isAuthenticated, async (req: any, res) => {
    try {
      const taxes = await restaurantStorage.getActiveReservationTaxes();
      res.json(taxes);
    } catch (error) {
      console.error("Error fetching taxes and charges:", error);
      res.status(500).json({ message: "Failed to fetch taxes and charges" });
    }
  });

  app.post("/api/taxes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Only allow superadmin and branch-admin to create taxes
      if (!["superadmin", "branch-admin"].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const taxData = insertTaxSchema.parse(req.body);
      const tax = await restaurantStorage.createTax(taxData);
      broadcastDataChange("taxes", "created", tax);
      res.status(201).json(tax);
    } catch (error) {
      console.error("Error creating tax:", error);
      if (error.code === "23505") {
        // Unique constraint violation
        res.status(400).json({ message: "Tax name already exists" });
      } else {
        res.status(500).json({ message: "Failed to create tax" });
      }
    }
  });

  app.put("/api/taxes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Only allow superadmin and branch-admin to update taxes
      if (!["superadmin", "branch-admin"].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const taxId = parseInt(req.params.id);
      const taxData = updateTaxSchema.parse(req.body);

      const existingTax = await restaurantStorage.getTax(taxId);
      if (!existingTax) {
        return res.status(404).json({ message: "Tax not found" });
      }

      const tax = await restaurantStorage.updateTax(taxId, taxData);
      broadcastDataChange("taxes", "updated", tax);
      res.json(tax);
    } catch (error) {
      console.error("Error updating tax:", error);
      if (error.code === "23505") {
        // Unique constraint violation
        res.status(400).json({ message: "Tax name already exists" });
      } else {
        res.status(500).json({ message: "Failed to update tax" });
      }
    }
  });

  app.delete("/api/taxes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check delete permission for tax-management module
      const hasDeletePermission = await checkUserPermission(
        req.session.user.id,
        "tax-management",
        "delete",
      );
      if (!hasDeletePermission) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions to delete taxes" });
      }

      // Only allow superadmin and branch-admin to delete taxes
      if (!["superadmin", "branch-admin"].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const taxId = parseInt(req.params.id);
      await restaurantStorage.deleteTax(taxId);
      broadcastDataChange("taxes", "deleted", { id: taxId });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tax:", error);
      res.status(500).json({ message: "Failed to delete tax" });
    }
  });

  // Restaurant Dashboard Metrics
  app.get(
    "/api/restaurant/dashboard/metrics",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const metrics =
          await restaurantStorage.getRestaurantDashboardMetrics(branchId);
        res.json(metrics);
      } catch (error) {
        console.error("Error fetching restaurant dashboard metrics:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch restaurant dashboard metrics" });
      }
    },
  );

  // Inventory Management Routes

  // Measuring Units
  app.get(
    "/api/inventory/measuring-units",
    isAuthenticated,
    async (req: any, res) => {
      try {
        // Measuring units are global and not branch-specific
        const units = await inventoryStorage.getMeasuringUnits();
        res.json(units);
      } catch (error) {
        console.error("Error fetching measuring units:", error);
        res.status(500).json({ message: "Failed to fetch measuring units" });
      }
    },
  );

  app.post(
    "/api/inventory/measuring-units",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const validatedData = insertMeasuringUnitSchema.parse(req.body);
        const unit = await inventoryStorage.createMeasuringUnit(validatedData);
        broadcastDataChange("measuring-units", "created", unit);
        res.status(201).json(unit);
      } catch (error) {
        console.error("Error creating measuring unit:", error);
        res.status(500).json({ message: "Failed to create measuring unit" });
      }
    },
  );

  app.put(
    "/api/inventory/measuring-units/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const unitId = parseInt(req.params.id);
        const validatedData = insertMeasuringUnitSchema
          .partial()
          .parse(req.body);
        const unit = await inventoryStorage.updateMeasuringUnit(
          unitId,
          validatedData,
        );
        broadcastDataChange("measuring-units", "updated", unit);
        res.json(unit);
      } catch (error) {
        console.error("Error updating measuring unit:", error);
        res.status(500).json({ message: "Failed to update measuring unit" });
      }
    },
  );

  app.delete(
    "/api/inventory/measuring-units/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        // Check delete permission for inventory-measuring-units module
        const hasDeletePermission = await checkUserPermission(
          req.session.user.id,
          "inventory-measuring-units",
          "delete",
        );
        if (!hasDeletePermission) {
          return res.status(403).json({
            message: "Insufficient permissions to delete measuring units",
          });
        }

        const unitId = parseInt(req.params.id);
        await inventoryStorage.deleteMeasuringUnit(unitId);
        broadcastDataChange("measuring-units", "deleted", { id: unitId });
        res.json({ message: "Measuring unit deleted successfully" });
      } catch (error) {
        console.error("Error deleting measuring unit:", error);
        res.status(500).json({ message: "Failed to delete measuring unit" });
      }
    },
  );

  // Stock Categories
  app.get(
    "/api/inventory/stock-categories",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        // For superadmin, show all categories. For branch admin/staff, show their branch categories
        const branchId = user.role === "superadmin" ? undefined : user.branchId;
        const categories = await inventoryStorage.getStockCategories(branchId);
        res.json(categories);
      } catch (error) {
        console.error("Error fetching stock categories:", error);
        res.status(500).json({ message: "Failed to fetch stock categories" });
      }
    },
  );

  app.get(
    "/api/inventory/stock-categories/menu",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const categories =
          await inventoryStorage.getMenuStockCategories(branchId);
        res.json(categories);
      } catch (error) {
        console.error("Error fetching menu stock categories:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch menu stock categories" });
      }
    },
  );

  app.post(
    "/api/inventory/stock-categories",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        console.log(
          "Creating stock category - User:",
          user.role,
          "Request body:",
          req.body,
        );

        const validatedData = insertStockCategorySchema.parse({
          ...req.body,
          branchId:
            user.role === "superadmin"
              ? req.body.branchId || null
              : user.branchId,
        });

        console.log("Validated data:", validatedData);

        const category =
          await inventoryStorage.createStockCategory(validatedData);
        console.log("Category created:", category);
        broadcastDataChange(
          "stock-categories",
          "created",
          category,
          category.branchId?.toString(),
        );
        res.status(201).json(category);
      } catch (error) {
        console.error("Error creating stock category:", error);
        if (error instanceof Error) {
          res.status(400).json({
            message: "Failed to create stock category",
            error: error.message,
          });
        } else {
          res.status(500).json({ message: "Failed to create stock category" });
        }
      }
    },
  );

  app.put(
    "/api/inventory/stock-categories/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const categoryId = parseInt(req.params.id);
        const validatedData = insertStockCategorySchema
          .partial()
          .parse(req.body);
        const category = await inventoryStorage.updateStockCategory(
          categoryId,
          validatedData,
        );
        broadcastDataChange(
          "stock-categories",
          "updated",
          category,
          category.branchId?.toString(),
        );
        res.json(category);
      } catch (error) {
        console.error("Error updating stock category:", error);
        res.status(500).json({ message: "Failed to update stock category" });
      }
    },
  );

  app.delete(
    "/api/inventory/stock-categories/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        // Check delete permission for inventory-stock-categories module
        const hasDeletePermission = await checkUserPermission(
          req.session.user.id,
          "inventory-stock-categories",
          "delete",
        );
        if (!hasDeletePermission) {
          return res.status(403).json({
            message: "Insufficient permissions to delete stock categories",
          });
        }

        const categoryId = parseInt(req.params.id);
        await inventoryStorage.deleteStockCategory(categoryId);
        broadcastDataChange("stock-categories", "deleted", { id: categoryId });
        res.json({ message: "Stock category deleted successfully" });
      } catch (error) {
        console.error("Error deleting stock category:", error);
        res.status(500).json({ message: "Failed to delete stock category" });
      }
    },
  );

  // Suppliers
  app.get(
    "/api/inventory/suppliers",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const suppliers = await inventoryStorage.getSuppliers(branchId);
        res.json(suppliers);
      } catch (error) {
        console.error("Error fetching suppliers:", error);
        res.status(500).json({ message: "Failed to fetch suppliers" });
      }
    },
  );

  app.post(
    "/api/inventory/suppliers",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const validatedData = insertSupplierSchema.parse({
          ...req.body,
          branchId:
            user.role === "superadmin" ? req.body.branchId : user.branchId!,
        });

        const supplier = await inventoryStorage.createSupplier(validatedData);
        broadcastDataChange(
          "suppliers",
          "created",
          supplier,
          supplier.branchId?.toString(),
        );
        res.status(201).json(supplier);
      } catch (error) {
        console.error("Error creating supplier:", error);
        res.status(500).json({ message: "Failed to create supplier" });
      }
    },
  );

  app.put(
    "/api/inventory/suppliers/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const supplierId = parseInt(req.params.id);
        const validatedData = insertSupplierSchema.partial().parse(req.body);
        const supplier = await inventoryStorage.updateSupplier(
          supplierId,
          validatedData,
        );
        broadcastDataChange(
          "suppliers",
          "updated",
          supplier,
          supplier.branchId?.toString(),
        );
        res.json(supplier);
      } catch (error) {
        console.error("Error updating supplier:", error);
        res.status(500).json({ message: "Failed to update supplier" });
      }
    },
  );

  app.delete(
    "/api/inventory/suppliers/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        // Check delete permission for inventory-suppliers module
        const hasDeletePermission = await checkUserPermission(
          req.session.user.id,
          "inventory-suppliers",
          "delete",
        );
        if (!hasDeletePermission) {
          return res
            .status(403)
            .json({ message: "Insufficient permissions to delete suppliers" });
        }

        const supplierId = parseInt(req.params.id);
        await inventoryStorage.deleteSupplier(supplierId);
        broadcastDataChange("suppliers", "deleted", { id: supplierId });
        res.json({ message: "Supplier deleted successfully" });
      } catch (error) {
        console.error("Error deleting supplier:", error);
        res.status(500).json({ message: "Failed to delete supplier" });
      }
    },
  );

  // Stock items
  app.post(
    "/api/inventory/stock-items",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const stockItemData = insertStockItemSchema.parse(req.body);

        if (
          !checkBranchPermissions(
            user.role,
            user.branchId,
            stockItemData.branchId,
          )
        ) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }

        const stockItem = await inventoryStorage.createStockItem(stockItemData);
        broadcastDataChange(
          "stock-items",
          "created",
          stockItem,
          stockItem.branchId?.toString(),
        );
        res.status(201).json(stockItem);
      } catch (error) {
        console.error("Error creating stock item:", error);
        res.status(500).json({ message: "Failed to create stock item" });
      }
    },
  );

  app.get(
    "/api/inventory/stock-items",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const categoryId = req.query.categoryId
          ? parseInt(req.query.categoryId as string)
          : undefined;
        const items = await inventoryStorage.getStockItems(
          branchId,
          categoryId,
        );
        res.json(items);
      } catch (error) {
        console.error("Error fetching stock items:", error);
        res.status(500).json({ message: "Failed to fetch stock items" });
      }
    },
  );

  app.get(
    "/api/inventory/stock-items/menu",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const items = await inventoryStorage.getMenuStockItems(branchId);
        res.json(items);
      } catch (error) {
        console.error("Error fetching menu stock items:", error);
        res.status(500).json({ message: "Failed to fetch menu stock items" });
      }
    },
  );

  app.put(
    "/api/inventory/stock-items/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const itemId = parseInt(req.params.id);
        const validatedData = insertStockItemSchema.partial().parse(req.body);
        const item = await inventoryStorage.updateStockItem(
          itemId,
          validatedData,
        );
        broadcastDataChange(
          "stock-items",
          "updated",
          item,
          item.branchId?.toString(),
        );
        res.json(item);
      } catch (error) {
        console.error("Error updating stock item:", error);
        res.status(500).json({ message: "Failed to update stock item" });
      }
    },
  );

  app.delete(
    "/api/inventory/stock-items/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        // Check delete permission for inventory-stock-items module
        const hasDeletePermission = await checkUserPermission(
          req.session.user.id,
          "inventory-stock-items",
          "delete",
        );
        if (!hasDeletePermission) {
          return res.status(403).json({
            message: "Insufficient permissions to delete stock items",
          });
        }

        const itemId = parseInt(req.params.id);
        await inventoryStorage.deleteStockItem(itemId);
        broadcastDataChange("stock-items", "deleted", { id: itemId });
        res.json({ message: "Stock item deleted successfully" });
      } catch (error) {
        console.error("Error deleting stock item:", error);
        res.status(500).json({ message: "Failed to delete stock item" });
      }
    },
  );

  // Stock Consumption
  app.get(
    "/api/inventory/consumption",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const orderId = req.query.orderId as string;
        const consumptions = await inventoryStorage.getStockConsumptions(
          branchId,
          orderId,
        );
        res.json(consumptions);
      } catch (error) {
        console.error("Error fetching stock consumptions:", error);
        res.status(500).json({ message: "Failed to fetch stock consumptions" });
      }
    },
  );

  app.get(
    "/api/inventory/low-stock",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId =
          user.role === "superadmin" ? undefined : user.branchId!;
        const items = await inventoryStorage.getLowStockItems(branchId);
        res.json(items);
      } catch (error) {
        console.error("Error fetching low stock items:", error);
        res.status(500).json({ message: "Failed to fetch low stock items" });
      }
    },
  );

  const requireAuth = (req: any, res: any, next: any) => {
    if (req.session && req.session.user) {
      req.user = req.session.user;
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  };

  // Get user permissions (for custom roles)
  app.get("/api/auth/user/permissions", requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = await storage.getUser(userId);
      if (!user || user.role !== "custom") {
        return res.json({});
      }

      // Use the getUserPermissions method which already aggregates permissions
      const permissions = await roleStorage.getUserPermissions(userId);
      console.log("User permissions found:", permissions);

      res.json(permissions);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // QR Code routes for tables and rooms
  app.get("/api/qr/table/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tableId = parseInt(req.params.id);
      const qrCode = await QRService.generateTableQR(tableId);
      const table = await restaurantStorage.getRestaurantTable(tableId);
      res.json({
        qrCode,
        url: `${QRService.getBaseUrl()}/order/${table?.qrToken}`,
      });
    } catch (error) {
      console.error("Error generating table QR code:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  app.get("/api/qr/room/:id", isAuthenticated, async (req: any, res) => {
    try {
      const roomId = parseInt(req.params.id);
      const qrCode = await QRService.generateRoomQR(roomId);
      const room = await storage.getRoom(roomId);
      res.json({
        qrCode,
        url: `${QRService.getBaseUrl()}/order/${room?.qrToken}`,
      });
    } catch (error) {
      console.error("Error generating room QR code:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  app.post(
    "/api/qr/table/:id/regenerate",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tableId = parseInt(req.params.id);
        const result = await QRService.regenerateTableQR(tableId);
        res.json(result);
      } catch (error) {
        console.error("Error regenerating table QR code:", error);
        res.status(500).json({ message: "Failed to regenerate QR code" });
      }
    },
  );

  app.post(
    "/api/qr/room/:id/regenerate",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const roomId = parseInt(req.params.id);
        const result = await QRService.regenerateRoomQR(roomId);
        res.json(result);
      } catch (error) {
        console.error("Error regenerating room QR code:", error);
        res.status(500).json({ message: "Failed to regenerate QR code" });
      }
    },
  );

  // Public order page route (no authentication required)
  app.get("/api/order/info/:token", async (req: any, res) => {
    try {
      const token = req.params.token;
      const orderInfo = await QRService.validateQRToken(token);

      if (!orderInfo) {
        return res.status(404).json({ message: "Invalid QR code" });
      }

      // Check hotel opening hours
      const hotelSettings = await storage.getHotelSettings();
      if (hotelSettings && hotelSettings.openingTime && hotelSettings.closingTime) {
        const now = new Date();
        const timeZone = hotelSettings.timeZone || "Asia/Kathmandu";
        
        // Get current time in hotel's timezone
        const currentTime = new Intl.DateTimeFormat("en-GB", {
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(now);

        const openingTime = hotelSettings.openingTime;
        const closingTime = hotelSettings.closingTime;

        // Convert times to minutes for comparison
        const timeToMinutes = (timeStr: string) => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        };

        const currentMinutes = timeToMinutes(currentTime);
        const openingMinutes = timeToMinutes(openingTime);
        const closingMinutes = timeToMinutes(closingTime);

        // Check if hotel is closed
        let isClosed = false;
        if (closingMinutes > openingMinutes) {
          // Same day opening (e.g., 06:00 to 22:00)
          isClosed = currentMinutes < openingMinutes || currentMinutes >= closingMinutes;
        } else {
          // Next day closing (e.g., 18:00 to 02:00)
          isClosed = currentMinutes >= closingMinutes && currentMinutes < openingMinutes;
        }

        if (isClosed) {
          return res.status(423).json({ 
            message: "We are currently closed. Please visit us during our opening hours.",
            openingTime: openingTime,
            closingTime: closingTime,
            currentTime: currentTime,
            isClosed: true
          });
        }
      }

      // Check for active reservation if this is a room order
      let activeReservation = null;
      let reservationStatus = null;
      if (orderInfo.type === "room") {
        try {
          activeReservation = await storage.getActiveReservationByRoom(
            orderInfo.id,
          );
          if (activeReservation) {
            reservationStatus = activeReservation.status;
            console.log(
              `🏨 Found active reservation ${activeReservation.id} for room ${orderInfo.id} with status: ${reservationStatus}`,
            );
          } else {
            console.log(
              `🏨 No active reservation found for room ${orderInfo.id}`,
            );
          }
        } catch (error) {
          console.error("Error checking room reservation:", error);
        }
      }

      // Get menu items for the branch
      const menuCategories = await restaurantStorage.getMenuCategories(
        orderInfo.branchId,
      );
      const menuDishes = await restaurantStorage.getMenuDishes(
        orderInfo.branchId,
      );

      const response = {
        location: orderInfo,
        menu: {
          categories: menuCategories,
          dishes: menuDishes,
        },
        reservation: activeReservation
          ? {
              id: activeReservation.id,
              status: activeReservation.status,
              guest: {
                id: activeReservation.guest.id,
                firstName: activeReservation.guest.firstName,
                lastName: activeReservation.guest.lastName,
                phone: activeReservation.guest.phone,
                email: activeReservation.guest.email,
              },
              canOrder: activeReservation.status === "checked-in",
            }
          : null,
      };

      res.json(response);
    } catch (error) {
      console.error("Error validating QR token:", error);
      res.status(500).json({ message: "Failed to validate QR code" });
    }
  });

  // Guest order creation/update (no authentication required)
  app.post("/api/order/guest", async (req: any, res) => {
    try {
      const { token, customerName, customerPhone, notes, items } = req.body;

      if (!token || !items || items.length === 0) {
        return res
          .status(400)
          .json({ message: "Token and items are required" });
      }

      const orderInfo = await QRService.validateQRToken(token);
      if (!orderInfo) {
        return res.status(404).json({ message: "Invalid QR code" });
      }

      // Check hotel opening hours
      const hotelSettings = await storage.getHotelSettings();
      if (hotelSettings && hotelSettings.openingTime && hotelSettings.closingTime) {
        const now = new Date();
        const timeZone = hotelSettings.timeZone || "Asia/Kathmandu";
        
        // Get current time in hotel's timezone
        const currentTime = new Intl.DateTimeFormat("en-GB", {
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(now);

        const openingTime = hotelSettings.openingTime;
        const closingTime = hotelSettings.closingTime;

        // Convert times to minutes for comparison
        const timeToMinutes = (timeStr: string) => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        };

        const currentMinutes = timeToMinutes(currentTime);
        const openingMinutes = timeToMinutes(openingTime);
        const closingMinutes = timeToMinutes(closingTime);

        // Check if hotel is closed
        let isClosed = false;
        if (closingMinutes > openingMinutes) {
          // Same day opening (e.g., 06:00 to 22:00)
          isClosed = currentMinutes < openingMinutes || currentMinutes >= closingMinutes;
        } else {
          // Next day closing (e.g., 18:00 to 02:00)
          isClosed = currentMinutes >= closingMinutes && currentMinutes < openingMinutes;
        }

        if (isClosed) {
          return res.status(423).json({ 
            message: "We are currently closed. Please visit us during our opening hours.",
            openingTime: openingTime,
            closingTime: closingTime,
            currentTime: currentTime,
            isClosed: true
          });
        }
      }

      // Check for existing active order
      const existingOrders = await restaurantStorage.getRestaurantOrders(
        orderInfo.branchId,
      );
      let existingOrder = existingOrders.find((order: any) =>
        orderInfo.type === "table"
          ? order.tableId === orderInfo.id &&
            ["pending", "confirmed", "preparing", "ready"].includes(
              order.status,
            )
          : order.roomId === orderInfo.id &&
            ["pending", "confirmed", "preparing", "ready"].includes(
              order.status,
            ),
      );

      if (existingOrder) {
        // Add new items to existing order
        const orderItems = items.map((item: any) => ({
          orderId: existingOrder.id,
          dishId: item.dishId,
          quantity: item.quantity,
          unitPrice: item.unitPrice || "0",
          totalPrice: (
            parseFloat(item.unitPrice || "0") * item.quantity
          ).toString(),
          specialInstructions: item.specialInstructions || null,
        }));

        // Insert new items
        for (const item of orderItems) {
          await restaurantStorage.createRestaurantOrderItem(item);
        }

        // Update order totals
        const allItems = await restaurantStorage.getRestaurantOrderItems(
          existingOrder.id,
        );
        const newSubtotal = allItems.reduce(
          (sum, item) => sum + parseFloat(item.totalPrice),
          0,
        );

        await restaurantStorage.updateRestaurantOrder(existingOrder.id, {
          subtotal: newSubtotal.toString(),
          totalAmount: newSubtotal.toString(),
          customerName: customerName || existingOrder.customerName,
          customerPhone: customerPhone || existingOrder.customerPhone,
          notes: notes || existingOrder.notes,
        });

        // Broadcast order update
        wsManager.broadcastDataUpdate(
          "restaurant-orders",
          orderInfo.branchId?.toString(),
        );
        wsManager.broadcastDataUpdate(
          "restaurant-dashboard",
          orderInfo.branchId?.toString(),
        );

        res.json({
          success: true,
          orderId: existingOrder.id,
          message: "Items added to existing order",
          itemsAdded: items.length,
        });
      } else {
        // Create new order
        const orderNumber = `ORD-${Date.now()}`;
        const subtotal = items.reduce(
          (sum: number, item: any) =>
            sum + parseFloat(item.unitPrice || "0") * item.quantity,
          0,
        );

        const orderData = {
          orderNumber,
          tableId: orderInfo.type === "dine-in" ? orderInfo.id : null,
          roomId: orderInfo.type === "room" ? orderInfo.id : null,
          branchId: orderInfo.branchId,
          status: "pending" as const,
          orderType: orderInfo.type as any,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          subtotal: subtotal.toString(),
          totalAmount: subtotal.toString(),
          notes: notes || null,
        };

        const newOrder =
          await restaurantStorage.createRestaurantOrder(orderData);

        // Add items to order
        const orderItems = items.map((item: any) => ({
          orderId: newOrder.id,
          dishId: item.dishId,
          quantity: item.quantity,
          unitPrice: item.unitPrice || "0",
          totalPrice: (
            parseFloat(item.unitPrice || "0") * item.quantity
          ).toString(),
          specialInstructions: item.specialInstructions || null,
        }));

        for (const item of orderItems) {
          await restaurantStorage.createRestaurantOrderItem(item);
        }

        // Broadcast new order creation
        wsManager.broadcastDataUpdate(
          "restaurant-orders",
          orderInfo.branchId?.toString(),
        );
        wsManager.broadcastDataUpdate(
          "restaurant-dashboard",
          orderInfo.branchId?.toString(),
        );

        res.json({
          success: true,
          orderId: newOrder.id,
          orderNumber: newOrder.orderNumber,
          message: "New order created successfully",
        });
      }
    } catch (error) {
      console.error("Error creating/updating guest order:", error);
      res.status(500).json({ message: "Failed to process order" });
    }
  });

  // Check for existing order
  app.get("/api/order/existing/:token", async (req: any, res) => {
    try {
      const token = req.params.token;
      const orderInfo = await QRService.validateQRToken(token);

      if (!orderInfo) {
        return res.status(404).json({ message: "Invalid QR code" });
      }

      // Find existing active order for this table/room
      const whereCondition =
        orderInfo.type === "table"
          ? {
              tableId: orderInfo.id,
              status: ["pending", "confirmed", "preparing", "ready"],
            }
          : {
              roomId: orderInfo.id,
              status: ["pending", "confirmed", "preparing", "ready"],
            };

      const existingOrder = await restaurantStorage.getRestaurantOrders(
        orderInfo.branchId,
        whereCondition.status[0],
      );
      const activeOrder = existingOrder.find((order: any) =>
        orderInfo.type === "table"
          ? order.tableId === orderInfo.id
          : order.roomId === orderInfo.id,
      );

      if (activeOrder) {
        const orderItems = await restaurantStorage.getRestaurantOrderItems(
          activeOrder.id,
        );
        res.json({
          ...activeOrder,
          items: orderItems,
        });
      } else {
        res.status(404).json({ message: "No active order found" });
      }
    } catch (error) {
      console.error("Error checking existing order:", error);
      res.status(500).json({ message: "Failed to check existing order" });
    }
  });

  // Update existing order
  app.put("/api/order/update/:orderId", async (req: any, res) => {
    try {
      const orderId = req.params.orderId;
      const { items, customerName, customerPhone, notes } = req.body;

      // Check if order can be modified (within 2 minutes)
      const existingOrder = await restaurantStorage.getRestaurantOrder(orderId);
      if (!existingOrder) {
        return res.status(404).json({ message: "Order not found" });
      }

      const orderTime = new Date(existingOrder.createdAt);
      const now = new Date();
      const diffInMinutes = (now.getTime() - orderTime.getTime()) / (1000 * 60);

      if (diffInMinutes > 2 && existingOrder.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Order can no longer be modified" });
      }

      // Calculate new totals
      let subtotal = 0;
      const orderItems = [];

      for (const item of items) {
        const dish = await restaurantStorage.getMenuDish(item.dishId);
        if (!dish) {
          return res
            .status(400)
            .json({ message: `Dish with ID ${item.dishId} not found` });
        }

        const itemTotal = parseFloat(dish.price) * item.quantity;
        subtotal += itemTotal;

        orderItems.push({
          orderId,
          dishId: item.dishId,
          quantity: item.quantity,
          unitPrice: dish.price,
          totalPrice: itemTotal.toString(),
          specialInstructions: item.specialInstructions || null,
        });
      }

      // Update order
      const updatedOrder = await restaurantStorage.updateRestaurantOrder(
        orderId,
        {
          customerName,
          customerPhone,
          subtotal: subtotal.toString(),
          totalAmount: subtotal.toString(),
          notes,
        },
      );

      // Delete existing items and add new ones
      await db
        .delete(restaurantOrderItems)
        .where(eq(restaurantOrderItems.orderId, orderId));
      await db.insert(restaurantOrderItems).values(orderItems);

      res.json({
        message: "Order updated successfully",
        orderNumber: updatedOrder.orderNumber,
        orderId: updatedOrder.id,
      });
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  // Clear table/room
  app.post("/api/order/clear/:token", async (req: any, res) => {
    try {
      const token = req.params.token;
      const orderInfo = await QRService.validateQRToken(token);

      if (!orderInfo) {
        return res.status(404).json({ message: "Invalid QR code" });
      }

      // Mark any active orders as completed
      const existingOrders = await restaurantStorage.getRestaurantOrders(
        orderInfo.branchId,
      );
      const activeOrders = existingOrders.filter(
        (order: any) =>
          (orderInfo.type === "table"
            ? order.tableId === orderInfo.id
            : order.roomId === orderInfo.id) &&
          !["completed", "cancelled"].includes(order.status),
      );

      for (const order of activeOrders) {
        await restaurantStorage.updateRestaurantOrderStatus(
          order.id,
          "completed",
        );
      }

      // Update table status if it's a table order
      if (orderInfo.type === "table") {
        await restaurantStorage.updateRestaurantTable(orderInfo.id, {
          status: "open",
        });
      }

      res.json({ message: "Table/room cleared successfully" });
    } catch (error) {
      console.error("Error clearing table/room:", error);
      res.status(500).json({ message: "Failed to clear table/room" });
    }
  });

  // Purchase Order Routes
  app.get("/api/purchase-orders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const { status } = req.query;
      const branchId = user.role === "superadmin" ? undefined : user.branchId;

      const { purchaseOrderStorage } = await import("./purchase-order-storage");
      const orders = await purchaseOrderStorage.getPurchaseOrders(
        branchId,
        status as string,
      );
      res.json(orders);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
  });

  app.get(
    "/api/purchase-orders/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const orderId = parseInt(req.params.id);
        const { purchaseOrderStorage } = await import(
          "./purchase-order-storage"
        );
        const order = await purchaseOrderStorage.getPurchaseOrder(orderId);

        if (!order) {
          return res.status(404).json({ message: "Purchase order not found" });
        }

        res.json(order);
      } catch (error) {
        console.error("Error fetching purchase order:", error);
        res.status(500).json({ message: "Failed to fetch purchase order" });
      }
    },
  );

  app.post("/api/purchase-orders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const { order, items } = req.body;

      if (!order || !items || !Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ message: "Order data and items are required" });
      }

      console.log("Creating purchase order:", { order, items });

      const { purchaseOrderStorage } = await import("./purchase-order-storage");

      const orderData = {
        ...order,
        createdBy: user.id,
        status: "draft" as const,
      };

      const newOrder = await purchaseOrderStorage.createPurchaseOrder(
        orderData,
        items,
      );
      broadcastDataChange(
        "purchase-orders",
        "created",
        newOrder,
        newOrder.branchId?.toString(),
      );
      res.status(201).json(newOrder);
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res.status(500).json({
        message: "Failed to create purchase order",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post(
    "/api/purchase-orders/:id/approve",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const orderId = parseInt(req.params.id);
        const { purchaseOrderStorage } = await import(
          "./purchase-order-storage"
        );

        const order = await purchaseOrderStorage.approvePurchaseOrder(
          orderId,
          user.id,
        );
        broadcastDataChange(
          "purchase-orders",
          "updated",
          order,
          order.branchId?.toString(),
        );
        res.json(order);
      } catch (error) {
        console.error("Error approving purchase order:", error);
        res.status(500).json({ message: "Failed to approve purchase order" });
      }
    },
  );

  app.delete(
    "/api/purchase-orders/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const orderId = parseInt(req.params.id);
        const { purchaseOrderStorage } = await import(
          "./purchase-order-storage"
        );

        await purchaseOrderStorage.deletePurchaseOrder(orderId);
        broadcastDataChange("purchase-orders", "deleted", { id: orderId });
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting purchase order:", error);
        res.status(500).json({ message: "Failed to delete purchase order" });
      }
    },
  );

  // Stock Receipts Routes
  app.get("/api/stock-receipts", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const branchId = user.role === "superadmin" ? undefined : user.branchId;
      const { purchaseOrderStorage } = await import("./purchase-order-storage");

      const receipts = await purchaseOrderStorage.getStockReceipts(branchId);
      res.json(receipts);
    } catch (error) {
      console.error("Error fetching stock receipts:", error);
      res.status(500).json({ message: "Failed to fetch stock receipts" });
    }
  });

  app.post("/api/stock-receipts", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const { receipt, items } = req.body;

      if (!receipt || !items || !Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ message: "Receipt data and items are required" });
      }

      console.log("Creating stock receipt:", { receipt, items });

      const { purchaseOrderStorage } = await import("./purchase-order-storage");

      const receiptData = {
        ...receipt,
        receivedBy: user.id,
      };

      const newReceipt = await purchaseOrderStorage.createStockReceipt(
        receiptData,
        items,
      );
      broadcastDataChange(
        "stock-receipts",
        "created",
        newReceipt,
        newReceipt.branchId?.toString(),
      );
      res.status(201).json(newReceipt);
    } catch (error) {
      console.error("Error creating stock receipt:", error);
      res.status(500).json({
        message: "Failed to create stock receipt",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Purchase Analytics Routes
  app.get("/api/purchase-analytics", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const { startDate, endDate } = req.query;
      const branchId = user.role === "superadmin" ? undefined : user.branchId;
      const { purchaseOrderStorage } = await import("./purchase-order-storage");

      const analytics = await purchaseOrderStorage.getPurchaseAnalytics(
        branchId,
        startDate as string,
        endDate as string,
      );
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching purchase analytics:", error);
      res.status(500).json({ message: "Failed to fetch purchase analytics" });
    }
  });

  app.get(
    "/api/inventory-valuation",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId = user.role === "superadmin" ? undefined : user.branchId;
        const { purchaseOrderStorage } = await import(
          "./purchase-order-storage"
        );

        const valuation =
          await purchaseOrderStorage.getInventoryValuation(branchId);
        res.json(valuation);
      } catch (error) {
        console.error("Error fetching inventory valuation:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch inventory valuation" });
      }
    },
  );

  app.get("/api/profit-analysis", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const { startDate, endDate } = req.query;
      const branchId = user.role === "superadmin" ? undefined : user.branchId;
      const { purchaseOrderStorage } = await import("./purchase-order-storage");

      const analysis = await purchaseOrderStorage.getProfitAnalysis(
        branchId,
        startDate as string,
        endDate as string,
      );
      res.json(analysis);
    } catch (error) {
      console.error("Error fetching profit analysis:", error);
      res.status(500).json({ message: "Failed to fetch profit analysis" });
    }
  });

  // Audit logs routes
  app.get("/api/audit-logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Only allow admin users to view audit logs
      if (user.role !== "superadmin" && user.role !== "branch-admin") {
        return res
          .status(403)
          .json({ message: "Only admin users can view audit logs" });
      }

      const {
        userId,
        entity,
        action,
        startDate,
        endDate,
        limit = 50,
        offset = 0,
      } = req.query;

      const branchId = user.role === "superadmin" ? undefined : user.branchId;

      const auditLogs = await storage.getAuditLogs({
        userId: userId as string,
        entity: entity as string,
        action: action as string,
        branchId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      const totalCount = await storage.getAuditLogCount({
        userId: userId as string,
        entity: entity as string,
        action: action as string,
        branchId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        auditLogs,
        totalCount,
        hasMore:
          parseInt(offset as string) + parseInt(limit as string) < totalCount,
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Printer connection testing utility
  async function testPrinterConnection(config: any): Promise<{ success: boolean; error?: string }> {
    const net = require('net');
    
    return new Promise((resolve) => {
      const client = new net.Socket();
      let connected = false;
      
      // Set timeout
      const timeout = setTimeout(() => {
        if (!connected) {
          client.destroy();
          resolve({
            success: false,
            error: `Connection timeout after ${config.connectionTimeout || 5000}ms`
          });
        }
      }, config.connectionTimeout || 5000);
      
      client.connect(config.port || 9100, config.ipAddress, () => {
        connected = true;
        clearTimeout(timeout);
        
        // Send a simple test command (ESC/POS paper feed)
        client.write('\x1B\x64\x02'); // Feed 2 lines
        
        setTimeout(() => {
          client.destroy();
          resolve({ success: true });
        }, 100);
      });
      
      client.on('error', (err: any) => {
        connected = true;
        clearTimeout(timeout);
        client.destroy();
        resolve({
          success: false,
          error: `Connection failed: ${err.message}`
        });
      });
    });
  }

  // Printer Configuration Management Endpoints
  // Get all printer configurations for a branch
  app.get(
    "/api/printer-configurations",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const branchId = user.role === "superadmin" ? 
          (req.query.branchId ? parseInt(req.query.branchId as string) : user.branchId) : 
          user.branchId;

        if (!branchId) {
          return res.status(400).json({ message: "Branch ID is required" });
        }

        const configurations = await db.select()
          .from(printerConfigurations)
          .where(eq(printerConfigurations.branchId, branchId));

        res.json(configurations);
      } catch (error) {
        console.error("Error fetching printer configurations:", error);
        res.status(500).json({ message: "Failed to fetch printer configurations" });
      }
    }
  );

  // Create or update printer configuration
  app.post(
    "/api/printer-configurations",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const validatedData = insertPrinterConfigurationSchema.parse(req.body);
        
        // Ensure branch permissions
        const branchId = user.role === "superadmin" ? 
          validatedData.branchId : user.branchId;
        
        if (!branchId) {
          return res.status(400).json({ message: "Branch ID is required" });
        }

        // Check if configuration already exists for this printer type and branch
        const existingConfig = await db.select()
          .from(printerConfigurations)
          .where(
            and(
              eq(printerConfigurations.branchId, branchId),
              eq(printerConfigurations.printerType, validatedData.printerType)
            )
          )
          .limit(1);

        let configuration;
        if (existingConfig.length > 0) {
          // Update existing configuration
          [configuration] = await db.update(printerConfigurations)
            .set({
              ...validatedData,
              branchId,
              updatedAt: new Date(),
            })
            .where(eq(printerConfigurations.id, existingConfig[0].id))
            .returning();
        } else {
          // Create new configuration
          [configuration] = await db.insert(printerConfigurations)
            .values({
              ...validatedData,
              branchId,
            })
            .returning();
        }

        broadcastDataChange("printer-configurations", "upserted", configuration);
        res.status(201).json(configuration);
      } catch (error) {
        console.error("Error creating/updating printer configuration:", error);
        res.status(500).json({ message: "Failed to save printer configuration" });
      }
    }
  );

  // Test printer connection
  app.post(
    "/api/printer-configurations/:id/test",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const configId = parseInt(req.params.id);
        const configuration = await db.select()
          .from(printerConfigurations)
          .where(eq(printerConfigurations.id, configId))
          .limit(1);

        if (!configuration.length) {
          return res.status(404).json({ message: "Printer configuration not found" });
        }

        const config = configuration[0];

        // Check branch permissions
        if (user.role !== "superadmin" && config.branchId !== user.branchId) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }

        // Test printer connection (simplified TCP connection test)
        const testResult = await testPrinterConnection(config);

        // Update configuration with test results
        await db.update(printerConfigurations)
          .set({
            lastTestPrint: new Date(),
            connectionStatus: testResult.success ? "connected" : "error",
            errorMessage: testResult.success ? null : testResult.error,
            updatedAt: new Date(),
          })
          .where(eq(printerConfigurations.id, configId));

        res.json(testResult);
      } catch (error) {
        console.error("Error testing printer connection:", error);
        res.status(500).json({ message: "Failed to test printer connection" });
      }
    }
  );

  // Delete printer configuration
  app.delete(
    "/api/printer-configurations/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.session.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });

        const configId = parseInt(req.params.id);
        const configuration = await db.select()
          .from(printerConfigurations)
          .where(eq(printerConfigurations.id, configId))
          .limit(1);

        if (!configuration.length) {
          return res.status(404).json({ message: "Printer configuration not found" });
        }

        // Check branch permissions
        if (user.role !== "superadmin" && configuration[0].branchId !== user.branchId) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }

        await db.delete(printerConfigurations)
          .where(eq(printerConfigurations.id, configId));

        broadcastDataChange("printer-configurations", "deleted", { id: configId });
        res.json({ message: "Printer configuration deleted successfully" });
      } catch (error) {
        console.error("Error deleting printer configuration:", error);
        res.status(500).json({ message: "Failed to delete printer configuration" });
      }
    }
  );

  const httpServer = createServer(app);
  return httpServer;
}