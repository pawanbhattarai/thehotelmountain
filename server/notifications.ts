import webpush from 'web-push';
import { storage } from './storage';
import type { Branch, Room, Guest, User, InsertNotificationHistory } from '@shared/schema';

// Generate VAPID keys if not provided
let VAPID_PUBLIC_KEY: string;
let VAPID_PRIVATE_KEY: string;

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.log('🔑 Generating new VAPID keys...');
  const vapidKeys = webpush.generateVAPIDKeys();
  VAPID_PUBLIC_KEY = vapidKeys.publicKey;
  VAPID_PRIVATE_KEY = vapidKeys.privateKey;
  console.log('📋 New VAPID Public Key:', VAPID_PUBLIC_KEY);
  console.log('🔐 New VAPID Private Key:', VAPID_PRIVATE_KEY);
  console.log('💡 Consider setting these as environment variables for production');
  console.log('⚠️ All existing push subscriptions will be cleared due to key change');
  
  // Clear all existing subscriptions since VAPID keys changed
  setTimeout(async () => {
    try {
      const { storage } = await import('./storage');
      await storage.clearAllPushSubscriptions();
      console.log('🗑️ Cleared all existing push subscriptions due to VAPID key change');
    } catch (error) {
      console.warn('⚠️ Could not clear existing subscriptions:', error);
    }
  }, 100);
} else {
  VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
  VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
  console.log('✅ Using existing VAPID keys from environment variables');
}

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@hotel.com';

// Configure web-push
webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
}

