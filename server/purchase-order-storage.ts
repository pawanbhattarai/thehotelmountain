import { db } from "./db";
import { eq, and, desc, sql, or, isNull, gte, lte, sum } from "drizzle-orm";
import {
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
  stockItems,
  stockReceipts,
  stockReceiptItems,
  stockCostHistory,
  branches,
  users,
  measuringUnits,
  stockCategories,
  type PurchaseOrder,
  type InsertPurchaseOrder,
  type PurchaseOrderItem,
  type InsertPurchaseOrderItem,
  type StockReceipt,
  type InsertStockReceipt,
  type StockReceiptItem,
  type InsertStockReceiptItem,
} from "@shared/schema";

export class PurchaseOrderStorage {
  // Purchase Orders
  async getPurchaseOrders(branchId?: number, status?: string): Promise<any[]> {
    const conditions = [eq(purchaseOrders.isActive, true)];
    if (branchId) {
      conditions.push(eq(purchaseOrders.branchId, branchId));
    }
    if (status) {
      conditions.push(eq(purchaseOrders.status, status));
    }

    return await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        status: purchaseOrders.status,
        orderDate: purchaseOrders.orderDate,
        expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
        actualDeliveryDate: purchaseOrders.actualDeliveryDate,
        subtotal: purchaseOrders.subtotal,
        taxAmount: purchaseOrders.taxAmount,
        discountAmount: purchaseOrders.discountAmount,
        totalAmount: purchaseOrders.totalAmount,
        notes: purchaseOrders.notes,
        approvedBy: purchaseOrders.approvedBy,
        approvedAt: purchaseOrders.approvedAt,
        createdBy: purchaseOrders.createdBy,
        createdByName: sql`(SELECT CONCAT(${users.firstName}, ' ', ${users.lastName}) FROM ${users} WHERE ${users.id} = ${purchaseOrders.createdBy})`,
        branchId: purchaseOrders.branchId,
        branchName: branches.name,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(branches, eq(purchaseOrders.branchId, branches.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(purchaseOrders.createdAt));
  }

  async getPurchaseOrder(id: number): Promise<any | undefined> {
    const [order] = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        supplierEmail: suppliers.email,
        supplierPhone: suppliers.phone,
        supplierAddress: suppliers.address,
        status: purchaseOrders.status,
        orderDate: purchaseOrders.orderDate,
        expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
        actualDeliveryDate: purchaseOrders.actualDeliveryDate,
        subtotal: purchaseOrders.subtotal,
        taxAmount: purchaseOrders.taxAmount,
        discountAmount: purchaseOrders.discountAmount,
        totalAmount: purchaseOrders.totalAmount,
        notes: purchaseOrders.notes,
        approvedBy: purchaseOrders.approvedBy,
        approvedAt: purchaseOrders.approvedAt,
        createdBy: purchaseOrders.createdBy,
        branchId: purchaseOrders.branchId,
        branchName: branches.name,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(branches, eq(purchaseOrders.branchId, branches.id))
      .where(eq(purchaseOrders.id, id));

    if (!order) return undefined;

    // Get items
    const items = await this.getPurchaseOrderItems(id);
    return { ...order, items };
  }

  async createPurchaseOrder(order: InsertPurchaseOrder, items: InsertPurchaseOrderItem[]): Promise<PurchaseOrder> {
    return await db.transaction(async (tx) => {
      // Generate PO number
      const timestamp = Date.now().toString().slice(-6);
      const poNumber = `PO-${timestamp}`;

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
      const totalAmount = subtotal + parseFloat(order.taxAmount || "0") - parseFloat(order.discountAmount || "0");

      // Create purchase order
      const [newOrder] = await tx.insert(purchaseOrders).values({
        ...order,
        poNumber,
        subtotal: subtotal.toString(),
        totalAmount: totalAmount.toString(),
      }).returning();

      // Create items
      const orderItems = items.map(item => ({
        ...item,
        purchaseOrderId: newOrder.id,
      }));

      await tx.insert(purchaseOrderItems).values(orderItems);

      return newOrder;
    });
  }

  async updatePurchaseOrder(id: number, order: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder> {
    const [updatedOrder] = await db
      .update(purchaseOrders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id))
      .returning();
    return updatedOrder;
  }

  async deletePurchaseOrder(id: number): Promise<void> {
    await db.update(purchaseOrders).set({ isActive: false }).where(eq(purchaseOrders.id, id));
  }

  async approvePurchaseOrder(id: number, approvedBy: string): Promise<PurchaseOrder> {
    const [updatedOrder] = await db
      .update(purchaseOrders)
      .set({ 
        status: "confirmed",
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(purchaseOrders.id, id))
      .returning();
    return updatedOrder;
  }

  // Purchase Order Items
  async getPurchaseOrderItems(purchaseOrderId: number): Promise<any[]> {
    return await db
      .select({
        id: purchaseOrderItems.id,
        purchaseOrderId: purchaseOrderItems.purchaseOrderId,
        stockItemId: purchaseOrderItems.stockItemId,
        stockItemName: stockItems.name,
        stockItemSku: stockItems.sku,
        quantity: purchaseOrderItems.quantity,
        unitPrice: purchaseOrderItems.unitPrice,
        totalPrice: purchaseOrderItems.totalPrice,
        receivedQuantity: purchaseOrderItems.receivedQuantity,
        notes: purchaseOrderItems.notes,
        measuringUnitName: measuringUnits.name,
        measuringUnitSymbol: measuringUnits.symbol,
        categoryName: stockCategories.name,
        createdAt: purchaseOrderItems.createdAt,
      })
      .from(purchaseOrderItems)
      .leftJoin(stockItems, eq(purchaseOrderItems.stockItemId, stockItems.id))
      .leftJoin(measuringUnits, eq(stockItems.measuringUnitId, measuringUnits.id))
      .leftJoin(stockCategories, eq(stockItems.categoryId, stockCategories.id))
      .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId))
      .orderBy(purchaseOrderItems.id);
  }

