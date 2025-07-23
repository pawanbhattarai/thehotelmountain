import QRCode from 'qrcode';
import { storage } from './storage';
import { restaurantStorage } from './restaurant-storage';
import sharp from 'sharp';
import { readFileSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

export class QRService {
  static getBaseUrl(): string {
    // In production, this would be your actual domain
    return process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'http://localhost:5000';
  }

  static async addIconToQRCode(qrCodeDataUrl: string): Promise<string> {
    try {
      // Convert data URL to buffer
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
      const qrBuffer = Buffer.from(base64Data, 'base64');
      
      // Load the sidebar icon
      const iconPath = path.join(process.cwd(), 'public', 'sidebar_icon.png');
      const iconBuffer = readFileSync(iconPath);
      
      // Get QR code dimensions
      const qrImage = sharp(qrBuffer);
      const { width, height } = await qrImage.metadata();
      
      // Calculate icon size (about 20% of QR code size)
      const iconSize = Math.floor((width || 300) * 0.2);
      
      // Resize icon and add white background for better visibility
      const processedIcon = await sharp(iconBuffer)
        .resize(iconSize, iconSize)
        .composite([{
          input: Buffer.from(`<svg width="${iconSize}" height="${iconSize}">
            <circle cx="${iconSize/2}" cy="${iconSize/2}" r="${iconSize/2 - 2}" fill="white" stroke="#e5e5e5" stroke-width="2"/>
          </svg>`),
          blend: 'dest-over'
        }])
        .png()
        .toBuffer();
      
      // Overlay icon on QR code center
      const result = await qrImage
        .composite([{
          input: processedIcon,
          left: Math.floor(((width || 300) - iconSize) / 2),
          top: Math.floor(((height || 300) - iconSize) / 2)
        }])
        .png()
        .toBuffer();
      
      // Convert back to data URL
      return `data:image/png;base64,${result.toString('base64')}`;
    } catch (error) {
      console.error('Error adding icon to QR code:', error);
      // Return original QR code if icon processing fails
      return qrCodeDataUrl;
    }
  }

  static async generateTableQR(tableId: number): Promise<string> {
    const table = await restaurantStorage.getRestaurantTable(tableId);
    if (!table) {
      throw new Error('Table not found');
    }

    const qrUrl = `${this.getBaseUrl()}/order/${table.qrToken}`;
    const qrCode = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Add the sidebar icon to the center of the QR code
    return await this.addIconToQRCode(qrCode);
  }

  static async generateRoomQR(roomId: number): Promise<string> {
    const room = await storage.getRoom(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const qrUrl = `${this.getBaseUrl()}/order/${room.qrToken}`;
    const qrCode = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Add the sidebar icon to the center of the QR code
    return await this.addIconToQRCode(qrCode);
  }

  static async validateQRToken(token: string): Promise<{ type: 'table' | 'room', id: number, branchId: number, name: string } | null> {
    try {
      console.log(`🔍 Validating QR token: ${token}`);
      
      // Check if it's a table
      const tables = await restaurantStorage.getRestaurantTables();
      console.log(`📋 Found ${tables.length} tables to check`);
      
      const table = tables.find(t => t.qrToken === token);
      if (table) {
        console.log(`✅ Found matching table: ${table.name} (ID: ${table.id})`);
        return {
          type: 'table',
          id: table.id,
          branchId: table.branchId,
          name: table.name
        };
      }

      // Check if it's a room
      const rooms = await storage.getRooms();
      console.log(`🏨 Found ${rooms.length} rooms to check`);
      
      const room = rooms.find(r => r.qrToken === token);
      if (room) {
        console.log(`✅ Found matching room: ${room.number} (ID: ${room.id})`);
        return {
          type: 'room',
          id: room.id,
          branchId: room.branchId,
          name: `Room ${room.number}`
        };
      }

      console.log(`❌ No matching table or room found for token: ${token}`);
      return null;
    } catch (error) {
      console.error('Error validating QR token:', error);
      return null;
    }
  }

  static async regenerateTableQR(tableId: number): Promise<{ qrToken: string, qrCode: string }> {
    const newToken = crypto.randomUUID();
    await restaurantStorage.updateRestaurantTable(tableId, { qrToken: newToken });
    const qrCode = await this.generateTableQR(tableId);
    return { qrToken: newToken, qrCode };
  }

  static async regenerateRoomQR(roomId: number): Promise<{ qrToken: string, qrCode: string }> {
    const newToken = crypto.randomUUID();
    await storage.updateRoom(roomId, { qrToken: newToken });
    const qrCode = await this.generateRoomQR(roomId);
    return { qrToken: newToken, qrCode };
  }
}