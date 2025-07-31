import { db } from "./db";
import { eq, and, desc, sql, or, isNull } from "drizzle-orm";
import {
  measuringUnits,
  stockCategories,
  suppliers,
  stockItems,
  stockConsumption,
  type MeasuringUnit,
  type InsertMeasuringUnit,
  type StockCategory,
  type InsertStockCategory,
  type Supplier,
  type InsertSupplier,
  type StockItem,
  type InsertStockItem,
  type StockConsumption,
  type InsertStockConsumption,
} from "@shared/schema";

export class InventoryStorage {
  // Measuring Units
  async getMeasuringUnits(): Promise<MeasuringUnit[]> {
    return await db.select().from(measuringUnits).where(eq(measuringUnits.isActive, true)).orderBy(measuringUnits.name);
  }

  async getMeasuringUnit(id: number): Promise<MeasuringUnit | undefined> {
    const [unit] = await db.select().from(measuringUnits).where(eq(measuringUnits.id, id));
    return unit;
  }

  async createMeasuringUnit(unit: InsertMeasuringUnit): Promise<MeasuringUnit> {
    const [newUnit] = await db.insert(measuringUnits).values(unit).returning();
    return newUnit;
  }

  async updateMeasuringUnit(id: number, unit: Partial<InsertMeasuringUnit>): Promise<MeasuringUnit> {
    const [updatedUnit] = await db
      .update(measuringUnits)
      .set({ ...unit, updatedAt: new Date() })
      .where(eq(measuringUnits.id, id))
      .returning();
    return updatedUnit;
  }

  async deleteMeasuringUnit(id: number): Promise<void> {
    await db.update(measuringUnits).set({ isActive: false }).where(eq(measuringUnits.id, id));
  }

  // Stock Categories
  async getStockCategories(branchId?: number): Promise<StockCategory[]> {
    const conditions = [eq(stockCategories.isActive, true)];
    if (branchId !== undefined) {
      // For branch users, show both branch-specific and global categories (branchId = null)
      conditions.push(
        or(
          eq(stockCategories.branchId, branchId),
          isNull(stockCategories.branchId)
        )
      );
    }
    // For superadmin (branchId is undefined), show all categories
    return await db.select().from(stockCategories).where(and(...conditions)).orderBy(stockCategories.name);
  }



  async getStockCategory(id: number): Promise<StockCategory | undefined> {
    const [category] = await db.select().from(stockCategories).where(eq(stockCategories.id, id));
    return category;
  }

  async createStockCategory(category: InsertStockCategory): Promise<StockCategory> {
    const [newCategory] = await db.insert(stockCategories).values(category).returning();
    return newCategory;
  }

