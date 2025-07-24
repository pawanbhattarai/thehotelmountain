import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Eye, Receipt, CreditCard, Trash2, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/ui/pagination-controls";

const checkoutSchema = z.object({
  paymentMethod: z.enum(["cash", "card", "Bank Transfer", "online"]),
  discountAmount: z.number().min(0).optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

export default function RestaurantBilling() {
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [viewingBill, setViewingBill] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: bills, isLoading } = useQuery({
    queryKey: ["/api/restaurant/bills"],
    refetchInterval: 2000, // Real-time polling every 2 seconds
  });

  const { data: orders } = useQuery({
    queryKey: ["/api/restaurant/orders"],
    refetchInterval: 2000, // Real-time polling every 2 seconds
  });

  const { data: tables } = useQuery({
    queryKey: ["/api/restaurant/tables"],
  });

  const { data: activeTaxes } = useQuery({
    queryKey: ["/api/taxes/order"],
  });

  const { data: hotelSettings } = useQuery({
    queryKey: ["/api/hotel-settings"],
    enabled: !!user,
  });

  const filteredBills = bills?.filter(
    (bill: any) => bill.order?.orderType === "dine-in",
  );

  const pagination = usePagination({
    data: Array.isArray(filteredBills) ? filteredBills : [],
    itemsPerPage: 10,
    searchTerm,
    searchFields: ["billNumber", "order.orderNumber", "customerName", "paymentMethod"] as any,
  });

  const deleteBillMutation = useMutation({
    mutationFn: async (billId: string) => {
      const response = await fetch(`/api/restaurant/bills/${billId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete bill");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/tables"] });
      toast({ title: "Bill deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete bill",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (data: CheckoutFormData & { orderId: string }) => {
      // Get order details to calculate amounts
      const order = orders?.find((o: any) => o.id === data.orderId);
      if (!order) throw new Error("Order not found");

      // Check if bill already exists for this order
      const existingBill = bills?.find(
        (bill: any) => bill.orderId === data.orderId,
      );
      if (existingBill) {
        throw new Error("Bill already exists for this order");
      }

      // Check if order is in correct status for checkout
      if (
        !["pending", "confirmed", "preparing", "ready", "served"].includes(
          order.status,
        )
      ) {
        throw new Error("Order must be active to checkout");
      }

      const subtotal = parseFloat(order.subtotal || order.totalAmount || "0");
      const discountAmount = data.discountAmount || 0;
      const discountPercentage = data.discountPercentage || 0;

      // Calculate discount
      const finalDiscountAmount =
        discountPercentage > 0
          ? (subtotal * discountPercentage) / 100
          : discountAmount;

      // Calculate amounts
      const afterDiscount = subtotal - finalDiscountAmount;

      // Calculate taxes dynamically from tax management system
      const baseAmountForTax = afterDiscount;
      let totalTaxAmount = 0;
      let appliedTaxes = [];

      if (activeTaxes && activeTaxes.length > 0) {
        activeTaxes.forEach((tax: any) => {
          const taxAmount = baseAmountForTax * (parseFloat(tax.rate) / 100);
          totalTaxAmount += taxAmount;
          appliedTaxes.push({
            taxName: tax.taxName,
            rate: tax.rate,
            amount: taxAmount.toFixed(2),
          });
        });
      }

      const totalAmount = afterDiscount + totalTaxAmount;

      const billData = {
        orderId: data.orderId,
        tableId: order.tableId,
        branchId: order.branchId,
        customerName: data.customerName || "",
        customerPhone: data.customerPhone || "",
        subtotal: subtotal.toString(),
        taxAmount: totalTaxAmount.toString(),
        appliedTaxes: JSON.stringify(appliedTaxes),
        discountAmount: finalDiscountAmount.toString(),
        discountPercentage: (data.discountPercentage || 0).toString(),
        totalAmount: totalAmount.toString(),
        paidAmount: totalAmount.toString(),
        changeAmount: "0",
        paymentStatus: "paid",
        paymentMethod: data.paymentMethod,
        notes: data.notes || "",
      };

      // Create bill
      const billResponse = await fetch("/api/restaurant/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(billData),
      });
      if (!billResponse.ok) {
        const errorData = await billResponse.json();
        throw new Error(errorData.message || "Failed to create bill");
      }

      // Update order status to completed
      const orderResponse = await fetch(
        `/api/restaurant/orders/${data.orderId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        },
      );
      if (!orderResponse.ok) {
        throw new Error("Failed to complete order");
      }

      return billResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/tables"] });
      setIsCheckoutModalOpen(false);
      setSelectedOrder(null);
      resetForm();
      toast({
        title: "Checkout completed successfully",
        description: "Table is now available for new orders.",
      });
    },
    onError: (error: any) => {
      let errorMessage = error.message;

      if (error.message?.includes("Bill already exists")) {
        errorMessage =
          "This order has already been billed. Please refresh the page to see the updated status.";
      } else if (error.message?.includes("Order must be active")) {
        errorMessage = "Order must be active to checkout.";
      }

      toast({
        title: "Failed to checkout",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      paymentMethod: "cash",
      discountAmount: 0,
      discountPercentage: 0,
      notes: "",
      customerName: "",
      customerPhone: "",
    },
  });

  const resetForm = () => {
    form.reset({
      paymentMethod: "cash",
      discountAmount: 0,
      discountPercentage: 0,
      notes: "",
      customerName: "",
      customerPhone: "",
    });
  };

  const onSubmit = (data: CheckoutFormData) => {
    if (!selectedOrder) return;
    checkoutMutation.mutate({ ...data, orderId: selectedOrder.id });
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case "cash":
        return "bg-green-500";
      case "card":
        return "bg-blue-500";
      case "Bank Transfer":
        return "bg-purple-500";
      case "online":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const getReadyForCheckoutOrders = () => {
    if (!orders || !bills) return [];

    // Get orders that are pending, confirmed, preparing, ready, or served and don't have bills yet
    // Only include table orders for restaurant billing, exclude room orders
    return orders.filter(
      (order: any) =>
        order.orderType === "dine-in" &&
        ["pending", "confirmed", "preparing", "ready", "served"].includes(
          order.status,
        ) &&
        !bills.some((bill: any) => bill.orderId === order.id),
    );
  };

  const getTableName = (tableId: number) => {
    const table = tables?.find((t: any) => t.id === tableId);
    return table ? table.name : `Table ${tableId}`;
  };

  const calculateBillPreview = () => {
    const discountAmount = form.watch("discountAmount") || 0;
    const discountPercentage = form.watch("discountPercentage") || 0;

    if (!selectedOrder) return null;

    const subtotal = parseFloat(
      selectedOrder.subtotal || selectedOrder.totalAmount || "0",
    );
    const finalDiscountAmount =
      discountPercentage > 0
        ? (subtotal * discountPercentage) / 100
        : discountAmount;

    const afterDiscount = subtotal - finalDiscountAmount;

    // Calculate taxes dynamically
    const baseAmountForTax = afterDiscount;
    let totalTaxAmount = 0;
    let appliedTaxes = [];

    if (activeTaxes && activeTaxes.length > 0) {
      activeTaxes.forEach((tax: any) => {
        const taxAmount = baseAmountForTax * (parseFloat(tax.rate) / 100);
        totalTaxAmount += taxAmount;
        appliedTaxes.push({
          taxName: tax.taxName,
          rate: tax.rate,
          amount: taxAmount,
        });
      });
    }

    const totalAmount = afterDiscount + totalTaxAmount;

    return {
      subtotal,
      discountAmount: finalDiscountAmount,
      taxAmount: totalTaxAmount,
      appliedTaxes,
      totalAmount,
    };
  };

  const billPreview = calculateBillPreview();

  const handleCheckout = (order: any) => {
    setSelectedOrder(order);
    setIsCheckoutModalOpen(true);
    resetForm();
  };

  const printBill = (bill: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({
        title: "Print failed",
        description: "Please allow popups to print bills",
        variant: "destructive",
      });
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill #${bill.billNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: ${hotelSettings?.printerFontFamily || '"Helvetica", "Arial", "Liberation Sans", sans-serif'};
              font-size: 12px; 
              line-height: 1.2;
              width: 80mm;
              margin: 0 auto;
              padding: 5mm;
              background: white;
            }
            .receipt-header { 
              text-align: center; 
              border-bottom: 1px dashed #000;
              padding-bottom: 4px;
              margin-bottom: 5px;
            }
            .restaurant-name { 
              font-size: 16px; 
              font-weight: bold; 
              margin-bottom: 2px;
            }
            .bill-number { 
              font-size: 14px; 
              font-weight: bold; 
              margin-top: 5px;
            }
            .info-section { 
              margin-bottom: 10px;
              font-size: 11px;
            }
            .info-row { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 2px;
            }
            .items-section { 
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
              padding: 8px 0;
              margin: 10px 0;
            }
            .items-header { 
              font-weight: bold; 
              border-bottom: 1px solid #000;
              padding-bottom: 2px;
              margin-bottom: 5px;
            }
            .item-row { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 2px;
              font-size: 10px;
              line-height: 1.3;
            }
            .item-name { 
              flex: 1; 
              word-wrap: break-word;
              overflow: hidden;
              text-overflow: ellipsis;
              min-width: 120px;
            }
            .item-qty { width: 35px; text-align: center; font-weight: bold; }
            .item-price { width: 60px; text-align: right; }
            .item-total { width: 70px; text-align: right; font-weight: bold; }
            .totals-section { 
              margin-top: 8px;
              border-top: 1px dashed #000;
              padding-top: 5px;
            }
            .total-row { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 2px;
              font-size: 11px;
            }
            .final-total { 
              font-weight: bold; 
              font-size: 13px;
              border-top: 1px solid #000;
              padding-top: 3px;
              margin-top: 5px;
            }
            .payment-info { 
              margin-top: 5px;
              text-align: center;
              font-weight: bold;
              font-size: 12px;
            }
            .footer { 
              margin-top: 15px; 
              text-align: center; 
              font-size: 10px;
              border-top: 1px dashed #000;
              padding-top: 8px;
            }
            .divider { 
              text-align: center; 
              margin: 5px 0;
              font-size: 10px;
            }
            @media print { 
              body { margin: 0; padding: 2mm; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <div class="restaurant-name">RESTAURANT</div>
            <div style="font-size: 10px;">Restaurant Address</div>
            <div style="font-size: 10px;">Phone: +977-XXXXXXXX</div>
            <div class="bill-number">Bill #${bill.billNumber}</div>
          </div>

          <div class="info-section">
            <div class="info-row">
              <span>Date:</span>
              <span>${new Date(bill.createdAt).toLocaleDateString("en-NP")} ${new Date(bill.createdAt).toLocaleTimeString("en-NP", { hour12: false })}</span>
            </div>
            <div class="info-row">
              <span>Table:</span>
              <span>${getTableName(bill.tableId)}</span>
            </div>
            <div class="info-row">
              <span>Order #:</span>
              <span>${bill.order?.orderNumber || "N/A"}</span>
            </div>
            ${
              bill.customerName
                ? `
              <div class="info-row">
                <span>Customer:</span>
                <span>${bill.customerName}</span>
              </div>
            `
                : ""
            }
            ${
              bill.customerPhone
                ? `
              <div class="info-row">
                <span>Phone:</span>
                <span>${bill.customerPhone}</span>
              </div>
            `
                : ""
            }
          </div>

          <div class="items-section">
            <div class="items-header">
              <div class="item-row">
                <div class="item-name">ITEM NAME</div>
                <div class="item-qty">QTY</div>
                <div class="item-price">RATE</div>
                <div class="item-total">AMOUNT</div>
              </div>
            </div>
            ${(() => {
              // Try multiple ways to get order items
              const items = bill.order?.items || bill.orderItems || [];

              if (items && items.length > 0) {
                return items
                  .map(
                    (item: any) => `
                    <div class="item-row">
                      <div class="item-name" title="${item.dish?.name || item.dishName || item.name || "Item"}">${(item.dish?.name || item.dishName || item.name || "Item").substring(0, 25)}</div>
                      <div class="item-qty">${item.quantity}</div>
                      <div class="item-price">Rs.${parseFloat(item.unitPrice || item.price || 0).toFixed(2)}</div>
                      <div class="item-total">Rs.${(parseFloat(item.unitPrice || item.price || 0) * item.quantity).toFixed(2)}</div>
                    </div>
                    ${
                      item.specialInstructions
                        ? `
                    <div class="item-row" style="font-size: 9px; color: #666; margin-left: 5px;">
                      <div class="item-name">Note: ${item.specialInstructions}</div>
                      <div class="item-qty"></div>
                      <div class="item-price"></div>
                      <div class="item-total"></div>
                    </div>
                    `
                        : ""
                    }
                  `,
                  )
                  .join("");
              } else {
                // Fallback: try to get items from the selected order if available
                const orderItems = selectedOrder?.items || [];
                if (orderItems.length > 0) {
                  return orderItems
                    .map(
                      (item: any) => `
                      <div class="item-row">
                        <div class="item-name" title="${item.dish?.name || "Item"}">${(item.dish?.name || "Item").substring(0, 25)}</div>
                        <div class="item-qty">${item.quantity}</div>
                        <div class="item-price">Rs.${parseFloat(item.unitPrice).toFixed(2)}</div>
                        <div class="item-total">Rs.${(parseFloat(item.unitPrice) * item.quantity).toFixed(2)}</div>
                      </div>
                      ${
                        item.specialInstructions
                          ? `
                      <div class="item-row" style="font-size: 9px; color: #666; margin-left: 5px;">
                        <div class="item-name">Note: ${item.specialInstructions}</div>
                        <div class="item-qty"></div>
                        <div class="item-price"></div>
                        <div class="item-total"></div>
                      </div>
                      `
                          : ""
                      }
                    `,
                    )
                    .join("");
                }

                return `
                  <div class="item-row">
                    <div class="item-name">Items data not available</div>
                    <div class="item-qty"></div>
                    <div class="item-price"></div>
                    <div class="item-total"></div>
                  </div>
                `;
              }
            })()}
            <div style="border-top: 1px solid #000; margin-top: 5px; padding-top: 3px;">
              <div class="item-row" style="font-weight: bold;">
                <div class="item-name">SUBTOTAL</div>
                <div class="item-qty"></div>
                <div class="item-price"></div>
                <div class="item-total">Rs.${parseFloat(bill.subtotal).toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div class="totals-section">

            ${
              parseFloat(bill.discountAmount) > 0
                ? `
              <div class="total-row">
                <span>Discount (${bill.discountPercentage}%):</span>
                <span>-Rs. ${parseFloat(bill.discountAmount).toFixed(2)}</span>
              </div>
            `
                : ""
            }
            ${
              bill.appliedTaxes
                ? JSON.parse(bill.appliedTaxes)
                    .map(
                      (tax: any) => `
                <div class="total-row">
                  <span>${tax.taxName} (${tax.rate}%):</span>
                  <span>Rs. ${tax.amount}</span>
                </div>
              `,
                    )
                    .join("")
                : `
                <div class="total-row">
                  <span>Tax:</span>
                  <span>Rs. ${parseFloat(bill.taxAmount).toFixed(2)}</span>
                </div>
              `
            }
            <div class="total-row final-total">
              <span>TOTAL AMOUNT:</span>
              <span>Rs. ${parseFloat(bill.totalAmount).toFixed(2)}</span>
            </div>
          </div>

          <div class="payment-info">
            PAYMENT: ${bill.paymentMethod.toUpperCase()} - PAID
          </div>

          ${
            bill.notes
              ? `
            <div style="margin-top: 10px; font-size: 10px; text-align: center;">
              <strong>Notes:</strong> ${bill.notes}
            </div>
          `
              : ""
          }

          <div class="divider">================================</div>
          <div class="footer">
            <div>THANK YOU FOR DINING WITH US!</div>
            <div style="margin-top: 3px;">Visit Again Soon</div>
            <div style="margin-top: 5px; font-size: 9px;">
              Powered by M.A.P. TECH
            </div>
          </div>
          <div class="divider">================================</div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() {
                  window.close();
                }, 500);
              }, 100);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const handleDeleteBill = (bill: any) => {
    if (
      window.confirm(
        `Are you sure you want to delete bill #${bill.billNumber}? This action cannot be undone.`,
      )
    ) {
      deleteBillMutation.mutate(bill.id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isMobileMenuOpen={isMobileSidebarOpen}
        setIsMobileMenuOpen={setIsMobileSidebarOpen}
      />
      <div className="main-content">
        <Header
          title="Restaurant Billing"
          subtitle="Manage restaurant bills and payments"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
        />
        <main className="p-6">
          {/* Orders Ready for Checkout */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Orders Ready for Checkout</CardTitle>
            </CardHeader>
            <CardContent>
              {getReadyForCheckoutOrders().length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getReadyForCheckoutOrders().map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          #{order.orderNumber}
                        </TableCell>
                        <TableCell>{getTableName(order.tableId)}</TableCell>
                        <TableCell>{order.items?.length || 0} items</TableCell>
                        <TableCell>
                          <div className="text-right">
                            <div>
                              Subtotal: NPR{" "}
                              {parseFloat(order.subtotal).toFixed(2)}
                            </div>
                            {order.taxAmount &&
                              parseFloat(order.taxAmount) > 0 && (
                                <div className="text-sm text-gray-600">
                                  Tax: NPR{" "}
                                  {parseFloat(order.taxAmount).toFixed(2)}
                                </div>
                              )}
                            <div className="font-semibold">
                              Total: NPR{" "}
                              {parseFloat(order.totalAmount).toFixed(2)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            onClick={() => handleCheckout(order)}
                            disabled={
                              checkoutMutation.isPending ||
                              bills?.some(
                                (bill: any) => bill.orderId === order.id,
                              )
                            }
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            {bills?.some(
                              (bill: any) => bill.orderId === order.id,
                            )
                              ? "Billed"
                              : "Checkout"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No table orders ready for checkout. Create table orders to see
                  them here.
                </div>
              )}
            </CardContent>
          </Card>

          {/* All Bills */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>All Bills</CardTitle>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search bills..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill #</TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.paginatedData?.length ? (
                      pagination.paginatedData.map((bill: any) => (
                          <TableRow key={bill.id}>
                            <TableCell className="font-medium">
                              #{bill.billNumber}
                            </TableCell>
                            <TableCell>
                              #{bill.order?.orderNumber || "N/A"}
                            </TableCell>
                            <TableCell>{getTableName(bill.tableId)}</TableCell>
                            <TableCell>
                              {bill.customerName || "Guest"}
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Badge
                                  className={`${getPaymentMethodColor(bill.paymentMethod)} text-white`}
                                >
                                  {bill.paymentMethod}
                                </Badge>
                                <Badge variant="default">paid</Badge>
                              </div>
                            </TableCell>
                            <TableCell>Rs. {bill.totalAmount}</TableCell>
                            <TableCell>
                              {new Date(bill.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setViewingBill(bill)}
                                  title="View Bill"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => printBill(bill)}
                                  title="Print Bill"
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteBill(bill)}
                                  disabled={deleteBillMutation.isPending}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Delete Bill"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center py-8 text-gray-500"
                        >
                          No table order bills found. Complete table orders to
                          generate bills automatically.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
              {pagination.totalItems > 0 && (
                <div className="mt-4">
                  <PaginationControls pagination={pagination} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checkout Modal */}
          <Dialog
            open={isCheckoutModalOpen}
            onOpenChange={setIsCheckoutModalOpen}
          >
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  <Receipt className="mr-2 h-5 w-5 inline" />
                  Checkout Order #{selectedOrder?.orderNumber}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Name (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Customer name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Phone (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Customer phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="card">Card</SelectItem>
                                <SelectItem value="Bank Transfer">
                                  Bank Transfer
                                </SelectItem>
                                <SelectItem value="online">Online</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="discountPercentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount (%)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              onChange={(e) =>
                                field.onChange(parseFloat(e.target.value) || 0)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="discountAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Amount (Rs.)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              onChange={(e) =>
                                field.onChange(parseFloat(e.target.value) || 0)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Additional notes..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Order Items Preview */}
                  {selectedOrder?.items && (
                    <div>
                      <h3 className="font-semibold mb-2">Order Items</h3>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead>Price</TableHead>
                              <TableHead>Qty</TableHead>
                              <TableHead>Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedOrder.items.map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">
                                  {item.dish?.name}
                                </TableCell>
                                <TableCell>Rs. {item.unitPrice}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>
                                  Rs.{" "}
                                  {(
                                    parseFloat(item.unitPrice) * item.quantity
                                  ).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Bill Preview */}
                  {billPreview && (
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <h3 className="font-semibold mb-3">Bill Preview</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>Rs. {billPreview.subtotal.toFixed(2)}</span>
                        </div>
                        {billPreview.discountAmount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Discount:</span>
                            <span>
                              - Rs. {billPreview.discountAmount.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {billPreview.appliedTaxes &&
                        billPreview.appliedTaxes.length > 0 ? (
                          billPreview.appliedTaxes.map(
                            (tax: any, index: number) => (
                              <div key={index} className="flex justify-between">
                                <span>
                                  {tax.taxName} ({tax.rate}%):
                                </span>
                                <span>Rs. {tax.amount.toFixed(2)}</span>
                              </div>
                            ),
                          )
                        ) : (
                          <div className="flex justify-between">
                            <span>Tax:</span>
                            <span>Rs. {billPreview.taxAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-bold">
                          <span>Total Amount:</span>
                          <span>Rs. {billPreview.totalAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCheckoutModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={checkoutMutation.isPending}>
                      {checkoutMutation.isPending
                        ? "Processing..."
                        : "Complete Checkout"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* View Bill Modal */}
          {viewingBill && (
            <Dialog
              open={!!viewingBill}
              onOpenChange={() => setViewingBill(null)}
            >
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center">
                    <Receipt className="mr-2 h-5 w-5" />
                    Bill Details - #{viewingBill.billNumber}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Order Number:
                      </span>
                      <p className="font-medium">
                        #{viewingBill.order?.orderNumber || "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Table:
                      </span>
                      <p className="font-medium">
                        {getTableName(viewingBill.tableId)}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Customer:
                      </span>
                      <p className="font-medium">
                        {viewingBill.customerName || "Guest"}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Phone:
                      </span>
                      <p className="font-medium">
                        {viewingBill.customerPhone || "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Payment Method:
                      </span>
                      <Badge
                        className={`${getPaymentMethodColor(viewingBill.paymentMethod)} text-white ml-2`}
                      >
                        {viewingBill.paymentMethod}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Date:
                      </span>
                      <p className="font-medium text-sm">
                        {new Date(viewingBill.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {viewingBill.order?.items && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        Order Items
                      </h3>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead>Price</TableHead>
                              <TableHead>Qty</TableHead>
                              <TableHead>Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {viewingBill.order.items.map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">
                                  {item.dish?.name}
                                </TableCell>
                                <TableCell>Rs. {item.unitPrice}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>
                                  Rs.{" "}
                                  {(
                                    parseFloat(item.unitPrice) * item.quantity
                                  ).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Bill Details */}

                  <div>
                    <h3 className="font-semibold mb-2">Order Summary</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>
                          NPR {parseFloat(viewingBill.subtotal).toFixed(2)}
                        </span>
                      </div>
                      {parseFloat(viewingBill.discountAmount) > 0 && (
                        <div className="flex justify-between">
                          <span>Discount:</span>
                          <span>
                            NPR{" "}
                            {parseFloat(viewingBill.discountAmount).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {viewingBill.appliedTaxes ? (
                        JSON.parse(viewingBill.appliedTaxes).map(
                          (tax: any, index: number) => (
                            <div key={index} className="flex justify-between">
                              <span>
                                {tax.taxName} ({tax.rate}%):
                              </span>
                              <span>NPR {tax.amount}</span>
                            </div>
                          ),
                        )
                      ) : (
                        <div className="flex justify-between">
                          <span>Tax:</span>
                          <span>
                            NPR {parseFloat(viewingBill.taxAmount).toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold">
                        <span>Total:</span>
                        <span>
                          NPR {parseFloat(viewingBill.totalAmount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {viewingBill.notes && (
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Notes:
                      </span>
                      <p className="font-medium">{viewingBill.notes}</p>
                    </div>
                  )}

                  <div className="flex justify-end space-x-2">
                    <Button onClick={() => printBill(viewingBill)}>
                      <Printer className="mr-2 h-4 w-4" />
                      Print Bill
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </main>
      </div>
    </div>
  );
}