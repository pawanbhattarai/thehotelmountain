import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
  date,
  uuid,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - mandatory for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", {
    enum: ["superadmin", "branch-admin", "front-desk", "custom"],
  })
    .notNull()
    .default("front-desk"),
  branchId: integer("branch_id"),
  isActive: boolean("is_active").default(true),
  permissions: jsonb("permissions").default("[]"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Branches table
export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Room types table
export const roomTypes = pgTable("room_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  maxOccupancy: integer("max_occupancy").notNull(),
  amenities: jsonb("amenities"),
  branchId: integer("branch_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Rooms table
export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  number: varchar("number", { length: 20 }).notNull(),
  floor: integer("floor"),
  roomTypeId: integer("room_type_id").notNull(),
  branchId: integer("branch_id").notNull(),
  status: varchar("status", {
    enum: [
      "available",
      "occupied",
      "maintenance",
      "housekeeping",
      "out-of-order",
      "reserved",
    ],
  })
    .notNull()
    .default("available"),
  qrToken: uuid("qr_token").defaultRandom().notNull().unique(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Guests table
export const guests = pgTable("guests", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  idType: varchar("id_type", {
    enum: ["passport", "driving-license", "national-id"],
  }),
  idNumber: varchar("id_number", { length: 100 }),
  address: text("address"),
  dateOfBirth: date("date_of_birth"),
  nationality: varchar("nationality", { length: 100 }),
  reservationCount: integer("reservation_count").notNull().default(0),
  creditBalance: decimal("credit_balance", { precision: 10, scale: 2 }).default("0"),
  idDocumentPath: text("id_document_path"),
  idDocumentOriginalName: text("id_document_original_name"),
  idDocumentSize: integer("id_document_size"),
  idDocumentMimeType: text("id_document_mime_type"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reservations table
export const reservations = pgTable("reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  guestId: uuid("guest_id").notNull(),
  branchId: integer("branch_id").notNull(),
  confirmationNumber: varchar("confirmation_number", { length: 20 })
    .notNull()
    .unique(),
  status: varchar("status", {
    enum: [
      "pending",
      "confirmed",
      "checked-in",
      "checked-out",
      "cancelled",
      "no-show",
    ],
  })
    .notNull()
    .default("pending"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  appliedTaxes: text("applied_taxes"), // JSON string of applied taxes
  discountType: varchar("discount_type"),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).default("0"),
  discountReason: text("discount_reason"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"),
  paymentMethod: varchar("payment_method", {
    enum: ["cash", "card", "bank-transfer", "digital"],
  }),
  paymentStatus: varchar("payment_status", {
    enum: ["pending", "partial", "paid"],
  })
    .notNull()
    .default("pending"),
  notes: text("notes"),
  createdById: varchar("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reservation rooms table (for multiple rooms per reservation)
export const reservationRooms = pgTable("reservation_rooms", {
  id: serial("id").primaryKey(),
  reservationId: uuid("reservation_id").notNull(),
  roomId: integer("room_id").notNull(),
  checkInDate: timestamp("check_in_date").notNull(),
  checkOutDate: timestamp("check_out_date").notNull(),
  adults: integer("adults").notNull().default(1),
  children: integer("children").notNull().default(0),
  ratePerNight: decimal("rate_per_night", {
    precision: 10,
    scale: 2,
  }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  specialRequests: text("special_requests"),
  actualCheckIn: timestamp("actual_check_in"),
  actualCheckOut: timestamp("actual_check_out"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payments table for tracking reservation payments
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  reservationId: uuid("reservation_id").notNull(),
  paymentType: varchar("payment_type", {
    enum: ["advance", "partial", "full", "credit"],
  }).notNull(),
  paymentMethod: varchar("payment_method", {
    enum: ["cash", "card", "online", "bank-transfer"],
  }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", {
    enum: ["pending", "completed", "failed", "refunded"],
  }).notNull().default("completed"),
  transactionReference: varchar("transaction_reference", { length: 255 }),
  notes: text("notes"),
  dueDate: date("due_date"),
  processedById: varchar("processed_by_id").notNull(),
  processedAt: timestamp("processed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  branch: one(branches, {
    fields: [users.branchId],
    references: [branches.id],
  }),
  customRoleAssignments: many(userCustomRoles),
}));

export const branchesRelations = relations(branches, ({ many }) => ({
  users: many(users),
  rooms: many(rooms),
  roomTypes: many(roomTypes),
  guests: many(guests),
  reservations: many(reservations),
}));

export const roomTypesRelations = relations(roomTypes, ({ one, many }) => ({
  branch: one(branches, {
    fields: [roomTypes.branchId],
    references: [branches.id],
  }),
  rooms: many(rooms),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  roomType: one(roomTypes, {
    fields: [rooms.roomTypeId],
    references: [roomTypes.id],
  }),
  branch: one(branches, {
    fields: [rooms.branchId],
    references: [branches.id],
  }),
  reservationRooms: many(reservationRooms),
}));

export const guestsRelations = relations(guests, ({ many }) => ({
  reservations: many(reservations),
}));

export const reservationsRelations = relations(
  reservations,
  ({ one, many }) => ({
    guest: one(guests, {
      fields: [reservations.guestId],
      references: [guests.id],
    }),
    branch: one(branches, {
      fields: [reservations.branchId],
      references: [branches.id],
    }),
    createdBy: one(users, {
      fields: [reservations.createdById],
      references: [users.id],
    }),
    reservationRooms: many(reservationRooms),
    payments: many(payments),
  }),
);

export const reservationRoomsRelations = relations(
  reservationRooms,
  ({ one }) => ({
    reservation: one(reservations, {
      fields: [reservationRooms.reservationId],
      references: [reservations.id],
    }),
    room: one(rooms, {
      fields: [reservationRooms.roomId],
      references: [rooms.id],
    }),
  }),
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  reservation: one(reservations, {
    fields: [payments.reservationId],
    references: [reservations.id],
  }),
  processedBy: one(users, {
    fields: [payments.processedById],
    references: [users.id],
  }),
}));

// Hotel settings table - for hotel information and billing details
export const hotelSettings = pgTable("hotel_settings", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id"), // null for global settings
  hotelName: varchar("hotel_name", { length: 255 }),
  hotelChain: varchar("hotel_chain", { length: 255 }),
  logo: text("logo"), // URL or base64
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 255 }),
  taxNumber: varchar("tax_number", { length: 100 }),
  registrationNumber: varchar("registration_number", { length: 100 }),
  checkInTime: varchar("check_in_time", { length: 10 }).default("15:00"),
  checkOutTime: varchar("check_out_time", { length: 10 }).default("11:00"),
  dayCalculationTime: varchar("day_calculation_time", { length: 10 }).default("00:00"),
  useCustomDayCalculation: boolean("use_custom_day_calculation").default(false),
  openingTime: varchar("opening_time", { length: 10 }).default("06:00"),
  closingTime: varchar("closing_time", { length: 10 }).default("23:00"),
  currency: varchar("currency", { length: 10 }).default("NPR"),
  timeZone: varchar("time_zone", { length: 50 }).default("Asia/Kathmandu"),
  billingFooter: text("billing_footer"),
  termsAndConditions: text("terms_and_conditions"),
  cancellationPolicy: text("cancellation_policy"),
  // Social media and company info
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  tiktokUrl: text("tiktok_url"),
  youtubeUrl: text("youtube_url"),
  contactInfo: text("contact_info"),
  reviewsUrl: text("reviews_url"),
  directPrintKotBot: boolean("direct_print_kot_bot").default(false),
  showBSDate: boolean("show_bs_date").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const hotelSettingsRelations = relations(hotelSettings, ({ one }) => ({
  branch: one(branches, {
    fields: [hotelSettings.branchId],
    references: [branches.id],
  }),
}));

// Push subscriptions table for browser notifications
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserEndpoint: unique().on(table.userId, table.endpoint),
  }),
);

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  }),
);

