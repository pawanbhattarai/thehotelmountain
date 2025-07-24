import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, gte, lt, desc, sql, isNull, or, inArray, lte } from "drizzle-orm";
import {
  branches,
  users,
  rooms,
  roomTypes,
  guests,
  reservations,
  reservationRooms,
  payments,
  hotelSettings,
  pushSubscriptions,
  notificationHistory,
  auditLogs,
  taxes,
  printerConfigurations,
  type User,
  type Branch,
  type RoomType,
  type Room,
  type Guest,
  type Reservation,
  type ReservationRoom,
  type Payment,
  type HotelSettings,
  type PushSubscription,
  type NotificationHistory,
  type Tax,
  type PrinterConfiguration,
  type InsertUser,
  type InsertBranch,
  type InsertRoomType,
  type InsertRoom,
  type InsertGuest,
  type InsertReservation,
  type InsertReservationRoom,
  type InsertPayment,
  type InsertHotelSettings,
  type InsertPushSubscription,
  type InsertNotificationHistory,
  type InsertTax,
  type InsertPrinterConfiguration,
} from "@shared/schema";

// Import roleStorage for custom role management
import { roleStorage } from "./role-storage";
import crypto from "crypto";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const client = postgres(process.env.DATABASE_URL);
export const db = drizzle(client);

