
import { db } from "./db";
import { measuringUnits } from "@shared/schema";
import { eq } from "drizzle-orm";

const defaultMeasuringUnits = [
  {
    name: "Kilogram",
    symbol: "kg",
    baseUnit: "gram",
    conversionFactor: "1000",
    isActive: true,
  },
  {
    name: "Gram",
    symbol: "g",
    baseUnit: null,
    conversionFactor: "1",
    isActive: true,
  },
  {
    name: "Liter",
    symbol: "L",
    baseUnit: "milliliter",
    conversionFactor: "1000",
    isActive: true,
  },
  {
    name: "Milliliter",
    symbol: "ml",
    baseUnit: null,
    conversionFactor: "1",
    isActive: true,
  },
  {
    name: "Piece",
    symbol: "pcs",
    baseUnit: null,
    conversionFactor: "1",
    isActive: true,
  },
  {
    name: "Dozen",
    symbol: "dz",
    baseUnit: "piece",
    conversionFactor: "12",
    isActive: true,
  },
  {
    name: "Packet",
    symbol: "pkt",
    baseUnit: null,
    conversionFactor: "1",
    isActive: true,
  },
  {
    name: "Box",
    symbol: "box",
    baseUnit: null,
    conversionFactor: "1",
    isActive: true,
  },
  {
    name: "Bottle",
    symbol: "btl",
    baseUnit: null,
    conversionFactor: "1",
    isActive: true,
  },
  {
    name: "Can",
    symbol: "can",
    baseUnit: null,
    conversionFactor: "1",
    isActive: true,
  },
];

export async function seedMeasuringUnits() {
  console.log("🌱 Seeding default measuring units...");
  
  try {
    for (const unit of defaultMeasuringUnits) {
      // Check if unit already exists
      const [existingUnit] = await db
        .select()
        .from(measuringUnits)
        .where(eq(measuringUnits.symbol, unit.symbol))
        .limit(1);

      if (!existingUnit) {
        await db.insert(measuringUnits).values(unit);
        console.log(`✅ Added measuring unit: ${unit.name} (${unit.symbol})`);
      } else {
        console.log(`⏭️ Measuring unit already exists: ${unit.name} (${unit.symbol})`);
      }
    }
    
    console.log("✅ Default measuring units seeded successfully");
  } catch (error) {
    console.error("❌ Error seeding measuring units:", error);
    throw error;
  }
}
