
import { inventoryStorage } from './inventory-storage';
import { storage } from './storage';
import { NotificationService } from './notifications';

export class LowStockChecker {
  private static instance: LowStockChecker;
  private checkInterval: NodeJS.Timeout | null = null;
  private notifiedItems: Set<string> = new Set(); // Track items we've already notified about

  private constructor() {}

  static getInstance(): LowStockChecker {
    if (!LowStockChecker.instance) {
      LowStockChecker.instance = new LowStockChecker();
    }
    return LowStockChecker.instance;
  }

  async checkLowStock(): Promise<void> {
    try {
      console.log('🔍 Checking for low stock items...');
      
      // Get all low stock items with branch information
      const lowStockItems = await inventoryStorage.getLowStockItemsWithBranches();
      
      if (lowStockItems.length === 0) {
        console.log('✅ No low stock items found');
        return;
      }

      console.log(`⚠️ Found ${lowStockItems.length} low stock items`);

      // Group items by branch for efficient notification
      const itemsByBranch = new Map<number | null, any[]>();
      
      for (const item of lowStockItems) {
        const branchId = item.branchId;
        if (!itemsByBranch.has(branchId)) {
          itemsByBranch.set(branchId, []);
        }
        itemsByBranch.get(branchId)!.push(item);
      }

      // Send notifications for each branch
      for (const [branchId, items] of itemsByBranch) {
        for (const item of items) {
          const itemKey = `${item.id}-${item.currentStock}-${item.reorderLevel}`;
          
          // Only send notification if we haven't notified about this item at this stock level
          if (!this.notifiedItems.has(itemKey)) {
            console.log(`📧 Sending low stock notification for item: ${item.name} (${item.currentStock} remaining)`);
            
            const branch = branchId ? { id: branchId, name: item.branchName } : undefined;
            
            await NotificationService.sendLowStockNotification(item, branch);
            
            // Mark this item as notified
            this.notifiedItems.add(itemKey);
            
            // Add small delay between notifications to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      // Clean up old notification tracking (items that are no longer low stock)
      this.cleanupNotificationTracking(lowStockItems);

    } catch (error) {
      console.error('❌ Error checking low stock:', error);
    }
  }

  private cleanupNotificationTracking(currentLowStockItems: any[]): void {
    const currentItemKeys = new Set(
      currentLowStockItems.map(item => `${item.id}-${item.currentStock}-${item.reorderLevel}`)
    );
    
    // Remove tracking for items that are no longer low stock or have different stock levels
    for (const itemKey of this.notifiedItems) {
      if (!currentItemKeys.has(itemKey)) {
        this.notifiedItems.delete(itemKey);
      }
    }
  }

  startMonitoring(intervalMinutes: number = 30): void {
    if (this.checkInterval) {
      console.log('⏰ Low stock monitoring already running');
      return;
    }

    console.log(`🚀 Starting low stock monitoring (checking every ${intervalMinutes} minutes)`);
    
    // Initial check
    this.checkLowStock();
    
    // Set up recurring checks
    this.checkInterval = setInterval(() => {
      this.checkLowStock();
    }, intervalMinutes * 60 * 1000);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏹️ Low stock monitoring stopped');
    }
  }

  // Manual trigger for immediate checking
  async triggerCheck(): Promise<void> {
    await this.checkLowStock();
  }

  // Check low stock when inventory is updated
  async onInventoryUpdate(stockItemId: number): Promise<void> {
    try {
      const stockItem = await inventoryStorage.getStockItem(stockItemId);
      if (!stockItem) return;

      const currentStock = parseFloat(stockItem.currentStock || '0');
      const reorderLevel = parseFloat(stockItem.reorderLevel || '0');

      // Check if this specific item is now low stock
      if (currentStock <= reorderLevel) {
        console.log(`⚠️ Item ${stockItem.name} is now low stock after inventory update`);
        
        // Get branch info if needed
        let branch: { id: number; name: string } | undefined;
        if (stockItem.branchId) {
          const branchData = await storage.getBranch(stockItem.branchId);
          if (branchData) {
            branch = { id: branchData.id, name: branchData.name };
          }
        }

        const itemKey = `${stockItem.id}-${currentStock}-${reorderLevel}`;
        
        // Only notify if we haven't already notified about this stock level
        if (!this.notifiedItems.has(itemKey)) {
          await NotificationService.sendLowStockNotification({
            id: stockItem.id,
            name: stockItem.name,
            currentStock: stockItem.currentStock,
            reorderLevel: stockItem.reorderLevel,
            reorderQuantity: stockItem.reorderQuantity,
            measuringUnitSymbol: '' // Will be fetched if needed
          }, branch);
          
          this.notifiedItems.add(itemKey);
        }
      }
    } catch (error) {
      console.error('❌ Error checking single item for low stock:', error);
    }
  }
}

export const lowStockChecker = LowStockChecker.getInstance();
