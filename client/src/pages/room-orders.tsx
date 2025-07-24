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
  AlertCircle,
  Save,
  X,
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
  // Deferred update state - track pending changes without immediate API calls
  const [pendingUpdates, setPendingUpdates] = useState<Map<number, { orderId: string; newQuantity: number; originalQuantity: number }>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
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
        // Use POST endpoint for new orders
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

      // Check if order was deleted (when all items were removed)
      if (data?.deleted) {
        toast({
          title: "Order deleted",
          description: "All items were removed, so the order has been deleted.",
        });
        
        // Clear the form and go back to reservations list
        setSelectedReservation(null);
        setSelectedItems([]);
        setOriginalItems([]);
        setPendingUpdates(new Map());
        setHasUnsavedChanges(false);
        return;
      }

      // Always generate KOT/BOT for new orders
      if (data?.id) {
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
          title: "Room order updated successfully",
          description: "Your order has been updated!",
        });
      }

      // Clear the form and go back to reservations list for new orders
      if (!data?.deleted) {
        setSelectedReservation(null);
        setSelectedItems([]);
        setOriginalItems([]);
        setPendingUpdates(new Map());
        setHasUnsavedChanges(false);
      }
    },
    onError: (error: any) => {
      console.error("Room order operation failed:", error);
      toast({
        title: "Failed to process room order",
        description:
          error.message || "An error occurred while processing the order",
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

    if (!selectedReservation) {
      toast({
        title: "Error",
        description: "No reservation selected",
        variant: "destructive",
      });
      return;
    }

    // For room service, only create orders with NEW items that have been added
    // Don't include existing items or deleted items
    
    // Get only NEW items that are not marked for deletion and have quantity > 0
    const newItemsOnly = selectedItems.filter(item => 
      !item.markedForDeletion && 
      item.quantity > 0 &&
      !getAllReservationItems(selectedReservation.id).some(existing => existing.dishId === item.dishId)
    );

    // Also include modified existing items (quantity changes)
    const modifiedExistingItems = selectedItems.filter(item => {
      if (item.markedForDeletion) return false;
      if (item.quantity <= 0) return false;
      
      // Check if this is a modification of an existing item
      const existingItem = getAllReservationItems(selectedReservation.id).find(existing => existing.dishId === item.dishId);
      if (existingItem && existingItem.quantity !== item.quantity) {
        // Calculate the difference - only order the additional quantity
        const additionalQuantity = item.quantity - existingItem.quantity;
        if (additionalQuantity > 0) {
          return true;
        }
      }
      return false;
    });

    // Prepare final items for the new order
    const finalItems = [
      ...newItemsOnly,
      ...modifiedExistingItems.map(item => {
        const existingItem = getAllReservationItems(selectedReservation.id).find(existing => existing.dishId === item.dishId);
        const additionalQuantity = item.quantity - (existingItem?.quantity || 0);
        return {
          ...item,
          quantity: additionalQuantity > 0 ? additionalQuantity : item.quantity
        };
      })
    ];

    if (finalItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the order",
        variant: "destructive",
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

    // Calculate subtotal from final items
    const subtotalForCalculation = finalItems.reduce(
      (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
      0
    );

    console.log("Creating NEW ORDER");
    console.log("Final items count:", finalItems.length);
    console.log("Subtotal:", subtotalForCalculation);

    // Calculate taxes
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

    const itemsData = finalItems.map((item) => ({
      dishId: item.dishId,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice).toFixed(2),
      totalPrice: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
      specialInstructions: item.notes || null,
    }));

    console.log("Submitting NEW room order:", { order: orderData, items: itemsData });
    console.log("Items to submit:", finalItems);

    // Always create new order - never update existing ones
    createOrderMutation.mutate({ 
      order: orderData, 
      items: itemsData,
      isUpdate: false,
      orderId: undefined
    });
  };

  const calculateSubtotal = () => {
    return selectedItems.reduce(
      (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
      0,
    );
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

    // Find the dish details for creating new items
    const dish = dishes?.find((d: any) => d.id === dishId);
    const dishName = dish?.name || `Dish ${dishId}`;
    const unitPrice = dish?.price || "0.00";

    // Check if this item already exists in selectedItems
    const existingSelectedItemIndex = selectedItems.findIndex(item => item.dishId === dishId);
    
    if (existingSelectedItemIndex >= 0) {
      // Update existing selected item
      setSelectedItems(prev => prev.map((item, index) => 
        index === existingSelectedItemIndex
          ? { ...item, quantity, markedForDeletion: false }
          : item
      ));
    } else {
      // Add new item to selectedItems
      const newItem = {
        dishId,
        dishName,
        quantity,
        unitPrice,
        notes: "",
        markedForDeletion: false
      };
      setSelectedItems(prev => [...prev, newItem]);
    }
  };

  const removeItemFromOrder = (dishId: number) => {
    // Simply remove the item from the current order selection
    // This doesn't affect existing orders - only the current order being built
    setSelectedItems(prev => prev.filter(item => item.dishId !== dishId));
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
              dishName: item.dishName || item.dish?.name || `Dish ${item.dishId}`,
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

  // Stage a quantity change for later batch update (deferred)
  const stagePendingUpdate = (dishId: number, newQuantity: number) => {
    if (!selectedReservation) return;

    const reservationOrders = getAllReservationOrders(selectedReservation.id);
    
    // Find which order contains this dish
    for (const order of reservationOrders) {
      if (order.items) {
        const item = order.items.find((item: any) => item.dishId === dishId);
        if (item) {
          setPendingUpdates(prev => {
            const newMap = new Map(prev);
            if (newQuantity <= 0) {
              newMap.set(dishId, { orderId: order.id, newQuantity: 0, originalQuantity: item.quantity });
            } else {
              newMap.set(dishId, { orderId: order.id, newQuantity, originalQuantity: item.quantity });
            }
            return newMap;
          });
          setHasUnsavedChanges(true);
          break;
        }
      }
    }
  };

  // Get the current effective quantity including pending changes
  const getEffectiveQuantity = (dishId: number, originalQuantity: number) => {
    const pendingUpdate = pendingUpdates.get(dishId);
    return pendingUpdate ? pendingUpdate.newQuantity : originalQuantity;
  };

  // Remove an item (stage for deletion)
  const removePreviousOrderItem = (dishId: number) => {
    stagePendingUpdate(dishId, 0);
  };

  // Apply all pending updates in a batch
  const applyPendingUpdates = async () => {
    if (pendingUpdates.size === 0) return;

    try {
      // Group updates by order ID
      const updatesByOrder = new Map<string, any[]>();
      
      for (const [dishId, updateInfo] of pendingUpdates.entries()) {
        if (!updatesByOrder.has(updateInfo.orderId)) {
          updatesByOrder.set(updateInfo.orderId, []);
        }
        updatesByOrder.get(updateInfo.orderId)!.push({
          dishId,
          newQuantity: updateInfo.newQuantity
        });
      }

      let deletedOrders = 0;
      let updatedOrders = 0;

      // Apply updates to each order
      for (const [orderId, updates] of updatesByOrder.entries()) {
        const order = orders?.find((o: any) => o.id === orderId);
        if (!order) continue;

        // Apply all quantity changes to this order's items
        const updatedItems = order.items.map((item: any) => {
          const update = updates.find(u => u.dishId === item.dishId);
          if (update) {
            if (update.newQuantity <= 0) {
              return null; // Mark for removal
            }
            return {
              ...item,
              quantity: update.newQuantity,
              totalPrice: (parseFloat(item.unitPrice) * update.newQuantity).toFixed(2)
            };
          }
          return item;
        }).filter(Boolean); // Remove null items

        // Calculate new order totals
        const newSubtotal = updatedItems.reduce((sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0);
        const newTotalAmount = newSubtotal;

        // Update the order via API
        const response = await fetch(`/api/restaurant/orders/${orderId}`, {
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

        if (!response.ok) {
          throw new Error(`Failed to update order ${orderId}`);
        }

        const responseData = await response.json();
        
        // Check if order was deleted due to all items being removed
        if (responseData.deleted) {
          deletedOrders++;
        } else {
          updatedOrders++;
        }
      }

      // Clear pending updates and refresh data
      setPendingUpdates(new Map());
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries(["/api/restaurant/orders/room"]);
      
      // Show appropriate success message
      if (deletedOrders > 0 && updatedOrders > 0) {
        toast({ 
          title: "Orders processed successfully", 
          description: `${updatedOrders} order(s) updated, ${deletedOrders} order(s) deleted (all items removed).` 
        });
      } else if (deletedOrders > 0) {
        toast({ 
          title: "Orders deleted successfully", 
          description: `${deletedOrders} order(s) deleted because all items were removed.` 
        });
      } else {
        toast({ 
          title: "Orders updated successfully", 
          description: `Updated ${pendingUpdates.size} item(s) across ${updatedOrders} order(s).` 
        });
      }

    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to update some orders. Please try again.", 
        variant: "destructive" 
      });
    }
  };

  // Discard all pending changes
  const discardPendingUpdates = () => {
    setPendingUpdates(new Map());
    setHasUnsavedChanges(false);
    toast({ title: "Changes discarded", description: "All pending changes have been reset." });
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

    // Always start with an empty order form for room service
    // This ensures each order is separate for billing purposes
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
                                // Show ALL orders for this reservation
                                const allReservationItems = selectedReservation ? getAllReservationItems(selectedReservation.id) : [];
                                const allDisplayItems = [...allReservationItems];

                                // Add new items being built for current order
                                selectedItems.forEach(newItem => {
                                  const existingIndex = allDisplayItems.findIndex(item => item.dishId === newItem.dishId);
                                  if (existingIndex >= 0) {
                                    // Combine quantities if same dish exists
                                    allDisplayItems[existingIndex] = {
                                      ...allDisplayItems[existingIndex],
                                      quantity: allDisplayItems[existingIndex].quantity + newItem.quantity,
                                      totalPrice: (parseFloat(allDisplayItems[existingIndex].unitPrice) * 
                                        (allDisplayItems[existingIndex].quantity + newItem.quantity)).toFixed(2),
                                      isNewItem: true // Mark as new to show different styling
                                    };
                                  } else {
                                    // Add as new item
                                    allDisplayItems.push({
                                      ...newItem,
                                      isNewItem: true,
                                      totalPrice: (parseFloat(newItem.unitPrice) * newItem.quantity).toFixed(2)
                                    });
                                  }
                                });

                                if (allDisplayItems.length === 0) {
                                  return (
                                    <TableRow>
                                      <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                        No orders placed yet
                                      </TableCell>
                                    </TableRow>
                                  );
                                }

                                return allDisplayItems.map((item, index) => (
                                  <TableRow 
                                    key={`all-item-${item.dishId}-${index}`}
                                    className={item.isNewItem ? "bg-blue-50" : ""}
                                  >
                                    <TableCell>
                                      <div className="font-medium text-sm">
                                        {item.dishName}
                                        {item.isNewItem && (
                                          <Badge variant="secondary" className="ml-2 text-xs">New</Badge>
                                        )}
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
                                            if (item.isNewItem) {
                                              // Handle new item quantity change
                                              const currentSelectedItem = selectedItems.find(si => si.dishId === item.dishId);
                                              if (currentSelectedItem) {
                                                const newQuantity = Math.max(1, currentSelectedItem.quantity - 1);
                                                updateItemQuantity(item.dishId, newQuantity);
                                              }
                                            } else {
                                              // Handle existing item quantity change (deferred)
                                              const currentEffectiveQuantity = getEffectiveQuantity(item.dishId, item.quantity);
                                              const newQuantity = Math.max(0, currentEffectiveQuantity - 1);
                                              stagePendingUpdate(item.dishId, newQuantity);
                                            }
                                          }}
                                          className="h-6 w-6 p-0"
                                        >
                                          <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-8 text-center text-sm font-medium">
                                          {item.isNewItem ? item.quantity : getEffectiveQuantity(item.dishId, item.quantity)}
                                        </span>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            if (item.isNewItem) {
                                              // Handle new item quantity change
                                              const currentSelectedItem = selectedItems.find(si => si.dishId === item.dishId);
                                              if (currentSelectedItem) {
                                                const newQuantity = currentSelectedItem.quantity + 1;
                                                updateItemQuantity(item.dishId, newQuantity);
                                              }
                                            } else {
                                              // Handle existing item quantity change (deferred)
                                              const currentEffectiveQuantity = getEffectiveQuantity(item.dishId, item.quantity);
                                              const newQuantity = currentEffectiveQuantity + 1;
                                              stagePendingUpdate(item.dishId, newQuantity);
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
                                          if (item.isNewItem) {
                                            // Remove from current order
                                            removeItemFromOrder(item.dishId);
                                          } else {
                                            // Remove from previous orders (deferred)
                                            removePreviousOrderItem(item.dishId);
                                          }
                                        }}
                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                        title="Remove from order"
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
                            // Calculate totals for ALL orders (existing + new)
                            const allReservationItems = selectedReservation ? getAllReservationItems(selectedReservation.id) : [];
                            let allOrdersSubtotal = 0;
                            let allOrdersItemCount = 0;
                            
                            // Add existing orders total
                            allReservationItems.forEach(item => {
                              allOrdersSubtotal += parseFloat(item.unitPrice) * item.quantity;
                              allOrdersItemCount += item.quantity;
                            });

                            // Calculate new order items total separately
                            let newOrderSubtotal = 0;
                            let newOrderItemCount = 0;
                            
                            selectedItems.forEach(item => {
                              newOrderSubtotal += parseFloat(item.unitPrice) * item.quantity;
                              newOrderItemCount += item.quantity;
                            });

                            const combinedSubtotal = allOrdersSubtotal + newOrderSubtotal;
                            const combinedItemCount = allOrdersItemCount + newOrderItemCount;

                            // Calculate taxes on combined total
                            let totalTaxAmount = 0;
                            const appliedTaxes = [];

                            if (orderTaxes) {
                              for (const tax of orderTaxes) {
                                const taxAmount = (combinedSubtotal * parseFloat(tax.rate)) / 100;
                                totalTaxAmount += taxAmount;
                                appliedTaxes.push({
                                  taxName: tax.taxName,
                                  rate: tax.rate,
                                  amount: taxAmount
                                });
                              }
                            }

                            const combinedTotal = combinedSubtotal + totalTaxAmount;

                            return (
                              <>
                                {allOrdersSubtotal > 0 && (
                                  <div className="flex justify-between text-sm text-gray-600">
                                    <span>Previous Orders ({allOrdersItemCount} items):</span>
                                    <span>{currencySymbol} {allOrdersSubtotal.toFixed(2)}</span>
                                  </div>
                                )}
                                
                                {newOrderSubtotal > 0 && (
                                  <div className="flex justify-between text-sm text-blue-600">
                                    <span>New Order ({newOrderItemCount} items):</span>
                                    <span>{currencySymbol} {newOrderSubtotal.toFixed(2)}</span>
                                  </div>
                                )}

                                <div className="flex justify-between text-sm font-medium">
                                  <span>Total Items ({combinedItemCount}):</span>
                                  <span>{currencySymbol} {combinedSubtotal.toFixed(2)}</span>
                                </div>

                                {appliedTaxes.map((tax, index) => (
                                  <div key={index} className="flex justify-between text-sm text-gray-600">
                                    <span>{tax.taxName} ({tax.rate}%):</span>
                                    <span>{currencySymbol} {tax.amount.toFixed(2)}</span>
                                  </div>
                                ))}

                                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                                  <span>Grand Total:</span>
                                  <span className="text-green-600">{currencySymbol} {combinedTotal.toFixed(2)}</span>
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

                            {/* Smart Update Order Button */}
                            <div className="space-y-3">
                              {(hasUnsavedChanges || selectedItems.length > 0) && (
                                <div className="flex items-center justify-between text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                                  <div className="flex items-center">
                                    <AlertCircle className="h-4 w-4 mr-2" />
                                    <span>
                                      {hasUnsavedChanges && selectedItems.length > 0
                                        ? `${pendingUpdates.size} pending change(s) + ${selectedItems.length} new item(s)`
                                        : hasUnsavedChanges
                                        ? `${pendingUpdates.size} pending change(s)`
                                        : `${selectedItems.length} new item(s)`}
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div className="flex space-x-2">
                                <Button
                                  type="button"
                                  onClick={async () => {
                                    // Handle both pending updates and new orders
                                    if (hasUnsavedChanges) {
                                      await applyPendingUpdates();
                                    }
                                    
                                    // If there are new items, create a new order
                                    if (selectedItems.length > 0) {
                                      form.handleSubmit(onSubmit)();
                                    }
                                  }}
                                  className="flex-1"
                                  disabled={
                                    createOrderMutation.isPending ||
                                    (!hasUnsavedChanges && selectedItems.length === 0)
                                  }
                                >
                                  {createOrderMutation.isPending ? (
                                    <div className="flex items-center">
                                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                      {hasUnsavedChanges && selectedItems.length > 0
                                        ? "Processing..."
                                        : hasUnsavedChanges
                                        ? "Updating..."
                                        : "Creating..."}
                                    </div>
                                  ) : (
                                    <>
                                      {hasUnsavedChanges && selectedItems.length > 0 ? (
                                        <>
                                          <Save className="h-4 w-4 mr-2" />
                                          Update Order & Create New
                                        </>
                                      ) : hasUnsavedChanges ? (
                                        <>
                                          <Save className="h-4 w-4 mr-2" />
                                          Update Order
                                        </>
                                      ) : (
                                        <>
                                          <Plus className="h-4 w-4 mr-2" />
                                          Create New Order
                                        </>
                                      )}
                                    </>
                                  )}
                                </Button>

                                {(hasUnsavedChanges || selectedItems.length > 0) && (
                                  <Button 
                                    type="button"
                                    variant="outline" 
                                    onClick={() => {
                                      if (hasUnsavedChanges) {
                                        discardPendingUpdates();
                                      }
                                      if (selectedItems.length > 0) {
                                        setSelectedItems([]);
                                        form.reset();
                                      }
                                    }}
                                    disabled={createOrderMutation.isPending}
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Reset
                                  </Button>
                                )}
                              </div>
                            </div>
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
              // Get ALL orders for this reservation to calculate cumulative totals
              const reservationOrders = orders?.filter(order => 
                order.reservationId === reservation.id
              ) || [];
              
              const hasOrder = reservationOrders.length > 0;
              
              // Calculate cumulative totals for ALL orders
              let totalAmount = 0;
              let totalItems = 0;
              let latestOrderNumber = '';
              let latestStatus = 'pending';
              
              reservationOrders.forEach(order => {
                totalAmount += parseFloat(order.totalAmount || '0');
                totalItems += order.items?.length || 0;
                // Use the latest order's details for display
                if (!latestOrderNumber || new Date(order.createdAt) > new Date(latestOrderNumber)) {
                  latestOrderNumber = order.orderNumber;
                  latestStatus = order.status;
                }
              });              return (
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
                        {hasOrder && (
                          <Badge className={getStatusColor(latestStatus)}>
                            {latestStatus}
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

                      {hasOrder && (
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">
                            {reservationOrders.length === 1 
                              ? `Order #${latestOrderNumber}`
                              : `${reservationOrders.length} Orders (Latest: #${latestOrderNumber})`
                            }
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-green-600">
                              {currencySymbol} {totalAmount.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {totalItems} items total
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