  async updatePurchaseOrderItem(id: number, item: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem> {
    const [updatedItem] = await db
      .update(purchaseOrderItems)
      .set(item)
      .where(eq(purchaseOrderItems.id, id))
      .returning();
    return updatedItem;
  }

  // Stock Receipts
  async getStockReceipts(branchId?: number, purchaseOrderId?: number): Promise<any[]> {
    const conditions = [eq(stockReceipts.isActive, true)];
    if (branchId) {
      conditions.push(eq(stockReceipts.branchId, branchId));
    }
    if (purchaseOrderId) {
      conditions.push(eq(stockReceipts.purchaseOrderId, purchaseOrderId));
    }

    return await db
      .select({
        id: stockReceipts.id,
        receiptNumber: stockReceipts.receiptNumber,
        purchaseOrderId: stockReceipts.purchaseOrderId,
        poNumber: purchaseOrders.poNumber,
        supplierId: stockReceipts.supplierId,
        supplierName: suppliers.name,
        receivedDate: stockReceipts.receivedDate,
        totalQuantity: stockReceipts.totalQuantity,
        totalValue: stockReceipts.totalValue,
        notes: stockReceipts.notes,
        receivedBy: stockReceipts.receivedBy,
        receivedByName: sql`(SELECT CONCAT(${users.firstName}, ' ', ${users.lastName}) FROM ${users} WHERE ${users.id} = ${stockReceipts.receivedBy})`,
        branchId: stockReceipts.branchId,
        branchName: branches.name,
        createdAt: stockReceipts.createdAt,
        updatedAt: stockReceipts.updatedAt,
      })
      .from(stockReceipts)
      .leftJoin(purchaseOrders, eq(stockReceipts.purchaseOrderId, purchaseOrders.id))
      .leftJoin(suppliers, eq(stockReceipts.supplierId, suppliers.id))
      .leftJoin(branches, eq(stockReceipts.branchId, branches.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(stockReceipts.createdAt));
  }

  async createStockReceipt(
    receipt: InsertStockReceipt, 
    items: InsertStockReceiptItem[]
  ): Promise<StockReceipt> {
    return await db.transaction(async (tx) => {
      // Generate receipt number
      const timestamp = Date.now().toString().slice(-6);
      const receiptNumber = `RCP-${timestamp}`;

      // Calculate totals
      const totalQuantity = items.reduce((sum, item) => sum + parseFloat(item.quantity), 0);
      const totalValue = items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);

      // Create receipt
      const [newReceipt] = await tx.insert(stockReceipts).values({
        ...receipt,
        receiptNumber,
        totalQuantity: totalQuantity.toString(),
        totalValue: totalValue.toString(),
      }).returning();

      // Create receipt items
      const receiptItems = items.map(item => ({
        ...item,
        stockReceiptId: newReceipt.id,
      }));

      await tx.insert(stockReceiptItems).values(receiptItems);

      // Update stock quantities and costs
      for (const item of items) {
        await this.updateStockOnReceipt(tx, item, newReceipt.id);
      }

      // Update purchase order status if applicable
      if (receipt.purchaseOrderId) {
        await this.updatePurchaseOrderStatus(tx, receipt.purchaseOrderId);
      }

      return newReceipt;
    });
  }

  private async updateStockOnReceipt(tx: any, item: InsertStockReceiptItem, receiptId: number): Promise<void> {
    // Get current stock
    const [currentStock] = await tx
      .select()
      .from(stockItems)
      .where(eq(stockItems.id, item.stockItemId));

    if (!currentStock) throw new Error('Stock item not found');

    // Update stock quantity
    const newQuantity = parseFloat(currentStock.currentStock || "0") + parseFloat(item.quantity);
    await tx
      .update(stockItems)
      .set({ 
        currentStock: newQuantity.toString(),
        updatedAt: new Date()
      })
      .where(eq(stockItems.id, item.stockItemId));

    // Create cost history record for FIFO tracking
    await tx.insert(stockCostHistory).values({
      stockItemId: item.stockItemId,
      stockReceiptItemId: receiptId,
      quantity: item.quantity,
      unitCost: item.unitPrice,
      totalCost: item.totalPrice,
      remainingQuantity: item.quantity,
      costingMethod: "fifo",
      transactionType: "purchase",
      transactionDate: new Date(),
    });

    // Update received quantity in purchase order item if linked
    if (item.purchaseOrderItemId) {
      const [poItem] = await tx
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.id, item.purchaseOrderItemId));

      if (poItem) {
        const newReceivedQty = parseFloat(poItem.receivedQuantity || "0") + parseFloat(item.quantity);
        await tx
          .update(purchaseOrderItems)
          .set({ receivedQuantity: newReceivedQty.toString() })
          .where(eq(purchaseOrderItems.id, item.purchaseOrderItemId));
      }
    }
  }

  private async updatePurchaseOrderStatus(tx: any, purchaseOrderId: number): Promise<void> {
    // Get all items for this PO
    const poItems = await tx
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));

    let allReceived = true;
    let anyReceived = false;

    for (const item of poItems) {
      const ordered = parseFloat(item.quantity);
      const received = parseFloat(item.receivedQuantity || "0");

      if (received > 0) anyReceived = true;
      if (received < ordered) allReceived = false;
    }

    let newStatus = "confirmed";
    if (allReceived) {
      newStatus = "received";
    } else if (anyReceived) {
      newStatus = "partially-received";
    }

    await tx
      .update(purchaseOrders)
      .set({ 
        status: newStatus,
        updatedAt: new Date()
      })
      .where(eq(purchaseOrders.id, purchaseOrderId));
  }

  // Analytics and Reporting
  async getPurchaseAnalytics(branchId?: number, startDate?: string, endDate?: string): Promise<any> {
    const conditions = [eq(purchaseOrders.isActive, true)];
    if (branchId) {
      conditions.push(eq(purchaseOrders.branchId, branchId));
    }
    if (startDate) {
      conditions.push(gte(purchaseOrders.orderDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(purchaseOrders.orderDate, endDate));
    }

    const [totalInvestment] = await db
      .select({
        totalAmount: sum(purchaseOrders.totalAmount),
        totalOrders: sql<number>`count(*)`,
      })
      .from(purchaseOrders)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Supplier-wise breakdown
    const supplierBreakdown = await db
      .select({
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        totalAmount: sum(purchaseOrders.totalAmount),
        totalOrders: sql<number>`count(*)`,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(purchaseOrders.supplierId, suppliers.name);

    // Monthly trends
    const monthlyTrends = await db
      .select({
        month: sql<string>`to_char(${purchaseOrders.orderDate}, 'YYYY-MM')`,
        totalAmount: sum(purchaseOrders.totalAmount),
        totalOrders: sql<number>`count(*)`,
      })
      .from(purchaseOrders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(sql`to_char(${purchaseOrders.orderDate}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${purchaseOrders.orderDate}, 'YYYY-MM')`);

    return {
      totalInvestment: parseFloat(totalInvestment.totalAmount || "0"),
      totalOrders: totalInvestment.totalOrders,
      supplierBreakdown,
      monthlyTrends,
    };
  }

  async getInventoryValuation(branchId?: number): Promise<any> {
    const conditions = [eq(stockItems.isActive, true)];
    if (branchId) {
      conditions.push(eq(stockItems.branchId, branchId));
    }

    const valuationData = await db
      .select({
        stockItemId: stockItems.id,
        stockItemName: stockItems.name,
        currentStock: stockItems.currentStock,
        categoryName: stockCategories.name,
        measuringUnitSymbol: measuringUnits.symbol,
        totalCost: sql<number>`COALESCE(SUM(${stockCostHistory.remainingQuantity} * ${stockCostHistory.unitCost}), 0)`,
        averageCost: sql<number>`COALESCE(AVG(${stockCostHistory.unitCost}), 0)`,
      })
      .from(stockItems)
      .leftJoin(stockCategories, eq(stockItems.categoryId, stockCategories.id))
      .leftJoin(measuringUnits, eq(stockItems.measuringUnitId, measuringUnits.id))
      .leftJoin(stockCostHistory, and(
        eq(stockCostHistory.stockItemId, stockItems.id),
        eq(stockCostHistory.isActive, true)
      ))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(
        stockItems.id,
        stockItems.name,
        stockItems.currentStock,
        stockCategories.name,
        measuringUnits.symbol
      );

    const totalValue = valuationData.reduce((sum, item) => sum + (item.totalCost || 0), 0);

    return {
      totalInventoryValue: totalValue,
      itemsValuation: valuationData,
    };
  }

  async getProfitAnalysis(branchId?: number, startDate?: string, endDate?: string): Promise<any> {
    // This would calculate profit by comparing purchase costs with sales revenue
    // Integration with restaurant orders and reservation revenue

    const conditions = [];
    if (branchId) {
      conditions.push(`branch_id = ${branchId}`);
    }
    if (startDate) {
      conditions.push(`created_at >= '${startDate}'`);
    }
    if (endDate) {
      conditions.push(`created_at <= '${endDate}'`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total purchase costs
    const purchaseCosts = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) as total_cost
      FROM purchase_orders 
      ${sql.raw(whereClause.replace('created_at', 'order_date'))}
      AND is_active = true
    `);

    // Get restaurant revenue
    const restaurantRevenue = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) as total_revenue
      FROM restaurant_orders 
      ${sql.raw(whereClause)}
      AND status NOT IN ('cancelled')
    `);

    // Get hotel revenue
    const hotelRevenue = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) as total_revenue
      FROM reservations 
      ${sql.raw(whereClause)}
      AND status NOT IN ('cancelled')
    `);

    const totalCosts = parseFloat(purchaseCosts[0]?.total_cost || "0");
    const totalRestaurantRevenue = parseFloat(restaurantRevenue[0]?.total_revenue || "0");
    const totalHotelRevenue = parseFloat(hotelRevenue[0]?.total_revenue || "0");
    const totalRevenue = totalRestaurantRevenue + totalHotelRevenue;
    const grossProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      totalCosts,
      totalRevenue,
      restaurantRevenue: totalRestaurantRevenue,
      hotelRevenue: totalHotelRevenue,
      grossProfit,
      profitMargin,
    };
  }

  // async getStockReceipts(branchId?: number): Promise<any[]> {
  //   const conditions = [];
  //   if (branchId) {
  //     conditions.push(eq(stockReceipts.branchId, branchId));
  //   }

  //   return await db
  //     .select({
  //       id: stockReceipts.id,
  //       receiptNumber: stockReceipts.receiptNumber,
  //       purchaseOrderId: stockReceipts.purchaseOrderId,
  //       poNumber: purchaseOrders.poNumber,
  //       supplierId: stockReceipts.supplierId,
  //       supplierName: suppliers.name,
  //       branchId: stockReceipts.branchId,
  //       receivedDate: stockReceipts.receivedDate,
  //       totalQuantity: stockReceipts.totalQuantity,
  //       totalValue: stockReceipts.totalValue,
  //       notes: stockReceipts.notes,
  //       receivedBy: stockReceipts.receivedBy,
  //       receivedByName: users.firstName,
  //       isActive: stockReceipts.isActive,
  //       createdAt: stockReceipts.createdAt,
  //     })
  //     .from(stockReceipts)
  //     .leftJoin(purchaseOrders, eq(stockReceipts.purchaseOrderId, purchaseOrders.id))
  //     .leftJoin(suppliers, eq(stockReceipts.supplierId, suppliers.id))
  //     .leftJoin(users, eq(stockReceipts.receivedBy, users.id))
  //     .where(conditions.length > 0 ? and(...conditions) : undefined)
  //     .orderBy(desc(stockReceipts.createdAt));
  // }

  async getStockReceipt(id: number): Promise<any | undefined> {
    const [receipt] = await db
      .select({
        id: stockReceipts.id,
        receiptNumber: stockReceipts.receiptNumber,
        purchaseOrderId: stockReceipts.purchaseOrderId,
        poNumber: purchaseOrders.poNumber,
        supplierId: stockReceipts.supplierId,
        supplierName: suppliers.name,
        branchId: stockReceipts.branchId,
        receivedDate: stockReceipts.receivedDate,
        totalQuantity: stockReceipts.totalQuantity,
        totalValue: stockReceipts.totalValue,
        notes: stockReceipts.notes,
        receivedBy: stockReceipts.receivedBy,
        receivedByName: users.firstName,
        isActive: stockReceipts.isActive,
        createdAt: stockReceipts.createdAt,
      })
      .from(stockReceipts)
      .leftJoin(purchaseOrders, eq(stockReceipts.purchaseOrderId, purchaseOrders.id))
      .leftJoin(suppliers, eq(stockReceipts.supplierId, suppliers.id))
      .leftJoin(users, eq(stockReceipts.receivedBy, users.id))
      .where(eq(stockReceipts.id, id));

    if (!receipt) return undefined;

    // Get receipt items
    const items = await db
      .select({
        id: stockReceiptItems.id,
        stockReceiptId: stockReceiptItems.stockReceiptId,
        purchaseOrderItemId: stockReceiptItems.purchaseOrderItemId,
        stockItemId: stockReceiptItems.stockItemId,
        stockItemName: stockItems.name,
        quantity: stockReceiptItems.quantity,
        unitPrice: stockReceiptItems.unitPrice,
        totalPrice: stockReceiptItems.totalPrice,
        batchNumber: stockReceiptItems.batchNumber,
        expiryDate: stockReceiptItems.expiryDate,
        notes: stockReceiptItems.notes,
        createdAt: stockReceiptItems.createdAt,
      })
      .from(stockReceiptItems)
      .leftJoin(stockItems, eq(stockReceiptItems.stockItemId, stockItems.id))
      .where(eq(stockReceiptItems.stockReceiptId, id));

    return {
      ...receipt,
      items,
    };
  }
}

export const purchaseOrderStorage = new PurchaseOrderStorage();