// Notification history table
export const notificationHistory = pgTable("notification_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", {
    enum: ["new-reservation", "check-in", "check-out", "maintenance"],
  }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  data: jsonb("data"), // Additional context data
  isRead: boolean("is_read").default(false),
  reservationId: uuid("reservation_id").references(() => reservations.id),
  roomId: integer("room_id").references(() => rooms.id),
  branchId: integer("branch_id").references(() => branches.id),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
});

export const notificationHistoryRelations = relations(
  notificationHistory,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationHistory.userId],
      references: [users.id],
    }),
    reservation: one(reservations, {
      fields: [notificationHistory.reservationId],
      references: [reservations.id],
    }),
    room: one(rooms, {
      fields: [notificationHistory.roomId],
      references: [rooms.id],
    }),
    branch: one(branches, {
      fields: [notificationHistory.branchId],
      references: [branches.id],
    }),
  }),
);

// Custom Roles and Permissions Tables
export const customRoles = pgTable("custom_roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").references(() => customRoles.id, {
    onDelete: "cascade",
  }),
  module: varchar("module", { length: 100 }).notNull(), // e.g., "dashboard", "reservations", "rooms"
  permissions: jsonb("permissions").notNull(), // { read: true, write: true, delete: false }
  createdAt: timestamp("created_at").defaultNow(),
});

export const userCustomRoles = pgTable("user_custom_roles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  roleId: integer("role_id").references(() => customRoles.id, {
    onDelete: "cascade",
  }),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by").references(() => users.id),
});

// Relations for custom roles
export const customRolesRelations = relations(customRoles, ({ many }) => ({
  permissions: many(rolePermissions),
  userAssignments: many(userCustomRoles),
}));

export const rolePermissionsRelations = relations(
  rolePermissions,
  ({ one }) => ({
    role: one(customRoles, {
      fields: [rolePermissions.roleId],
      references: [customRoles.id],
    }),
  }),
);

export const userCustomRolesRelations = relations(
  userCustomRoles,
  ({ one }) => ({
    user: one(users, {
      fields: [userCustomRoles.userId],
      references: [users.id],
    }),
    role: one(customRoles, {
      fields: [userCustomRoles.roleId],
      references: [customRoles.id],
    }),
    assignedByUser: one(users, {
      fields: [userCustomRoles.assignedBy],
      references: [users.id],
    }),
  }),
);

// Insert schemas
export const insertCustomRoleSchema = createInsertSchema(customRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRolePermissionSchema = createInsertSchema(
  rolePermissions,
).omit({
  id: true,
  createdAt: true,
});

export const insertUserCustomRoleSchema = createInsertSchema(
  userCustomRoles,
).omit({
  id: true,
  assignedAt: true,
});

export const insertUserSchema = createInsertSchema(users)
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    customRoleIds: z.array(z.number()).optional(), // For assigning custom roles
  });

