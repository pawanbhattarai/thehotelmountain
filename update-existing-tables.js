
import { db } from './server/db.ts';
import { restaurantTables } from './shared/schema.ts';
import { eq, isNull } from 'drizzle-orm';
import crypto from 'crypto';

async function updateExistingTables() {
  try {
    console.log('🔄 Updating existing tables with QR tokens...');

    // Find all tables without QR tokens
    const tablesWithoutTokens = await db
      .select()
      .from(restaurantTables)
      .where(isNull(restaurantTables.qrToken));

    console.log(`Found ${tablesWithoutTokens.length} tables without QR tokens`);

    // Update each table with a new QR token
    for (const table of tablesWithoutTokens) {
      const qrToken = crypto.randomUUID();
      await db
        .update(restaurantTables)
        .set({ qrToken })
        .where(eq(restaurantTables.id, table.id));
      
      console.log(`✅ Updated table ${table.name} (ID: ${table.id}) with QR token: ${qrToken}`);
    }

    console.log('✅ All existing tables updated with QR tokens');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating tables:', error);
    process.exit(1);
  }
}

updateExistingTables();