export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;

  // Branch operations
  getBranches(): Promise<Branch[]>;
  getBranch(id: number): Promise<Branch | undefined>;
  createBranch(branch: InsertBranch): Promise<Branch>;
  updateBranch(id: number, branch: Partial<InsertBranch>): Promise<Branch>;
  deleteBranch(id: number): Promise<void>;

  // Room Type operations
  getRoomTypes(branchId?: number): Promise<RoomType[]>;
  getRoomType(id: number): Promise<RoomType | undefined>;
  createRoomType(roomType: InsertRoomType): Promise<RoomType>;
  updateRoomType(
    id: number,
    roomType: Partial<InsertRoomType>,
  ): Promise<RoomType>;
  deleteRoomType(id: number): Promise<void>;
  createRoomTypesBulk(roomTypes: InsertRoomType[]): Promise<RoomType[]>;

  // Room operations
  getRooms(
    branchId?: number,
    status?: string,
  ): Promise<(Room & { roomType: RoomType; branch: Branch })[]>;
  getRoom(
    id: number,
  ): Promise<(Room & { roomType: RoomType; branch: Branch }) | undefined>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(id: number, room: Partial<InsertRoom>): Promise<Room>;
  deleteRoom(id: number): Promise<void>;
  createRoomsBulk(rooms: InsertRoom[]): Promise<Room[]>;

  // Guest operations
  getGuests(branchId?: number): Promise<Guest[]>;
  getGuest(id: string): Promise<Guest | undefined>;
  createGuest(guest: InsertGuest): Promise<Guest>;
  updateGuest(id: string, guest: Partial<InsertGuest>): Promise<Guest>;
  deleteGuest(id: string): Promise<void>;
  searchGuests(query: string, branchId?: number): Promise<Guest[]>;
  findGuestByPhone(phone: string): Promise<Guest | undefined>;

  // Reservation operations
  getReservations(branchId?: number): Promise<
    (Reservation & {
      guest: Guest;
      reservationRooms: (ReservationRoom & {
        room: Room & { roomType: RoomType };
      })[];
    })[]
  >;
  getReservation(id: string): Promise<
    | (Reservation & {
        guest: Guest;
        reservationRooms: (ReservationRoom & {
          room: Room & { roomType: RoomType };
        })[];
      })
    | undefined
  >;
  createReservation(
    reservation: InsertReservation,
    roomsData?: InsertReservationRoom[],
  ): Promise<Reservation>;
  updateReservation(
    id: string,
    reservation: Partial<InsertReservation>,
  ): Promise<Reservation>;
  deleteReservation(id: string): Promise<void>;

  // Reservation Room operations
  createReservationRoom(
    reservationRoom: InsertReservationRoom,
  ): Promise<ReservationRoom>;
  getReservationRooms(reservationId: string): Promise<
    (ReservationRoom & {
      room: Room & { roomType: RoomType };
    })[]
  >;

  // Hotel Settings operations
  getHotelSettings(): Promise<HotelSettings | undefined>;
  upsertHotelSettings(settings: InsertHotelSettings): Promise<HotelSettings>;

  // Push Subscription operations
  savePushSubscription(subscription: InsertPushSubscription): Promise<void>;
  getPushSubscriptions(userId?: string): Promise<PushSubscription[]>;
  removePushSubscription(endpoint: string): Promise<void>;
  clearAllPushSubscriptions(): Promise<void>;
  createPushSubscription(
    subscription: InsertPushSubscription,
  ): Promise<PushSubscription>;
  getPushSubscription(
    userId: string,
    endpoint: string,
  ): Promise<PushSubscription | undefined>;
  deletePushSubscription(userId: string, endpoint: string): Promise<void>;
  getAllAdminSubscriptions(): Promise<(PushSubscription & { user?: User })[]>;
  getBranchAdminSubscriptions(branchId?: number): Promise<PushSubscription[]>;
  getAllPushSubscriptions(): Promise<PushSubscription[]>;

  // Notification History operations
  saveNotificationHistory(
    notification: InsertNotificationHistory,
  ): Promise<void>;
  getNotificationHistory(
    userId?: string,
    limit?: number,
  ): Promise<NotificationHistory[]>;
  createNotificationHistory(
    notification: InsertNotificationHistory,
  ): Promise<NotificationHistory>;
  markNotificationAsRead(notificationId: number, userId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  // Tax operations
  getTaxes(applicationType?: string): Promise<Tax[]>;
  getTax(id: number): Promise<Tax | undefined>;
  createTax(tax: InsertTax): Promise<Tax>;
  updateTax(id: number, tax: Partial<InsertTax>): Promise<Tax>;
  deleteTax(id: number): Promise<void>;

  // Analytics operations
  getRevenueAnalytics(branchId?: number, period?: string): Promise<any>;
  getOccupancyAnalytics(branchId?: number, period?: string): Promise<any>;
  getGuestAnalytics(branchId?: number): Promise<any>;
  getRoomPerformanceAnalytics(branchId?: number): Promise<any>;
  getOperationalAnalytics(branchId?: number): Promise<any>;

  // Dashboard metrics - updated for 24-hour specific data
  getDashboardMetrics(branchId?: number): Promise<{
    totalRooms: number;
    occupiedRooms: number;
    todayReservations: number;
    todayRevenue: number;
    roomStatusCounts: Record<string, number>;
  }>;

  // 24-hour specific methods
  getTodayReservations(branchId?: number): Promise<
    (Reservation & {
      guest: Guest;
      reservationRooms: (ReservationRoom & {
        room: Room & { roomType: RoomType };
      })[];
    })[]
  >;
  // User operations - mandatory for Replit Auth
  getUsers(): Promise<any[]>;

  // Audit Logs methods
  getAuditLogs(filters: {
    userId?: string;
    entity?: string;
    action?: string;
    branchId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]>;
  getAuditLogCount(filters: {
    userId?: string;
    entity?: string;
    action?: string;
    branchId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number>;

  // Payment operations
  getPaymentsByReservation(reservationId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePaymentStatus(paymentId: number, status: string): Promise<Payment>;
  getReservationWithPayments(reservationId: string): Promise<(Reservation & { payments: Payment[] }) | undefined>;

  // Printer Configuration operations
  getPrinterConfigurations(branchId?: number): Promise<PrinterConfiguration[]>;
  getPrinterConfiguration(id: number): Promise<PrinterConfiguration | undefined>;
  getPrinterConfigurationByType(branchId: number, printerType: string): Promise<PrinterConfiguration | undefined>;
  createPrinterConfiguration(config: InsertPrinterConfiguration): Promise<PrinterConfiguration>;
  updatePrinterConfiguration(id: number, config: Partial<InsertPrinterConfiguration>): Promise<PrinterConfiguration>;
  deletePrinterConfiguration(id: number): Promise<void>;
  testPrinterConnection(id: number): Promise<{ success: boolean; message: string }>;
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

  async upsertUser(user: InsertUser): Promise<User> {
    const [result] = await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        },
      })
      .returning();
    return result;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getAllUsersWithCustomRoles(): Promise<
    (User & { customRoleIds: number[] })[]
  > {
    const allUsers = await db.select().from(users);

    const usersWithRoles = await Promise.all(
      allUsers.map(async (user) => {
        const customRoleIds = await roleStorage.getUserRoles(user.id);
        return {
          ...user,
          customRoleIds,
        };
      }),
    );

    return usersWithRoles;
  }

  async getUserWithCustomRoles(
    userId: string,
  ): Promise<(User & { customRoleIds: number[] }) | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;

    const customRoleIds = await roleStorage.getUserRoles(userId);
    return {
      ...user,
      customRoleIds,
    };
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User> {
    const [result] = await db
      .update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    return result;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Branch operations
  async getBranches(): Promise<Branch[]> {
    return await db.select().from(branches).orderBy(branches.name);
  }

  async getBranch(id: number): Promise<Branch | undefined> {
    const [branch] = await db
      .select()
      .from(branches)
      .where(eq(branches.id, id));
    return branch;
  }

  async createBranch(branch: InsertBranch): Promise<Branch> {
    const [result] = await db.insert(branches).values(branch).returning();
    return result;
  }

  async updateBranch(
    id: number,
    branch: Partial<InsertBranch>,
  ): Promise<Branch> {
    const [result] = await db
      .update(branches)
      .set(branch)
      .where(eq(branches.id, id))
      .returning();
    return result;
  }

  async deleteBranch(id: number): Promise<void> {
    await db.delete(branches).where(eq(branches.id, id));
  }

  // Room Type operations
  async getRoomTypes(branchId?: number): Promise<RoomType[]> {
    let query = db.select().from(roomTypes);

    if (branchId) {
      query = query.where(
        or(eq(roomTypes.branchId, branchId), isNull(roomTypes.branchId)),
      );
    }

    return await query.orderBy(roomTypes.name);
  }

  async getRoomType(id: number): Promise<RoomType | undefined> {
    const [roomType] = await db
      .select()
      .from(roomTypes)
      .where(eq(roomTypes.id, id));
    return roomType;
  }

  async createRoomType(roomType: InsertRoomType): Promise<RoomType> {
    const [result] = await db.insert(roomTypes).values(roomType).returning();
    return result;
  }

  async updateRoomType(
    id: number,
    roomType: Partial<InsertRoomType>,
  ): Promise<RoomType> {
    const [result] = await db
      .update(roomTypes)
      .set(roomType)
      .where(eq(roomTypes.id, id))
      .returning();
    return result;
  }

  async deleteRoomType(id: number): Promise<void> {
    await db.delete(roomTypes).where(eq(roomTypes.id, id));
  }

  async createRoomTypesBulk(roomTypesData: InsertRoomType[]): Promise<RoomType[]> {
    const results = await db.insert(roomTypes).values(roomTypesData).returning();
    return results;
  }

  // Room operations
  async getRooms(
    branchId?: number,
    status?: string,
  ): Promise<(Room & { roomType: RoomType; branch: Branch })[]> {
    try {
      console.log("🏨 getRooms called with:", { branchId, status });

      let query = db
        .select()
        .from(rooms)
        .leftJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
        .leftJoin(branches, eq(rooms.branchId, branches.id));

      const conditions = [];

      if (branchId) {
        console.log("🔍 Adding branchId filter:", branchId);
        conditions.push(eq(rooms.branchId, branchId));
      }

      if (status) {
        console.log("🔍 Adding status filter:", status);
        conditions.push(eq(rooms.status, status));
      }

      if (conditions.length === 1) {
        query = query.where(conditions[0]);
      } else if (conditions.length > 1) {
        query = query.where(and(...conditions));
      }

      console.log("🔄 Executing rooms query...");
      const results = await query.orderBy(rooms.number);
      console.log("✅ Query executed, found", results.length, "results");

      const mappedResults = results
        .map((result) => {
          if (!result.rooms) {
            console.warn("⚠️ Found result without rooms data:", result);
            return null;
          }

          return {
            ...result.rooms,
            roomType: result.room_types || {
              id: 0,
              name: "Unknown",
              description: "",
              basePrice: "0",
              maxOccupancy: 1,
              amenities: [],
              isActive: true,
              branchId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            branch: result.branches || {
              id: 0,
              name: "Unknown",
              address: "",
              phone: "",
              email: "",
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          };
        })
        .filter(Boolean);

      console.log(
        "✅ getRooms completed successfully with",
        mappedResults.length,
        "rooms",
      );
      return mappedResults as (Room & { roomType: RoomType; branch: Branch })[];
    } catch (error) {
      console.error("❌ Error in getRooms:", error);
      throw error;
    }
  }

  async getRoom(
    id: number,
  ): Promise<(Room & { roomType: RoomType; branch: Branch }) | undefined> {
    const [result] = await db
      .select()
      .from(rooms)
      .leftJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .leftJoin(branches, eq(rooms.branchId, branches.id))
      .where(eq(rooms.id, id));

    if (!result) return undefined;

    return {
      ...result.rooms,
      roomType: result.room_types!,
      branch: result.branches!,
    };
  }

  async createRoom(roomData: typeof rooms.$inferInsert): Promise<Room> {
    const roomWithToken = {
      ...roomData,
      qrToken: roomData.qrToken || crypto.randomUUID(),
    };
    const [room] = await db.insert(rooms).values(roomWithToken).returning();
    return room;
  }

  async updateRoom(id: number, room: Partial<InsertRoom>): Promise<Room> {
    const [result] = await db
      .update(rooms)
      .set(room)
      .where(eq(rooms.id, id))
      .returning();
    return result;
  }

  async deleteRoom(id: number): Promise<void> {
    await db.delete(rooms).where(eq(rooms.id, id));
  }

  async createRoomsBulk(roomsData: InsertRoom[]): Promise<Room[]> {
    const roomsWithTokens = roomsData.map(room => ({
      ...room,
      qrToken: room.qrToken || crypto.randomUUID(),
    }));
    const results = await db.insert(rooms).values(roomsWithTokens).returning();
    return results;
  }

  // Guest operations
  async getGuests(branchId?: number): Promise<Guest[]> {
    // Guests are now centrally stored and accessible to all branches
    // Branch filtering is only applied for reservations, not guest management
    return await db
      .select()
      .from(guests)
      .where(eq(guests.isActive, true))
      .orderBy(desc(guests.createdAt));
  }

  async getGuest(id: string): Promise<Guest | undefined> {
    const [guest] = await db.select().from(guests).where(eq(guests.id, id));
    return guest;
  }

  async createGuest(guest: InsertGuest): Promise<Guest> {
    const [result] = await db.insert(guests).values(guest).returning();
    return result;
  }

  async updateGuest(id: string, guest: Partial<InsertGuest>): Promise<Guest> {
    const [result] = await db
      .update(guests)
      .set(guest)
      .where(eq(guests.id, id))
      .returning();
    return result;
  }

  // // Reservation Room operations for comprehensive editing
  // async createReservationRoom(roomData: InsertReservationRoom): Promise<ReservationRoom> {
  //   const [result] = await db.insert(reservationRooms).values(roomData).returning();
  //   return result;
  // }

  async updateReservationRoom(id: number, roomData: Partial<InsertReservationRoom>): Promise<ReservationRoom> {
    const [result] = await db
      .update(reservationRooms)
      .set(roomData)
      .where(eq(reservationRooms.id, id))
      .returning();
    return result;
  }

  async deleteReservationRoom(id: number): Promise<void> {
    await db.delete(reservationRooms).where(eq(reservationRooms.id, id));
  }

  async deleteGuest(id: string): Promise<void> {
    await db.delete(guests).where(eq(guests.id, id));
  }

  async searchGuests(query: string, branchId?: number): Promise<Guest[]> {
    const searchConditions = and(
      eq(guests.isActive, true),
      or(
        sql`${guests.firstName} ILIKE ${`%${query}%`}`,
        sql`${guests.lastName} ILIKE ${`%${query}%`}`,
        sql`${guests.phone} ILIKE ${`%${query}%`}`,
        sql`${guests.email} ILIKE ${`%${query}%`}`,
      ),
    );

    // Search all active guests regardless of branch
    const searchQuery = db.select().from(guests).where(searchConditions);

    return await searchQuery.orderBy(desc(guests.createdAt)).limit(10);
  }

  async findGuestByPhone(phone: string): Promise<Guest | undefined> {
    console.log("🔍 Searching for guest with phone:", phone);

    // First try exact match
    let [guest] = await db
      .select()
      .from(guests)
      .where(and(eq(guests.phone, phone), eq(guests.isActive, true)))
      .limit(1);

    // If no exact match, try searching by partial match (last 10 digits)
    if (!guest && phone.length >= 10) {
      const phoneDigits = phone.replace(/\D/g, ''); // Remove non-digits
      const lastTenDigits = phoneDigits.slice(-10);

      console.log("🔍 Trying partial match with last 10 digits:", lastTenDigits);

      [guest] = await db
        .select()
        .from(guests)
        .where(
          and(
            sql`REGEXP_REPLACE(${guests.phone}, '[^0-9]', '', 'g') LIKE ${`%${lastTenDigits}`}`,
            eq(guests.isActive, true)
          )
        )
        .limit(1);
    }

    console.log("📱 Guest search result:", guest ? `Found: ${guest.firstName} ${guest.lastName}` : "Not found");
    return guest;
  }

  // Reservation operations
  // Get active reservation for a specific room
  async getActiveReservationByRoom(roomId: number): Promise<
    (Reservation & {
      guest: Guest;
      reservationRooms: (ReservationRoom & {
        room: Room & { roomType: RoomType };
      })[];
    }) | null
  > {
    try {
      console.log(`🏨 Looking for active reservation for room ${roomId}`);

      // Find reservation rooms for the specific room with checked-in status
      const roomReservationResults = await db
        .select()
        .from(reservationRooms)
        .leftJoin(reservations, eq(reservationRooms.reservationId, reservations.id))
        .leftJoin(guests, eq(reservations.guestId, guests.id))
        .where(
          and(
            eq(reservationRooms.roomId, roomId),
            eq(reservations.status, 'checked-in')
          )
        )
        .limit(1);

      if (roomReservationResults.length === 0) {
        console.log(`🏨 No active reservation found for room ${roomId}`);
        return null;
      }

      const result = roomReservationResults[0];
      const reservation = result.reservations!;
      const guest = result.guests!;

      console.log(`🏨 Found active reservation ${reservation.id} for room ${roomId} with status: ${reservation.status}`);

      // Get all rooms for this reservation
      const allRoomResults = await db
        .select()
        .from(reservationRooms)
        .leftJoin(rooms, eq(reservationRooms.roomId, rooms.id))
        .leftJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
        .where(eq(reservationRooms.reservationId, reservation.id));

      const reservationRoomsData = allRoomResults.map((roomResult) => ({
        ...roomResult.reservation_rooms,
        room: {
          ...roomResult.rooms!,
          roomType: roomResult.room_types!,
        },
      }));

      return {
        ...reservation,
        guest,
        reservationRooms: reservationRoomsData,
      };
    } catch (error) {
      console.error('Error getting active reservation by room:', error);
      return null;
    }
  }

  async getReservations(branchId?: number): Promise<
    (Reservation & {
      guest: Guest;
      reservationRooms: (ReservationRoom & {
        room: Room & { roomType: RoomType };
      })[];
    })[]
  > {
    let reservationQuery = db
      .select()
      .from(reservations)
      .leftJoin(guests, eq(reservations.guestId, guests.id));

    if (branchId !== undefined && branchId !== null) {
      console.log("🔍 Filtering reservations for branchId:", branchId);
      reservationQuery = reservationQuery.where(
        eq(reservations.branchId, branchId),
      );
    }

    const reservationResults = await reservationQuery.orderBy(
      desc(reservations.createdAt),
    );

    const reservationsWithRooms = await Promise.all(
      reservationResults.map(async (result) => {
        const reservation = result.reservations;
        const guest = result.guests!;

        const roomResults = await db
          .select()
          .from(reservationRooms)
          .leftJoin(rooms, eq(reservationRooms.roomId, rooms.id))
          .leftJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
          .where(eq(reservationRooms.reservationId, reservation.id));

        const reservationRoomsData = roomResults.map((roomResult) => ({
          ...roomResult.reservation_rooms,
          room: {
            ...roomResult.rooms!,
            roomType: roomResult.room_types!,
          },
        }));

        return {
          ...reservation,
          guest,
          reservationRooms: reservationRoomsData,
        };
      }),
    );

    return reservationsWithRooms;
  }

  async getReservation(id: string): Promise<
    | (Reservation & {
        guest: Guest;
        reservationRooms: (ReservationRoom & {
          room: Room & { roomType: RoomType };
        })[];
      })
    | undefined
  > {
    const [result] = await db
      .select()
      .from(reservations)
      .leftJoin(guests, eq(reservations.guestId, guests.id))
      .where(eq(reservations.id, id));

    if (!result) return undefined;

    const reservation = result.reservations;
    const guest = result.guests!;

    const roomResults = await db
      .select()
      .from(reservationRooms)
      .leftJoin(rooms, eq(reservationRooms.roomId, rooms.id))
      .leftJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .where(eq(reservationRooms.reservationId, reservation.id));

    const reservationRoomsData = roomResults.map((roomResult) => ({
      ...roomResult.reservation_rooms,
      room: {
        ...roomResult.rooms!,
        roomType: roomResult.room_types!,
      },
    }));

    return {
      ...reservation,
      guest,
      reservationRooms: reservationRoomsData,
    };
  }

  async createReservation(
    reservation: InsertReservation,
    roomsData?: InsertReservationRoom[],
  ): Promise<Reservation> {
    return await db.transaction(async (tx) => {
      const [newReservation] = await tx
        .insert(reservations)
        .values(reservation)
        .returning();

      if (roomsData && roomsData.length > 0) {
        const roomsWithReservationId = roomsData.map((room) => ({
          ...room,
          reservationId: newReservation.id,
        }));

        await tx.insert(reservationRooms).values(roomsWithReservationId);

        // Update guest reservation count if guest exists
        if (reservation.guestId) {
          await tx
            .update(guests)
            .set({
              reservationCount: sql`${guests.reservationCount} + 1`,
            })
            .where(eq(guests.id, reservation.guestId));
        }
      }

      return newReservation;
    });
  }

  async updateReservation(
    id: string,
    reservation: Partial<InsertReservation>,
  ): Promise<Reservation> {
    const [result] = await db
      .update(reservations)
      .set(reservation)
      .where(eq(reservations.id, id))
      .returning();
    return result;
  }

  async deleteReservation(id: string): Promise<void> {
    await db.delete(reservations).where(eq(reservations.id, id));
  }

  // Reservation Room operations
  async createReservationRoom(
    reservationRoom: InsertReservationRoom,
  ): Promise<ReservationRoom> {
    const [result] = await db
      .insert(reservationRooms)
      .values(reservationRoom)
      .returning();
    return result;
  }

  async getReservationRooms(reservationId: string): Promise<
    (ReservationRoom & {
      room: Room & { roomType: RoomType };
    })[]
  > {
    const results = await db
      .select()
      .from(reservationRooms)
      .leftJoin(rooms, eq(reservationRooms.roomId, rooms.id))
      .leftJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .where(eq(reservationRooms.reservationId, reservationId));

    return results.map((result) => ({
      ...result.reservation_rooms,
      room: {
        ...result.rooms!,
        roomType: result.room_types!,
      },
    }));
  }

  // Hotel Settings operations
  async getHotelSettings(): Promise<HotelSettings | undefined> {
    const [settings] = await db.select().from(hotelSettings).limit(1);
    return settings;
  }

  async upsertHotelSettings(
    settings: InsertHotelSettings,
  ): Promise<HotelSettings> {
    const existingSettings = await this.getHotelSettings();

    if (existingSettings) {
      const [result] = await db
        .update(hotelSettings)
        .set(settings)
        .where(eq(hotelSettings.id, existingSettings.id))
        .returning();
      return result;
    } else {
      const [result] = await db
        .insert(hotelSettings)
        .values(settings)
        .returning();
      return result;
    }
  }

  // Push Subscription operations
  async savePushSubscription(
    subscription: InsertPushSubscription,
  ): Promise<void> {
    await db
      .insert(pushSubscriptions)
      .values(subscription)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      });
  }

  async getPushSubscriptions(userId?: string): Promise<PushSubscription[]> {
    let query = db.select().from(pushSubscriptions);
    if (userId) {
      query = query.where(eq(pushSubscriptions.userId, userId));
    }
    return await query;
  }

  async removePushSubscription(endpoint: string): Promise<void> {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async clearAllPushSubscriptions(): Promise<void> {
    await db.delete(pushSubscriptions);
  }

  async createPushSubscription(
    subscription: InsertPushSubscription,
  ): Promise<PushSubscription> {
    try {
      // First try to insert with conflict resolution
      const [result] = await db
        .insert(pushSubscriptions)
        .values({
          userId: subscription.userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        })
        .onConflictDoUpdate({
          target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
          set: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        })
        .returning();
      return result;
    } catch (error: any) {
      // If the unique constraint doesn't exist, try without conflict resolution
      if (error.code === '42P10') {
        console.log('⚠️ Unique constraint not found, checking for existing subscription manually...');

        // Check if subscription already exists
        const existing = await db
          .select()
          .from(pushSubscriptions)
          .where(
            and(
              eq(pushSubscriptions.userId, subscription.userId),
              eq(pushSubscriptions.endpoint, subscription.endpoint)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing subscription
          const [result] = await db
            .update(pushSubscriptions)
            .set({
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            })
            .where(
              and(
                eq(pushSubscriptions.userId, subscription.userId),
                eq(pushSubscriptions.endpoint, subscription.endpoint)
              )
            )
            .returning();
          return result;
        } else {
          // Insert new subscription
          const [result] = await db
            .insert(pushSubscriptions)
            .values({
              userId: subscription.userId,
              endpoint: subscription.endpoint,
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            })
            .returning();
          return result;
        }
      }
      throw error;
    }
  }

  async getPushSubscription(
    userId: string,
    endpoint: string,
  ): Promise<PushSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint),
        ),
      );
    return subscription;
  }

  async deletePushSubscription(
    userId: string,
    endpoint: string,
  ): Promise<void> {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint),
        ),
      );
  }

  async getAllAdminSubscriptions(): Promise<
    (PushSubscription & { user?: User })[]
  > {
    const results = await db
      .select()
      .from(pushSubscriptions)
      .leftJoin(users, eq(pushSubscriptions.userId, users.id))
      .where(or(eq(users.role, "superadmin"), eq(users.role, "branch-admin")));

    return results.map((result) => ({
      ...result.push_subscriptions,
      user: result.users || undefined,
    }));
  }

  async getBranchAdminSubscriptions(branchId?: number): Promise<PushSubscription[]> {
    const conditions = [eq(users.isActive, true)];

    if (branchId) {
      // Get superadmins (all branches) and admins for specific branch
      conditions.push(
        or(
          eq(users.role, 'superadmin'),
          and(
            eq(users.role, 'admin'),
            eq(users.branchId, branchId)
          )
        )
      );
    } else {
      // If no branchId, get all superadmins
      conditions.push(eq(users.role, 'superadmin'));
    }

    return await db.select().from(pushSubscriptions)
      .leftJoin(users, eq(pushSubscriptions.userId, users.id))
      .where(and(...conditions))
      .then(rows => rows.map(row => ({
        userId: row.push_subscriptions.userId,
        endpoint: row.push_subscriptions.endpoint,
        p256dh: row.push_subscriptions.p256dh,
        auth: row.push_subscriptions.auth,
        createdAt: row.push_subscriptions.createdAt
      })));
  }



  async getAllPushSubscriptions() {
    return await db.select().from(pushSubscriptions);
  }

  // Notification History operations
  async saveNotificationHistory(
    notification: InsertNotificationHistory,
  ): Promise<void> {
    await db.insert(notificationHistory).values(notification);
  }

  async getNotificationHistory(
    userId?: string,
    limit: number = 50,
  ): Promise<NotificationHistory[]> {
    let query = db.select().from(notificationHistory);
    if (userId) {
      query = query.where(eq(notificationHistory.userId, userId));
    }
    return await query
      .orderBy(desc(notificationHistory.createdAt))
      .limit(limit);
  }

  async createNotificationHistory(
    notification: InsertNotificationHistory,
  ): Promise<NotificationHistory> {
    const [result] = await db
      .insert(notificationHistory)
      .values(notification)
      .returning();
    return result;
  }

  async markNotificationAsRead(
    notificationId: number,
    userId: string,
  ): Promise<void> {
    await db
      .update(notificationHistory)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notificationHistory.id, notificationId),
          eq(notificationHistory.userId, userId),
        ),
      );
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notificationHistory)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notificationHistory.userId, userId));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificationHistory)
      .where(
        and(
          eq(notificationHistory.userId, userId),
          eq(notificationHistory.isRead, false),
        ),
      );
    return result.count;
  }

  // Tax operations
  async getTaxes(applicationType?: string): Promise<Tax[]> {
    let query = db.select().from(taxes).where(eq(taxes.isActive, true));
    if (applicationType) {
      query = query.where(
        and(
          eq(taxes.isActive, true),
          eq(taxes.applicationType, applicationType),
        ),
      );
    }
    return await query.orderBy(taxes.taxName);
  }

  async getTax(id: number): Promise<Tax | undefined> {
    const [tax] = await db.select().from(taxes).where(eq(taxes.id, id));
    return tax;
  }

  async createTax(tax: InsertTax): Promise<Tax> {
    const [result] = await db.insert(taxes).values(tax).returning();
    return result;
  }

  async updateTax(id: number, tax: Partial<InsertTax>): Promise<Tax> {
    const [result] = await db
      .update(taxes)
      .set(tax)
      .where(eq(taxes.id, id))
      .returning();
    return result;
  }

  async deleteTax(id: number): Promise<void> {
    await db.delete(taxes).where(eq(taxes.id, id));
  }

  // Analytics operations
  async getRevenueAnalytics(
    branchId?: number,
    period: string = "30d",
  ): Promise<any> {
    const days = parseInt(period.replace("d", ""));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateString = startDate.toISOString().split("T")[0];

    let query = db
      .select({
        date: sql<string>`DATE(${reservations.createdAt})`,
        revenue: sql<number>`SUM(CAST(${reservations.totalAmount} AS DECIMAL))`,
      })
      .from(reservations)
      .where(
        and(
          sql`DATE(${reservations.createdAt}) >= ${startDateString}`,
          branchId ? eq(reservations.branchId, branchId) : undefined,
        ),
      )
      .groupBy(sql`DATE(${reservations.createdAt})`)
      .orderBy(sql`DATE(${reservations.createdAt})`);

    const dailyRevenue = await query;

    const totalRevenue = dailyRevenue.reduce(
      (sum, day) => sum + (Number(day.revenue) || 0),
      0,
    );

    return {
      dailyRevenue: dailyRevenue.map((day) => ({
        date: day.date,
        revenue: Number(day.revenue) || 0,
      })),
      totalRevenue,
      period: `${days} days`,
    };
  }

  async getOccupancyAnalytics(
    branchId?: number,
    period: string = "30d",
  ): Promise<any> {
    const days = parseInt(period.replace("d", ""));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateString = startDate.toISOString().split("T")[0];

    // Get total rooms
    let totalRoomsQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(rooms);
    if (branchId) {
      totalRoomsQuery = totalRoomsQuery.where(eq(rooms.branchId, branchId));
    }
    const [totalRoomsResult] = await totalRoomsQuery;
    const totalRooms = totalRoomsResult.count;

    // Get daily occupancy
    let occupancyQuery = db
      .select({
        date: sql<string>`DATE(${reservationRooms.checkInDate})`,
        occupiedRooms: sql<number>`COUNT(DISTINCT ${reservationRooms.roomId})`,
      })
      .from(reservationRooms)
      .leftJoin(
        reservations,
        eq(reservationRooms.reservationId, reservations.id),
      )
      .where(
        and(
          sql`DATE(${reservationRooms.checkInDate}) >= ${startDateString}`,
          branchId ? eq(reservations.branchId, branchId) : undefined,
        ),
      )
      .groupBy(sql`DATE(${reservationRooms.checkInDate})`)
      .orderBy(sql`DATE(${reservationRooms.checkInDate})`);

    const dailyOccupancy = await occupancyQuery;

    return {
      dailyOccupancy: dailyOccupancy.map((day) => ({
        date: day.date,
        occupiedRooms: day.occupiedRooms,
        occupancyRate:
          totalRooms > 0
            ? Math.round((day.occupiedRooms / totalRooms) * 100)
            : 0,
      })),
      totalRooms,
      averageOccupancy:
        dailyOccupancy.length > 0
          ? Math.round(
              dailyOccupancy.reduce((sum, day) => sum + day.occupiedRooms, 0) /
                dailyOccupancy.length,
            )
          : 0,
    };
  }

  async getGuestAnalytics(branchId?: number): Promise<any> {
    // Guest demographics
    let guestQuery = db.select().from(guests);
    if (branchId) {
      guestQuery = guestQuery.where(eq(guests.branchId, branchId));
    }
    const allGuests = await guestQuery;

    // Top guests by reservation count with total spent
    let topGuestsQuery = db
      .select({
        guest: {
          id: guests.id,
          firstName: guests.firstName,
          lastName: guests.lastName,
          email: guests.email,
        },
        totalBookings: guests.reservationCount,
        totalSpent: sql<number>`COALESCE(SUM(CAST(${reservations.totalAmount} AS DECIMAL)), 0)`,
      })
      .from(guests)
      .leftJoin(reservations, eq(guests.id, reservations.guestId))
      .groupBy(
        guests.id,
        guests.firstName,
        guests.lastName,
        guests.email,
        guests.reservationCount,
      )
      .orderBy(desc(guests.reservationCount))
      .limit(10);

    if (branchId) {
      topGuestsQuery = topGuestsQuery.where(eq(guests.branchId, branchId));
    }

    const topGuests = await topGuestsQuery;

    // Guest nationality demographics
    const guestsByNationality = await db
      .select({
        nationality: guests.nationality,
        count: sql<number>`COUNT(*)`,
      })
      .from(guests)
      .where(branchId ? eq(guests.branchId, branchId) : undefined)
      .groupBy(guests.nationality)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    // New guests this month
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const [newGuestsResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(guests)
      .where(
        and(
          gte(guests.createdAt, currentMonth),
          branchId ? eq(guests.branchId, branchId) : undefined,
        ),
      );

    return {
      totalGuests: allGuests.length,
      topGuests: topGuests.map((guest) => ({
        guest: guest.guest,
        totalBookings: guest.totalBookings,
        totalSpent: Number(guest.totalSpent) || 0,
      })),
      guestsByNationality: guestsByNationality
        .filter((g) => g.nationality)
        .map((g) => ({
          nationality: g.nationality || "Unknown",
          count: g.count,
        })),
      newGuestsThisMonth: newGuestsResult.count,
      repeatGuestRate:
        allGuests.length > 0
          ? Math.round(
              (allGuests.filter((g) => g.reservationCount > 1).length /
                allGuests.length) *
                100,
            )
          : 0,
    };
  }

  async getRoomPerformanceAnalytics(branchId?: number): Promise<any> {
    // Room type performance
    let roomTypeQuery = db
      .select({
        roomTypeId: roomTypes.id,
        roomTypeName: roomTypes.name,
        totalRooms: sql<number>`COUNT(${rooms.id})`,
        totalReservations: sql<number>`COUNT(${reservationRooms.id})`,
      })
      .from(roomTypes)
      .leftJoin(rooms, eq(roomTypes.id, rooms.roomTypeId))
      .leftJoin(reservationRooms, eq(rooms.id, reservationRooms.roomId))
      .groupBy(roomTypes.id, roomTypes.name)
      .orderBy(desc(sql`COUNT(${reservationRooms.id})`));

    if (branchId) {
      roomTypeQuery = roomTypeQuery.where(eq(rooms.branchId, branchId));
    }

    const roomTypePerformance = await roomTypeQuery;

    // Room status distribution
    let statusQuery = db
      .select({
        status: rooms.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(rooms)
      .groupBy(rooms.status);

    if (branchId) {
      statusQuery = statusQuery.where(eq(rooms.branchId, branchId));
    }

    const roomStatusDistribution = await statusQuery;

    return {
      roomTypePerformance: roomTypePerformance.map((rt) => ({
        roomTypeId: rt.roomTypeId,
        roomTypeName: rt.roomTypeName,
        totalRooms: rt.totalRooms,
        totalReservations: rt.totalReservations,
        utilizationRate:
          rt.totalRooms > 0
            ? Math.round((rt.totalReservations / rt.totalRooms) * 100)
            : 0,
      })),
      roomStatusDistribution,
    };
  }

  async getOperationalAnalytics(branchId?: number): Promise<any> {
    // Reservation status distribution
    let statusQuery = db
      .select({
        status: reservations.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(reservations)
      .groupBy(reservations.status);

    if (branchId) {
      statusQuery = statusQuery.where(eq(reservations.branchId, branchId));
    }

    const reservationStatusDistribution = await statusQuery;

    // Average length of stay
    let avgStayQuery = db
      .select({
        avgStay: sql<number>`AVG(EXTRACT(DAY FROM (${reservationRooms.checkOutDate}::timestamp - ${reservationRooms.checkInDate}::timestamp)))`,
      })
      .from(reservationRooms)
      .leftJoin(
        reservations,
        eq(reservationRooms.reservationId, reservations.id),
      )
      .where(
        and(
          sql`${reservationRooms.checkOutDate} IS NOT NULL`,
          sql`${reservationRooms.checkInDate} IS NOT NULL`,
        ),
      );

    if (branchId) {
      avgStayQuery = avgStayQuery.where(
        and(
          eq(reservations.branchId, branchId),
          sql`${reservationRooms.checkOutDate} IS NOT NULL`,
          sql`${reservationRooms.checkInDate} IS NOT NULL`,
        ),
      );
    }

    const [avgStayResult] = await avgStayQuery;

    // Check-in/out times analysis
    let checkInTimesQuery = db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${reservationRooms.actualCheckIn}::timestamp)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(reservationRooms)
      .leftJoin(
        reservations,
        eq(reservationRooms.reservationId, reservations.id),
      )
      .where(sql`${reservationRooms.actualCheckIn} IS NOT NULL`)
      .groupBy(
        sql`EXTRACT(HOUR FROM ${reservationRooms.actualCheckIn}::timestamp)`,
      )
      .orderBy(
        sql`EXTRACT(HOUR FROM ${reservationRooms.actualCheckIn}::timestamp)`,
      );

    if (branchId) {
      checkInTimesQuery = checkInTimesQuery.where(
        eq(reservations.branchId, branchId),
      );
    }

    const checkInTimes = await checkInTimesQuery;

    return {
      reservationStatusDistribution,
      averageLengthOfStay: Math.round(Number(avgStayResult?.avgStay) || 0),
      checkInTimes: checkInTimes.map((ct) => ({
        hour: ct.hour,
        count: ct.count,
      })),
    };
  }

  // Dashboard metrics - updated for 24-hour specific data
  async getDashboardMetrics(branchId?: number): Promise<{
    totalRooms: number;
    occupiedRooms: number;
    todayReservations: number;
    todayRevenue: number;
    roomStatusCounts: Record<string, number>;
  }> {
    // Get today's date range (24 hours)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get total rooms
    let roomQuery = db.select({ count: sql<number>`count(*)` }).from(rooms);
    if (branchId) {
      roomQuery = roomQuery.where(eq(rooms.branchId, branchId));
    }
    const [totalRoomsResult] = await roomQuery;
    const totalRooms = totalRoomsResult.count;

    // Get occupied rooms (based on current reservations)
    let occupiedQuery = db
      .select({ count: sql<number>`count(distinct ${rooms.id})` })
      .from(rooms)
      .leftJoin(reservationRooms, eq(rooms.id, reservationRooms.roomId))
      .leftJoin(
        reservations,
        eq(reservationRooms.reservationId, reservations.id),
      )
      .where(
        and(
          eq(reservations.status, "checked-in"),
          branchId ? eq(rooms.branchId, branchId) : undefined,
        ),
      );

    const [occupiedRoomsResult] = await occupiedQuery;
    const occupiedRooms = occupiedRoomsResult.count;

    // Get today's reservations (created today)
    let todayReservationsQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(reservations)
      .where(
        and(
          gte(reservations.createdAt, today),
          lt(reservations.createdAt, tomorrow),
          branchId ? eq(reservations.branchId, branchId) : undefined,
        ),
      );

    const [todayReservationsResult] = await todayReservationsQuery;
    const todayReservations = todayReservationsResult.count;

    // Get today's revenue (from reservations created today)
    let todayRevenueQuery = db
      .select({
        revenue: sql<number>`coalesce(sum(cast(${reservations.totalAmount} as decimal)), 0)`,
      })
      .from(reservations)
      .where(
        and(
          gte(reservations.createdAt, today),
          lt(reservations.createdAt, tomorrow),
          branchId ? eq(reservations.branchId, branchId) : undefined,
        ),
      );

    const [todayRevenueResult] = await todayRevenueQuery;
    const todayRevenue = Number(todayRevenueResult.revenue);

    // Get room status counts
    let statusQuery = db
      .select({
        status: rooms.status,
        count: sql<number>`count(*)`,
      })
      .from(rooms)
      .groupBy(rooms.status);

    if (branchId) {
      statusQuery = statusQuery.where(eq(rooms.branchId, branchId));
    }

    const statusResults = await statusQuery;
    const roomStatusCounts = statusResults.reduce(
      (acc, result) => {
        acc[result.status] = result.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalRooms,
      occupiedRooms,
      todayReservations,
      todayRevenue,
      roomStatusCounts,
    };
  }

  // 24-hour specific methods
  async getTodayReservations(
    branchId?: number,
    limit?: number,
  ): Promise<
    (Reservation & {
      guest: Guest;
      reservationRooms: (ReservationRoom & {
        room: Room & { roomType: RoomType };
      })[];
    })[]
  > {
    // Get today's date range (24 hours)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let reservationQuery = db
      .select()
      .from(reservations)
      .leftJoin(guests, eq(reservations.guestId, guests.id))
      .where(
        and(
          gte(reservations.createdAt, today),
          lt(reservations.createdAt, tomorrow),
          branchId ? eq(reservations.branchId, branchId) : undefined,
        ),
      );

    const reservationResults = await reservationQuery
      .orderBy(desc(reservations.createdAt))
      .limit(limit || 1000);

    const reservationsWithRooms = await Promise.all(
      reservationResults.map(async (result) => {
        const reservation = result.reservations;
        const guest = result.guests!;

        const roomResults = await db
          .select()
          .from(reservationRooms)
          .leftJoin(rooms, eq(reservationRooms.roomId, rooms.id))
          .leftJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
          .where(eq(reservationRooms.reservationId, reservation.id));

        const reservationRoomsData = roomResults.map((roomResult) => ({
          ...roomResult.reservation_rooms,
          room: {
            ...roomResult.rooms!,
            roomType: roomResult.room_types!,
          },
        }));

        return {
          ...reservation,
          guest,
          reservationRooms: reservationRoomsData,
        };
      }),
    );

    return reservationsWithRooms;
  }

  // Super admin dashboard metrics
  async getSuperAdminDashboardMetrics(): Promise<{
    totalBranches: number;
    totalReservations: number;
    totalRevenue: number;
    totalRooms: number;
    branchMetrics: Array<{
      branchId: number;
      branchName: string;
      totalRooms: number;
      bookedRooms: number;
      availableRooms: number;
      occupancyRate: number;
      totalReservations: number;
      revenue: number;
    }>;
  }> {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get total branches
    const [totalBranchesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(branches);
    const totalBranches = totalBranchesResult.count;

    // Get total reservations (today)
    const [totalReservationsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reservations)
      .where(
        and(
          gte(reservations.createdAt, today),
          lt(reservations.createdAt, tomorrow),
        ),
      );
    const totalReservations = totalReservationsResult.count;

    // Get total revenue (today)
    const [totalRevenueResult] = await db
      .select({
        revenue: sql<number>`coalesce(sum(cast(${reservations.totalAmount} as decimal)), 0)`,
      })
      .from(reservations)
      .where(
        and(
          gte(reservations.createdAt, today),
          lt(reservations.createdAt, tomorrow),
        ),
      );
    const totalRevenue = Number(totalRevenueResult.revenue);

    // Get total rooms
    const [totalRoomsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rooms);
    const totalRooms = totalRoomsResult.count;

    // Get branch metrics
    const branchResults = await db
      .select({
        branchId: branches.id,
        branchName: branches.name,
      })
      .from(branches);

    const branchMetrics = await Promise.all(
      branchResults.map(async (branch) => {
        // Get total rooms for this branch
        const [branchRoomsResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(rooms)
          .where(eq(rooms.branchId, branch.branchId));
        const branchTotalRooms = branchRoomsResult.count;

        // Get booked rooms (currently occupied)
        const [bookedRoomsResult] = await db
          .select({ count: sql<number>`count(distinct ${rooms.id})` })
          .from(rooms)
          .leftJoin(reservationRooms, eq(rooms.id, reservationRooms.roomId))
          .leftJoin(
            reservations,
            eq(reservationRooms.reservationId, reservations.id),
          )
          .where(
            and(
              eq(rooms.branchId, branch.branchId),
              eq(reservations.status, "checked-in"),
            ),
          );
        const bookedRooms = bookedRoomsResult.count;

        // Get today's reservations for this branch
        const [branchReservationsResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(reservations)
          .where(
            and(
              eq(reservations.branchId, branch.branchId),
              gte(reservations.createdAt, today),
              lt(reservations.createdAt, tomorrow),
            ),
          );
        const branchTotalReservations = branchReservationsResult.count;

        // Get today's revenue for this branch
        const [branchRevenueResult] = await db
          .select({
            revenue: sql<number>`coalesce(sum(cast(${reservations.totalAmount} as decimal)), 0)`,
          })
          .from(reservations)
          .where(
            and(
              eq(reservations.branchId, branch.branchId),
              gte(reservations.createdAt, today),
              lt(reservations.createdAt, tomorrow),
            ),
          );
        const branchRevenue = Number(branchRevenueResult.revenue);

        // Get restaurant data for this branch (using restaurant-storage import)
        const { restaurantStorage } = await import("./restaurant-storage");
        const restaurantMetrics =
          await restaurantStorage.getRestaurantDashboardMetrics(
            branch.branchId,
          );

        const availableRooms = branchTotalRooms - bookedRooms;
        const occupancyRate =
          branchTotalRooms > 0
            ? Math.round((bookedRooms / branchTotalRooms) * 100)
            : 0;

        return {
          branchId: branch.branchId,
          branchName: branch.branchName,
          totalRooms: branchTotalRooms,
          bookedRooms,
          availableRooms,
          occupancyRate,
          totalReservations: branchTotalReservations,
          revenue: branchRevenue,
          totalOrders: restaurantMetrics.totalOrders,
          restaurantRevenue: restaurantMetrics.totalRevenue,
        };
      }),
    );

    return {
      totalBranches,
      totalReservations,
      totalRevenue,
      totalRooms,
      branchMetrics,
    };
  }
  async getUsers() {
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));

    // For each user, get their custom role information
    const usersWithRoles = await Promise.all(
      allUsers.map(async (user) => {
        if (user.role === "custom") {
          const customRoleIds = await roleStorage.getUserRoles(user.id);
          return { ...user, customRoleIds };
        }
        return user;
      }),
    );

    return usersWithRoles;
  }
  async getTodaysReservations(): Promise<any[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    try {
      const result = await db
        .select({
          id: reservations.id,
          confirmationNumber: reservations.confirmationNumber,
          status: reservations.status,
          totalAmount: reservations.totalAmount,
          createdAt: reservations.createdAt,
          guestId: guests.id,
          guestFirstName: guests.firstName,
          guestLastName: guests.lastName,
          guestPhone: guests.phone,
        })
        .from(reservations)
        .leftJoin(guests, eq(reservations.guestId, guests.id))
        .where(
          and(
            gte(reservations.createdAt, startOfDay),
            lte(reservations.createdAt, endOfDay)
          )
        )
        .orderBy(desc(reservations.createdAt));

      return result;
    } catch (error) {
      console.error('Error fetching today\'s reservations:', error);
      throw error;
    }
  }

    // Audit Logs methods
  async getAuditLogs(filters: {
    userId?: string;
    entity?: string;
    action?: string;
    branchId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    let query = db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        sessionId: auditLogs.sessionId,
        success: auditLogs.success,
        errorMessage: auditLogs.errorMessage,
        branchId: auditLogs.branchId,
        timestamp: auditLogs.timestamp,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
        branch: {
          name: branches.name,
        }
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(branches, eq(auditLogs.branchId, branches.id));

    const conditions = [];

    if (filters.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }

    if (filters.entity) {
      conditions.push(eq(auditLogs.entity, filters.entity));
    }

    if (filters.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }

    if (filters.branchId) {
      conditions.push(eq(auditLogs.branchId, filters.branchId));
    }

    if (filters.startDate) {
      conditions.push(gte(auditLogs.timestamp, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(auditLogs.timestamp, filters.endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const logs = await query
      .orderBy(desc(auditLogs.timestamp))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);

    return logs;
  }

  async getAuditLogCount(filters: {
    userId?: string;
    entity?: string;
    action?: string;
    branchId?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    let query = db
      .select({ count: sql`count(*)` })
      .from(auditLogs);

    const conditions = [];

    if (filters.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }

    if (filters.entity) {
      conditions.push(eq(auditLogs.entity, filters.entity));
    }

    if (filters.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }

    if (filters.branchId) {
      conditions.push(eq(auditLogs.branchId, filters.branchId));
    }

    if (filters.startDate) {
      conditions.push(gte(auditLogs.timestamp, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(auditLogs.timestamp, filters.endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query;
    return parseInt(result[0]?.count as string) || 0;
  }

  // Payment operations
  async getPaymentsByReservation(reservationId: string): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.reservationId, reservationId))
      .orderBy(desc(payments.createdAt));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [result] = await db
      .insert(payments)
      .values({
        ...payment,
        processedAt: payment.paymentDate || new Date(),
      })
      .returning();
    return result;
  }

  async updatePaymentStatus(paymentId: number, status: string): Promise<Payment> {
    const now = new Date();
    const [result] = await db
      .update(payments)
      .set({ 
        status,
        updatedAt: now,
        processedAt: status === 'completed' ? now : undefined,
      })
      .where(eq(payments.id, paymentId))
      .returning();
    return result;
  }

  async getReservationWithPayments(reservationId: string): Promise<(Reservation & { payments: Payment[] }) | undefined> {
    const reservation = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, reservationId))
      .limit(1);

    if (!reservation.length) return undefined;

    const reservationPayments = await this.getPaymentsByReservation(reservationId);

    return {
      ...reservation[0],
      payments: reservationPayments,
    };
  }

  // Printer Configuration operations
  async getPrinterConfigurations(branchId?: number): Promise<PrinterConfiguration[]> {
    let query = db.select().from(printerConfigurations);
    
    if (branchId) {
      query = query.where(eq(printerConfigurations.branchId, branchId));
    }
    
    return await query.orderBy(printerConfigurations.printerType, printerConfigurations.createdAt);
  }

  async getPrinterConfiguration(id: number): Promise<PrinterConfiguration | undefined> {
    const result = await db
      .select()
      .from(printerConfigurations)
      .where(eq(printerConfigurations.id, id))
      .limit(1);
    
    return result[0];
  }

  async getPrinterConfigurationByType(branchId: number, printerType: string): Promise<PrinterConfiguration | undefined> {
    const result = await db
      .select()
      .from(printerConfigurations)
      .where(
        and(
          eq(printerConfigurations.branchId, branchId),
          eq(printerConfigurations.printerType, printerType),
          eq(printerConfigurations.isEnabled, true)
        )
      )
      .limit(1);
    
    return result[0];
  }

  async createPrinterConfiguration(config: InsertPrinterConfiguration): Promise<PrinterConfiguration> {
    const result = await db
      .insert(printerConfigurations)
      .values({
        ...config,
        printerType: config.printerType.toLowerCase() as 'kot' | 'bot' | 'billing',
      })
      .returning();
    
    return result[0];
  }

  async updatePrinterConfiguration(id: number, config: Partial<InsertPrinterConfiguration>): Promise<PrinterConfiguration> {
    const result = await db
      .update(printerConfigurations)
      .set({
        ...config,
        printerType: config.printerType ? config.printerType.toLowerCase() as 'kot' | 'bot' | 'billing' : undefined,
        updatedAt: new Date(),
      })
      .where(eq(printerConfigurations.id, id))
      .returning();
    
    return result[0];
  }

  async deletePrinterConfiguration(id: number): Promise<void> {
    await db
      .delete(printerConfigurations)
      .where(eq(printerConfigurations.id, id));
  }

  async testPrinterConnection(id: number): Promise<{ success: boolean; message: string }> {
    const config = await this.getPrinterConfiguration(id);
    
    if (!config) {
      return { success: false, message: 'Printer configuration not found' };
    }

    // Import printer service dynamically to avoid circular imports
    const { printerService } = await import('./printer-service');
    
    try {
      const isConnected = await printerService.testPrinterConnection(
        config.ipAddress, 
        config.port || 9100, 
        config.connectionTimeout || 5000
      );
      
      if (isConnected) {
        await this.updatePrinterConfiguration(id, {
          connectionStatus: 'connected',
          errorMessage: null,
          lastTestPrint: new Date(),
        });
        return { success: true, message: 'Printer connection successful' };
      } else {
        await this.updatePrinterConfiguration(id, {
          connectionStatus: 'disconnected',
          errorMessage: 'Connection timeout or refused',
        });
        return { success: false, message: 'Cannot connect to printer' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updatePrinterConfiguration(id, {
        connectionStatus: 'error',
        errorMessage,
      });
      return { success: false, message: `Connection error: ${errorMessage}` };
    }
  }
}

export const storage = new DatabaseStorage();