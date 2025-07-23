/**
 * Calculates the number of nights between check-in and check-out dates
 * based on a custom day calculation time.
 * 
 * @param checkInDate - Check-in date string (YYYY-MM-DD)
 * @param checkOutDate - Check-out date string (YYYY-MM-DD)
 * @param dayCalculationTime - Time when new day starts (HH:MM format, default "00:00")
 * @param timeZone - Hotel timezone (default "Asia/Kathmandu")
 * @returns Number of nights
 */
export function calculateNightsWithDayCalculation(
  checkInDateTime: string,
  checkOutDateTime: string,
  dayCalculationTime: string = "00:00",
  timeZone: string = "Asia/Kathmandu",
  useCustomDayCalculation: boolean = false
): number {
  // Ensure we create proper Date objects from the datetime strings
  const checkIn = new Date(checkInDateTime);
  const checkOut = new Date(checkOutDateTime);
  
  // Validate the dates
  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    console.error('Invalid date provided:', { checkInDateTime, checkOutDateTime });
    return 1; // Return minimum nights if dates are invalid
  }

  // If custom day calculation is disabled, use standard 24-hour periods
  if (!useCustomDayCalculation) {
    const diffInMs = checkOut.getTime() - checkIn.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    return Math.max(Math.ceil(diffInHours / 24), 1);
  }

  // Use custom day calculation logic with dayCalculationTime
  // Parse the day calculation time (e.g., "14:00" for 2:00 PM)
  const [dayHour, dayMinute] = dayCalculationTime.split(':').map(Number);

  // Get the date parts for boundary calculation
  const checkInDateStr = checkInDateTime.split('T')[0];
  const checkOutDateStr = checkOutDateTime.split('T')[0];

  // Same calendar day - minimum 1 night
  if (checkInDateStr === checkOutDateStr) {
    return 1;
  }

  // Calculate hotel day boundaries for check-in and check-out dates
  const checkInDayBoundary = new Date(checkInDateStr + 'T00:00:00');
  checkInDayBoundary.setHours(dayHour, dayMinute, 0, 0);
  
  const checkOutDayBoundary = new Date(checkOutDateStr + 'T00:00:00');
  checkOutDayBoundary.setHours(dayHour, dayMinute, 0, 0);

  // Hotel industry logic: Count how many hotel day periods the guest occupies
  // Each "hotel day" runs from dayCalculationTime to dayCalculationTime next day
  
  // Start counting from first hotel day boundary that's <= check-in time
  let currentBoundary = new Date(checkInDayBoundary);
  if (checkIn < checkInDayBoundary) {
    // Check-in is before the day boundary, so start from previous day's boundary
    currentBoundary.setDate(currentBoundary.getDate() - 1);
  }
  
  // Count hotel day periods until we reach check-out
  let nights = 0;
  while (currentBoundary < checkOut) {
    nights++;
    currentBoundary.setDate(currentBoundary.getDate() + 1);
  }

  return Math.max(nights, 1); // Minimum 1 night
}

/**
 * Formats a date for display
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

/**
 * Legacy function for backward compatibility (uses midnight as boundary)
 */
export function calculateNights(checkInDate: string, checkOutDate: string, dayCalculationTime: string = "00:00"): number {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  // Parse the day calculation time (e.g., "14:00" for 2:00 PM)
  const [hours, minutes] = dayCalculationTime.split(':').map(Number);

  // Create boundary dates using the day calculation time
  const checkInBoundary = new Date(checkIn);
  checkInBoundary.setHours(hours, minutes, 0, 0);

  const checkOutBoundary = new Date(checkOut);
  checkOutBoundary.setHours(hours, minutes, 0, 0);

  // Count the number of day calculation boundaries crossed
  let nights = 0;
  const currentBoundary = new Date(checkInBoundary);

  while (currentBoundary < checkOutBoundary) {
    nights++;
    currentBoundary.setDate(currentBoundary.getDate() + 1);
  }

  return Math.max(1, nights); // Ensure at least 1 night
}