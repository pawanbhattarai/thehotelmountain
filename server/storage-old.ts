import {
  users,
  branches,
  rooms,
  roomTypes,
  guests,
  reservations,
  reservationRooms,
  hotelSettings,
  restaurantTables,
  menuCategories,
  menuDishes,
  restaurantOrders,
  restaurantOrderItems,
  restaurantBills,
  type User,
  type UpsertUser,
  type Branch,
  type InsertBranch,
  type Room,
  type InsertRoom,
  type RoomType,
  type InsertRoomType,
  type Guest,
  type InsertGuest,
  type Reservation,
  type InsertReservation,
  type ReservationRoom,
  type InsertReservationRoom,
  type HotelSettings,
  type InsertHotelSettings,
  type RestaurantTable,
  type InsertRestaurantTable,
  type MenuCategory,
  type InsertMenuCategory,
  type MenuDish,
  type InsertMenuDish,
  type RestaurantOrder,
  type InsertRestaurantOrder,
  type RestaurantOrderItem,
  type InsertRestaurantOrderItem,
  type RestaurantBill,
  type InsertRestaurantBill,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, between, sql, ilike } from "drizzle-orm";

export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, user: Partial<UpsertUser>): Promise<User>;

  // Branch operations
  getBranches(): Promise<Branch[]>;
  getBranch(id: number): Promise<Branch | undefined>;
  createBranch(branch: InsertBranch): Promise<Branch>;
  updateBranch(id: number, branch: Partial<InsertBranch>): Promise<Branch>;

  // Room operations
  getRooms(branchId?: number, status?: string): Promise<(Room & { roomType: RoomType; branch: Branch })[]>;
  getRoom(id: number): Promise<Room | undefined>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(id: number, room: Partial<InsertRoom>): Promise<Room>;
  getRoomsByBranch(branchId: number): Promise<Room[]>;

  // Room type operations
  getRoomTypes(branchId?: number): Promise<RoomType[]>;
  getRoomType(id: number): Promise<RoomType | undefined>;
  createRoomType(roomType: InsertRoomType): Promise<RoomType>;
  updateRoomType(id: number, roomType: Partial<InsertRoomType>): Promise<RoomType>;

  // Guest operations
  getGuests(branchId?: number): Promise<Guest[]>;
  getGuest(id: number): Promise<Guest | undefined>;
  createGuest(guest: InsertGuest): Promise<Guest>;
  updateGuest(id: number, guest: Partial<InsertGuest>): Promise<Guest>;
  searchGuests(query: string, branchId?: number): Promise<Guest[]>;

  // Reservation operations
  getReservations(branchId?: number): Promise<(Reservation & { guest: Guest; reservationRooms: (ReservationRoom & { room: Room & { roomType: RoomType } })[] })[]>;
  getReservation(id: string): Promise<(Reservation & { guest: Guest; reservationRooms: (ReservationRoom & { room: Room & { roomType: RoomType } })[] }) | undefined>;
  createReservation(reservation: InsertReservation, rooms: InsertReservationRoom[]): Promise<Reservation>;
  updateReservation(id: string, reservation: Partial<InsertReservation>): Promise<Reservation>;

  // Dashboard metrics
  getDashboardMetrics(branchId?: number): Promise<{
    totalReservations: number;
    occupancyRate: number;
    revenueToday: number;
    availableRooms: number;
    roomStatusCounts: Record<string, number>;
  }>;

  // Super admin dashboard metrics (all branches)
  getSuperAdminDashboardMetrics(): Promise<{
    totalBranches: number;
    totalReservations: number;
    totalRevenue: number;
    totalRooms: number;
    branchMetrics: Array<{
      branchId: number;
      branchName: string;
      totalReservations: number;
      occupancyRate: number;
      revenue: number;
      availableRooms: number;
    }>;
  }>;

  // Room availability
  getAvailableRooms(branchId: number, checkIn: string, checkOut: string): Promise<Room[]>;

  // Hotel settings operations
  getHotelSettings(branchId?: number): Promise<HotelSettings | undefined>;
  upsertHotelSettings(settings: InsertHotelSettings): Promise<HotelSettings>;

  getUserByEmail(email: string): Promise<User | undefined>;

  // Restaurant Management System operations
  // Restaurant tables
  getRestaurantTables(branchId?: number): Promise<RestaurantTable[]>;
  getRestaurantTable(id: number): Promise<RestaurantTable | undefined>;
  createRestaurantTable(table: InsertRestaurantTable): Promise<RestaurantTable>;
  updateRestaurantTable(id: number, table: Partial<InsertRestaurantTable>): Promise<RestaurantTable>;
  deleteRestaurantTable(id: number): Promise<void>;

  // Menu categories
  getMenuCategories(branchId?: number): Promise<MenuCategory[]>;
  getMenuCategory(id: number): Promise<MenuCategory | undefined>;
  createMenuCategory(category: InsertMenuCategory): Promise<MenuCategory>;
  updateMenuCategory(id: number, category: Partial<InsertMenuCategory>): Promise<MenuCategory>;
  deleteMenuCategory(id: number): Promise<void>;

  // Menu dishes
  getMenuDishes(branchId?: number, categoryId?: number): Promise<(MenuDish & { category: MenuCategory })[]>;
  getMenuDish(id: number): Promise<MenuDish | undefined>;
  createMenuDish(dish: InsertMenuDish): Promise<MenuDish>;
  updateMenuDish(id: number, dish: Partial<InsertMenuDish>): Promise<MenuDish>;
  deleteMenuDish(id: number): Promise<void>;

  // Restaurant orders
  getRestaurantOrders(branchId?: number, status?: string): Promise<(RestaurantOrder & { 
    table: RestaurantTable; 
    items: (RestaurantOrderItem & { dish: MenuDish })[];
    createdBy: User;
  })[]>;
  getRestaurantOrder(id: string): Promise<(RestaurantOrder & { 
    table: RestaurantTable; 
    items: (RestaurantOrderItem & { dish: MenuDish })[];
    createdBy: User;
  }) | undefined>;
  createRestaurantOrder(order: InsertRestaurantOrder, items: InsertRestaurantOrderItem[]): Promise<RestaurantOrder>;
  updateRestaurantOrder(id: string, order: Partial<InsertRestaurantOrder>): Promise<RestaurantOrder>;
  updateRestaurantOrderStatus(id: string, status: string): Promise<RestaurantOrder>;

  // Restaurant bills
  getRestaurantBills(branchId?: number): Promise<(RestaurantBill & { 
    order: RestaurantOrder; 
    table: RestaurantTable;
    createdBy: User;
  })[]>;
  getRestaurantBill(id: string): Promise<(RestaurantBill & { 
    order: RestaurantOrder & { items: (RestaurantOrderItem & { dish: MenuDish })[] }; 
    table: RestaurantTable;
    createdBy: User;
  }) | undefined>;
  createRestaurantBill(bill: InsertRestaurantBill): Promise<RestaurantBill>;
  updateRestaurantBill(id: string, bill: Partial<InsertRestaurantBill>): Promise<RestaurantBill>;

  // KOT/BOT operations
  generateKOT(orderId: string): Promise<{ kotItems: RestaurantOrderItem[]; orderNumber: string }>;
  generateBOT(orderId: string): Promise<{ botItems: RestaurantOrderItem[]; orderNumber: string }>;

  // Restaurant dashboard metrics
  getRestaurantDashboardMetrics(branchId?: number): Promise<{
    totalOrders: number;
    totalRevenue: number;
    activeOrders: number;
    availableTables: number;
    tableStatusCounts: Record<string, number>;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations - mandatory for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isActive, true)).orderBy(users.firstName, users.lastName);
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // Branch operations
  async getBranches(): Promise<Branch[]> {
    return await db.select().from(branches).where(eq(branches.isActive, true)).orderBy(branches.name);
  }

  async getBranch(id: number): Promise<Branch | undefined> {
    const [branch] = await db.select().from(branches).where(eq(branches.id, id));
    return branch;
  }

  async createBranch(branch: InsertBranch): Promise<Branch> {
    const [newBranch] = await db.insert(branches).values(branch).returning();
    return newBranch;
  }

  async updateBranch(id: number, branch: Partial<InsertBranch>): Promise<Branch> {
    const [updatedBranch] = await db
      .update(branches)
      .set({ ...branch, updatedAt: new Date() })
      .where(eq(branches.id, id))
      .returning();
    return updatedBranch;
  }

  // Room operations
  async getRooms(branchId?: number, status?: string): Promise<(Room & { roomType: RoomType; branch: Branch })[]> {
    const conditions = [eq(rooms.isActive, true)];

    if (branchId) {
      conditions.push(eq(rooms.branchId, branchId));
    }

    if (status) {
      conditions.push(eq(rooms.status, status));
    }

    const query = db.query.rooms.findMany({
      with: {
        roomType: true,
        branch: true,
      },
      where: conditions.length > 1 ? and(...conditions) : conditions[0],
      orderBy: rooms.number,
    });

    return await query;
  }

  async getRoom(id: number): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room;
  }

  async createRoom(room: InsertRoom): Promise<Room> {
    const [newRoom] = await db.insert(rooms).values(room).returning();
    return newRoom;
  }

  async updateRoom(id: number, room: Partial<InsertRoom>): Promise<Room> {
    const [updatedRoom] = await db
      .update(rooms)
      .set({ ...room, updatedAt: new Date() })
      .where(eq(rooms.id, id))
      .returning();
    return updatedRoom;
  }

  async getRoomsByBranch(branchId: number): Promise<Room[]> {
    return await db
      .select()
      .from(rooms)
      .where(and(eq(rooms.branchId, branchId), eq(rooms.isActive, true)))
      .orderBy(rooms.number);
  }

  // Room type operations
  async getRoomTypes(branchId?: number): Promise<RoomType[]> {
    if (branchId) {
      // For specific branch, return both branch-specific and unassigned room types
      return await db.select().from(roomTypes)
        .where(and(
          eq(roomTypes.isActive, true),
          or(
            eq(roomTypes.branchId, branchId),
            sql`${roomTypes.branchId} IS NULL`
          )
        ))
        .orderBy(roomTypes.name);
    } else {
      // For superadmin, return all active room types
      return await db.select().from(roomTypes)
        .where(eq(roomTypes.isActive, true))
        .orderBy(roomTypes.name);
    }
  }

  async getRoomType(id: number): Promise<RoomType | undefined> {
    const [roomType] = await db.select().from(roomTypes).where(eq(roomTypes.id, id));
    return roomType;
  }

  async createRoomType(roomType: InsertRoomType): Promise<RoomType> {
    const [newRoomType] = await db.insert(roomTypes).values(roomType).returning();
    return newRoomType;
  }

  async updateRoomType(id: number, roomType: Partial<InsertRoomType>): Promise<RoomType> {
    const [updatedRoomType] = await db
      .update(roomTypes)
      .set({
        ...roomType,
        updatedAt: new Date(),
      })
      .where(eq(roomTypes.id, id))
      .returning();
    return updatedRoomType;
  }

  // Guest operations
  async getGuests(branchId?: number): Promise<Guest[]> {
    const query = db.select().from(guests);
    if (branchId) {
      query.where(eq(guests.branchId, branchId));
    }
    return await query.orderBy(desc(guests.createdAt));
  }

  async getGuest(id: number): Promise<Guest | undefined> {
    const [guest] = await db.select().from(guests).where(eq(guests.id, id));
    return guest;
  }

  async createGuest(guest: InsertGuest): Promise<Guest> {
    const [newGuest] = await db.insert(guests).values(guest).returning();
    return newGuest;
  }

  async updateGuest(id: number, guest: Partial<InsertGuest>): Promise<Guest> {
    const [updatedGuest] = await db
      .update(guests)
      .set({ ...guest, updatedAt: new Date() })
      .where(eq(guests.id, id))
      .returning();
    return updatedGuest;
  }

  async searchGuests(query: string, branchId?: number): Promise<Guest[]> {
    const searchCondition = or(
      ilike(guests.firstName, `%${query}%`),
      ilike(guests.lastName, `%${query}%`),
      ilike(guests.email, `%${query}%`),
      ilike(guests.phone, `%${query}%`)
    );

    const conditions = branchId 
      ? and(searchCondition, eq(guests.branchId, branchId))
      : searchCondition;

    return await db.select().from(guests).where(conditions).limit(10);
  }

  // Reservation operations
  async getReservations(branchId?: number): Promise<(Reservation & { guest: Guest; reservationRooms: (ReservationRoom & { room: Room & { roomType: RoomType } })[] })[]> {
    const query = db.query.reservations.findMany({
      with: {
        guest: true,
        reservationRooms: {
          with: {
            room: {
              with: {
                roomType: true,
              },
            },
          },
        },
      },
      where: branchId ? eq(reservations.branchId, branchId) : undefined,
      orderBy: desc(reservations.createdAt),
    });

    return await query;
  }

  async getReservation(id: string): Promise<(Reservation & { guest: Guest; reservationRooms: (ReservationRoom & { room: Room & { roomType: RoomType } })[] }) | undefined> {
    return await db.query.reservations.findFirst({
      with: {
        guest: true,
        reservationRooms: {
          with: {
            room: {
              with: {
                roomType: true,
              },
            },
          },
        },
      },
      where: eq(reservations.id, id),
    });
  }

  async createReservation(reservation: InsertReservation, roomsData: InsertReservationRoom[]): Promise<Reservation> {
    return await db.transaction(async (tx) => {
      const [newReservation] = await tx.insert(reservations).values(reservation).returning();

      const roomsWithReservationId = roomsData.map(room => ({
        ...room,
        reservationId: newReservation.id,
      }));

      await tx.insert(reservationRooms).values(roomsWithReservationId);

      // Update guest reservation count
      await tx
        .update(guests)
        .set({ 
          reservationCount: sql`${guests.reservationCount} + 1`
        })
        .where(eq(guests.id, reservation.guestId));

      return newReservation;
    });
  }

  async updateReservation(id: string, reservation: Partial<InsertReservation>): Promise<Reservation> {
    const [updatedReservation] = await db
      .update(reservations)
      .set({ ...reservation, updatedAt: new Date() })
      .where(eq(reservations.id, id))
      .returning();
    return updatedReservation;
  }

  // Dashboard metrics
  async getDashboardMetrics(branchId?: number): Promise<{
    totalReservations: number;
    occupancyRate: number;
    revenueToday: number;
    availableRooms: number;
    roomStatusCounts: Record<string, number>;
  }> {
    const today = new Date().toISOString().split('T')[0];

    // Total reservations
    let totalReservationsQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(reservations);

    if (branchId) {
      totalReservationsQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(reservations)
        .where(eq(reservations.branchId, branchId));
    }

    const [{ count: totalReservations }] = await totalReservationsQuery;

    // Room status counts
    let roomStatusQuery = db
      .select({
        status: rooms.status,
        count: sql<number>`count(*)`,
      })
      .from(rooms)
      .where(eq(rooms.isActive, true))
      .groupBy(rooms.status);

    if (branchId) {
      roomStatusQuery = db
        .select({
          status: rooms.status,
          count: sql<number>`count(*)`,
        })
        .from(rooms)
        .where(and(eq(rooms.isActive, true), eq(rooms.branchId, branchId)))
        .groupBy(rooms.status);
    }

    const roomStatusResults = await roomStatusQuery;
    const roomStatusCounts = roomStatusResults.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {} as Record<string, number>);

    // Calculate occupancy rate
    const totalRooms = Object.values(roomStatusCounts).reduce((sum, count) => sum + count, 0);
    const occupiedRooms = roomStatusCounts.occupied || 0;
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    // Revenue today (simplified - sum of paid amounts for today's check-ins)
    let revenueTodayQuery = db
      .select({ sum: sql<number>`COALESCE(SUM(${reservations.paidAmount}), 0)` })
      .from(reservations)
      .innerJoin(reservationRooms, eq(reservations.id, reservationRooms.reservationId))
      .where(eq(reservationRooms.checkInDate, today));

    if (branchId) {
      revenueTodayQuery = db
        .select({ sum: sql<number>`COALESCE(SUM(${reservations.paidAmount}), 0)` })
        .from(reservations)
        .innerJoin(reservationRooms, eq(reservations.id, reservationRooms.reservationId))
        .where(and(
          eq(reservationRooms.checkInDate, today),
          eq(reservations.branchId, branchId)
        ));
    }

    const [{ sum: revenueToday }] = await revenueTodayQuery;

    return {
      totalReservations,
      occupancyRate: Math.round(occupancyRate),
      revenueToday: revenueToday || 0,
      availableRooms: roomStatusCounts.available || 0,
      roomStatusCounts,
    };
  }

  // Room availability
  async getAvailableRooms(branchId: number, checkIn: string, checkOut: string): Promise<Room[]> {
    // Get rooms that are not reserved for the given date range
    const reservedRoomIds = db
      .select({ roomId: reservationRooms.roomId })
      .from(reservationRooms)
      .where(
        and(
          or(
            between(reservationRooms.checkInDate, checkIn, checkOut),
            between(reservationRooms.checkOutDate, checkIn, checkOut),
            and(
              sql`${reservationRooms.checkInDate} <= ${checkIn}`,
              sql`${reservationRooms.checkOutDate} >= ${checkOut}`
            )
          )
        )
      );

    return await db
      .select()
      .from(rooms)
      .where(
        and(
          eq(rooms.branchId, branchId),
          eq(rooms.isActive, true),
          eq(rooms.status, 'available'),
          sql`${rooms.id} NOT IN ${reservedRoomIds}`
        )
      )
      .orderBy(rooms.number);
  }

  async getSuperAdminDashboardMetrics(): Promise<{
    totalBranches: number;
    totalReservations: number;
    totalRevenue: number;
    totalRooms: number;
    branchMetrics: Array<{
      branchId: number;
      branchName: string;
      totalReservations: number;
      occupancyRate: number;
      revenue: number;
      availableRooms: number;
    }>;
  }> {
    // Get total branches
    const [{ count: totalBranches }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(branches)
      .where(eq(branches.isActive, true));

    // Get total reservations
    const [{ count: totalReservations }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(reservations);

    // Get total revenue
    const [{ sum: totalRevenue }] = await db
      .select({ sum: sql<number>`COALESCE(SUM(${reservations.paidAmount}), 0)` })
      .from(reservations);

    // Get total rooms
    const [{ count: totalRooms }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(rooms)
      .where(eq(rooms.isActive, true));

    // Get branch metrics
    const branchesData = await db
      .select()
      .from(branches)
      .where(eq(branches.isActive, true));

    const branchMetrics = await Promise.all(
      branchesData.map(async (branch) => {
        const metrics = await this.getDashboardMetrics(branch.id);
        return {
          branchId: branch.id,
          branchName: branch.name,
          totalReservations: metrics.totalReservations,
          occupancyRate: metrics.occupancyRate,
          revenue: metrics.revenueToday,
          availableRooms: metrics.availableRooms,
        };
      })
    );

    return {
      totalBranches,
      totalReservations,
      totalRevenue: totalRevenue || 0,
      totalRooms,
      branchMetrics,
    };
  }

  async getHotelSettings(branchId?: number): Promise<HotelSettings | undefined> {
    let query = db.select().from(hotelSettings);
    
    if (branchId) {
      query = query.where(eq(hotelSettings.branchId, branchId));
    } else {
      query = query.where(sql`${hotelSettings.branchId} IS NULL`);
    }
    
    const [settings] = await query;
    return settings;
  }

  async upsertHotelSettings(settings: InsertHotelSettings): Promise<HotelSettings> {
    const [result] = await db
      .insert(hotelSettings)
      .values(settings)
      .onConflictDoUpdate({
        target: [hotelSettings.branchId],
        set: {
          ...settings,
          updatedAt: sql`NOW()`,
        },
      })
      .returning();
    return result;
  }

  // Restaurant Management System Methods

  // Restaurant Tables
  async getRestaurantTables(branchId?: number): Promise<RestaurantTable[]> {
    if (branchId) {
      return await db
        .select()
        .from(restaurantTables)
        .where(and(eq(restaurantTables.isActive, true), eq(restaurantTables.branchId, branchId)))
        .orderBy(restaurantTables.name);
    }
    
    return await db
      .select()
      .from(restaurantTables)
      .where(eq(restaurantTables.isActive, true))
      .orderBy(restaurantTables.name);
  }

  async getRestaurantTable(id: number): Promise<RestaurantTable | undefined> {
    const [table] = await db.select().from(restaurantTables).where(eq(restaurantTables.id, id));
    return table;
  }

  async createRestaurantTable(table: InsertRestaurantTable): Promise<RestaurantTable> {
    const [result] = await db.insert(restaurantTables).values(table).returning();
    return result;
  }

  async updateRestaurantTable(id: number, table: Partial<InsertRestaurantTable>): Promise<RestaurantTable> {
    const [result] = await db
      .update(restaurantTables)
      .set({ ...table, updatedAt: sql`NOW()` })
      .where(eq(restaurantTables.id, id))
      .returning();
    return result;
  }

  async deleteRestaurantTable(id: number): Promise<void> {
    await db
      .update(restaurantTables)
      .set({ isActive: false, updatedAt: sql`NOW()` })
      .where(eq(restaurantTables.id, id));
  }

  // Menu Categories
  async getMenuCategories(branchId?: number): Promise<MenuCategory[]> {
    let query = db.select().from(menuCategories).where(eq(menuCategories.isActive, true));
    
    if (branchId) {
      query = query.where(and(eq(menuCategories.isActive, true), eq(menuCategories.branchId, branchId)));
    }
    
    return await query.orderBy(menuCategories.sortOrder, menuCategories.name);
  }

  async getMenuCategory(id: number): Promise<MenuCategory | undefined> {
    const [category] = await db.select().from(menuCategories).where(eq(menuCategories.id, id));
    return category;
  }

  async createMenuCategory(category: InsertMenuCategory): Promise<MenuCategory> {
    const [result] = await db.insert(menuCategories).values(category).returning();
    return result;
  }

  async updateMenuCategory(id: number, category: Partial<InsertMenuCategory>): Promise<MenuCategory> {
    const [result] = await db
      .update(menuCategories)
      .set({ ...category, updatedAt: sql`NOW()` })
      .where(eq(menuCategories.id, id))
      .returning();
    return result;
  }

  async deleteMenuCategory(id: number): Promise<void> {
    await db
      .update(menuCategories)
      .set({ isActive: false, updatedAt: sql`NOW()` })
      .where(eq(menuCategories.id, id));
  }

  // Menu Dishes
  async getMenuDishes(branchId?: number, categoryId?: number): Promise<(MenuDish & { category: MenuCategory })[]> {
    let query = db
      .select({
        ...menuDishes,
        category: menuCategories,
      })
      .from(menuDishes)
      .innerJoin(menuCategories, eq(menuDishes.categoryId, menuCategories.id))
      .where(and(eq(menuDishes.isActive, true), eq(menuCategories.isActive, true)));
    
    if (branchId) {
      query = query.where(and(
        eq(menuDishes.isActive, true), 
        eq(menuCategories.isActive, true),
        eq(menuDishes.branchId, branchId)
      ));
    }
    
    if (categoryId) {
      query = query.where(and(
        eq(menuDishes.isActive, true), 
        eq(menuCategories.isActive, true),
        eq(menuDishes.categoryId, categoryId)
      ));
    }
    
    return await query.orderBy(menuDishes.sortOrder, menuDishes.name) as (MenuDish & { category: MenuCategory })[];
  }

  async getMenuDish(id: number): Promise<MenuDish | undefined> {
    const [dish] = await db.select().from(menuDishes).where(eq(menuDishes.id, id));
    return dish;
  }

  async createMenuDish(dish: InsertMenuDish): Promise<MenuDish> {
    const [result] = await db.insert(menuDishes).values(dish).returning();
    return result;
  }

  async updateMenuDish(id: number, dish: Partial<InsertMenuDish>): Promise<MenuDish> {
    const [result] = await db
      .update(menuDishes)
      .set({ ...dish, updatedAt: sql`NOW()` })
      .where(eq(menuDishes.id, id))
      .returning();
    return result;
  }

  async deleteMenuDish(id: number): Promise<void> {
    await db
      .update(menuDishes)
      .set({ isActive: false, updatedAt: sql`NOW()` })
      .where(eq(menuDishes.id, id));
  }

  // Restaurant Orders
  async getRestaurantOrders(branchId?: number, status?: string): Promise<(RestaurantOrder & { 
    table: RestaurantTable; 
    items: (RestaurantOrderItem & { dish: MenuDish })[];
    createdBy: User;
  })[]> {
    let whereConditions = [];
    
    if (branchId) {
      whereConditions.push(eq(restaurantOrders.branchId, branchId));
    }
    
    if (status) {
      whereConditions.push(eq(restaurantOrders.status, status));
    }

    const orders = await db
      .select({
        ...restaurantOrders,
        table: restaurantTables,
        createdBy: users,
      })
      .from(restaurantOrders)
      .innerJoin(restaurantTables, eq(restaurantOrders.tableId, restaurantTables.id))
      .innerJoin(users, eq(restaurantOrders.createdById, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(restaurantOrders.createdAt));

    // Get order items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await db
          .select({
            ...restaurantOrderItems,
            dish: menuDishes,
          })
          .from(restaurantOrderItems)
          .innerJoin(menuDishes, eq(restaurantOrderItems.dishId, menuDishes.id))
          .where(eq(restaurantOrderItems.orderId, order.id));

        return {
          ...order,
          items: items as (RestaurantOrderItem & { dish: MenuDish })[],
        };
      })
    );

    return ordersWithItems as (RestaurantOrder & { 
      table: RestaurantTable; 
      items: (RestaurantOrderItem & { dish: MenuDish })[];
      createdBy: User;
    })[];
  }

  async getRestaurantOrder(id: string): Promise<(RestaurantOrder & { 
    table: RestaurantTable; 
    items: (RestaurantOrderItem & { dish: MenuDish })[];
    createdBy: User;
  }) | undefined> {
    const [order] = await db
      .select({
        ...restaurantOrders,
        table: restaurantTables,
        createdBy: users,
      })
      .from(restaurantOrders)
      .innerJoin(restaurantTables, eq(restaurantOrders.tableId, restaurantTables.id))
      .innerJoin(users, eq(restaurantOrders.createdById, users.id))
      .where(eq(restaurantOrders.id, id));

    if (!order) return undefined;

    const items = await db
      .select({
        ...restaurantOrderItems,
        dish: menuDishes,
      })
      .from(restaurantOrderItems)
      .innerJoin(menuDishes, eq(restaurantOrderItems.dishId, menuDishes.id))
      .where(eq(restaurantOrderItems.orderId, id));

    return {
      ...order,
      items: items as (RestaurantOrderItem & { dish: MenuDish })[],
    } as (RestaurantOrder & { 
      table: RestaurantTable; 
      items: (RestaurantOrderItem & { dish: MenuDish })[];
      createdBy: User;
    });
  }

  async createRestaurantOrder(order: InsertRestaurantOrder, items: InsertRestaurantOrderItem[]): Promise<RestaurantOrder> {
    return await db.transaction(async (tx) => {
      // Create order
      const [newOrder] = await tx.insert(restaurantOrders).values(order).returning();
      
      // Create order items with the new order ID
      const orderItemsWithOrderId = items.map(item => ({
        ...item,
        orderId: newOrder.id,
      }));
      
      await tx.insert(restaurantOrderItems).values(orderItemsWithOrderId);
      
      // Update table status to occupied
      await tx
        .update(restaurantTables)
        .set({ status: 'occupied', updatedAt: sql`NOW()` })
        .where(eq(restaurantTables.id, order.tableId));
      
      return newOrder;
    });
  }

  async updateRestaurantOrder(id: string, order: Partial<InsertRestaurantOrder>): Promise<RestaurantOrder> {
    const [result] = await db
      .update(restaurantOrders)
      .set({ ...order, updatedAt: sql`NOW()` })
      .where(eq(restaurantOrders.id, id))
      .returning();
    return result;
  }

  async updateRestaurantOrderStatus(id: string, status: string): Promise<RestaurantOrder> {
    const updateData: any = { status, updatedAt: sql`NOW()` };
    
    if (status === 'served') {
      updateData.servedAt = sql`NOW()`;
    } else if (status === 'completed') {
      updateData.completedAt = sql`NOW()`;
      
      // Set table status back to open when order is completed
      const [order] = await db.select().from(restaurantOrders).where(eq(restaurantOrders.id, id));
      if (order) {
        await db
          .update(restaurantTables)
          .set({ status: 'open', updatedAt: sql`NOW()` })
          .where(eq(restaurantTables.id, order.tableId));
      }
    }

    const [result] = await db
      .update(restaurantOrders)
      .set(updateData)
      .where(eq(restaurantOrders.id, id))
      .returning();
    return result;
  }

  // Restaurant Bills
  async getRestaurantBills(branchId?: number): Promise<(RestaurantBill & { 
    order: RestaurantOrder; 
    table: RestaurantTable;
    createdBy: User;
  })[]> {
    let query = db
      .select({
        ...restaurantBills,
        order: restaurantOrders,
        table: restaurantTables,
        createdBy: users,
      })
      .from(restaurantBills)
      .innerJoin(restaurantOrders, eq(restaurantBills.orderId, restaurantOrders.id))
      .innerJoin(restaurantTables, eq(restaurantBills.tableId, restaurantTables.id))
      .innerJoin(users, eq(restaurantBills.createdById, users.id))
      .orderBy(desc(restaurantBills.createdAt));

    if (branchId) {
      query = query.where(eq(restaurantBills.branchId, branchId));
    }

    return await query as (RestaurantBill & { 
      order: RestaurantOrder; 
      table: RestaurantTable;
      createdBy: User;
    })[];
  }

  async getRestaurantBill(id: string): Promise<(RestaurantBill & { 
    order: RestaurantOrder & { items: (RestaurantOrderItem & { dish: MenuDish })[] }; 
    table: RestaurantTable;
    createdBy: User;
  }) | undefined> {
    const [bill] = await db
      .select({
        ...restaurantBills,
        order: restaurantOrders,
        table: restaurantTables,
        createdBy: users,
      })
      .from(restaurantBills)
      .innerJoin(restaurantOrders, eq(restaurantBills.orderId, restaurantOrders.id))
      .innerJoin(restaurantTables, eq(restaurantBills.tableId, restaurantTables.id))
      .innerJoin(users, eq(restaurantBills.createdById, users.id))
      .where(eq(restaurantBills.id, id));

    if (!bill) return undefined;

    // Get order items
    const items = await db
      .select({
        ...restaurantOrderItems,
        dish: menuDishes,
      })
      .from(restaurantOrderItems)
      .innerJoin(menuDishes, eq(restaurantOrderItems.dishId, menuDishes.id))
      .where(eq(restaurantOrderItems.orderId, bill.order.id));

    return {
      ...bill,
      order: {
        ...bill.order,
        items: items as (RestaurantOrderItem & { dish: MenuDish })[],
      },
    } as (RestaurantBill & { 
      order: RestaurantOrder & { items: (RestaurantOrderItem & { dish: MenuDish })[] }; 
      table: RestaurantTable;
      createdBy: User;
    });
  }

  async createRestaurantBill(bill: InsertRestaurantBill): Promise<RestaurantBill> {
    const [result] = await db.insert(restaurantBills).values(bill).returning();
    return result;
  }

  async updateRestaurantBill(id: string, bill: Partial<InsertRestaurantBill>): Promise<RestaurantBill> {
    const [result] = await db
      .update(restaurantBills)
      .set({ ...bill, updatedAt: sql`NOW()` })
      .where(eq(restaurantBills.id, id))
      .returning();
    return result;
  }

  // KOT/BOT Operations
  async generateKOT(orderId: string): Promise<{ kotItems: RestaurantOrderItem[]; orderNumber: string }> {
    return await db.transaction(async (tx) => {
      // Get order details
      const [order] = await tx.select().from(restaurantOrders).where(eq(restaurantOrders.id, orderId));
      if (!order) throw new Error('Order not found');

      // Get items that need KOT (food items, not beverages)
      const kotItems = await tx
        .select()
        .from(restaurantOrderItems)
        .innerJoin(menuDishes, eq(restaurantOrderItems.dishId, menuDishes.id))
        .where(and(
          eq(restaurantOrderItems.orderId, orderId),
          eq(restaurantOrderItems.isKot, false),
          or(
            sql`${menuDishes.spiceLevel} IS NOT NULL`,
            sql`${menuDishes.preparationTime} > 0`
          )
        ));

      // Mark items as KOT generated
      if (kotItems.length > 0) {
        await tx
          .update(restaurantOrderItems)
          .set({ isKot: true })
          .where(and(
            eq(restaurantOrderItems.orderId, orderId),
            sql`${restaurantOrderItems.id} IN (${kotItems.map(item => item.restaurant_order_items.id).join(',')})`
          ));

        // Mark order as KOT generated
        await tx
          .update(restaurantOrders)
          .set({ kotGenerated: true, kotGeneratedAt: sql`NOW()` })
          .where(eq(restaurantOrders.id, orderId));
      }

      return { 
        kotItems: kotItems.map(item => item.restaurant_order_items), 
        orderNumber: order.orderNumber 
      };
    });
  }

  async generateBOT(orderId: string): Promise<{ botItems: RestaurantOrderItem[]; orderNumber: string }> {
    return await db.transaction(async (tx) => {
      // Get order details
      const [order] = await tx.select().from(restaurantOrders).where(eq(restaurantOrders.id, orderId));
      if (!order) throw new Error('Order not found');

      // Get beverage items that need BOT
      const botItems = await tx
        .select()
        .from(restaurantOrderItems)
        .innerJoin(menuDishes, eq(restaurantOrderItems.dishId, menuDishes.id))
        .innerJoin(menuCategories, eq(menuDishes.categoryId, menuCategories.id))
        .where(and(
          eq(restaurantOrderItems.orderId, orderId),
          eq(restaurantOrderItems.isBot, false),
          or(
            ilike(menuCategories.name, '%beverage%'),
            ilike(menuCategories.name, '%drink%'),
            ilike(menuCategories.name, '%juice%'),
            ilike(menuCategories.name, '%tea%'),
            ilike(menuCategories.name, '%coffee%')
          )
        ));

      // Mark items as BOT generated
      if (botItems.length > 0) {
        await tx
          .update(restaurantOrderItems)
          .set({ isBot: true })
          .where(and(
            eq(restaurantOrderItems.orderId, orderId),
            sql`${restaurantOrderItems.id} IN (${botItems.map(item => item.restaurant_order_items.id).join(',')})`
          ));

        // Mark order as BOT generated
        await tx
          .update(restaurantOrders)
          .set({ botGenerated: true, botGeneratedAt: sql`NOW()` })
          .where(eq(restaurantOrders.id, orderId));
      }

      return { 
        botItems: botItems.map(item => item.restaurant_order_items), 
        orderNumber: order.orderNumber 
      };
    });
  }

  // Restaurant Dashboard Metrics
  async getRestaurantDashboardMetrics(branchId?: number): Promise<{
    totalOrders: number;
    totalRevenue: number;
    activeOrders: number;
    availableTables: number;
    tableStatusCounts: Record<string, number>;
  }> {
    const today = new Date().toISOString().split('T')[0];

    // Total orders today
    let totalOrdersQuery = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(restaurantOrders)
      .where(sql`DATE(${restaurantOrders.createdAt}) = ${today}`);

    if (branchId) {
      totalOrdersQuery = totalOrdersQuery.where(and(
        sql`DATE(${restaurantOrders.createdAt}) = ${today}`,
        eq(restaurantOrders.branchId, branchId)
      ));
    }

    const [{ count: totalOrders }] = await totalOrdersQuery;

    // Total revenue today
    let totalRevenueQuery = db
      .select({ sum: sql<number>`COALESCE(SUM(${restaurantOrders.totalAmount}), 0)` })
      .from(restaurantOrders)
      .where(and(
        sql`DATE(${restaurantOrders.createdAt}) = ${today}`,
        eq(restaurantOrders.paymentStatus, 'paid')
      ));

    if (branchId) {
      totalRevenueQuery = totalRevenueQuery.where(and(
        sql`DATE(${restaurantOrders.createdAt}) = ${today}`,
        eq(restaurantOrders.paymentStatus, 'paid'),
        eq(restaurantOrders.branchId, branchId)
      ));
    }

    const [{ sum: totalRevenue }] = await totalRevenueQuery;

    // Active orders (not completed or cancelled)
    let activeOrdersQuery = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(restaurantOrders)
      .where(sql`${restaurantOrders.status} NOT IN ('completed', 'cancelled')`);

    if (branchId) {
      activeOrdersQuery = activeOrdersQuery.where(and(
        sql`${restaurantOrders.status} NOT IN ('completed', 'cancelled')`,
        eq(restaurantOrders.branchId, branchId)
      ));
    }

    const [{ count: activeOrders }] = await activeOrdersQuery;

    // Table status counts
    let tableStatusQuery = db
      .select({
        status: restaurantTables.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(restaurantTables)
      .where(eq(restaurantTables.isActive, true))
      .groupBy(restaurantTables.status);

    if (branchId) {
      tableStatusQuery = tableStatusQuery.where(and(
        eq(restaurantTables.isActive, true),
        eq(restaurantTables.branchId, branchId)
      ));
    }

    const tableStatusResults = await tableStatusQuery;
    const tableStatusCounts = tableStatusResults.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalOrders,
      totalRevenue: totalRevenue || 0,
      activeOrders,
      availableTables: tableStatusCounts.open || 0,
      tableStatusCounts,
    };
  }
}

export const storage = new DatabaseStorage();