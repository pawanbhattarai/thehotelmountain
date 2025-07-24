import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus,
  Eye,
  FileText,
  Printer,
  Minus,
  Trash2,
  ShoppingCart,
  Clock,
  CheckCircle,
  Users,
  Utensils,
  ArrowLeft,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";

const orderSchema = z.object({
  reservationId: z.string().min(1, "Reservation is required"),
  branchId: z.number().min(1, "Branch is required"),
  items: z
    .array(
      z.object({
        dishId: z.number().min(1, "Dish is required"),
        quantity: z.number().min(1, "Quantity must be at least 1"),
        unitPrice: z.string().min(1, "Price is required"),
        notes: z.string().optional(),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

export default function RoomOrders() {
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [originalItems, setOriginalItems] = useState<any[]>([]);
  const [isCompleteOrderUpdate, setIsCompleteOrderUpdate] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDietFilter, setSelectedDietFilter] = useState<string>("all");
  const [selectedMenuTypeFilter, setSelectedMenuTypeFilter] = useState<string>("all");
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/restaurant/orders/room"],
    refetchInterval: 2000, // Real-time polling every 2 seconds for immediate updates
  });

  const { data: reservations, isLoading: reservationsLoading } = useQuery({
    queryKey: ["/api/reservations"],
  });

  const { data: dishes } = useQuery({
    queryKey: ["/api/restaurant/dishes"],
  });

  const { data: categories } = useQuery({
    queryKey: ["/api/restaurant/categories"],
  });

  const { data: orderTaxes } = useQuery({
    queryKey: ["/api/taxes/order"],
  });

  const { data: branches } = useQuery({
    queryKey: ["/api/branches"],
  });

  // Get currency from settings or default to Rs.
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });
  const currencySymbol = settings?.currency || "Rs.";

  const createOrderMutation = useMutation({
    mutationFn: async (data: { order: any; items: any[]; isUpdate?: boolean; orderId?: string }) => {
      console.log("Sending room order request:", data);
      
      if (data.isUpdate && data.orderId) {
        // Use PUT endpoint for complete order updates (when items are deleted or modified)
        const response = await fetch(`/api/restaurant/orders/${data.orderId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: data.order, items: data.items }),
        });

        const responseData = await response.json();
        console.log("Room order update response:", responseData);

        if (!response.ok) {
          throw new Error(responseData.message || "Failed to update room order");
        }
        return responseData;
      } else {
        // Use POST endpoint for new orders or adding items to existing orders
        const response = await fetch("/api/restaurant/orders/room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const responseData = await response.json();
        console.log("Room order creation response:", responseData);

        if (!response.ok) {
          throw new Error(responseData.message || "Failed to create room order");
        }
        return responseData;
      }
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/orders/room"] });
      const existingOrder = selectedReservation
        ? getReservationOrder(selectedReservation.id)
        : null;

      // Automatically generate KOT/BOT for new orders
      if (!existingOrder && data?.id) {
        try {
          await generateKOTBOTMutation.mutateAsync(data.id);
          toast({
            title: "Room order created successfully",
            description: "Your order has been placed and tickets generated!",
          });
        } catch (error) {
          toast({
            title: "Order created but ticket generation failed",
            description: "Please generate KOT/BOT manually from the order view",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: existingOrder
            ? "Order updated successfully"
            : "Room order created successfully",
          description: existingOrder
            ? "Items have been added to the order!"
            : "Your order has been placed!",
        });
      }

      setSelectedReservation(null);
      setSelectedItems([]);
      setOriginalItems([]);
    },
    onError: (error: any) => {
      console.error("Room order creation failed:", error);
      toast({
        title: "Failed to create room order",
        description:
          error.message || "An error occurred while creating the order",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/restaurant/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update order status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/orders/room"] });
      toast({ title: "Order status updated" });
    },
  });

  const generateKOTBOTMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/restaurant/orders/${orderId}/kot-bot`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate KOT/BOT");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/orders/room"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/kot"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/bot"] });

      let description = "";
      if (data.kotGenerated && data.botGenerated) {
        description = `KOT ${data.kotData.kotNumber} sent to kitchen and BOT ${data.botData.botNumber} sent to bar`;
      } else if (data.kotGenerated) {
        description = `KOT ${data.kotData.kotNumber} sent to kitchen for food items`;
      } else if (data.botGenerated) {
        description = `BOT ${data.botData.botNumber} sent to bar for beverage items`;
      } else {
        description = "No items available for KOT/BOT generation";
      }

      toast({ 
        title: data.message,
        description: description
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate KOT/BOT",
        description: error.message || "An error occurred while generating KOT/BOT",
        variant: "destructive",
      });
    },
  });

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      reservationId: selectedReservation?.id || "",
      branchId: user?.role === "superadmin" ? 1 : user?.branchId || 1,
      items: [],
      notes: "",
    },
  });

  // Update form values when reservation changes
  React.useEffect(() => {
    if (selectedReservation) {
      form.setValue("reservationId", selectedReservation.id);
    }
  }, [selectedReservation, form]);

  const onSubmit = (data: OrderFormData) => {
    console.log("Form submitted with data:", data);
    console.log("Selected items:", selectedItems);
    console.log("Selected reservation:", selectedReservation);

    const existingOrder = getReservationOrder(selectedReservation.id);

    if (selectedItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the order",
        variant: "destructive",
      });
      return;
    }

    if (!selectedReservation) {
      toast({
        title: "Error",
        description: "No reservation selected",
        variant: "destructive",
      });
      return;
    }

    // Check if there are changes to the order
    if (existingOrder && !hasOrderChanged()) {
      toast({
        title: "No changes",
        description: "No changes detected in the order",
        variant: "default",
      });
      return;
    }

    // Determine branch ID based on user role
    let branchId: number;
    if (user?.role === "superadmin") {
      branchId = branches?.[0]?.id || 1;
    } else {
      branchId = user?.branchId || 1;
    }

    // Determine if we need complete update or partial update
    const useCompleteUpdate = existingOrder && needsCompleteUpdate();
    let itemsToSubmit = selectedItems;
    let subtotalForCalculation = 0;
    
    if (useCompleteUpdate) {
      // Complete update: send all current items (handles deletions and modifications)
      itemsToSubmit = selectedItems;
      subtotalForCalculation = calculateSubtotal();
      console.log("Using COMPLETE UPDATE mode - sending all items");
    } else if (existingOrder) {
      // Partial update: only send new items or items with increased quantity
      itemsToSubmit = selectedItems.filter((item) => {
        const originalItem = originalItems.find(
          (orig) => orig.dishId === item.dishId
        );
        
        if (!originalItem) {
          // This is a completely new item
          subtotalForCalculation += parseFloat(item.unitPrice) * item.quantity;
          return true;
        } else if (item.quantity > originalItem.quantity) {
          // This item has increased quantity, only submit the difference
          const additionalQuantity = item.quantity - originalItem.quantity;
          subtotalForCalculation += parseFloat(item.unitPrice) * additionalQuantity;
          return true;
        }
        
        return false; // Don't submit unchanged items
      });

      // For items with increased quantity, adjust the quantity to only the difference
      itemsToSubmit = itemsToSubmit.map((item) => {
        const originalItem = originalItems.find(
          (orig) => orig.dishId === item.dishId
        );
        
        if (originalItem && item.quantity > originalItem.quantity) {
          const additionalQuantity = item.quantity - originalItem.quantity;
          return {
            ...item,
            quantity: additionalQuantity
          };
        }
        
        return item;
      });
      console.log("Using PARTIAL UPDATE mode - sending only new/increased items");
    } else {
      // New order: calculate full subtotal
      subtotalForCalculation = calculateSubtotal();
      console.log("Creating NEW ORDER");
    }

    if (existingOrder && !useCompleteUpdate && itemsToSubmit.length === 0) {
      toast({
        title: "No new items",
        description: "No new items to add to the existing order",
        variant: "default",
      });
      return;
    }

    // Calculate taxes dynamically on new items only
    let totalTaxAmount = 0;
    const appliedTaxes = [];

    if (orderTaxes) {
      for (const tax of orderTaxes) {
        const taxAmount = (subtotalForCalculation * parseFloat(tax.rate)) / 100;
        totalTaxAmount += taxAmount;
        appliedTaxes.push({
          taxId: tax.id,
          taxName: tax.taxName,
          rate: tax.rate,
          amount: taxAmount.toFixed(2)
        });
      }
    }

    const total = subtotalForCalculation + totalTaxAmount;

    const orderData = {
      reservationId: selectedReservation.id,
      roomId: selectedReservation.reservationRooms?.[0]?.roomId || null,
      branchId,
      orderType: "room",
      customerName: `${selectedReservation.guest?.firstName || ""} ${selectedReservation.guest?.lastName || ""}`.trim(),
      customerPhone: selectedReservation.guest?.phone || "",
      subtotal: subtotalForCalculation.toFixed(2),
      taxAmount: totalTaxAmount.toFixed(2),
      appliedTaxes: appliedTaxes.length > 0 ? appliedTaxes : null,
      totalAmount: total.toFixed(2),
      notes: data.notes || "",
      status: "pending",
    };

    const itemsData = itemsToSubmit.map((item) => ({
      dishId: item.dishId,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice).toFixed(2),
      totalPrice: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
      specialInstructions: item.notes || null,
    }));

    console.log("Submitting room order:", { order: orderData, items: itemsData });
    console.log("Items to submit:", itemsToSubmit);
    console.log("Existing order:", existingOrder ? "Yes" : "No");
    console.log("Update mode:", useCompleteUpdate ? "COMPLETE" : "PARTIAL");

    createOrderMutation.mutate({ 
      order: orderData, 
      items: itemsData,
      isUpdate: useCompleteUpdate,
      orderId: useCompleteUpdate ? existingOrder.id : undefined
    });
  };

  const calculateSubtotal = () => {
    return selectedItems.reduce(
      (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
      0,
    );
  };

  const hasOrderChanged = () => {
    if (originalItems.length !== selectedItems.length) return true;
    
    // Check if any items were removed
    const hasRemovedItems = originalItems.some(original => 
      !selectedItems.find(selected => selected.dishId === original.dishId)
    );
    if (hasRemovedItems) return true;
    
    // Check if any items were added or modified
    return selectedItems.some(selected => {
      const originalItem = originalItems.find(orig => orig.dishId === selected.dishId);
      return (
        !originalItem ||
        selected.quantity !== originalItem.quantity ||
        selected.notes !== originalItem.notes
      );
    });
  };

  const needsCompleteUpdate = () => {
    // Complete update needed if items were deleted or this is a major change
    if (originalItems.length > selectedItems.length) return true;
    
    // Check if any items were removed
    const hasRemovedItems = originalItems.some(original => 
      !selectedItems.find(selected => selected.dishId === original.dishId)
    );
    
    return hasRemovedItems;
  };

  const addItemToOrder = (dish: any) => {
    const existingItemIndex = selectedItems.findIndex(
      (item) => item.dishId === dish.id,
    );

    if (existingItemIndex >= 0) {
      const updatedItems = [...selectedItems];
      updatedItems[existingItemIndex].quantity += 1;
      setSelectedItems(updatedItems);
    } else {
      const newItem = {
        dishId: dish.id,
        dishName: dish.name,
        unitPrice: dish.price,
        quantity: 1,
        notes: "",
      };
      setSelectedItems([...selectedItems, newItem]);
    }
  };

  const updateItemQuantity = (dishId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItemFromOrder(dishId);
      return;
    }

    const updatedItems = selectedItems.map((item) =>
      item.dishId === dishId ? { ...item, quantity } : item,
    );
    setSelectedItems(updatedItems);
  };

  const removeItemFromOrder = (dishId: number) => {
    setSelectedItems(selectedItems.filter((item) => item.dishId !== dishId));
  };

  const updateItemNotes = (dishId: number, notes: string) => {
    const updatedItems = selectedItems.map((item) =>
      item.dishId === dishId ? { ...item, notes } : item,
    );
    setSelectedItems(updatedItems);
  };

  const getReservationOrder = (reservationId: string) => {
    return orders?.find((order: any) => order.reservationId === reservationId);
  };

  // Get ALL orders for a reservation
  const getAllReservationOrders = (reservationId: string) => {
    return orders?.filter((order: any) => order.reservationId === reservationId) || [];
  };

  // Get ALL items from ALL orders for a reservation 
  const getAllReservationItems = (reservationId: string) => {
    const reservationOrders = getAllReservationOrders(reservationId);
    const allItems: any[] = [];
    
    reservationOrders.forEach((order: any) => {
      if (order.items) {
        order.items.forEach((item: any) => {
          // Check if we already have this dish in our combined list
          const existingItemIndex = allItems.findIndex(
            (existing) => existing.dishId === item.dishId
          );
          
          if (existingItemIndex >= 0) {
            // Add quantities if same dish exists
            allItems[existingItemIndex].quantity += item.quantity;
            allItems[existingItemIndex].totalPrice = 
              (parseFloat(allItems[existingItemIndex].unitPrice) * allItems[existingItemIndex].quantity).toFixed(2);
          } else {
            // Add new item
            allItems.push({
              ...item,
              dishName: item.dishName || `Dish ${item.dishId}`,
            });
          }
        });
      }
    });
    
    return allItems;
  };

  // Calculate total for ALL reservation orders
  const calculateAllReservationTotal = (reservationId: string) => {
    const allItems = getAllReservationItems(reservationId);
    return allItems.reduce(
      (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
      0
    );
  };

  // Update quantity for a previous order item
  const updatePreviousOrderItem = async (dishId: number, newQuantity: number) => {
    if (!selectedReservation) return;
    
    const reservationOrders = getAllReservationOrders(selectedReservation.id);
    
    // Find which order contains this dish
    for (const order of reservationOrders) {
      if (order.items) {
        const itemIndex = order.items.findIndex((item: any) => item.dishId === dishId);
        if (itemIndex >= 0) {
          // Update the item in this order
          const updatedItems = [...order.items];
          
          if (newQuantity <= 0) {
            // Remove the item if quantity is 0
            updatedItems.splice(itemIndex, 1);
          } else {
            // Update the quantity
            updatedItems[itemIndex] = {
              ...updatedItems[itemIndex],
              quantity: newQuantity,
              totalPrice: (parseFloat(updatedItems[itemIndex].unitPrice) * newQuantity).toFixed(2)
            };
          }
          
          // Calculate new order totals
          const newSubtotal = updatedItems.reduce((sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0);
          const newTotalAmount = newSubtotal; // Add tax calculation if needed
          
          // Update the order via API
          try {
            const response = await fetch(`/api/restaurant/orders/${order.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order: {
                  ...order,
                  subtotal: newSubtotal.toFixed(2),
                  totalAmount: newTotalAmount.toFixed(2)
                },
                items: updatedItems
              })
            });
            
            if (response.ok) {
              // Refresh orders data
              queryClient.invalidateQueries(["/api/restaurant/orders/room"]);
              toast({ title: "Order updated successfully", description: "Item quantity changed." });
            }
          } catch (error) {
            toast({ title: "Error", description: "Failed to update order", variant: "destructive" });
          }
          
          break; // Exit loop once we found and updated the item
        }
      }
    }
  };

  // Remove an item from previous orders
  const removePreviousOrderItem = async (dishId: number) => {
    await updatePreviousOrderItem(dishId, 0);
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      preparing: "bg-orange-100 text-orange-800",
      ready: "bg-green-100 text-green-800",
      served: "bg-purple-100 text-purple-800",
      completed: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  const filteredDishes = dishes?.filter((dish: any) => {
    // Filter by category
    if (selectedCategory !== "all" && dish.categoryId !== parseInt(selectedCategory)) {
      return false;
    }

    // Filter by diet type
    if (selectedDietFilter !== "all") {
      if (selectedDietFilter === "vegetarian" && !dish.isVegetarian) {
        return false;
      }
      if (selectedDietFilter === "vegan" && !dish.isVegan) {
        return false;
      }
      if (selectedDietFilter === "non-vegetarian" && (dish.isVegetarian || dish.isVegan)) {
        return false;
      }
    }

    // Filter by menu type (Food vs Bar)
    if (selectedMenuTypeFilter !== "all") {
      const category = categories?.find((cat: any) => cat.id === dish.categoryId);
      if (category && category.menuType !== selectedMenuTypeFilter) {
        return false;
      }
    }

    return true;
  });

  const checkedInReservations = reservations?.filter(
    (reservation: any) => reservation.status === "checked-in"
  ) || [];

  const handleReservationClick = (reservation: any) => {
    setSelectedReservation(reservation);
    setSelectedItems([]);
    setOriginalItems([]);
    setSelectedCategory("all");

    // If reservation has an existing order, load its items
    const existingOrder = getReservationOrder(reservation.id);
    if (existingOrder && existingOrder.items) {
      const orderItems = existingOrder.items.map((item: any) => ({
        dishId: item.dishId,
        dishName: item.dish?.name || "Unknown Dish",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        notes: item.specialInstructions || "",
      }));
      setSelectedItems(orderItems);
      setOriginalItems(JSON.parse(JSON.stringify(orderItems))); // Deep copy for comparison
    }
  };

  if (reservationsLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar
          isMobileMenuOpen={isMobileSidebarOpen}
          setIsMobileMenuOpen={setIsMobileSidebarOpen}
        />
        <div className="main-content">
          <Header
            title="Room Orders"
            subtitle="Manage room service orders"
            onMobileMenuToggle={() =>
              setIsMobileSidebarOpen(!isMobileSidebarOpen)
            }
          />
          <main className="p-6">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Show order interface for selected reservation
  if (selectedReservation) {
    const existingOrder = getReservationOrder(selectedReservation.id);

    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar
          isMobileMenuOpen={isMobileSidebarOpen}
          setIsMobileMenuOpen={setIsMobileSidebarOpen}
        />
        <div className="main-content">
          <Header
            title={`Room Order - ${selectedReservation.guest?.firstName} ${selectedReservation.guest?.lastName}`}
            subtitle={`Room ${selectedReservation.reservationRooms?.[0]?.room?.number} • ${selectedReservation.confirmationNumber}`}
            onMobileMenuToggle={() =>
              setIsMobileSidebarOpen(!isMobileSidebarOpen)
            }
          />
          <main className="p-6">
            {/* Back Button */}
            <div className="mb-6">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedReservation(null);
                  setSelectedItems([]);
                  setOriginalItems([]);
                }}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Reservations
              </Button>

              {existingOrder && (
                <Card className="mb-6 border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">
                          Existing Order #{existingOrder.orderNumber}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Status:{" "}
                          <Badge
                            className={getStatusColor(existingOrder.status)}
                          >
                            {existingOrder.status}
                          </Badge>
                        </p>
                        <p className="text-sm text-gray-600">
                          Total: {currencySymbol} {existingOrder.totalAmount}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingOrder(existingOrder)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateKOTBOTMutation.mutate(existingOrder.id)}
                          disabled={generateKOTBOTMutation.isPending}
                          className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          {generateKOTBOTMutation.isPending ? "Generating..." : "Generate KOT/BOT"}
                        </Button>
                        <Select
                          value={existingOrder.status}
                          onValueChange={(status) =>
                            updateStatusMutation.mutate({
                              id: existingOrder.id,
                              status,
                            })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="preparing">Preparing</SelectItem>
                            <SelectItem value="ready">Ready</SelectItem>
                            <SelectItem value="served">Served</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Menu Selection */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="space-y-3">
                      <CardTitle>Menu Items</CardTitle>

                      {/* Filter Controls */}
                      <div className="flex flex-wrap gap-3">
                        {/* Category Filter */}
                        <Select
                          value={selectedCategory}
                          onValueChange={setSelectedCategory}
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue placeholder="All Categories" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories?.map((category: any) => (
                              <SelectItem
                                key={category.id}
                                value={category.id.toString()}
                              >
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Diet Type Filter */}
                        <Select
                          value={selectedDietFilter}
                          onValueChange={setSelectedDietFilter}
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue placeholder="All Diet Types" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Diet Types</SelectItem>
                            <SelectItem value="vegetarian">Vegetarian</SelectItem>
                            <SelectItem value="vegan">Vegan</SelectItem>
                            <SelectItem value="non-vegetarian">Non-Vegetarian</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Menu Type Filter */}
                        <Select
                          value={selectedMenuTypeFilter}
                          onValueChange={setSelectedMenuTypeFilter}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="All Menus" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Menus</SelectItem>
                            <SelectItem value="Food">Food</SelectItem>
                            <SelectItem value="Bar">Bar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                      {filteredDishes?.map((dish: any) => (
                        <Card
                          key={dish.id}
                          className="hover:shadow-md transition-shadow cursor-pointer"
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-medium">{dish.name}</h4>
                                <p className="text-green-600 font-semibold">
                                  {currencySymbol} {dish.price}
                                </p>
                                {dish.description && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    {dish.description}
                                  </p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                onClick={() => addItemToOrder(dish)}
                                className="ml-2"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Order Summary */}
              <div>
                <Card className="sticky top-4">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Order Summary
                      {selectedItems.length > 0 && (
                        <Badge className="ml-2">{selectedItems.length}</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedItems.length === 0 && (!selectedReservation || getAllReservationItems(selectedReservation.id).length === 0) ? (
                      <div className="text-center py-8">
                        <ShoppingCart className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500">No items selected</p>
                      </div>
                    ) : (
                      <>
                        {/* Table-style order summary */}
                        <div className="border rounded-lg overflow-hidden mb-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[40%]">Item</TableHead>
                                <TableHead className="w-[20%] text-center">Price</TableHead>
                                <TableHead className="w-[25%] text-center">Quantity</TableHead>
                                <TableHead className="w-[15%] text-center">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(() => {
                                // Consolidate all items (previous orders + current editing) into one list
                                const consolidatedItems = new Map();
                                
                                // Add previous order items
                                if (selectedReservation) {
                                  const previousItems = getAllReservationItems(selectedReservation.id);
                                  previousItems.forEach((item) => {
                                    consolidatedItems.set(item.dishId, {
                                      ...item,
                                      isFromPreviousOrder: true
                                    });
                                  });
                                }
                                
                                // Add/update with current editing items
                                selectedItems.forEach((item) => {
                                  const existing = consolidatedItems.get(item.dishId);
                                  if (existing) {
                                    // Update existing item with current editing values
                                    consolidatedItems.set(item.dishId, {
                                      ...existing,
                                      quantity: item.quantity,
                                      notes: item.notes || existing.notes,
                                      isFromPreviousOrder: false, // Now being edited
                                      dishName: item.dishName || existing.dishName
                                    });
                                  } else {
                                    // Add new item
                                    consolidatedItems.set(item.dishId, {
                                      ...item,
                                      isFromPreviousOrder: false
                                    });
                                  }
                                });
                                
                                return Array.from(consolidatedItems.values()).map((item) => (
                                  <TableRow key={item.dishId}>
                                    <TableCell>
                                      <div>
                                        <div className="font-medium text-sm">{item.dishName}</div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center text-sm">
                                      {currencySymbol} {item.unitPrice}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center justify-center space-x-1">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            if (item.isFromPreviousOrder) {
                                              updatePreviousOrderItem(item.dishId, item.quantity - 1);
                                            } else {
                                              updateItemQuantity(item.dishId, item.quantity - 1);
                                            }
                                          }}
                                          className="h-6 w-6 p-0"
                                        >
                                          <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-8 text-center text-sm font-medium">
                                          {item.quantity}
                                        </span>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            if (item.isFromPreviousOrder) {
                                              updatePreviousOrderItem(item.dishId, item.quantity + 1);
                                            } else {
                                              updateItemQuantity(item.dishId, item.quantity + 1);
                                            }
                                          }}
                                          className="h-6 w-6 p-0"
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          if (item.isFromPreviousOrder) {
                                            removePreviousOrderItem(item.dishId);
                                          } else {
                                            removeItemFromOrder(item.dishId);
                                          }
                                        }}
                                        className="h-6 w-6 p-0 text-red-500"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ));
                              })()}
                            </TableBody>
                          </Table>
                        </div>

                        
<div className="border-t pt-4 space-y-2">
                          {(() => {
                            // Calculate totals using consolidated items (no duplicates)
                            const consolidatedItems = new Map();
                            
                            // Add previous order items
                            if (selectedReservation) {
                              const previousItems = getAllReservationItems(selectedReservation.id);
                              previousItems.forEach((item) => {
                                consolidatedItems.set(item.dishId, {
                                  ...item,
                                  quantity: item.quantity,
                                  unitPrice: parseFloat(item.unitPrice)
                                });
                              });
                            }
                            
                            // Add/update with current editing items
                            selectedItems.forEach((item) => {
                              consolidatedItems.set(item.dishId, {
                                ...item,
                                quantity: item.quantity,
                                unitPrice: parseFloat(item.unitPrice)
                              });
                            });
                            
                            // Calculate total from consolidated items
                            let allItemsTotal = 0;
                            let totalItemCount = 0;
                            Array.from(consolidatedItems.values()).forEach((item) => {
                              allItemsTotal += item.unitPrice * item.quantity;
                              totalItemCount += 1;
                            });
                            
                            let totalTaxAmount = 0;
                            const appliedTaxes = [];

                            // Calculate taxes on consolidated total
                            if (orderTaxes) {
                              for (const tax of orderTaxes) {
                                const taxAmount = (allItemsTotal * parseFloat(tax.rate)) / 100;
                                totalTaxAmount += taxAmount;
                                appliedTaxes.push({
                                  taxName: tax.taxName,
                                  rate: tax.rate,
                                  amount: taxAmount
                                });
                              }
                            }

                            return (
                              <>
                                {/* Show subtotal */}
                                <div className="flex justify-between text-sm font-medium">
                                  <span>Subtotal ({totalItemCount} items):</span>
                                  <span>{currencySymbol} {allItemsTotal.toFixed(2)}</span>
                                </div>

                                {/* Show taxes if any */}
                                {appliedTaxes.map((tax, index) => (
                                  <div key={index} className="flex justify-between text-sm text-gray-600">
                                    <span>{tax.taxName} ({tax.rate}%):</span>
                                    <span>{currencySymbol} {tax.amount.toFixed(2)}</span>
                                  </div>
                                ))}

                                {/* Show total */}
                                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                                  <span>Total Amount:</span>
                                  <span className="text-green-600">{currencySymbol} {(allItemsTotal + totalTaxAmount).toFixed(2)}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        <Form {...form}>
                          <form
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="mt-4 space-y-4"
                          >
                            <FormField
                              control={form.control}
                              name="notes"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Order Notes</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      {...field}
                                      placeholder="Special instructions..."
                                      className="h-20"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="submit"
                              className="w-full"
                              disabled={
                                createOrderMutation.isPending ||
                                selectedItems.length === 0 ||
                                (getReservationOrder(selectedReservation?.id) &&
                                  !hasOrderChanged())
                              }
                            >
                              {createOrderMutation.isPending ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                  {getReservationOrder(selectedReservation?.id)
                                    ? "Updating..."
                                    : "Creating..."}
                                </div>
                              ) : getReservationOrder(selectedReservation?.id) ? (
                                "Add Items to Order"
                              ) : (
                                "Create Order"
                              )}
                            </Button>
                          </form>
                        </Form>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Show reservations grid (similar to tables grid in restaurant orders)
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isMobileMenuOpen={isMobileSidebarOpen}
        setIsMobileMenuOpen={setIsMobileSidebarOpen}
      />
      <div className="main-content">
        <Header
          title="Room Service"
          subtitle="Click on a reservation to manage room orders"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
        />
        <main className="p-6">
          {/* Reservations Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {checkedInReservations.map((reservation: any) => {
              // Check if room has existing order linked to this reservation
              const hasOrder = orders?.some(order => 
                order.reservationId === reservation.id
              );

              const existingOrder = orders?.find(order => 
                order.reservationId === reservation.id
              );              return (
                <Card
                  key={reservation.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    hasOrder
                      ? "border-l-4 border-l-orange-500 bg-orange-50"
                      : "border-l-4 border-l-green-500 bg-green-50"
                  }`}
                  onClick={() => handleReservationClick(reservation)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Utensils
                          className={`h-5 w-5 ${hasOrder ? "text-orange-600" : "text-green-600"}`}
                        />
                        <h3 className="font-semibold text-lg">
                          {reservation.guest?.firstName} {reservation.guest?.lastName}
                        </h3>
                      </div>
                      <div
                        className={`w-3 h-3 rounded-full ${hasOrder ? "bg-orange-500" : "bg-green-500"}`}
                      ></div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2" />
                          <span>Room: {reservation.reservationRooms?.[0]?.room?.number || "N/A"}</span>
                        </div>
                        {hasOrder && existingOrder && (
                          <Badge className={getStatusColor(existingOrder.status)}>
                            {existingOrder.status}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm text-gray-600">
                          {reservation.confirmationNumber}
                        </p>
                        <p className="text-sm text-gray-600">
                          Phone: {reservation.guest?.phone || "N/A"}
                        </p>
                      </div>

                      {hasOrder && existingOrder && (
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">
                            Order #{existingOrder.orderNumber}
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-green-600">
                              {currencySymbol} {existingOrder.totalAmount}
                            </p>
                            <p className="text-xs text-gray-500">
                              {existingOrder.items?.length || 0} items
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {!checkedInReservations?.length && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 font-medium">No checked-in guests</p>
              <p className="text-sm text-gray-400">
                Guests need to be checked in to place room service orders.
              </p>
            </div>
          )}

          {/* View Order Modal */}
          {viewingOrder && (
            <Dialog
              open={!!viewingOrder}
              onOpenChange={() => setViewingOrder(null)}
            >
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    Order Details - #{viewingOrder.orderNumber}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Customer:
                      </p>
                      <p className="font-semibold">
                        {viewingOrder.customerName}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Room:
                      </p>
                      <p className="font-semibold">
                        Room {viewingOrder.roomId || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Status:
                      </p>
                      <Badge className={getStatusColor(viewingOrder.status)}>
                        {viewingOrder.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Total:
                      </p>
                      <p className="font-bold text-green-600">
                        {currencySymbol} {viewingOrder.totalAmount}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Order Items</h4>
                    <div className="space-y-2">
                      {viewingOrder.items?.map((item: any) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center p-2 bg-gray-50 rounded"
                        >
                          <div>
                            <p className="font-medium">{item.dish?.name || `Item ${item.dishId}`}</p>
                            <p className="text-sm text-gray-600">
                              Qty: {item.quantity} × {currencySymbol} {item.unitPrice}
                            </p>
                            {item.specialInstructions && (
                              <p className="text-xs text-gray-600 italic">{item.specialInstructions}</p>
                            )}
                          </div>
                          <p className="font-semibold text-green-600">
                            {currencySymbol} {(
                              parseFloat(item.unitPrice) * item.quantity
                            ).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {viewingOrder.notes && (
                    <div>
                      <h4 className="font-semibold mb-2">Notes</h4>
                      <p className="text-gray-700 bg-gray-50 p-2 rounded">
                        {viewingOrder.notes}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() =>
                        generateKOTBOTMutation.mutate(viewingOrder.id)
                      }
                      variant="outline"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate KOT/BOT
                    </Button>
                    <Button
                      onClick={() => setViewingOrder(null)}
                      variant="outline"
                    >
                      Close
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

    function calculateNewItemsSubtotal() {
        // Calculate subtotal only for new items or additional quantities
        return selectedItems.reduce((sum, item) => {
            const originalItem = originalItems.find(orig => orig.dishId === item.dishId);
            
            if (!originalItem) {
                // Completely new item
                return sum + parseFloat(item.unitPrice) * item.quantity;
            } else if (item.quantity > originalItem.quantity) {
                // Item with increased quantity - only count the additional quantity
                const additionalQuantity = item.quantity - originalItem.quantity;
                return sum + parseFloat(item.unitPrice) * additionalQuantity;
            }
            
            // No change or decreased quantity - don't count
            return sum;
        }, 0);
    }
}