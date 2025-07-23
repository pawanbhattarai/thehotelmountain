export interface BillingCalculation {
  subtotal: number;
  taxes: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

export function calculateBillingAmounts(
  reservation: any,
  payments: any[] = [],
  taxesAndCharges: any[] = [],
  roomOrders: any[] = [],
): BillingCalculation {
  // Calculate subtotal from room amounts
  const roomSubtotal =
    reservation.reservationRooms?.reduce((sum: number, roomRes: any) => {
      return sum + parseFloat(roomRes.totalAmount || 0);
    }, 0) || parseFloat(reservation.totalAmount || 0);

  // Calculate room service total
  const roomServiceTotal = roomOrders?.reduce((sum: number, order: any) => {
    return sum + parseFloat(order.totalAmount || 0);
  }, 0) || 0;

  const subtotal = roomSubtotal + roomServiceTotal;

  // Calculate dynamic taxes and charges
  let taxes = 0;
  if (taxesAndCharges && Array.isArray(taxesAndCharges)) {
    taxes = taxesAndCharges.reduce((sum: number, item: any) => {
      if ((item.isActive || item.status === 'active') && item.applyToReservations) {
        const rate = parseFloat(item.rate || item.percentage) || 0;
        return sum + (subtotal * rate) / 100;
      }
      return sum;
    }, 0);
  }

  // Calculate discount
  let discount = 0;
  if (reservation.discountType && reservation.discountValue) {
    const discountValue = parseFloat(reservation.discountValue) || 0;
    if (reservation.discountType === "percentage") {
      discount = (subtotal * discountValue) / 100;
    } else if (reservation.discountType === "fixed") {
      discount = discountValue;
    }
  }

  // Ensure discount doesn't exceed subtotal + taxes
  const maxDiscount = subtotal + taxes;
  discount = Math.min(discount, maxDiscount);

  const totalAmount = Math.max(0, subtotal + taxes - discount);

  // Calculate paid amount excluding credit payments
  // If payments array is provided, use it; otherwise fall back to reservation.paidAmount
  const paidAmount =
    payments && payments.length > 0
      ? payments
          .filter(
            (payment) =>
              payment.status === "completed" &&
              payment.paymentType !== "credit",
          )
          .reduce((sum, payment) => sum + parseFloat(payment.amount), 0)
      : parseFloat(reservation.paidAmount || 0);

  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  return {
    subtotal,
    taxes,
    discount,
    totalAmount,
    paidAmount,
    remainingAmount,
  };
}

export function formatCurrency(
  amount: number | string,
  symbol: string = "Rs.",
): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${symbol}${numAmount.toFixed(2)}`;
}
