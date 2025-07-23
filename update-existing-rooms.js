
import { db } from './server/db.ts';
import { rooms } from './shared/schema.ts';
import { eq, isNull } from 'drizzle-orm';
import crypto from 'crypto';

async function updateExistingRooms() {
  try {
    console.log('🔄 Updating existing rooms with QR tokens...');

    // Find all rooms without QR tokens
    const roomsWithoutTokens = await db
      .select()
      .from(rooms)
      .where(isNull(rooms.qrToken));

    console.log(`Found ${roomsWithoutTokens.length} rooms without QR tokens`);

    // Update each room with a new QR token
    for (const room of roomsWithoutTokens) {
      const qrToken = crypto.randomUUID();
      await db
        .update(rooms)
        .set({ qrToken })
        .where(eq(rooms.id, room.id));
      
      console.log(`✅ Updated room ${room.number} (ID: ${room.id}) with QR token: ${qrToken}`);
    }

    console.log('✅ All existing rooms updated with QR tokens');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating rooms:', error);
    process.exit(1);
  }
}

updateExistingRooms();