export const insertBranchSchema = createInsertSchema(branches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoomTypeSchema = createInsertSchema(roomTypes)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    basePrice: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    branchId: z.union([z.number(), z.null()]).optional(),
  });

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGuestSchema = createInsertSchema(guests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReservationSchema = createInsertSchema(reservations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReservationRoomSchema = createInsertSchema(
  reservationRooms,
).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  processedAt: true,
});

export const insertHotelSettingsSchema = createInsertSchema(hotelSettings).omit(
  {
    id: true,
    createdAt: true,
    updatedAt: true,
  },
).extend({
  checkInTime: z.string().default("15:00"),
  checkOutTime: z.string().default("11:00"),
  dayCalculationTime: z.string().default("00:00"),
  useCustomDayCalculation: z.boolean().default(false),
  openingTime: z.string().default("06:00"),
  closingTime: z.string().default("23:00"),
});

export const insertPushSubscriptionSchema = createInsertSchema(
  pushSubscriptions,
).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationHistorySchema = createInsertSchema(
  notificationHistory,
).omit({
  id: true,
  sentAt: true,
});

// Restaurant Management System (RMS) Tables

// Restaurant tables for seating management
export const restaurantTables = pgTable("restaurant_tables", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  capacity: integer("capacity").notNull(),
  status: varchar("status", {
    enum: ["open", "occupied", "maintenance"],
  })
    .notNull()
    .default("open"),
  branchId: integer("branch_id").notNull(),
  qrToken: uuid("qr_token").defaultRandom().notNull().unique(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Menu categories
export const menuCategories = pgTable("menu_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  menuType: varchar("menu_type", { 
    enum: ["Food", "Bar"] 
  }).notNull().default("Food"),
  branchId: integer("branch_id").notNull(),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Menu dishes
export const menuDishes = pgTable("menu_dishes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  image: text("image"), // URL or path to image
  categoryId: integer("category_id").notNull(),
  branchId: integer("branch_id").notNull(),
  description: text("description"),
  ingredients: text("ingredients"),
  isVegetarian: boolean("is_vegetarian").default(false),
  isVegan: boolean("is_vegan").default(false),
  spiceLevel: varchar("spice_level", {
    enum: ["mild", "medium", "hot", "extra-hot"],
  }),
  preparationTime: integer("preparation_time"), // in minutes
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Restaurant orders
export const restaurantOrders = pgTable("restaurant_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: varchar("order_number", { length: 20 }).notNull().unique(),
  tableId: integer("table_id"), // Nullable for room orders
  branchId: integer("branch_id").notNull(),
  status: varchar("status", {
    enum: [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "served",
      "completed",
      "cancelled",
    ],
  })
    .notNull()
    .default("pending"),
  orderType: varchar("order_type", {
    enum: ["dine-in", "takeaway", "delivery", "table", "room"],
  })
    .notNull()
    .default("dine-in"),
  roomId: integer("room_id"), // For room service orders
  reservationId: uuid("reservation_id"), // Link orders to reservations
  customerName: varchar("customer_name", { length: 100 }),
  customerPhone: varchar("customer_phone", { length: 20 }),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  appliedTaxes: jsonb("applied_taxes"), // Store tax breakdown
  discountAmount: decimal("discount_amount", {
    precision: 10,
    scale: 2,
  }).default("0"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"),
  paymentStatus: varchar("payment_status", {
    enum: ["pending", "partial", "paid"],
  })
    .notNull()
    .default("pending"),
  paymentMethod: varchar("payment_method", {
    enum: ["cash", "card", "digital", "bank-transfer"],
  }),
  notes: text("notes"),
  kotGenerated: boolean("kot_generated").default(false),
  botGenerated: boolean("bot_generated").default(false),
  kotGeneratedAt: timestamp("kot_generated_at"),
  botGeneratedAt: timestamp("bot_generated_at"),
  servedAt: timestamp("served_at"),
  completedAt: timestamp("completed_at"),
  createdById: text("created_by_id").references(() => users.id), // Nullable for guest orders
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order items
export const restaurantOrderItems = pgTable("restaurant_order_items", {
  id: serial("id").primaryKey(),
  orderId: uuid("order_id").notNull(),
  dishId: integer("dish_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  specialInstructions: text("special_instructions"),
  status: varchar("status", {
    enum: ["pending", "preparing", "ready", "served"],
  })
    .notNull()
    .default("pending"),
  isKot: boolean("is_kot").default(false), // Kitchen Order Ticket item
  isBot: boolean("is_bot").default(false), // Beverage Order Ticket item
  kotNumber: varchar("kot_number", { length: 20 }), // KOT batch number
  botNumber: varchar("bot_number", { length: 20 }), // BOT batch number
  kotGeneratedAt: timestamp("kot_generated_at"),
  botGeneratedAt: timestamp("bot_generated_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// KOT (Kitchen Order Ticket) table for tracking individual KOTs
export const kotTickets = pgTable("kot_tickets", {
  id: serial("id").primaryKey(),
  kotNumber: varchar("kot_number", { length: 20 }).notNull().unique(),
  orderId: uuid("order_id").notNull(),
  tableId: integer("table_id"),
  roomId: integer("room_id"),
  branchId: integer("branch_id").notNull(),
  customerName: varchar("customer_name", { length: 100 }),
  status: varchar("status", {
    enum: ["pending", "preparing", "ready", "served"],
  })
    .notNull()
    .default("pending"),
  itemCount: integer("item_count").notNull().default(0),
  notes: text("notes"),
  createdById: text("created_by_id"),
  printedAt: timestamp("printed_at"),
  startedAt: timestamp("started_at"), // When kitchen started preparing
  completedAt: timestamp("completed_at"), // When kitchen finished
  servedAt: timestamp("served_at"), // When served to customer
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// BOT (Bar Order Ticket) table for tracking individual BOTs
export const botTickets = pgTable("bot_tickets", {
  id: serial("id").primaryKey(),
  botNumber: varchar("bot_number", { length: 20 }).notNull().unique(),
  orderId: uuid("order_id").notNull(),
  tableId: integer("table_id"),
  roomId: integer("room_id"),
  branchId: integer("branch_id").notNull(),
  customerName: varchar("customer_name", { length: 100 }),
  status: varchar("status", {
    enum: ["pending", "preparing", "ready", "served"],
  })
    .notNull()
    .default("pending"),
  itemCount: integer("item_count").notNull().default(0),
  notes: text("notes"),
  createdById: text("created_by_id"),
  printedAt: timestamp("printed_at"),
  startedAt: timestamp("started_at"), // When bar started preparing
  completedAt: timestamp("completed_at"), // When bar finished
  servedAt: timestamp("served_at"), // When served to customer
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Restaurant billing
export const restaurantBills = pgTable("restaurant_bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  billNumber: varchar("bill_number", { length: 20 }).notNull().unique(),
  orderId: uuid("order_id").notNull(),
  tableId: integer("table_id").notNull(),
  branchId: integer("branch_id").notNull(),
  customerName: varchar("customer_name", { length: 100 }),
  customerPhone: varchar("customer_phone", { length: 20 }),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  appliedTaxes: text("applied_taxes"), // JSON string of applied taxes
  discountAmount: decimal("discount_amount", {
    precision: 10,
    scale: 2,
  }).default("0"),
  discountPercentage: decimal("discount_percentage", {
    precision: 5,
    scale: 2,
  }).default("0"),
  serviceChargeAmount: decimal("service_charge_amount", {
    precision: 10,
    scale: 2,
  }).default("0"),
  serviceChargePercentage: decimal("service_charge_percentage", {
    precision: 5,
    scale: 2,
  }).default("10"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"),
  changeAmount: decimal("change_amount", { precision: 10, scale: 2 }).default(
    "0",
  ),
  paymentStatus: varchar("payment_status", {
    enum: ["pending", "partial", "paid"],
  })
    .notNull()
    .default("pending"),
  paymentMethod: varchar("payment_method", {
    enum: ["cash", "card", "digital", "bank-transfer"],
  }),
  isPrinted: boolean("is_printed").default(false),
  printedAt: timestamp("printed_at"),
  createdById: text("created_by_id"), // Making createdById optional
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tax/Charges master table
export const taxes = pgTable("taxes", {
  id: serial("id").primaryKey(),
  taxName: varchar("tax_name", { length: 100 }).notNull().unique(),
  rate: decimal("rate", { precision: 5, scale: 2 }).notNull(), // Rate percentage
  status: varchar("status", { enum: ["active", "inactive"] })
    .notNull()
    .default("active"),
  applyToReservations: boolean("apply_to_reservations").default(false),
  applyToOrders: boolean("apply_to_orders").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Restaurant Relations
export const restaurantTablesRelations = relations(
  restaurantTables,
  ({ one, many }) => ({
    branch: one(branches, {
      fields: [restaurantTables.branchId],
      references: [branches.id],
    }),
    orders: many(restaurantOrders),
    bills: many(restaurantBills),
  }),
);

export const menuCategoriesRelations = relations(
  menuCategories,
  ({ one, many }) => ({
    branch: one(branches, {
      fields: [menuCategories.branchId],
      references: [branches.id],
    }),
    dishes: many(menuDishes),
  }),
);

export const menuDishesRelations = relations(menuDishes, ({ one, many }) => ({
  category: one(menuCategories, {
    fields: [menuDishes.categoryId],
    references: [menuCategories.id],
  }),
  branch: one(branches, {
    fields: [menuDishes.branchId],
    references: [branches.id],
  }),
  orderItems: many(restaurantOrderItems),
  ingredients: many(dishIngredients),
}));

export const restaurantOrdersRelations = relations(
  restaurantOrders,
  ({ one, many }) => ({
    table: one(restaurantTables, {
      fields: [restaurantOrders.tableId],
      references: [restaurantTables.id],
    }),
    room: one(rooms, {
      fields: [restaurantOrders.roomId],
      references: [rooms.id],
    }),
    reservation: one(reservations, {
      fields: [restaurantOrders.reservationId],
      references: [reservations.id],
    }),
    branch: one(branches, {
      fields: [restaurantOrders.branchId],
      references: [branches.id],
    }),
    createdBy: one(users, {
      fields: [restaurantOrders.createdById],
      references: [users.id],
    }),
    items: many(restaurantOrderItems),
    bill: one(restaurantBills, {
      fields: [restaurantOrders.id],
      references: [restaurantBills.orderId],
    }),
  }),
);

export const restaurantOrderItemsRelations = relations(
  restaurantOrderItems,
  ({ one }) => ({
    order: one(restaurantOrders, {
      fields: [restaurantOrderItems.orderId],
      references: [restaurantOrders.id],
    }),
    dish: one(menuDishes, {
      fields: [restaurantOrderItems.dishId],
      references: [menuDishes.id],
    }),
  }),
);

export const kotTicketsRelations = relations(kotTickets, ({ one, many }) => ({
  order: one(restaurantOrders, {
    fields: [kotTickets.orderId],
    references: [restaurantOrders.id],
  }),
  table: one(restaurantTables, {
    fields: [kotTickets.tableId],
    references: [restaurantTables.id],
  }),
  branch: one(branches, {
    fields: [kotTickets.branchId],
    references: [branches.id],
  }),
  createdBy: one(users, {
    fields: [kotTickets.createdById],
    references: [users.id],
  }),
}));

export const botTicketsRelations = relations(botTickets, ({ one, many }) => ({
  order: one(restaurantOrders, {
    fields: [botTickets.orderId],
    references: [restaurantOrders.id],
  }),
  table: one(restaurantTables, {
    fields: [botTickets.tableId],
    references: [restaurantTables.id],
  }),
  branch: one(branches, {
    fields: [botTickets.branchId],
    references: [branches.id],
  }),
  createdBy: one(users, {
    fields: [botTickets.createdById],
    references: [users.id],
  }),
}));

export const restaurantBillsRelations = relations(
  restaurantBills,
  ({ one }) => ({
    order: one(restaurantOrders, {
      fields: [restaurantBills.orderId],
      references: [restaurantOrders.id],
    }),
    table: one(restaurantTables, {
      fields: [restaurantBills.tableId],
      references: [restaurantTables.id],
    }),
    branch: one(branches, {
      fields: [restaurantBills.branchId],
      references: [branches.id],
    }),
    createdBy: one(users, {
      fields: [restaurantBills.createdById],
      references: [users.id],
    }),
  }),
);

// Restaurant Insert Schemas
export const insertRestaurantTableSchema = createInsertSchema(
  restaurantTables,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMenuCategorySchema = createInsertSchema(menuCategories).omit(
  {
    id: true,
    createdAt: true,
    updatedAt: true,
  },
);

export const insertMenuDishSchema = createInsertSchema(menuDishes)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    price: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
  });

export const insertRestaurantOrderSchema = createInsertSchema(
  restaurantOrders,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRestaurantOrderItemSchema = createInsertSchema(
  restaurantOrderItems,
).omit({
  id: true,
  createdAt: true,
  kotGeneratedAt: true,
  botGeneratedAt: true,
});

export const insertKotTicketSchema = createInsertSchema(kotTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBotTicketSchema = createInsertSchema(botTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRestaurantBillSchema = createInsertSchema(
  restaurantBills,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type RoomType = typeof roomTypes.$inferSelect;
export type InsertRoomType = z.infer<typeof insertRoomTypeSchema>;
export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Guest = typeof guests.$inferSelect;
export type InsertGuest = z.infer<typeof insertGuestSchema>;
export type Reservation = typeof reservations.$inferSelect;
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type ReservationRoom = typeof reservationRooms.$inferSelect;
export type InsertReservationRoom = z.infer<typeof insertReservationRoomSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type HotelSettings = typeof hotelSettings.$inferSelect;
export type InsertHotelSettings = z.infer<typeof insertHotelSettingsSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;
export type NotificationHistory = typeof notificationHistory.$inferSelect;
export type InsertNotificationHistory = z.infer<
  typeof insertNotificationHistorySchema
>;

// Restaurant Types
export type RestaurantTable = typeof restaurantTables.$inferSelect;
export type InsertRestaurantTable = z.infer<typeof insertRestaurantTableSchema>;
export type MenuCategory = typeof menuCategories.$inferSelect;
export type InsertMenuCategory = z.infer<typeof insertMenuCategorySchema>;
export type MenuDish = typeof menuDishes.$inferSelect;
export type InsertMenuDish = z.infer<typeof insertMenuDishSchema>;
export type RestaurantOrder = typeof restaurantOrders.$inferSelect;
export type InsertRestaurantOrder = z.infer<typeof insertRestaurantOrderSchema>;
export type RestaurantOrderItem = typeof restaurantOrderItems.$inferSelect;
export type InsertRestaurantOrderItem = z.infer<
  typeof insertRestaurantOrderItemSchema
>;
export type RestaurantBill = typeof restaurantBills.$inferSelect;
export type InsertRestaurantBill = z.infer<typeof insertRestaurantBillSchema>;
export type KotTicket = typeof kotTickets.$inferSelect;
export type InsertKotTicket = z.infer<typeof insertKotTicketSchema>;
export type BotTicket = typeof botTickets.$inferSelect;
export type InsertBotTicket = z.infer<typeof insertBotTicketSchema>;

// Printer Configuration table for KOT/BOT printing settings
export const printerConfigurations = pgTable("printer_configurations", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull(),
  printerType: varchar("printer_type", {
    enum: ["kot", "bot", "billing"],
  }).notNull(),
  printerName: varchar("printer_name", { length: 100 }).notNull(),
  ipAddress: varchar("ip_address", { length: 15 }).notNull(),
  port: integer("port").default(9100),
  isEnabled: boolean("is_enabled").default(true),
  autoDirectPrint: boolean("auto_direct_print").default(false),
  paperWidth: integer("paper_width").default(80), // in mm
  characterEncoding: varchar("character_encoding", { length: 20 }).default("UTF-8"),
  connectionTimeout: integer("connection_timeout").default(5000), // in milliseconds
  retryAttempts: integer("retry_attempts").default(3),
  lastTestPrint: timestamp("last_test_print"),
  lastSuccessfulPrint: timestamp("last_successful_print"),
  connectionStatus: varchar("connection_status", {
    enum: ["connected", "disconnected", "error"],
  }).default("disconnected"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Printer Configuration Relations
export const printerConfigurationsRelations = relations(
  printerConfigurations,
  ({ one }) => ({
    branch: one(branches, {
      fields: [printerConfigurations.branchId],
      references: [branches.id],
    }),
  }),
);

// Printer Configuration Insert Schema
export const insertPrinterConfigurationSchema = createInsertSchema(
  printerConfigurations,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastTestPrint: true,
  lastSuccessfulPrint: true,
  connectionStatus: true,
  errorMessage: true,
});

export type PrinterConfiguration = typeof printerConfigurations.$inferSelect;
export type InsertPrinterConfiguration = z.infer<typeof insertPrinterConfigurationSchema>;

// Tax/Charges Schemas and Types
export const insertTaxSchema = createInsertSchema(taxes)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    rate: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
  });

export const updateTaxSchema = z.object({
  taxName: z.string().optional(),
  rate: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === "number" ? val.toString() : val))
    .optional(),
  status: z.enum(["active", "inactive"]).optional(),
  applyToReservations: z.boolean().optional(),
  applyToOrders: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export type Tax = typeof taxes.$inferSelect;
export type InsertTax = z.infer<typeof insertTaxSchema>;
export type UpdateTax = z.infer<typeof updateTaxSchema>;

// Audit Logs table for security and activity tracking
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").references(() => users.id),
    action: varchar("action", { length: 100 }).notNull(), // CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, etc.
    entity: varchar("entity", { length: 100 }).notNull(), // users, guests, reservations, etc.
    entityId: varchar("entity_id", { length: 255 }), // ID of the affected entity
    details: jsonb("details").default("{}"), // Additional details about the action
    ipAddress: varchar("ip_address", { length: 45 }), // IPv4/IPv6 address
    userAgent: text("user_agent"), // Browser/client information
    sessionId: varchar("session_id", { length: 255 }), // Session identifier
    success: boolean("success").default(true), // Whether the action was successful
    errorMessage: text("error_message"), // Error message if action failed
    branchId: integer("branch_id").references(() => branches.id), // Branch context
    timestamp: timestamp("timestamp").defaultNow(),
  },
  (table) => [
    index("idx_audit_logs_user_id").on(table.userId),
    index("idx_audit_logs_timestamp").on(table.timestamp),
    index("idx_audit_logs_action").on(table.action),
    index("idx_audit_logs_entity").on(table.entity),
    index("idx_audit_logs_branch_id").on(table.branchId),
  ],
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  branch: one(branches, {
    fields: [auditLogs.branchId],
    references: [branches.id],
  }),
}));

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
// Inventory Management Tables

// Measuring Units
export const measuringUnits = pgTable("measuring_units", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  baseUnit: varchar("base_unit", { length: 100 }),
  conversionFactor: decimal("conversion_factor", {
    precision: 10,
    scale: 4,
  }).default("1"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stock Categories
export const stockCategories = pgTable("stock_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  branchId: integer("branch_id").references(() => branches.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Suppliers
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  contactPerson: varchar("contact_person", { length: 255 }),
  taxNumber: varchar("tax_number", { length: 100 }),
  branchId: integer("branch_id").references(() => branches.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stock Items
export const stockItems = pgTable("stock_items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).unique(),
  categoryId: integer("category_id").references(() => stockCategories.id),
  measuringUnitId: integer("measuring_unit_id").references(
    () => measuringUnits.id,
  ),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  defaultPrice: decimal("default_price", { precision: 10, scale: 2 }).default(
    "0",
  ),
  currentStock: decimal("current_stock", { precision: 10, scale: 3 }).default(
    "0",
  ),
  minimumStock: decimal("minimum_stock", { precision: 10, scale: 3 }).default(
    "0",
  ),
  maximumStock: decimal("maximum_stock", { precision: 10, scale: 3 }),
  reorderLevel: decimal("reorder_level", { precision: 10, scale: 3 }),
  reorderQuantity: decimal("reorder_quantity", { precision: 10, scale: 3 }),
  description: text("description"),
  branchId: integer("branch_id").references(() => branches.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Dish Ingredients/Recipe - tracks what stock items are used in each dish
export const dishIngredients = pgTable("dish_ingredients", {
  id: serial("id").primaryKey(),
  dishId: integer("dish_id").notNull(),
  stockItemId: integer("stock_item_id").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stock Consumption
export const stockConsumption = pgTable("stock_consumption", {
  id: serial("id").primaryKey(),
  stockItemId: integer("stock_item_id").references(() => stockItems.id),
  orderId: varchar("order_id", { length: 255 }),
  orderItemId: integer("order_item_id"), // Reference to specific order item
  dishId: integer("dish_id"), // Reference to dish that caused consumption
  orderType: varchar("order_type", { length: 50 }).default("restaurant"), // restaurant, hotel, etc
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  consumedBy: text("consumed_by"),
  notes: text("notes"),
  branchId: integer("branch_id").references(() => branches.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Inventory Relations
export const measuringUnitsRelations = relations(
  measuringUnits,
  ({ many }) => ({
    stockItems: many(stockItems),
  }),
);

export const stockCategoriesRelations = relations(
  stockCategories,
  ({ one, many }) => ({
    branch: one(branches, {
      fields: [stockCategories.branchId],
      references: [branches.id],
    }),
    stockItems: many(stockItems),
  }),
);

export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  branch: one(branches, {
    fields: [suppliers.branchId],
    references: [branches.id],
  }),
  stockItems: many(stockItems),
}));

export const stockItemsRelations = relations(stockItems, ({ one, many }) => ({
  category: one(stockCategories, {
    fields: [stockItems.categoryId],
    references: [stockCategories.id],
  }),
  measuringUnit: one(measuringUnits, {
    fields: [stockItems.measuringUnitId],
    references: [measuringUnits.id],
  }),
  supplier: one(suppliers, {
    fields: [stockItems.supplierId],
    references: [suppliers.id],
  }),
  branch: one(branches, {
    fields: [stockItems.branchId],
    references: [branches.id],
  }),
  consumptions: many(stockConsumption),
  dishIngredients: many(dishIngredients),
}));

export const dishIngredientsRelations = relations(
  dishIngredients,
  ({ one }) => ({
    dish: one(menuDishes, {
      fields: [dishIngredients.dishId],
      references: [menuDishes.id],
    }),
    stockItem: one(stockItems, {
      fields: [dishIngredients.stockItemId],
      references: [stockItems.id],
    }),
  }),
);

export const stockConsumptionRelations = relations(
  stockConsumption,
  ({ one }) => ({
    stockItem: one(stockItems, {
      fields: [stockConsumption.stockItemId],
      references: [stockItems.id],
    }),
    branch: one(branches, {
      fields: [stockConsumption.branchId],
      references: [branches.id],
    }),
    order: one(restaurantOrders, {
      fields: [stockConsumption.orderId],
      references: [restaurantOrders.id],
    }),
    orderItem: one(restaurantOrderItems, {
      fields: [stockConsumption.orderItemId],
      references: [restaurantOrderItems.id],
    }),
    dish: one(menuDishes, {
      fields: [stockConsumption.dishId],
      references: [menuDishes.id],
    }),
  }),
);

// Inventory Insert Schemas
export const insertMeasuringUnitSchema = createInsertSchema(
  measuringUnits,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStockCategorySchema = createInsertSchema(
  stockCategories,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStockItemSchema = createInsertSchema(stockItems)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    defaultPrice: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    currentStock: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    minimumStock: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    maximumStock: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val))
      .optional(),
    reorderLevel: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val))
      .optional(),
    reorderQuantity: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val))
      .optional(),
  });

export const insertDishIngredientSchema = createInsertSchema(dishIngredients)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    quantity: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    cost: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
  });

export const insertStockConsumptionSchema = createInsertSchema(stockConsumption)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    quantity: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    unitPrice: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val))
      .optional(),
    totalCost: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val))
      .optional(),
  });

// Inventory Types
export type MeasuringUnit = typeof measuringUnits.$inferSelect;
export type InsertMeasuringUnit = z.infer<typeof insertMeasuringUnitSchema>;

export type StockCategory = typeof stockCategories.$inferSelect;
export type InsertStockCategory = z.infer<typeof insertStockCategorySchema>;

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

export type StockItem = typeof stockItems.$inferSelect;
export type InsertStockItem = z.infer<typeof insertStockItemSchema>;

export type DishIngredient = typeof dishIngredients.$inferSelect;
export type InsertDishIngredient = z.infer<typeof insertDishIngredientSchema>;

export type StockConsumption = typeof stockConsumption.$inferSelect;
export type InsertStockConsumption = z.infer<
  typeof insertStockConsumptionSchema
>;

// Purchase Orders
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: varchar("po_number", { length: 50 }).notNull().unique(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  branchId: integer("branch_id").references(() => branches.id),
  status: varchar("status", {
    enum: ["draft", "sent", "confirmed", "partially-received", "received", "cancelled"],
  }).notNull().default("draft"),
  orderDate: date("order_date").notNull(),
  expectedDeliveryDate: date("expected_delivery_date"),
  actualDeliveryDate: date("actual_delivery_date"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).default("0"),
  notes: text("notes"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase Order Items
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id, {
    onDelete: "cascade",
  }).notNull(),
  stockItemId: integer("stock_item_id").references(() => stockItems.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  receivedQuantity: decimal("received_quantity", { precision: 10, scale: 3 }).default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Stock Receipts (for receiving goods)
export const stockReceipts = pgTable("stock_receipts", {
  id: serial("id").primaryKey(),
  receiptNumber: varchar("receipt_number", { length: 50 }).notNull().unique(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  branchId: integer("branch_id").references(() => branches.id),
  receivedDate: date("received_date").notNull(),
  totalQuantity: decimal("total_quantity", { precision: 10, scale: 3 }).default("0"),
  totalValue: decimal("total_value", { precision: 10, scale: 2 }).default("0"),
  notes: text("notes"),
  receivedBy: varchar("received_by").references(() => users.id).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stock Receipt Items
export const stockReceiptItems = pgTable("stock_receipt_items", {
  id: serial("id").primaryKey(),
  stockReceiptId: integer("stock_receipt_id").references(() => stockReceipts.id, {
    onDelete: "cascade",
  }).notNull(),
  purchaseOrderItemId: integer("purchase_order_item_id").references(() => purchaseOrderItems.id),
  stockItemId: integer("stock_item_id").references(() => stockItems.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  batchNumber: varchar("batch_number", { length: 100 }),
  expiryDate: date("expiry_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Stock Cost History (for FIFO/LIFO tracking)
export const stockCostHistory = pgTable("stock_cost_history", {
  id: serial("id").primaryKey(),
  stockItemId: integer("stock_item_id").references(() => stockItems.id).notNull(),
  stockReceiptItemId: integer("stock_receipt_item_id").references(() => stockReceiptItems.id),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  remainingQuantity: decimal("remaining_quantity", { precision: 10, scale: 3 }).notNull(),
  costingMethod: varchar("costing_method", {
    enum: ["fifo", "lifo", "average"],
  }).notNull().default("fifo"),
  transactionType: varchar("transaction_type", {
    enum: ["purchase", "adjustment", "opening"],
  }).notNull().default("purchase"),
  transactionDate: timestamp("transaction_date").defaultNow(),
  branchId: integer("branch_id").references(() => branches.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Purchase Order Relations
export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  branch: one(branches, {
    fields: [purchaseOrders.branchId],
    references: [branches.id],
  }),
  createdBy: one(users, {
    fields: [purchaseOrders.createdBy],
    references: [users.id],
  }),
  approvedBy: one(users, {
    fields: [purchaseOrders.approvedBy],
    references: [users.id],
  }),
  items: many(purchaseOrderItems),
  receipts: many(stockReceipts),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  stockItem: one(stockItems, {
    fields: [purchaseOrderItems.stockItemId],
    references: [stockItems.id],
  }),
}));

export const stockReceiptsRelations = relations(stockReceipts, ({ one, many }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [stockReceipts.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  supplier: one(suppliers, {
    fields: [stockReceipts.supplierId],
    references: [suppliers.id],
  }),
  branch: one(branches, {
    fields: [stockReceipts.branchId],
    references: [branches.id],
  }),
  receivedBy: one(users, {
    fields: [stockReceipts.receivedBy],
    references: [users.id],
  }),
  items: many(stockReceiptItems),
}));

export const stockReceiptItemsRelations = relations(stockReceiptItems, ({ one }) => ({
  stockReceipt: one(stockReceipts, {
    fields: [stockReceiptItems.stockReceiptId],
    references: [stockReceipts.id],
  }),
  purchaseOrderItem: one(purchaseOrderItems, {
    fields: [stockReceiptItems.purchaseOrderItemId],
    references: [purchaseOrderItems.id],
  }),
  stockItem: one(stockItems, {
    fields: [stockReceiptItems.stockItemId],
    references: [stockItems.id],
  }),
}));

export const stockCostHistoryRelations = relations(stockCostHistory, ({ one }) => ({
  stockItem: one(stockItems, {
    fields: [stockCostHistory.stockItemId],
    references: [stockItems.id],
  }),
  stockReceiptItem: one(stockReceiptItems, {
    fields: [stockCostHistory.stockReceiptItemId],
    references: [stockReceiptItems.id],
  }),
  purchaseOrder: one(purchaseOrders, {
    fields: [stockCostHistory.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  branch: one(branches, {
    fields: [stockCostHistory.branchId],
    references: [branches.id],
  }),
}));

// Purchase Order Schemas
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    poNumber: true,
  })
  .extend({
    subtotal: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    taxAmount: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    discountAmount: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    totalAmount: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
  });

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    quantity: z
      .union([z.string(), z.number()])      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    unitPrice: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    totalPrice: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    receivedQuantity: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
  });

export const insertStockReceiptSchema = createInsertSchema(stockReceipts)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    receiptNumber: true,
  })
  .extend({
    totalQuantity: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    totalValue: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
  });

export const insertStockReceiptItemSchema = createInsertSchema(stockReceiptItems)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    quantity: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    unitPrice: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    totalPrice: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
  });

export const insertStockCostHistorySchema = createInsertSchema(stockCostHistory)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    quantity: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    unitCost: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    totalCost: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
    remainingQuantity: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toString() : val)),
  });

// Inventory Types
export type MeasuringUnit = typeof measuringUnits.$inferSelect;
export type InsertMeasuringUnit = z.infer<typeof insertMeasuringUnitSchema>;

export type StockCategory = typeof stockCategories.$inferSelect;
export type InsertStockCategory = z.infer<typeof insertStockCategorySchema>;

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

export type StockItem = typeof stockItems.$inferSelect;
export type InsertStockItem = z.infer<typeof insertStockItemSchema>;

export type DishIngredient = typeof dishIngredients.$inferSelect;
export type InsertDishIngredient = z.infer<typeof insertDishIngredientSchema>;

export type StockConsumption = typeof stockConsumption.$inferSelect;
export type InsertStockConsumption = z.infer<
  typeof insertStockConsumptionSchema
>;

// Purchase Order Types
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type StockReceipt = typeof stockReceipts.$inferSelect;
export type InsertStockReceipt = z.infer<typeof insertStockReceiptSchema>;
export type StockReceiptItem = typeof stockReceiptItems.$inferSelect;
export type InsertStockReceiptItem = z.infer<typeof insertStockReceiptItemSchema>;
export type StockCostHistory = typeof stockCostHistory.$inferSelect;
export type InsertStockCostHistory = z.infer<typeof insertStockCostHistorySchema>;

// Custom Role Types
export type CustomRole = typeof customRoles.$inferSelect;
export type InsertCustomRole = z.infer<typeof insertCustomRoleSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type UserCustomRole = typeof userCustomRoles.$inferSelect;
export type InsertUserCustomRole = z.infer<typeof insertUserCustomRoleSchema>;