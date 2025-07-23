import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Printer,
  CreditCard,
  Eye,
  DollarSign,
  Clock,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { PaymentDialog } from "@/components/payments/payment-dialog";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PaymentHistory } from "@/components/payments/payment-history";

import { calculateBillingAmounts } from "@/lib/billing-utils";
import { calculateNightsWithDayCalculation } from "@shared/billing-utils";
import {
  formatDateWithBS,
  formatDateTimeWithBS,
  convertADtoBS,
} from "@/lib/bs-date-converter";

// Utility function to format billing currency
const formatBillingCurrency = (amount: number, currencySymbol: string) => {
  return `${currencySymbol}${amount.toFixed(2)}`;
};

export default function Billing() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [billData, setBillData] = useState({
    additionalCharges: 0,
    discount: 0,
    tax: 0,
    paymentMethod: "cash",
    notes: "",
  });

  const { data: reservations, isLoading: reservationsLoading } = useQuery({
    queryKey: ["/api/reservations"],
    enabled: isAuthenticated,
  });

  const { data: hotelSettings } = useQuery({
    queryKey: ["/api/hotel-settings"],
    enabled: isAuthenticated,
  });

  const { data: taxesAndCharges } = useQuery({
    queryKey: ["/api/taxes-and-charges"],
    enabled: isAuthenticated,
  });

  const { data: selectedReservationPayments } = useQuery({
    queryKey: [`/api/reservations/${selectedReservation?.id}/payments`],
    enabled: !!selectedReservation?.id,
  });

  // Fetch room orders for the selected reservation
  const { data: reservationRoomOrders } = useQuery({
    queryKey: [`/api/reservations/${selectedReservation?.id}/room-orders`],
    enabled: !!selectedReservation?.id,
  });

  const { data: roomOrders } = useQuery({
    queryKey: ["/api/room-orders"],
    enabled: isAuthenticated,
  });

  const filteredReservations = reservations?.filter((reservation: any) => {
    // Filter out confirmed reservations first
    if (reservation.status === "confirmed") {
      return false;
    }

    const searchLower = searchTerm.toLowerCase();
    return (
      reservation.guest.firstName.toLowerCase().includes(searchLower) ||
      reservation.guest.lastName.toLowerCase().includes(searchLower) ||
      reservation.guest.email?.toLowerCase().includes(searchLower) ||
      reservation.confirmationNumber.toLowerCase().includes(searchLower)
    );
  });

  const pagination = usePagination({
    data: filteredReservations || [],
    itemsPerPage: 10,
    searchTerm,
    searchFields: [
      "confirmationNumber",
      "guest.firstName",
      "guest.lastName",
      "guest.email",
    ] as any,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { label: "Confirmed", className: "reservation-confirmed" },
      pending: { label: "Pending", className: "reservation-pending" },
      "checked-in": {
        label: "Checked In",
        className: "reservation-checked-in",
      },
      "checked-out": {
        label: "Checked Out",
        className: "reservation-checked-out",
      },
      cancelled: { label: "Cancelled", className: "reservation-cancelled" },
      "no-show": { label: "No Show", className: "reservation-no-show" },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const calculateNights = (
    checkIn: string,
    checkOut: string,
    dayCalculationTime: string = "00:00",
  ) => {
    const useCustomDayCalculation = hotelSettings?.useCustomDayCalculation || false;
    const timeZone = hotelSettings?.timeZone || "Asia/Kathmandu";

    return calculateNightsWithDayCalculation(
      checkIn,
      checkOut, 
      dayCalculationTime,
      timeZone,
      useCustomDayCalculation
    );
  };

  const handleCreateBill = (reservation: any) => {
    setSelectedReservation(reservation);
    setIsBillModalOpen(true);
    setShowPaymentHistory(false);
  };

  const handlePayment = (reservation: any) => {
    setSelectedReservation(reservation);
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentSuccess = () => {
    // Refetch reservations to get updated data
    queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
  };

  const handleViewPaymentHistory = (reservation: any) => {
    setSelectedReservation(reservation);
    setShowPaymentHistory(true);
    setIsBillModalOpen(true);
  };

  const handlePrintBill = async () => {
    if (!selectedReservation) return;

    const billWindow = window.open("", "_blank");
    if (!billWindow) return;

    // Get printer settings from hotel settings
    const printerSettings = hotelSettings || {};
    const paperWidth = printerSettings.printerPaperWidth || "80mm";
    const paperHeight = printerSettings.printerPaperHeight || "auto";
    const margins = printerSettings.printerMargins || "2mm";
    const fontSize = printerSettings.printerFontSize || "12px";
    const lineHeight = printerSettings.printerLineHeight || "1.2";
    const paperSize = printerSettings.printerPaperSize || "80mm";

    // Determine if this is a thermal receipt printer
    const isThermal = paperSize === "80mm" || paperSize === "58mm";

    // Get font family from settings or use default based on printer type
const fontFamily = printerSettings.printerFontFamily || '"Helvetica", "Arial", "Liberation Sans", sans-serif';

    // Calculate subtotal from room amounts
    const roomSubtotal = selectedReservation.reservationRooms.reduce(
      (sum: number, roomRes: any) => {
        return sum + parseFloat(roomRes.totalAmount);
      },
      0,
    );

    // Calculate room service totals
    let roomServiceTotal = 0;
    let roomServiceByDate: { [key: string]: any[] } = {};

    if (reservationRoomOrders && reservationRoomOrders.length > 0) {
      reservationRoomOrders.forEach((order: any) => {
        // Group orders by date
        const orderDate = new Date(order.createdAt).toDateString();
        if (!roomServiceByDate[orderDate]) {
          roomServiceByDate[orderDate] = [];
        }
        roomServiceByDate[orderDate].push(order);

        // Add to total
        roomServiceTotal += parseFloat(order.totalAmount || 0);
      });
    }

    const subtotal = roomSubtotal + roomServiceTotal;

    // Calculate dynamic taxes and charges
    let taxes = 0;
    let taxBreakdown = "";
    if (taxesAndCharges && Array.isArray(taxesAndCharges)) {
      const activeTaxes = taxesAndCharges.filter((item) => item.isActive);
      activeTaxes.forEach((item) => {
        const rate = parseFloat(item.rate || item.percentage) || 0;
        const amount = (subtotal * rate) / 100;
        taxes += amount;
        taxBreakdown += `
                          <div class="tax-line">
                            <span>${item.taxName || item.name} (${rate.toFixed(1)}%):</span>
                            <span>Rs.${amount.toFixed(2)}</span>
                          </div>
                        `;
      });
    }

    // Calculate discount
    let discount = 0;
    let discountBreakdown = "";
    if (selectedReservation.discountType && selectedReservation.discountValue) {
      const discountValue = parseFloat(selectedReservation.discountValue) || 0;
      if (selectedReservation.discountType === "percentage") {
        discount = (subtotal * discountValue) / 100;
      } else if (selectedReservation.discountType === "fixed") {
        discount = discountValue;
      }

      // Ensure discount doesn't exceed subtotal + taxes
      const maxDiscount = subtotal + taxes;
      discount = Math.min(discount, maxDiscount);

      if (discount > 0) {
        discountBreakdown = `
          <div class="tax-line" style="color: #16a34a;">
            <span>Discount (${
              selectedReservation.discountType === "percentage"
                ? `${discountValue.toFixed(1)}%`
                : "Fixed"
            }${selectedReservation.discountReason ? ` - ${selectedReservation.discountReason}` : ""}):</span>
            <span>-Rs.${discount.toFixed(2)}</span>
          </div>
        `;
      }
    }

    const totalAmount = Math.max(0, subtotal + taxes - discount);
    const paidAmount =
      selectedReservationPayments && selectedReservationPayments.length > 0
        ? selectedReservationPayments
            .filter(
              (payment) =>
                payment.status === "completed" &&
                payment.paymentType !== "credit",
            )
            .reduce((sum, payment) => sum + parseFloat(payment.amount), 0)
        : parseFloat(selectedReservation.paidAmount || 0);
    const remainingAmount = totalAmount - paidAmount;
    const isPaid = remainingAmount <= 0;
    const showBSDate = hotelSettings?.showBSDate || false;

    // Format current date time
    const currentDateTime = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // BS Date conversion for current date
    let currentDateTimeBS = "";
    if (showBSDate) {
      try {
        currentDateTimeBS = await convertADtoBS(new Date().toISOString());
      } catch (error) {
        console.error("Error converting AD to BS:", error);
        currentDateTimeBS = "N/A";
      }
    }

    // Format check-in and check-out dates
    let checkInFormatted = "";
    let checkOutFormatted = "";
    let checkInBS = "";
    let checkOutBS = "";

    if (
      selectedReservation.reservationRooms &&
      selectedReservation.reservationRooms.length > 0
    ) {
      checkInFormatted = formatDate(
        selectedReservation.reservationRooms[0].checkInDate,
      );
      checkOutFormatted = formatDate(
        selectedReservation.reservationRooms[0].checkOutDate,
      );

      if (showBSDate) {
        try {
          checkInBS = await convertADtoBS(
            selectedReservation.reservationRooms[0].checkInDate,
          );
          checkOutBS = await convertADtoBS(
            selectedReservation.reservationRooms[0].checkOutDate,
          );
        } catch (error) {
          console.error("Error converting AD to BS:", error);
          checkInBS = "N/A";
          checkOutBS = "N/A";
        }
      }
    }

    const billContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hotel Bill - ${selectedReservation.confirmationNumber}</title>
        <style>
          @page {
            size: ${paperWidth} ${paperHeight === "auto" ? "auto" : paperHeight};
            margin: ${margins};
          }
          body { 
            font-family: ${fontFamily}; 
            padding: ${isThermal ? "5px" : "20px"}; 
            margin: 0;
            line-height: ${lineHeight};
            color: #333;
            font-size: ${fontSize};
            width: 100%;
            max-width: ${paperWidth === "80mm" ? "72mm" : paperWidth === "58mm" ? "50mm" : "100%"};
          }
          .header { 
            text-align: center; 
            margin-bottom: ${isThermal ? "5px" : "15px"}; 
            border-bottom: ${isThermal ? "1px dashed #333" : "2px solid #333"};
            padding-bottom: ${isThermal ? "4px" : "10px"};
          }
          .hotel-name {
            font-size: ${isThermal ? "14px" : "18px"};
            font-weight: bold;
            color: #333;
            margin: ${isThermal ? "2px 0" : "5px 0"};
            word-wrap: break-word;
          }
          .bill-title {
            font-size: ${isThermal ? "12px" : "16px"};
            font-weight: bold;
            margin: ${isThermal ? "4px 0 2px 0" : "10px 0 5px 0"};
            color: #333;
          }
          .bill-info {
            display: ${isThermal ? "block" : "flex"};
            justify-content: space-between;
            margin-bottom: ${isThermal ? "5px" : "10px"};
            padding: ${isThermal ? "2px 0" : "8px"};
            background-color: ${isThermal ? "transparent" : "#f8f9fa"};
            border-radius: ${isThermal ? "0" : "5px"};
            ${isThermal ? "border-bottom: 1px dashed #333;" : ""}
          }
          .guest-details, .bill-details {
            flex: ${isThermal ? "none" : "1"};
            margin-bottom: ${isThermal ? "8px" : "0"};
          }
          .guest-details {
            margin-right: ${isThermal ? "0" : "20px"};
          }
          .detail-label {
            font-weight: bold;
            color: #333;
          }
          .room-details {
            margin-bottom: 20px;
          }
          .room-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: ${isThermal ? "3px" : "8px"};
            font-size: ${isThermal ? "12px" : "14px"};
          }
          .room-table th, .room-table td {
            border: ${isThermal ? "none" : "1px solid #ddd"};
            padding: ${isThermal ? "1px 2px" : "3px"};
            text-align: left;
            ${isThermal ? "border-bottom: 1px dashed #ccc;" : ""}
          }
          .room-table th {
            background-color: ${isThermal ? "transparent" : "#f2f2f2"};
            font-weight: bold;
            ${isThermal ? "border-bottom: 1px solid #333;" : ""}
          }
          .room-table td:last-child {
            text-align: right;
          }
          .total-section {
            margin-top: ${isThermal ? "8px" : "20px"};
            text-align: ${isThermal ? "left" : "right"};
            padding: ${isThermal ? "4px 0" : "15px"};
            background-color: ${isThermal ? "transparent" : "#f8f9fa"};
            border-radius: ${isThermal ? "0" : "5px"};
            ${isThermal ? "border-top: 1px dashed #333;" : ""}
          }
          .subtotal-row {
            margin-bottom: ${isThermal ? "2px" : "5px"};
            ${isThermal ? "display: flex; justify-content: space-between;" : ""}
          }
          .total-row {
            margin-top: ${isThermal ? "4px" : "10px"};
            padding-top: ${isThermal ? "4px" : "10px"};
            border-top: ${isThermal ? "1px solid #333" : "2px solid #333"};
            font-size: ${isThermal ? "inherit" : "18px"};
            font-weight: bold;
            ${isThermal ? "display: flex; justify-content: space-between;" : ""}
          }
          .payment-status {
            margin: ${isThermal ? "8px 0" : "20px 0"};
            padding: ${isThermal ? "4px" : "15px"};
            text-align: center;
            font-weight: bold;
            font-size: ${isThermal ? "inherit" : "16px"};
            border-radius: ${isThermal ? "0" : "5px"};
            ${isThermal ? "border-top: 1px dashed #333; border-bottom: 1px dashed #333;" : ""}
          }
          .payment-status.paid {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
          }
          .payment-status.unpaid {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
          }
          .footer {
            margin-top: ${isThermal ? "10px" : "30px"};
            text-align: center;
            font-size: ${isThermal ? "8px" : "12px"};
            color: #666;
            border-top: ${isThermal ? "1px dashed #ccc" : "1px solid #ddd"};
            padding-top: ${isThermal ? "4px" : "15px"};
          }
          .payment-history {
            margin-top: 20px;
          }
          .payment-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          .payment-table th, .payment-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          .payment-table th {
            background-color: #f2f2f2;
          }
          .tax-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: ${isThermal ? "2px" : "5px"};
            font-size: ${isThermal ? "inherit" : "14px"};
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="hotel-name">HOTEL MANAGEMENT SYSTEM</div>
          <div class="bill-title">HOTEL BILL / INVOICE</div>
        </div>

        <div class="bill-info">
          <div class="guest-details">
            <div><span class="detail-label">Guest Name:</span> ${selectedReservation.guest.firstName} ${selectedReservation.guest.lastName}</div>
            <div><span class="detail-label">Email:</span> ${selectedReservation.guest.email || "N/A"}</div>
            <div><span class="detail-label">Phone:</span> ${selectedReservation.guest.phone || "N/A"}</div>
          </div>
          <div class="bill-details">
            <div><span class="detail-label">Confirmation Number:</span> ${selectedReservation.confirmationNumber}</div>
            <div><span class="detail-label">Bill Date:</span> ${currentDateTime}${showBSDate && currentDateTimeBS ? ` (${currentDateTimeBS} BS)` : ""}</div>
            <div><span class="detail-label">Check-in:</span> ${checkInFormatted}${showBSDate && checkInBS ? ` (${checkInBS} BS)` : ""}</div>
            <div><span class="detail-label">Check-out:</span> ${checkOutFormatted}${showBSDate && checkOutBS ? ` (${checkOutBS} BS)` : ""}</div>
          </div>
        </div>

        <div class="room-details">
          <h3 style="border-bottom: 1px solid #333; padding-bottom: 5px;">ROOM CHARGES</h3>
          <table class="room-table">
            <thead>
              <tr>
                <th>ROOM</th>
                <th>RATE</th>
                <th>DAYS</th>
                <th>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${selectedReservation.reservationRooms
                .map(
                  (roomRes: any) => `
                <tr>
                  <td>${roomRes.room.number}<br><small>${roomRes.room.roomType.name}</small></td>
                  <td>Rs.${parseFloat(roomRes.ratePerNight).toFixed(2)}</td>
                  <td>${calculateNights(roomRes.checkInDate, roomRes.checkOutDate, hotelSettings?.dayCalculationTime)}</td>
                  <td>Rs.${parseFloat(roomRes.totalAmount).toFixed(2)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>

        ${
          roomServiceTotal > 0
            ? `
        <div class="room-details">
          <h3 style="border-bottom: 1px solid #333; padding-bottom: 5px;">ROOM SERVICE</h3>
          ${Object.keys(roomServiceByDate)
              .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
              .map((dateKey) => {
                const ordersOnDate = roomServiceByDate[dateKey];
                const dateFormatted = new Date(dateKey).toLocaleDateString(
                  "en-GB",
                  {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  },
                );

                return ordersOnDate.map((order: any) => `
                <div style="border: 1px solid #333; margin-bottom: 5px; padding: 3px;">
                  <div style="background: #f0f0f0; padding: 2px 3px; font-weight: bold; border-bottom: 1px solid #333; font-size: 10px;">
                    Order #${order.orderNumber} - ${dateFormatted} - ${order.createdAt ? new Date(order.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </div>
                  <table class="room-table" style="margin: 2px 0;">
                    <thead>
                      <tr style="border-bottom: 1px solid #333; font-weight: bold;">
                        <th style="width: 50%; text-align: left; padding: 1px 2px;">ITEM NAME</th>
                        <th style="width: 15%; text-align: center; padding: 1px 2px;">QTY</th>
                        <th style="width: 15%; text-align: right; padding: 1px 2px;">RATE</th>
                        <th style="width: 20%; text-align: right; padding: 1px 2px;">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${order.items?.map((item: any) => `
                        <tr>
                          <td style="width: 50%; padding: 1px 2px;">${item.dishName || item.dish?.name || item.name || "Unknown Item"}</td>
                          <td style="width: 15%; text-align: center; padding: 1px 2px;">${item.quantity}</td>
                          <td style="width: 15%; text-align: right; padding: 1px 2px;">Rs.${parseFloat(item.unitPrice).toFixed(2)}</td>
                          <td style="width: 20%; text-align: right; padding: 1px 2px;">Rs.${parseFloat(item.totalPrice).toFixed(2)}</td>
                        </tr>
                      `).join("") || ""}
                      <tr style="border-top: 1px solid #333; font-weight: bold;">
                        <td colspan="3" style="text-align: right; padding: 1px 2px;">Order Total:</td>
                        <td style="text-align: right; padding: 1px 2px;">Rs.${parseFloat(order.totalAmount || 0).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                `).join("");
              })
              .join("")}
        </div>
        `
            : ""
        }

        <div class="total-section">
          <h3 style="border-bottom: 1px solid #333; padding-bottom: 5px;">PAYMENT SUMMARY</h3>
          <div class="subtotal-row">Room Charges: Rs.${roomSubtotal.toFixed(2)}</div>
          ${roomServiceTotal > 0 ? `<div class="subtotal-row">Room Service: Rs.${roomServiceTotal.toFixed(2)}</div>` : ""}
          <div class="subtotal-row">Subtotal: Rs.${subtotal.toFixed(2)}</div>
          ${discountBreakdown}
          ${taxBreakdown}
          ${taxes > 0 ? `<div class="subtotal-row">Total Taxes & Charges: Rs.${taxes.toFixed(2)}</div>` : ""}
          <div class="total-row">
            <strong>TOTAL: Rs.${totalAmount.toFixed(2)}</strong>
          </div>
          <div class="subtotal-row">Payment Method: Cash</div>
        </div>

        <div class="payment-status ${isPaid ? "paid" : "unpaid"}">
          PAYMENT STATUS: ${isPaid ? "PAID IN FULL" : "PAYMENT PENDING"}
        </div>

        ${
          selectedReservationPayments && selectedReservationPayments.length > 0
            ? `
          <div class="payment-history" style="margin-top: 8px;">
            <h3 style="margin-bottom: 3px; font-size: 12px;">Payment History</h3>
            <table class="payment-table" style="font-size: 9px;">
              <thead>
                <tr>
                  <th style="padding: 2px;">Date</th>
                  <th style="padding: 2px;">Method</th>
                  <th style="padding: 2px;">Amount</th>
                  <th style="padding: 2px;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${selectedReservationPayments
                  .map((payment: any) => {
                    // Determine payment status based on payment type and overall payment status
                    let paymentStatus = "COMPLETED";
                    if (payment.paymentType === "credit") {
                      paymentStatus = "NOT PAID";
                    } else if (payment.paymentType === "partial") {
                      paymentStatus = "PARTIAL";
                    } else if (payment.paymentType === "full") {
                      paymentStatus = "FULL";
                    }

                    // Fix date formatting
                    const paymentDate =
                      payment.paymentDate || payment.createdAt;
                    const formattedDate = paymentDate
                      ? new Date(paymentDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })
                      : "N/A";

                    return `
                  <tr>
                    <td style="padding: 1px 2px;">${formattedDate}</td>
                    <td style="padding: 1px 2px;">${payment.paymentMethod.toUpperCase()}</td>
                    <td style="padding: 1px 2px;">Rs.${parseFloat(payment.amount).toFixed(2)}</td>
                    <td style="padding: 1px 2px;">${paymentStatus}</td>
                  </tr>
                `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        `
            : ""
        }

        <div class="footer">
          <p>Thank you for choosing our hotel!</p>
          <p>For any queries regarding this bill, please contact the front desk.</p>
        </div>
      </body>
      </html>
    `;

    billWindow?.document.write(billContent);
    billWindow?.document.close();
    billWindow?.print();
  };

  const currencySymbol = "Rs.";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Function to preload NepaliFunctions library
  const preloadNepaliFunctions = async () => {
    try {
      // Dynamically import the library
      await import("nepali-date-converter");
      console.log("NepaliFunctions library preloaded successfully.");
    } catch (error) {
      console.error("Error preloading NepaliFunctions library:", error);
    }
  };

  useEffect(() => {
    // Preload the NepaliFunctions library
    preloadNepaliFunctions();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isMobileMenuOpen={isMobileSidebarOpen}
        setIsMobileMenuOpen={setIsMobileSidebarOpen}
      />
      <div className="main-content">
        <Header
          title="Billing & Payments"
          subtitle="Manage guest checkout, billing and payment processing"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
        />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Search Section */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search reservations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Bills</CardTitle>
            </CardHeader>
            <CardContent>
              {reservationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Rooms</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.paginatedData?.length ? (
                      pagination.paginatedData.map((reservation: any) => (
                        <TableRow key={reservation.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {reservation.guest.firstName}{" "}
                                {reservation.guest.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {reservation.guest.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {reservation.reservationRooms.length} Room
                                {reservation.reservationRooms.length > 1
                                  ? "s"
                                  : ""}
                              </div><div className="text-sm text-gray-500">
                                {reservation.reservationRooms
                                  .map((rr: any) => rr.room.roomType.name)
                                  .join(", ")}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {reservation.reservationRooms.length > 0 && (
                              <div>
                                <div>
                                  {formatDate(
                                    reservation.reservationRooms[0]
                                      .checkOutDate,
                                  )}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {calculateNights(
                                    reservation.reservationRooms[0].checkInDate,
                                    reservation.reservationRooms[0]
                                      .checkOutDate,
                                    hotelSettings?.dayCalculationTime,
                                  )}{" "}
                                  nights
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(reservation.status)}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              // Use the consistent billing calculation including room service
                              const reservationRoomOrders =
                                roomOrders?.filter(
                                  (order) =>
                                    order.reservationId === reservation.id,
                                ) || [];
                              const billingCalc = calculateBillingAmounts(
                                reservation,
                                [],
                                taxesAndCharges || [],
                                reservationRoomOrders,
                              );

                              const paidAmount = parseFloat(
                                reservation.paidAmount || 0,
                              );
                              const balance = Math.max(
                                0,
                                billingCalc.totalAmount - paidAmount,
                              );

                              if (paidAmount === 0) {
                                return (
                                  <Badge
                                    variant="destructive"
                                    className="flex items-center gap-1"
                                  >
                                    <AlertCircle className="h-3 w-3" />
                                    Unpaid
                                  </Badge>
                                );
                              } else if (balance > 0.01) {
                                // Allow for small rounding differences
                                return (
                                  <Badge
                                    variant="secondary"
                                    className="flex items-center gap-1"
                                  >
                                    <Clock className="h-3 w-3" />
                                    Partial
                                  </Badge>
                                );
                              } else {
                                return (
                                  <Badge
                                    variant="default"
                                    className="flex items-center gap-1 bg-green-600"
                                  >
                                    Paid
                                  </Badge>
                                );
                              }
                            })()}
                          </TableCell>
                          <TableCell className="font-medium">
                            {(() => {
                              const reservationRoomOrders =
                                roomOrders?.filter(
                                  (order) =>
                                    order.reservationId === reservation.id,
                                ) || [];
                              const billingCalc = calculateBillingAmounts(
                                reservation,
                                [],
                                taxesAndCharges || [],
                                reservationRoomOrders,
                              );
                              return formatBillingCurrency(
                                billingCalc.totalAmount,
                                currencySymbol,
                              );
                            })()}
                          </TableCell>
                          <TableCell className="font-medium text-green-600">
                            {formatBillingCurrency(
                              parseFloat(reservation.paidAmount || 0),
                              currencySymbol,
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-orange-600">
                            {(() => {
                              const reservationRoomOrders =
                                roomOrders?.filter(
                                  (order) =>
                                    order.reservationId === reservation.id,
                                ) || [];
                              const billingCalc = calculateBillingAmounts(
                                reservation,
                                [],
                                taxesAndCharges || [],
                                reservationRoomOrders,
                              );
                              const paidAmount = parseFloat(
                                reservation.paidAmount || 0,
                              );
                              const balance = Math.max(
                                0,
                                billingCalc.totalAmount - paidAmount,
                              );
                              return formatBillingCurrency(
                                balance,
                                currencySymbol,
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCreateBill(reservation)}
                                title={
                                  reservation.status === "checked-out"
                                    ? "View bill"
                                    : "Create bill"
                                }
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {(() => {
                                // Use the consistent billing calculation including room service
                                const reservationRoomOrders =
                                  roomOrders?.filter(
                                    (order) =>
                                      order.reservationId === reservation.id,
                                  ) || [];
                                const billingCalc = calculateBillingAmounts(
                                  reservation,
                                  [],
                                  taxesAndCharges || [],
                                  reservationRoomOrders,
                                );

                                const paidAmount = parseFloat(
                                  reservation.paidAmount || 0,
                                );
                                const balance = Math.max(
                                  0,
                                  billingCalc.totalAmount - paidAmount,
                                );
                                const isFullyPaid = balance <= 0;

                                return isFullyPaid ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedReservation(reservation);
                                      handlePrintBill();
                                    }}
                                    title="Print bill"
                                  >
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handlePayment(reservation)}
                                    title="Process payment"
                                  >
                                    <CreditCard className="h-4 w-4" />
                                  </Button>
                                );
                              })()}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleViewPaymentHistory(reservation)
                                }
                                title="Payment history"
                              >
                                <Calendar className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          className="text-center py-8 text-gray-500"
                        >
                          No reservations found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              <PaginationControls
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={pagination.setCurrentPage}
                startIndex={pagination.startIndex}
                endIndex={pagination.endIndex}
                totalItems={pagination.totalItems}
              />
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Billing Modal */}
      <Dialog open={isBillModalOpen} onOpenChange={setIsBillModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                {showPaymentHistory
                  ? "Payment History"
                  : selectedReservation?.status === "checked-out"
                    ? "View Bill"
                    : "Create Bill"}{" "}
                - {selectedReservation?.confirmationNumber}
              </span>
              {!showPaymentHistory && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPaymentHistory(true)}
                  className="ml-2"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Payment History
                </Button>
              )}
              {showPaymentHistory && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPaymentHistory(false)}
                  className="ml-2"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Bill
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-6">
              {showPaymentHistory ? (
                <div className="space-y-4">
                  {/* Payment Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-600" />
                          <p className="text-sm text-muted-foreground">
                            Total Amount
                          </p>
                          <p className="text-2xl font-bold">
                            {currencySymbol}
                            {(() => {
                              // Use the consistent billing calculation including room service
                              const reservationRoomOrders =
                                roomOrders?.filter(
                                  (order) =>
                                    order.reservationId ===
                                    selectedReservation.id,
                                ) || [];
                              const billingCalc = calculateBillingAmounts(
                                selectedReservation,
                                [],
                                taxesAndCharges || [],
                                reservationRoomOrders,
                              );
                              return billingCalc.totalAmount.toFixed(2);
                            })()}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <CreditCard className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                          <p className="text-sm text-muted-foreground">
                            Paid Amount
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            {currencySymbol}
                            {(() => {
                              // Only count completed payments (excluding credit payments)
                              const paidAmount =
                                selectedReservationPayments &&
                                selectedReservationPayments.length > 0
                                  ? selectedReservationPayments
                                      .filter(
                                        (payment) =>
                                          payment.status === "completed" &&
                                          payment.paymentType !== "credit",
                                      )
                                      .reduce(
                                        (sum, payment) =>
                                          sum + parseFloat(payment.amount),
                                        0,
                                      )
                                  : parseFloat(
                                      selectedReservation.paidAmount || 0,
                                    );
                              return paidAmount.toFixed(2);
                            })()}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                          <p className="text-sm text-muted-foreground">
                            Remaining
                          </p>
                          <p className="text-2xl font-bold text-orange-600">
                            {currencySymbol}
                            {(() => {
                              // Use the consistent billing calculation including room service
                              const reservationRoomOrders =
                                roomOrders?.filter(
                                  (order) =>
                                    order.reservationId ===
                                    selectedReservation.id,
                                ) || [];
                              const billingCalc = calculateBillingAmounts(
                                selectedReservation,
                                selectedReservationPayments || [],
                                taxesAndCharges || [],
                                reservationRoomOrders,
                              );
                              return billingCalc.remainingAmount.toFixed(2);
                            })()}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Payment History */}
                  <PaymentHistory reservationId={selectedReservation.id} />

                  {/* Process Payment Button */}
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={() => {
                        setIsBillModalOpen(false);
                        handlePayment(selectedReservation);
                      }}
                      disabled={(() => {
                        // Use consistent billing calculation including room service
                        const reservationRoomOrders =
                          roomOrders?.filter(
                            (order) =>
                              order.reservationId === selectedReservation.id,
                          ) || [];
                        const billingCalc = calculateBillingAmounts(
                          selectedReservation,
                          selectedReservationPayments || [],
                          taxesAndCharges || [],
                          reservationRoomOrders,
                        );
                        return billingCalc.remainingAmount <= 0;
                      })()}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Process New Payment
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Bill Header */}
                  <div className="text-center border-b pb-4">
                    <h2 className="text-2xl font-bold">HOTEL BILL</h2>
                    <p className="text-sm text-gray-600">
                      Confirmation: {selectedReservation.confirmationNumber}
                    </p>
                    <p className="text-sm text-gray-600">
                      Date: {new Date().toLocaleDateString()}
                    </p>
                  </div>

                  {/* Guest Information */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-2">Guest Information</h3>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-medium">Name:</span>{" "}
                          {selectedReservation.guest.firstName}{" "}
                          {selectedReservation.guest.lastName}
                        </p>
                        <p>
                          <span className="font-medium">Email:</span>{" "}
                          {selectedReservation.guest.email || "N/A"}
                        </p>
                        <p>
                          <span className="font-medium">Phone:</span>{" "}
                          {selectedReservation.guest.phone || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Stay Information</h3>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-medium">Check-in:</span>{" "}
                          {selectedReservation.reservationRooms[0]
                            ? formatDate(
                                selectedReservation.reservationRooms[0]
                                  .checkInDate,
                              )
                            : "N/A"}
                        </p>
                        <p>
                          <span className="font-medium">Check-out:</span>{" "}
                          {selectedReservation.reservationRooms[0]
                            ? formatDate(
                                selectedReservation.reservationRooms[0]
                                  .checkOutDate,
                              )
                            : "N/A"}
                        </p>
                        <p>
                          <span className="font-medium">Nights:</span>{" "}
                          {selectedReservation.reservationRooms[0]
                            ? calculateNights(
                                selectedReservation.reservationRooms[0]
                                  .checkInDate,
                                selectedReservation.reservationRooms[0]
                                  .checkOutDate,
                                hotelSettings?.dayCalculationTime,
                              )
                            : 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Room Details */}
                  <div>
                    <h3 className="font-semibold mb-3">Room Details</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-3 font-medium">Room</th>
                            <th className="text-left p-3 font-medium">Type</th>
                            <th className="text-left p-3 font-medium">
                              Rate/Night
                            </th>
                            <th className="text-left p-3 font-medium">
                              Nights
                            </th>
                            <th className="text-right p-3 font-medium">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReservation.reservationRooms.map(
                            (roomRes: any, index: number) => (
                              <tr key={index} className="border-t">
                                <td className="p-3">{roomRes.room.number}</td>
                                <td className="p-3">
                                  {roomRes.room.roomType.name}
                                </td>
                                <td className="p-3">
                                  {currencySymbol}
                                  {parseFloat(roomRes.ratePerNight).toFixed(2)}
                                </td>
                                <td className="p-3">
                                  {calculateNights(
                                    roomRes.checkInDate,
                                    roomRes.checkOutDate,
                                    hotelSettings?.dayCalculationTime,
                                  )}
                                </td>
                                <td className="p-3 text-right font-medium">
                                  {currencySymbol}
                                  {parseFloat(roomRes.totalAmount).toFixed(2)}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Room Service Details */}
                  {(() => {
                    // Use the fetched reservation room orders instead of filtering all room orders
                    const roomServiceOrders = reservationRoomOrders || [];

                    if (roomServiceOrders.length === 0) return null;

                    const roomServiceTotal = roomServiceOrders.reduce(
                      (sum: number, order: any) => {
                        return sum + parseFloat(order.totalAmount || 0);
                      },
                      0,
                    );

                    // Group orders by date
                    const roomServiceByDate = roomServiceOrders.reduce(
                      (acc: any, order: any) => {
                        const orderDate = new Date(
                          order.createdAt,
                        ).toDateString();
                        if (!acc[orderDate]) acc[orderDate] = [];
                        acc[orderDate].push(order);
                        return acc;
                      },
                      {},
                    );

                    return (
                      <div>
                        <h3 className="font-semibold mb-3">Room Service</h3>
                        <div className="space-y-4">
                          {Object.keys(roomServiceByDate)
                            .sort(
                              (a, b) =>
                                new Date(a).getTime() - new Date(b).getTime(),
                            )
                            .map((dateKey) => {
                              const ordersOnDate = roomServiceByDate[dateKey];
                              const dateFormatted = new Date(
                                dateKey,
                              ).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              });

                              return ordersOnDate.map((order: any) => (
                                <div
                                  key={order.id}
                                  className="border rounded-lg overflow-hidden"
                                >
                                  <div className="bg-gray-50 p-3 border-b">
                                    <div className="flex justify-between items-center">
                                      <span className="font-medium">
                                        Order #{order.orderNumber} -{" "}
                                        {dateFormatted}
                                      </span>
                                      <span className="text-sm text-gray-600">
                                        {new Date(
                                          order.createdAt,
                                        ).toLocaleTimeString("en-GB", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                  <table className="w-full">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="text-left p-3 font-medium">
                                          ITEM NAME
                                        </th>
                                        <th className="text-center p-3 font-medium">
                                          QTY
                                        </th>
                                        <th className="text-right p-3 font-medium">
                                          RATE
                                        </th>
                                        <th className="text-right p-3 font-medium">
                                          AMOUNT
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {order.items?.map(
                                        (item: any, itemIndex: number) => {
                                          // Try multiple ways to get dish name
                                          const dishName =
                                            item.dishName ||
                                            item.dish?.name ||
                                            item.name ||
                                            "Unknown Item";

                                          return (
                                            <tr
                                              key={itemIndex}
                                              className="border-t"
                                            >
                                              <td className="p-3 font-medium">
                                                {dishName}
                                              </td>
                                              <td className="p-3 text-center">
                                                {item.quantity}
                                              </td>
                                              <td className="p-3 text-right">
                                                {currencySymbol}
                                                {parseFloat(
                                                  item.unitPrice,
                                                ).toFixed(2)}
                                              </td>
                                              <td className="p-3 text-right font-medium">
                                                {currencySymbol}
                                                {parseFloat(
                                                  item.totalPrice,
                                                ).toFixed(2)}
                                              </td>
                                            </tr>
                                          );
                                        },
                                      )}
                                      <tr className="border-t bg-gray-50">
                                        <td
                                          colSpan={3}
                                          className="p-3 text-right font-medium"
                                        >
                                          Order Total:
                                        </td>
                                        <td className="p-3 text-right font-bold">
                                          {currencySymbol}
                                          {parseFloat(
                                            order.totalAmount || 0,
                                          ).toFixed(2)}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              ));
                            })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Bill Summary */}
                  <div className="border-t pt-4">
                    <div className="flex justify-end">
                      <div className="w-64 space-y-2">
                        {(() => {
                          // Calculate subtotal from room amounts
                          const roomChargesTotal =
                            selectedReservation.reservationRooms.reduce(
                              (sum: number, roomRes: any) => {
                                return sum + parseFloat(roomRes.totalAmount);
                              },
                              0,
                            );

                          // Calculate room service total
                          const reservationRoomOrders =
                            roomOrders?.filter(
                              (order) =>
                                order.reservationId === selectedReservation.id,
                            ) || [];
                          const roomServiceTotal = reservationRoomOrders.reduce(
                            (sum: number, order: any) =>
                              sum + parseFloat(order.totalAmount || 0),
                            0,
                          );

                          const subtotal = roomChargesTotal + roomServiceTotal;

                          // Calculate dynamic taxes and charges
                          let taxes = 0;
                          if (
                            taxesAndCharges &&
                            Array.isArray(taxesAndCharges)
                          ) {
                            const activeTaxes = taxesAndCharges.filter(
                              (item) =>
                                item.isActive && item.applyToReservations,
                            );
                            activeTaxes.forEach((item) => {
                              const rate =
                                parseFloat(item.rate || item.percentage) || 0;
                              const amount = (subtotal * rate) / 100;
                              taxes += amount;
                            });
                          }

                          // Calculate discount
                          let discount = 0;
                          if (
                            selectedReservation.discountType &&
                            selectedReservation.discountValue
                          ) {
                            const discountValue =
                              parseFloat(selectedReservation.discountValue) ||
                              0;
                            if (
                              selectedReservation.discountType === "percentage"
                            ) {
                              discount = (subtotal * discountValue) / 100;
                            } else if (
                              selectedReservation.discountType === "fixed"
                            ) {
                              discount = discountValue;
                            }
                          }

                          // Ensure discount doesn't exceed subtotal + taxes
                          const maxDiscount = subtotal + taxes;
                          discount = Math.min(discount, maxDiscount);

                          const totalAmount = Math.max(
                            0,
                            subtotal + taxes - discount,
                          );

                          return (
                            <>
                              <div className="flex justify-between">
                                <span>Room Charges:</span>
                                <span className="font-medium">
                                  {currencySymbol}
                                  {roomChargesTotal.toFixed(2)}
                                </span>
                              </div>
                              {roomServiceTotal > 0 && (
                                <div className="flex justify-between">
                                  <span>Room Service:</span>
                                  <span className="font-medium">
                                    {currencySymbol}
                                    {roomServiceTotal.toFixed(2)}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span>Subtotal:</span>
                                <span className="font-medium">
                                  {currencySymbol}
                                  {subtotal.toFixed(2)}
                                </span>
                              </div>

                              {/* Dynamic Taxes and Charges */}
                              {taxesAndCharges &&
                                taxesAndCharges.length > 0 && (
                                  <>
                                    {taxesAndCharges
                                      .filter(
                                        (item) =>
                                          item.isActive &&
                                          item.applyToReservations,
                                      )
                                      .map((item, index) => {
                                        const amount =
                                          (subtotal *
                                            parseFloat(
                                              item.rate || item.percentage,
                                            )) /
                                          100;
                                        return (
                                          <div
                                            key={index}
                                            className="flex justify-between text-sm"
                                          >
                                            <span className="text-gray-600">
                                              {item.taxName || item.name} (
                                              {parseFloat(
                                                item.rate || item.percentage,
                                              ).toFixed(1)}
                                              %):
                                            </span>
                                            <span className="font-medium">
                                              {currencySymbol}
                                              {amount.toFixed(2)}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    {taxes > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">
                                          Total Taxes & Charges:
                                        </span>
                                        <span className="font-medium">
                                          {currencySymbol}
                                          {taxes.toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )}

                              {/* Discount Section */}
                              {discount > 0 && (
                                <div className="flex justify-between text-green-600">
                                  <span>
                                    Discount (
                                    {selectedReservation.discountType ===
                                    "percentage"
                                      ? parseFloat(
                                          selectedReservation.discountValue ||
                                            "0",
                                        ).toFixed(1) + "%"
                                      : "Fixed"}
                                    {selectedReservation.discountReason
                                      ? " - " +
                                        selectedReservation.discountReason
                                      : ""}
                                    ):
                                  </span>
                                  <span className="font-medium">
                                    -{currencySymbol}
                                    {discount.toFixed(2)}
                                  </span>
                                </div>
                              )}

                              <div className="flex justify-between border-t pt-2 font-bold text-lg">
                                <span>Total Amount:</span>
                                <span>
                                  {currencySymbol}
                                  {totalAmount.toFixed(2)}
                                </span>
                              </div>
                            </>
                          );
                        })()}
                        <div className="flex justify-between text-green-600">
                          <span>Paid Amount:</span>
                          <span className="font-medium">
                            {currencySymbol}
                            {(() => {
                              const paidAmount =
                                selectedReservationPayments &&
                                selectedReservationPayments.length > 0
                                  ? selectedReservationPayments
                                      .filter(
                                        (payment) =>
                                          payment.status === "completed" &&
                                          payment.paymentType !== "credit",
                                      )
                                      .reduce(
                                        (sum, payment) =>
                                          sum + parseFloat(payment.amount),
                                        0,
                                      )
                                  : parseFloat(
                                      selectedReservation.paidAmount || 0,
                                    );
                              return (
                                Math.round(paidAmount * 100) / 100
                              ).toFixed(2);
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between text-orange-600 border-t pt-2">
                          <span className="font-medium">Balance Due:</span>
                          <span className="font-bold">
                            {currencySymbol}
                            {(() => {
                              // Use the consistent billing calculation
                              const billingCalc = calculateBillingAmounts(
                                selectedReservation,
                                selectedReservationPayments || [],
                                taxesAndCharges || [],
                              );
                              return billingCalc.remainingAmount.toFixed(2);
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setIsBillModalOpen(false)}
                    >
                      Close
                    </Button>
                    <Button variant="outline" onClick={handlePrintBill}>
                      <Printer className="h-4 w-4 mr-2" />
                      Print Bill
                    </Button>
                    {(() => {
                      const totalAmount = parseFloat(
                        selectedReservation.totalAmount,
                      );
                      const paidAmount =
                        selectedReservationPayments &&
                        selectedReservationPayments.length > 0
                          ? selectedReservationPayments
                              .filter(
                                (payment) =>
                                  payment.status === "completed" &&
                                  payment.paymentType !== "credit",
                              )
                              .reduce(
                                (sum, payment) =>
                                  sum + parseFloat(payment.amount),
                                0,
                              )
                          : parseFloat(selectedReservation.paidAmount || 0);
                      const isFullyPaid = totalAmount - paidAmount <= 0;

                      return isFullyPaid ? (
                        <div className="flex items-center text-green-600 font-medium">
                          <DollarSign className="h-4 w-4 mr-2" />
                          Payment Complete
                        </div>
                      ) : (
                        <Button
                          onClick={() => {
                            setIsBillModalOpen(false);
                            handlePayment(selectedReservation);
                          }}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Process Payment
                        </Button>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <PaymentDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        reservation={selectedReservation}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