  async updateStockCategory(id: number, category: Partial<InsertStockCategory>): Promise<StockCategory> {
    const [updatedCategory] = await db
      .update(stockCategories)
      .set({ ...category, updatedAt: new Date() })
      .where(eq(stockCategories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteStockCategory(id: number): Promise<void> {
    await db.update(stockCategories).set({ isActive: false }).where(eq(stockCategories.id, id));
  }

  // Suppliers
  async getSuppliers(branchId?: number): Promise<Supplier[]> {
    const conditions = [eq(suppliers.isActive, true)];
    if (branchId) {
      conditions.push(eq(suppliers.branchId, branchId));
    }
    return await db.select().from(suppliers).where(and(...conditions)).orderBy(suppliers.name);
  }

  async getSupplier(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [newSupplier] = await db.insert(suppliers).values(supplier).returning();
    return newSupplier;
  }

  async updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier> {
    const [updatedSupplier] = await db
      .update(suppliers)
      .set({ ...supplier, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    return updatedSupplier;
  }

  async deleteSupplier(id: number): Promise<void> {
    await db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, id));
  }

  // Stock Items
  async getStockItems(branchId?: number, categoryId?: number): Promise<any[]> {
    const conditions = [eq(stockItems.isActive, true)];
    if (branchId) {
      conditions.push(eq(stockItems.branchId, branchId));
    }
    if (categoryId) {
      conditions.push(eq(stockItems.categoryId, categoryId));
    }

    return await db
      .select({
        id: stockItems.id,
        name: stockItems.name,
        sku: stockItems.sku,
        defaultPrice: stockItems.defaultPrice,
        currentStock: stockItems.currentStock,
        minimumStock: stockItems.minimumStock,
        maximumStock: stockItems.maximumStock,
        reorderLevel: stockItems.reorderLevel,
        reorderQuantity: stockItems.reorderQuantity,
        description: stockItems.description,
        categoryId: stockItems.categoryId,
        categoryName: stockCategories.name,
        measuringUnitId: stockItems.measuringUnitId,
        measuringUnitName: measuringUnits.name,
        measuringUnitSymbol: measuringUnits.symbol,
        supplierId: stockItems.supplierId,
        supplierName: suppliers.name,
        branchId: stockItems.branchId,
        createdAt: stockItems.createdAt,
        updatedAt: stockItems.updatedAt,
      })
      .from(stockItems)
      .leftJoin(stockCategories, eq(stockItems.categoryId, stockCategories.id))
      .leftJoin(measuringUnits, eq(stockItems.measuringUnitId, measuringUnits.id))
      .leftJoin(suppliers, eq(stockItems.supplierId, suppliers.id))
      .where(and(...conditions))
      .orderBy(stockItems.name);
  }

  async getMenuStockItems(branchId?: number): Promise<any[]> {
    const conditions = [
      eq(stockItems.isActive, true),
      eq(stockCategories.isActive, true)
    ];
    if (branchId) {
      conditions.push(eq(stockItems.branchId, branchId));
    }

    return await db
      .select({
        id: stockItems.id,
        name: stockItems.name,
        sku: stockItems.sku,
        defaultPrice: stockItems.defaultPrice,
        currentStock: stockItems.currentStock,
        categoryId: stockItems.categoryId,
        categoryName: stockCategories.name,
        measuringUnitId: stockItems.measuringUnitId,
        measuringUnitName: measuringUnits.name,
        measuringUnitSymbol: measuringUnits.symbol,
        description: stockItems.description,
      })
      .from(stockItems)
      .leftJoin(stockCategories, eq(stockItems.categoryId, stockCategories.id))
      .leftJoin(measuringUnits, eq(stockItems.measuringUnitId, measuringUnits.id))
      .where(and(...conditions))
      .orderBy(stockCategories.name, stockItems.name);
  }

  async getStockItem(id: number): Promise<StockItem | undefined> {
    const [item] = await db.select().from(stockItems).where(eq(stockItems.id, id));
    return item;
  }

  async createStockItem(item: InsertStockItem): Promise<StockItem> {
    // Generate SKU if not provided
    if (!item.sku) {
      const timestamp = Date.now().toString().slice(-6);
      item.sku = `STK-${timestamp}`;
    }

    const [newItem] = await db.insert(stockItems).values(item).returning();
    return newItem;
  }

  async updateStockItem(id: number, item: Partial<InsertStockItem>): Promise<StockItem> {
    const [updatedItem] = await db
      .update(stockItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(stockItems.id, id))
      .returning();
    return updatedItem;
  }

  async updateStockQuantity(id: number, quantity: number, operation: 'add' | 'subtract'): Promise<StockItem> {
    const currentItem = await this.getStockItem(id);
    if (!currentItem) {
      throw new Error('Stock item not found');
    }

    const currentStock = parseFloat(currentItem.currentStock || '0');
    const newStock = operation === 'add' ? currentStock + quantity : currentStock - quantity;

    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }

    const updatedItem = await this.updateStockItem(id, { currentStock: newStock.toString() });
    
    // Import here to avoid circular dependency
    const { lowStockChecker } = await import('./low-stock-checker');
    // Check for low stock after update
    lowStockChecker.onInventoryUpdate(id);
    
    return updatedItem;
  }

  async deleteStockItem(id: number): Promise<void> {
    await db.update(stockItems).set({ isActive: false }).where(eq(stockItems.id, id));
  }

  // Stock Consumption
  async getStockConsumptions(branchId?: number, orderId?: string): Promise<any[]> {
    const conditions = [];
    if (branchId) {
      conditions.push(eq(stockConsumption.branchId, branchId));
    }
    if (orderId) {
      conditions.push(eq(stockConsumption.orderId, orderId));
    }

    return await db
      .select({
        id: stockConsumption.id,
        stockItemId: stockConsumption.stockItemId,
        stockItemName: stockItems.name,
        orderId: stockConsumption.orderId,
        orderItemId: stockConsumption.orderItemId, // Fixed: Added missing field
        dishId: stockConsumption.dishId, // Fixed: Added missing field
        orderType: stockConsumption.orderType,
        quantity: stockConsumption.quantity,
        unitPrice: stockConsumption.unitPrice,
        totalCost: stockConsumption.totalCost,
        consumedBy: stockConsumption.consumedBy,
        branchId: stockConsumption.branchId, // Fixed: Added missing field
        notes: stockConsumption.notes,
        measuringUnitSymbol: measuringUnits.symbol,
        createdAt: stockConsumption.createdAt,
      })
      .from(stockConsumption)
      .leftJoin(stockItems, eq(stockConsumption.stockItemId, stockItems.id))
      .leftJoin(measuringUnits, eq(stockItems.measuringUnitId, measuringUnits.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(stockConsumption.createdAt));
  }

  async createStockConsumption(consumption: InsertStockConsumption): Promise<StockConsumption> {
    // Deduct stock quantity
    if (consumption.stockItemId) {
      await this.updateStockQuantity(
        consumption.stockItemId,
        parseFloat(consumption.quantity),
        'subtract'
      );
    }

    const [newConsumption] = await db.insert(stockConsumption).values(consumption).returning();
    return newConsumption;
  }

  async createStockConsumptionBulk(consumptions: InsertStockConsumption[]): Promise<StockConsumption[]> {
    // Deduct stock for each item
    for (const consumption of consumptions) {
      if (consumption.stockItemId) {
        await this.updateStockQuantity(
          consumption.stockItemId,
          parseFloat(consumption.quantity),
          'subtract'
        );
      }
    }

    return await db.insert(stockConsumption).values(consumptions).returning();
  }

  async getStockConsumption(id: number): Promise<any | undefined> {
    const [consumption] = await db
      .select({
        id: stockConsumption.id,
        stockItemId: stockConsumption.stockItemId,
        stockItemName: stockItems.name,
        orderId: stockConsumption.orderId,
        orderItemId: stockConsumption.orderItemId,
        dishId: stockConsumption.dishId,
        orderType: stockConsumption.orderType,
        quantity: stockConsumption.quantity,
        unitPrice: stockConsumption.unitPrice,
        totalCost: stockConsumption.totalCost,
        consumedBy: stockConsumption.consumedBy,
        branchId: stockConsumption.branchId,
        notes: stockConsumption.notes,
        measuringUnitSymbol: measuringUnits.symbol,
        createdAt: stockConsumption.createdAt,
      })
      .from(stockConsumption)
      .leftJoin(stockItems, eq(stockConsumption.stockItemId, stockItems.id))
      .leftJoin(measuringUnits, eq(stockItems.measuringUnitId, measuringUnits.id))
      .where(eq(stockConsumption.id, id));
    
    return consumption;
  }

  async deleteStockConsumption(id: number): Promise<void> {
    // Get consumption record first to restore stock
    const consumption = await this.getStockConsumption(id);
    if (consumption) {
      // Restore stock quantity
      await this.updateStockQuantity(
        consumption.stockItemId,
        parseFloat(consumption.quantity),
        'add'
      );
    }
    
    // Delete the consumption record
    await db.delete(stockConsumption).where(eq(stockConsumption.id, id));
  }

  async getLowStockItems(branchId?: number): Promise<any[]> {
    const conditions = [
      eq(stockItems.isActive, true),
      sql`CAST(${stockItems.currentStock} AS DECIMAL) <= CAST(${stockItems.minimumStock} AS DECIMAL)`
    ];
    if (branchId) {
      conditions.push(eq(stockItems.branchId, branchId));
    }

    return await db
      .select({
        id: stockItems.id,
        name: stockItems.name,
        sku: stockItems.sku,
        currentStock: stockItems.currentStock,
        reorderLevel: stockItems.reorderLevel,
        reorderQuantity: stockItems.reorderQuantity,
        categoryName: stockCategories.name,
        measuringUnitSymbol: measuringUnits.symbol,
        branchId: stockItems.branchId,
      })
      .from(stockItems)
      .leftJoin(stockCategories, eq(stockItems.categoryId, stockCategories.id))
      .leftJoin(measuringUnits, eq(stockItems.measuringUnitId, measuringUnits.id))
      .where(and(...conditions))
      .orderBy(stockItems.name);
  }

  async getLowStockItemsWithBranches(): Promise<any[]> {
    const conditions = [
      eq(stockItems.isActive, true),
      sql`CAST(${stockItems.currentStock} AS DECIMAL) <= CAST(${stockItems.minimumStock} AS DECIMAL)`
    ];

    return await db
      .select({
        id: stockItems.id,
        name: stockItems.name,
        sku: stockItems.sku,
        currentStock: stockItems.currentStock,
        reorderLevel: stockItems.reorderLevel,
        reorderQuantity: stockItems.reorderQuantity,
        categoryName: stockCategories.name,
        measuringUnitSymbol: measuringUnits.symbol,
        branchId: stockItems.branchId,
        branchName: sql`(SELECT name FROM branches WHERE id = ${stockItems.branchId})`,
      })
      .from(stockItems)
      .leftJoin(stockCategories, eq(stockItems.categoryId, stockCategories.id))
      .leftJoin(measuringUnits, eq(stockItems.measuringUnitId, measuringUnits.id))
      .where(and(...conditions))
      .orderBy(stockItems.name);
  }
}

export const inventoryStorage = new InventoryStorage();