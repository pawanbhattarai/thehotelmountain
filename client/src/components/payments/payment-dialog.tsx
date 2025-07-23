import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  CreditCard,
  DollarSign,
  AlertCircle,
  Banknote,
  Smartphone,
  Building,
} from "lucide-react";

import { calculateBillingAmounts } from "@/lib/billing-utils";

const paymentSchema = z.object({
  paymentType: z.enum(["advance", "partial", "full", "credit"]),
  paymentMethod: z.enum(["cash", "card", "online", "bank-transfer"]),
  amount: z.string().min(1, "Amount is required"),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
  dueDate: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: any;
  onPaymentSuccess?: () => void;
}

export function PaymentDialog({
  isOpen,
  onClose,
  reservation,
  onPaymentSuccess,
}: PaymentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Get payment history for accurate calculation
  const { data: payments } = useQuery({
    queryKey: [`/api/reservations/${reservation?.id}/payments`],
    enabled: !!reservation?.id,
  });

  const { data: taxesAndCharges } = useQuery({
    queryKey: ["/api/taxes/reservation"],
    enabled: isOpen,
  });

  // Get room orders for billing calculation
  const { data: roomOrders } = useQuery({
    queryKey: [`/api/reservations/${reservation?.id}/room-orders`],
    enabled: !!reservation?.id && isOpen,
  });

  // Get current reservation data with refetch capability
  const { data: currentReservation, refetch: refetchReservation } = useQuery({
    queryKey: [`/api/reservations/${reservation?.id}`],
    enabled: !!reservation?.id,
    initialData: reservation,
  });

  // Local state for discount editing
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [discountData, setDiscountData] = useState({
    discountType: currentReservation?.discountType || "none",
    discountValue: currentReservation?.discountValue || "0",
    discountReason: currentReservation?.discountReason || "",
  });

  // Update discount data when currentReservation changes
  useEffect(() => {
    if (currentReservation && !isEditingDiscount) {
      setDiscountData({
        discountType: currentReservation.discountType || "none",
        discountValue: currentReservation.discountValue || "0",
        discountReason: currentReservation.discountReason || "",
      });
    }
  }, [currentReservation?.discountType, currentReservation?.discountValue, currentReservation?.discountReason, isEditingDiscount]);

  // Force component re-render when discount values change
  const discountKey = `${reservation?.discountType}-${reservation?.discountValue}-${reservation?.discountReason}`;

  // Calculate amounts using billing utils and direct calculation like multi-room-modal
  const billingCalc = useMemo(() => {
    // Return default values if reservation is not available
    if (!currentReservation) {
      return {
        subtotal: 0,
        taxes: 0,
        discount: 0,
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
      };
    }

    // Calculate subtotal from room amounts
    const roomSubtotal = currentReservation.reservationRooms?.reduce((sum: number, roomRes: any) => {
      return sum + parseFloat(roomRes.totalAmount || 0);
    }, 0) || parseFloat(currentReservation.totalAmount || 0);

    // Calculate room service total
    const roomServiceTotal = roomOrders?.reduce((sum: number, order: any) => {
      return sum + parseFloat(order.totalAmount || 0);
    }, 0) || 0;

    const subtotal = roomSubtotal + roomServiceTotal;

    // Calculate dynamic taxes and charges - same logic as multi-room-modal
    let taxes = 0;
    if (taxesAndCharges && Array.isArray(taxesAndCharges)) {
      const activeTaxes = taxesAndCharges.filter(
        (item) => item.status === "active" && item.applyToReservations,
      );
      taxes = activeTaxes.reduce((sum, item) => {
        const rate = parseFloat(item.rate) || 0;
        const amount = (subtotal * rate) / 100;
        return sum + amount;
      }, 0);
    }

    // Calculate discount - use live preview data if editing, otherwise use current discount data
    let discount = 0;
    const activeDiscountData = isEditingDiscount ? discountData : discountData;

    if (activeDiscountData.discountType && activeDiscountData.discountValue && activeDiscountData.discountType !== "none") {
      const discountValue = parseFloat(activeDiscountData.discountValue) || 0;
      if (activeDiscountData.discountType === "percentage") {
        discount = (subtotal * discountValue) / 100;
      } else if (activeDiscountData.discountType === "fixed") {
        discount = discountValue;
      }
    }

    // Ensure discount doesn't exceed subtotal + taxes
    const maxDiscount = subtotal + taxes;
    discount = Math.min(discount, maxDiscount);

    const totalAmount = Math.max(0, subtotal + taxes - discount);

    // Calculate paid amount excluding credit payments
    const paidAmount = payments && payments.length > 0
      ? payments
          .filter(
            (payment) =>
              payment.status === "completed" &&
              payment.paymentType !== "credit",
          )
          .reduce((sum, payment) => sum + parseFloat(payment.amount), 0)
      : parseFloat(currentReservation.paidAmount || 0);

    const remainingAmount = Math.max(0, totalAmount - paidAmount);

    return {
      subtotal,
      taxes,
      discount,
      totalAmount,
      paidAmount,
      remainingAmount,
    };
  }, [currentReservation, payments, taxesAndCharges, roomOrders, isEditingDiscount, discountData]);

  const subtotal = billingCalc.subtotal;
  const taxes = billingCalc.taxes;
  const discount = billingCalc.discount;
  const totalAmount = billingCalc.totalAmount;
  const paidAmount = billingCalc.paidAmount;
  const remainingAmount = billingCalc.remainingAmount;

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentType: "partial",
      paymentMethod: "cash",
      amount: "",
      transactionReference: "",
      notes: "",
      dueDate: "",
    },
  });

  const paymentTypeBadgeColor = {
    advance: "bg-blue-100 text-blue-800 hover:bg-blue-200",
    partial: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
    full: "bg-green-100 text-green-800 hover:bg-green-200",
    credit: "bg-red-100 text-red-800 hover:bg-red-200",
  };

  const paymentMethodIcons = {
    cash: <Banknote className="h-4 w-4" />,
    card: <CreditCard className="h-4 w-4" />,
    online: <Smartphone className="h-4 w-4" />,
    "bank-transfer": <Building className="h-4 w-4" />,
  };

  const createPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(
        "POST",
        `/api/reservations/${reservation.id}/payments`,
        data,
      );
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment processed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/reservations/${reservation.id}/payments`],
      });
      onPaymentSuccess?.();
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    },
  });

  const updateDiscountMutation = useMutation({
    mutationFn: async (discountData: any) => {
      return apiRequest(
        "PATCH",
        `/api/reservations/${reservation.id}`,
        discountData,
      );
    },
    onSuccess: (updatedReservation) => {
      toast({
        title: "Success",
        description: "Discount updated successfully",
      });

      // Update discount data state immediately
      setDiscountData({
        discountType: updatedReservation.discountType || "none",
        discountValue: updatedReservation.discountValue || "0",
        discountReason: updatedReservation.discountReason || "",
      });

      setIsEditingDiscount(false);

      // Refetch current reservation to get updated data
      refetchReservation();

      // Force refetch of reservations list
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/reservations/${reservation.id}/payments`],
      });

      onPaymentSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update discount",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof paymentSchema>) => {
    createPaymentMutation.mutate(data);
  };

  const handleDiscountUpdate = () => {
    updateDiscountMutation.mutate({
      discountType:
        discountData.discountType === "none" ? null : discountData.discountType,
      discountValue:
        discountData.discountType === "none" ? "0" : discountData.discountValue,
      discountReason:
        discountData.discountType === "none"
          ? null
          : discountData.discountReason,
    });
  };

  if (!reservation) return null;

  // Calculate actual paid amount from completed payments (excluding credit)
  const actualPaidAmount = payments
    ? payments
        .filter(
          (payment: any) =>
            payment.status === "completed" && payment.paymentType !== "credit",
        )
        .reduce(
          (sum: number, payment: any) => sum + parseFloat(payment.amount),
          0,
        )
    : 0;

  const selectedPaymentType = form.watch("paymentType");
  const selectedAmount = parseFloat(form.watch("amount") || "0");

  // Suggested amount based on payment type
  const getSuggestedAmount = (type: string) => {
    switch (type) {
      case "advance":
        return Math.round(totalAmount * 0.3); // 30% advance
      case "partial":
        return Math.round(remainingAmount * 0.5); // 50% of remaining
      case "full":
        return remainingAmount;
      case "credit":
        return remainingAmount;
      default:
        return 0;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} key={discountKey}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Process Payment - {reservation.confirmationNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Reservation Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Guest:</span>
                <span className="font-medium">
                  {reservation.guest?.firstName} {reservation.guest?.lastName}
                </span>
              </div>

              {/* Detailed Breakdown */}
              {(() => {
                return (
                  <>
                    {(() => {
                      // Calculate room charges and service separately for display
                      const roomSubtotal = currentReservation?.reservationRooms?.reduce((sum: number, roomRes: any) => {
                        return sum + parseFloat(roomRes.totalAmount || 0);
                      }, 0) || parseFloat(currentReservation?.totalAmount || 0);
                      
                      const roomServiceTotal = roomOrders?.reduce((sum: number, order: any) => {
                        return sum + parseFloat(order.totalAmount || 0);
                      }, 0) || 0;

                      return (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Room Charges:
                            </span>
                            <span className="font-medium">
                              Rs.{roomSubtotal.toFixed(2)}
                            </span>
                          </div>
                          {roomServiceTotal > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Room Service:
                              </span>
                              <span className="font-medium">
                                Rs.{roomServiceTotal.toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center font-medium border-t pt-2">
                            <span className="text-sm text-muted-foreground">
                              Subtotal:
                            </span>
                            <span className="font-medium">
                              Rs.{subtotal.toFixed(2)}
                            </span>
                          </div>
                        </>
                      );
                    })()}

                    {/* Tax breakdown */}
                    {taxesAndCharges &&
                      Array.isArray(taxesAndCharges) &&
                      taxesAndCharges
                        .filter((item) => item.isActive && item.applyToReservations)
                        .map((item: any) => {
                          const percentage = parseFloat(item.rate || item.percentage) || 0;
                          const amount = (subtotal * percentage) / 100;
                          return (
                            <div
                              key={item.id}
                              className="flex justify-between items-center"
                            >
                              <span className="text-sm text-muted-foreground">
                                {item.taxName || item.name} ({percentage.toFixed(1)}%):
                              </span>
                              <span className="font-medium">
                                Rs.{amount.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}

                    {/* Total taxes */}
                    {taxes > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Total Taxes & Charges:
                        </span>
                        <span className="font-medium">
                          Rs.{taxes.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Discount */}
                    {isEditingDiscount ? (
                      <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="discountType" className="text-xs font-medium">
                            Edit Discount
                          </Label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                           <div>
                            <Label htmlFor="discountType" className="text-xs font-medium">
                                Discount Type
                            </Label>
                            <Select
                                value={discountData.discountType}
                                onValueChange={(value) => {
                                    setDiscountData({
                                        ...discountData,
                                        discountType: value,
                                        discountValue: value === "none" ? "0" : discountData.discountValue,
                                    });
                                }}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">
                                        No Discount
                                    </SelectItem>
                                    <SelectItem value="percentage">
                                        Percentage (%)
                                    </SelectItem>
                                    <SelectItem value="fixed">
                                        Fixed Amount (Rs.)
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="discountValue" className="text-xs font-medium">
                                Value{" "}
                                {discountData.discountType === "percentage"
                                    ? "(%)"
                                    : discountData.discountType === "fixed"
                                        ? "(Rs.)"
                                        : ""}
                            </Label>
                            <Input
                                id="discountValue"
                                type="number"
                                min="0"
                                max={
                                    discountData.discountType === "percentage"
                                        ? "100"
                                        : discountData.discountType === "fixed"
                                            ? (subtotal + taxes).toString()
                                            : undefined
                                }
                                step={discountData.discountType === "percentage" ? "0.1" : "0.01"}
                                value={discountData.discountValue}
                                onChange={(e) =>
                                    setDiscountData({
                                        ...discountData,
                                        discountValue: e.target.value,
                                    })
                                }
                                className="h-8 text-xs"
                                disabled={discountData.discountType === "none"}
                                placeholder={discountData.discountType === "none" ? "0" : "Enter value"}
                            />
                        </div>
                        </div>
                        <div>
                           <Label htmlFor="discountReason" className="text-xs font-medium">
                                Reason for Discount
                           </Label>
                           <Input
                               id="discountReason"
                               value={discountData.discountReason}
                               onChange={(e) =>
                                   setDiscountData({
                                       ...discountData,
                                       discountReason: e.target.value,
                                   })
                               }
                               placeholder="e.g., Regular customer, Group booking, Staff discount"
                               className="h-8 text-xs"
                               disabled={discountData.discountType === "none"}
                           />
                        </div>

                        {/* Live Preview Section */}
                        {/* Live Preview Section removed as per request */}

                         <div className="flex gap-2 pt-2 border-t">
                            <Button
                                size="sm"
                                onClick={handleDiscountUpdate}
                                disabled={updateDiscountMutation.isPending}
                                className="h-7 px-3 text-xs flex-1"
                            >
                                {updateDiscountMutation.isPending
                                    ? "Updating..."
                                    : "Apply Discount"}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setDiscountData({
                                        discountType: currentReservation?.discountType || "none",
                                        discountValue: currentReservation?.discountValue || "0",
                                        discountReason: currentReservation?.discountReason || "",
                                    });
                                    setIsEditingDiscount(false);
                                }}
                                className="h-7 px-3 text-xs flex-1"
                            >
                                Cancel
                            </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center bg-green-50 px-3 py-2 rounded-md border border-green-200">
                        <span className="text-sm font-medium">
                          Discount:
                          {discount > 0 ? (
                            <>
                              {discountData.discountType === "percentage"
                                ? `${parseFloat(
                                    discountData.discountValue || "0",
                                  ).toFixed(1)}%`
                                : "Fixed"}
                              {discountData.discountReason &&
                                ` - ${discountData.discountReason}`}
                            </>
                          ) : (
                            "None"
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          {discount > 0 && (
                            <span className="text-sm text-green-600">
                              -Rs.{discount.toFixed(2)}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditingDiscount(true)}
                            className="h-6 px-2 text-xs"
                          >
                            {isEditingDiscount ? "Cancel" : "Edit"}
                          </Button>
                        </div>
                      </div>
                    )}

                    <Separator />

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Total Amount:</span>
                      <span className="font-bold">
                        Rs.{totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </>
                );
              })()}

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Paid Amount:
                </span>
                <span className="font-medium text-green-600">
                  Rs.{paidAmount.toFixed(2)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Remaining Balance:</span>
                <span className="font-bold text-lg">
                  Rs.{remainingAmount.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Payment Type Selection */}
              <FormField
                control={form.control}
                name="paymentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Type</FormLabel>
                    <div className="text-sm text-muted-foreground mb-2">
                      Choose how much to pay now:
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {(["advance", "partial", "full", "credit"] as const).map(
                        (type) => (
                          <Button
                            key={type}
                            type="button"
                            variant={
                              field.value === type ? "default" : "outline"
                            }
                            className="h-10 flex-col gap-1"
                            onClick={() => {
                              field.onChange(type);
                              form.setValue(
                                "amount",
                                getSuggestedAmount(type).toString(),
                              );
                            }}
                          >
                            <Badge
                              variant="secondary"
                              className={`text-xs ${paymentTypeBadgeColor[type]}`}
                            >
                              {type}
                            </Badge>
                            <div className="text-xs text-muted-foreground text-center">
                              {type === "advance"}
                              {type === "partial"}
                              {type === "full"}
                              {type === "credit"}
                            </div>
                          </Button>
                        ),
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Credit Payment Warning */}
              {selectedPaymentType === "credit" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-yellow-100 rounded-full p-1 mt-0.5">
                      <span className="text-yellow-600 text-sm font-bold">
                        !
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium text-yellow-800">
                        Credit Payment Selected
                      </h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        This amount will be added to the guest's credit balance.
                        The reservation will NOT be marked as paid until actual
                        payment is received.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Method Selection */}
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <div className="text-sm text-muted-foreground mb-2">
                      How will this payment be made?
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {(
                        ["cash", "card", "online", "bank-transfer"] as const
                      ).map((method) => (
                        <Button
                          key={method}
                          type="button"
                          variant={
                            field.value === method ? "default" : "outline"
                          }
                          className="h-10 flex items-center gap-2"
                          onClick={() => field.onChange(method)}
                        >
                          {paymentMethodIcons[method]}
                          <span className="capitalize">
                            {method.replace("-", " ")}
                          </span>
                        </Button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (Rs.)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          min="0"
                          max={remainingAmount}
                          placeholder="Enter amount"
                          className="pl-8"
                        />
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                          Rs.
                        </span>
                      </div>
                    </FormControl>
                    {selectedAmount > remainingAmount && (
                      <p className="text-sm text-red-600">
                        Amount cannot exceed remaining balance of Rs.
                        {remainingAmount.toFixed(2)}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Transaction Reference */}
              <FormField
                control={form.control}
                name="transactionReference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Reference (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter transaction ID or reference number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Due Date for Credit Payments */}
              {selectedPaymentType === "credit" && (
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="datetime-local"
                          min={new Date().toISOString().slice(0, 16)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Add any additional notes about this payment..."
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createPaymentMutation.isPending ||
                    isProcessing ||
                    selectedAmount <= 0 ||
                    selectedAmount > remainingAmount
                  }
                  className="flex-1"
                >
                  {createPaymentMutation.isPending || isProcessing
                    ? "Processing..."
                    : `Process Payment (Rs.${selectedAmount.toFixed(2)})`}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}