export class NotificationService {
  static async sendToAllAdmins(notification: NotificationData, notificationType?: string, additionalData?: any) {
    try {
      console.log('🔔 Starting notification send process...');
      console.log('📋 Notification details:', {
        title: notification.title,
        body: notification.body,
        type: notificationType
      });

      const subscriptions = await storage.getAllAdminSubscriptions();
      console.log(`👥 Found ${subscriptions.length} admin subscriptions`);

      if (subscriptions.length === 0) {
        console.warn('⚠️ No admin subscriptions found - no notifications will be sent');
        return;
      }

      // Save notification to history for each admin user
      const savePromises = subscriptions.map(async (sub) => {
        try {
          const historyData: InsertNotificationHistory = {
            userId: sub.userId,
            type: notificationType as any || 'new-reservation',
            title: notification.title,
            body: notification.body,
            data: notification.data,
            ...additionalData
          };
          await storage.createNotificationHistory(historyData);
          console.log(`💾 Saved notification history for user ${sub.userId}`);
        } catch (error) {
          console.error(`❌ Failed to save notification history for user ${sub.userId}:`, error);
        }
      });
      
      await Promise.allSettled(savePromises);
      console.log('💾 Notification history saved for all users');
      
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/favicon.ico',
        badge: notification.badge || '/favicon.ico',
        tag: notification.tag || 'hotel-notification',
        data: notification.data || {},
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'View Details'
          }
        ],
        timestamp: Date.now()
      });

      console.log(`📤 Attempting to send push notifications to ${subscriptions.length} subscribers...`);
      console.log('📦 Payload size:', payload.length, 'bytes');

      const sendPromises = subscriptions.map(async (sub) => {
        try {
          console.log(`📨 Sending notification to user ${sub.userId}...`);
          
          const pushConfig = {
            endpoint: sub.endpoint,
            keys: {
              auth: sub.auth,
              p256dh: sub.p256dh,
            },
          };

          console.log(`🔧 Push config for user ${sub.userId}:`, {
            endpoint: sub.endpoint.substring(0, 50) + '...',
            authLength: sub.auth.length,
            p256dhLength: sub.p256dh.length
          });

          const result = await webpush.sendNotification(pushConfig, payload);
          console.log(`✅ Notification sent successfully to user ${sub.userId}`, result.statusCode);
          return { success: true, userId: sub.userId, statusCode: result.statusCode };
        } catch (error: any) {
          console.error(`❌ Failed to send notification to user ${sub.userId}:`, {
            message: error.message,
            statusCode: error.statusCode,
            body: error.body
          });
          
          // If subscription is invalid or VAPID mismatch, remove it
          if (error.statusCode === 410 || error.statusCode === 404 || error.statusCode === 403) {
            console.log(`🗑️ Removing invalid subscription for user ${sub.userId}`);
            try {
              await storage.deletePushSubscription(sub.userId, sub.endpoint);
              console.log(`✅ Removed invalid subscription for user ${sub.userId}`);
            } catch (deleteError) {
              console.error(`❌ Failed to remove invalid subscription for user ${sub.userId}:`, deleteError);
            }
          }
          
          return { success: false, userId: sub.userId, error: error.message, statusCode: error.statusCode };
        }
      });

      const results = await Promise.allSettled(sendPromises);
      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
      const failed = results.length - successful;
      
      console.log(`📊 Notification send results: ${successful}/${results.length} successful, ${failed} failed`);
      
      // Log details of failed sends
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && !(result.value as any).success) {
          console.error(`❌ Failed send details for user ${subscriptions[index].userId}:`, result.value);
        } else if (result.status === 'rejected') {
          console.error(`❌ Promise rejected for user ${subscriptions[index].userId}:`, result.reason);
        }
      });

      if (successful === 0) {
        console.error('❌ All notification sends failed!');
      } else {
        console.log(`✅ Notification send process completed: ${successful} successful sends`);
      }
    } catch (error) {
      console.error('❌ Critical error in notification send process:', error);
    }
  }

  static async sendNewReservationNotification(
    guest: Guest,
    room: Room & { roomType: { name: string } },
    branch: Branch,
    reservationId: string,
    checkIn: string,
    checkOut: string
  ) {
    const checkInDate = new Date(checkIn).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const checkOutDate = new Date(checkOut).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const notification: NotificationData = {
      title: '🆕 New Reservation Created',
      body: `${guest.firstName} ${guest.lastName} has booked Room ${room.number} (${room.roomType.name}) at ${branch.name} from ${checkInDate} to ${checkOutDate}`,
      tag: 'new-reservation',
      data: {
        type: 'new_reservation',
        reservationId,
        branchId: branch.id,
        roomId: room.id,
        guestId: guest.id,
      }
    };

    await this.sendToAllAdmins(notification, 'new-reservation', {
      reservationId,
      roomId: room.id,
      branchId: branch.id
    });
  }

  static async sendCheckInNotification(
    guest: Guest,
    room: Room & { roomType: { name: string } },
    branch: Branch,
    reservationId: string
  ) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const notification: NotificationData = {
      title: '🏨 Guest Check-In',
      body: `Room ${room.number} has been checked in at ${branch.name} on ${currentDate} (${guest.firstName} ${guest.lastName})`,
      tag: 'check-in',
      data: {
        type: 'check_in',
        reservationId,
        branchId: branch.id,
        roomId: room.id,
        guestId: guest.id,
      }
    };

    await this.sendToAllAdmins(notification, 'check-in', {
      reservationId,
      roomId: room.id,
      branchId: branch.id
    });
  }

  static async sendCheckOutNotification(
    guest: Guest,
    room: Room & { roomType: { name: string } },
    branch: Branch,
    reservationId: string
  ) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const notification: NotificationData = {
      title: '🚪 Guest Check-Out',
      body: `Room ${room.number} has been checked out at ${branch.name} on ${currentDate} (${guest.firstName} ${guest.lastName})`,
      tag: 'check-out',
      data: {
        type: 'check_out',
        reservationId,
        branchId: branch.id,
        roomId: room.id,
        guestId: guest.id,
      }
    };

    await this.sendToAllAdmins(notification, 'check-out', {
      reservationId,
      roomId: room.id,
      branchId: branch.id
    });
  }

  static async sendMaintenanceNotification(
    room: Room & { roomType: { name: string } },
    branch: Branch,
    maintenanceType: string = 'maintenance'
  ) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const statusText = maintenanceType === 'out-of-order' ? 'out of order' : 'under maintenance';

    const notification: NotificationData = {
      title: '🔧 Room Maintenance Alert',
      body: `Room ${room.number} is ${statusText} at ${branch.name} on ${currentDate}`,
      tag: 'maintenance',
      data: {
        type: 'room_maintenance',
        branchId: branch.id,
        roomId: room.id,
        maintenanceType,
      }
    };

    await this.sendToAllAdmins(notification, 'maintenance', {
      roomId: room.id,
      branchId: branch.id
    });
  }

  static async sendLowStockNotification(
    stockItem: any,
    branch?: { id: number; name: string }
  ) {
    const notification: NotificationData = {
      title: '📦 Low Stock Alert',
      body: `${stockItem.name} is running low (${stockItem.currentStock} ${stockItem.measuringUnitSymbol || 'units'} remaining)${branch ? ` at ${branch.name}` : ''}. Reorder level: ${stockItem.reorderLevel}`,
      tag: 'low-stock',
      data: {
        type: 'low_stock',
        stockItemId: stockItem.id,
        branchId: branch?.id,
        currentStock: stockItem.currentStock,
        reorderLevel: stockItem.reorderLevel,
        reorderQuantity: stockItem.reorderQuantity
      }
    };

    // Send to all superadmins and branch admins for the specific branch
    if (branch?.id) {
      // For branch-specific items, send to superadmins and that branch's admins
      await this.sendToBranchAdmins(notification, 'low-stock', {
        stockItemId: stockItem.id,
        branchId: branch.id
      }, branch.id);
    } else {
      // For global items, send to all superadmins
      await this.sendToAllAdmins(notification, 'low-stock', {
        stockItemId: stockItem.id
      });
    }
  }

  static async sendToBranchAdmins(notification: NotificationData, notificationType?: string, additionalData?: any, branchId?: number) {
    try {
      console.log('🔔 Starting branch-specific notification send process...');
      console.log('📋 Notification details:', {
        title: notification.title,
        body: notification.body,
        type: notificationType,
        branchId
      });

      // Get subscriptions for superadmins and branch admins for the specific branch
      const subscriptions = await storage.getBranchAdminSubscriptions(branchId);
      console.log(`👥 Found ${subscriptions.length} admin subscriptions for branch ${branchId}`);

      if (subscriptions.length === 0) {
        console.warn(`⚠️ No admin subscriptions found for branch ${branchId} - no notifications will be sent`);
        return;
      }

      // Save notification to history for each admin user
      const savePromises = subscriptions.map(async (sub) => {
        try {
          const historyData: InsertNotificationHistory = {
            userId: sub.userId,
            type: notificationType as any || 'low-stock',
            title: notification.title,
            body: notification.body,
            data: notification.data,
            ...additionalData
          };
          await storage.createNotificationHistory(historyData);
          console.log(`💾 Saved notification history for user ${sub.userId}`);
        } catch (error) {
          console.error(`❌ Failed to save notification history for user ${sub.userId}:`, error);
        }
      });
      
      await Promise.allSettled(savePromises);
      console.log('💾 Notification history saved for all branch users');
      
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/favicon.ico',
        badge: notification.badge || '/favicon.ico',
        tag: notification.tag || 'hotel-notification',
        data: notification.data || {},
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'View Stock'
          }
        ],
        timestamp: Date.now()
      });

      console.log(`📤 Attempting to send push notifications to ${subscriptions.length} branch subscribers...`);

      const sendPromises = subscriptions.map(async (sub) => {
        try {
          console.log(`📨 Sending notification to user ${sub.userId}...`);
          
          const pushConfig = {
            endpoint: sub.endpoint,
            keys: {
              auth: sub.auth,
              p256dh: sub.p256dh,
            },
          };

          const result = await webpush.sendNotification(pushConfig, payload);
          console.log(`✅ Notification sent successfully to user ${sub.userId}`, result.statusCode);
          return { success: true, userId: sub.userId, statusCode: result.statusCode };
        } catch (error: any) {
          console.error(`❌ Failed to send notification to user ${sub.userId}:`, {
            message: error.message,
            statusCode: error.statusCode,
            body: error.body
          });
          
          // If subscription is invalid, remove it
          if (error.statusCode === 410 || error.statusCode === 404 || error.statusCode === 403) {
            console.log(`🗑️ Removing invalid subscription for user ${sub.userId}`);
            try {
              await storage.deletePushSubscription(sub.userId, sub.endpoint);
              console.log(`✅ Removed invalid subscription for user ${sub.userId}`);
            } catch (deleteError) {
              console.error(`❌ Failed to remove invalid subscription for user ${sub.userId}:`, deleteError);
            }
          }
          
          return { success: false, userId: sub.userId, error: error.message, statusCode: error.statusCode };
        }
      });

      const results = await Promise.allSettled(sendPromises);
      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
      const failed = results.length - successful;
      
      console.log(`📊 Branch notification send results: ${successful}/${results.length} successful, ${failed} failed`);

      if (successful === 0) {
        console.error('❌ All branch notification sends failed!');
      } else {
        console.log(`✅ Branch notification send process completed: ${successful} successful sends`);
      }
    } catch (error) {
      console.error('❌ Critical error in branch notification send process:', error);
    }
  }

  static getVapidPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  }
}