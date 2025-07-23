# Timezone Fix Instructions for Local Development

## Problem
When running locally in VSCode, datetime inputs like "7:44" get converted to wrong times like "1:59" due to timezone differences between browser and server.

## Root Cause
- Replit server runs in UTC timezone
- Your local development server runs in your local timezone (likely Asia/Kathmandu)
- JavaScript Date constructor applies timezone interpretation

## Final Solution - UTC Constructor Method
Copy this exact code to your local `server/routes.ts` file:

### For Both Reservation Creation AND Editing:
Replace the `parseAsExactLocalTime` or `parsePreservingExactTime` functions with:

```javascript
// Create Date object that represents the EXACT local time without timezone shifting
const parseAsExactLocalTime = (dateTimeStr: string) => {
  console.log(`🕐 Input datetime: "${dateTimeStr}"`);
  
  // Parse components manually
  const [datePart, timePart] = dateTimeStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  
  // CRITICAL: Use UTC constructor with our local components to avoid timezone shift
  const exactDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  
  console.log(`🕐 Exact UTC date: "${exactDate.toISOString()}" - stores exactly ${hour}:${minute.toString().padStart(2, '0')}`);
  
  return exactDate;
};
```

## How It Works
1. **UTC Constructor**: `Date.UTC()` creates a timestamp treating the input as UTC time
2. **No Timezone Conversion**: Since we treat user input as UTC, it stores exactly what they entered
3. **Universal Solution**: Works identically on any server timezone

## Key Insight
Instead of fighting timezone conversion, we treat all datetime inputs as if they were UTC. This means:
- User enters "7:49" 
- We store it as "7:49 UTC"
- When displayed back, it shows "7:49" 
- No conversion happens anywhere in the pipeline

## Test Results Expected
After applying the fix:
- Console shows: `🕐 Exact UTC date: "2025-07-25T07:49:00.000Z" - stores exactly 7:49`
- Database stores: `2025-07-25 07:49:00`
- Edit form shows: `07:49`

This approach is bulletproof because it completely sidesteps timezone interpretation.

## Frontend Fix for Editing (Additional)
Also copy this fix to your local `client/src/components/reservations/multi-room-modal.tsx`:

In the `formatDateTimeLocal` function fallback section (around line 848), replace:
```javascript
// OLD: This causes timezone conversion
const date = new Date(dateString);
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, "0");
// ... rest

// NEW: Manual parsing without Date constructor
let year, month, day, hours, minutes;
if (dateString.includes('T') && dateString.includes('Z')) {
  const [datePart, timePart] = dateString.split('T');
  [year, month, day] = datePart.split('-').map(Number);
  [hours, minutes] = timePart.split(':').map(Number);
} else {
  console.error("Cannot parse date format:", dateString);
  return getCurrentDateTime();
}

const formattedMonth = String(month).padStart(2, "0");
const formattedDay = String(day).padStart(2, "0");
const formattedHours = String(hours).padStart(2, "0");
const formattedMinutes = String(minutes).padStart(2, "0");

return `${year}-${formattedMonth}-${formattedDay}T${formattedHours}:${formattedMinutes}`;
```

This prevents timezone conversion during the edit form display.

## Critical: Frontend Edit Payload Fix
Also ensure the edit payload includes room data for datetime updates:

1. In the room initialization (around line 881), add:
```javascript
return {
  id: rr.id, // Include reservation room ID for updates
  roomId: rr.roomId, // Include roomId for backend
  roomTypeId: rr.room.id.toString(),
  checkInDate: formatDateTimeLocal(rr.checkInDate),
  checkOutDate: formatDateTimeLocal(rr.checkOutDate),
  // ... rest of fields
};
```

2. In the edit payload creation (around line 594), change:
```javascript
// OLD: Only sends reservation data
result = await apiRequest("PATCH", `/api/reservations/${editData.id}`, payloadData.reservation);

// NEW: Include rooms data for datetime updates
const editPayload = {
  ...payloadData.reservation,
  rooms: payloadData.rooms, // Include rooms data for datetime updates
};
result = await apiRequest("PATCH", `/api/reservations/${editData.id}`, editPayload);
```

3. Fix room mapping in payload (around line 575):
```javascript
rooms: rooms.map((room) => ({
  id: room.id, // Include existing reservation room ID for updates
  roomId: room.roomId || parseInt(room.roomTypeId), // Use roomId if available
  checkInDate: room.checkInDate,
  checkOutDate: room.checkOutDate,
  // ... rest of fields
})),
```

This ensures datetime changes during editing are properly sent to the backend and processed.