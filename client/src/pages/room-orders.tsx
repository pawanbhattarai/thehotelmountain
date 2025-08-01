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
  Package,
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

interface CartItem {
  dishId: number;
  dishName: string;
  quantity: number;
  unitPrice: string;
  notes: string;
  isNewItem: boolean; // true for new items, false for existing order items
  originalOrderItemId?: number; // for existing items that are being modified
}

export default function RoomOrders() {
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDietFilter, setSelectedDietFilter] = useState<string>("all");
  const [selectedMenuTypeFilter, setSelectedMenuTypeFilter] =
    useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/restaurant/orders/room"],
    refetchInterval: 2000,
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

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });
  const currencySymbol = (settings as any)?.currency || "Rs.";

  // Get hotel settings for timezone
  const { data: hotelSettings } = useQuery({
    queryKey: ["/api/hotel-settings"],
  });
  const timeZone = (hotelSettings as any)?.timeZone || "Asia/Kathmandu";

  // Utility function to format dates in hotel's timezone
  const formatDateInTimezone = (dateString: string, timeZone: string) => {
    if (!dateString) {
      console.log("🕐 No dateString provided");
      return "N/A";
    }

    try {
      const date = new Date(dateString);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error(`🕐 Invalid date: ${dateString}`);
        return "Invalid Date";
      }

      console.log(
        `🕐 Formatting timestamp: "${dateString}" in timezone: "${timeZone}"`,
      );
      console.log(`🕐 Original date object: ${date.toString()}`);

      // Use the hotel's timezone to format the timestamp
      const safeTimeZone =
        timeZone && timeZone.trim() !== "" ? timeZone : "Asia/Kathmandu";

      // Format using Intl.DateTimeFormat with the hotel's timezone
      const formatted = new Intl.DateTimeFormat("en-GB", {
        timeZone: safeTimeZone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);

      console.log(`🕐 Formatted in ${safeTimeZone}: "${formatted}"`);

      return formatted;
    } catch (error) {
      console.error("🕐 Error formatting date:", error);
      return dateString; // Return original string if formatting fails
    }
  };

  // Create new order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (data: { order: any; items: any[] }) => {
      const response = await fetch("/api/restaurant/orders/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create room order");
      }
      return response.json();
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/restaurant/orders/room"],
      });

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
      }

      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create room order",
        description:
          error.message || "An error occurred while creating the order",
        variant: "destructive",
      });
    },
  });

  // Update existing order item mutation
  const updateOrderItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      quantity,
      totalPrice,
    }: {
      itemId: number;
      quantity: number;
      totalPrice: string;
    }) => {
      const response = await fetch(`/api/restaurant/order-items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, totalPrice }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update order item");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/restaurant/orders/room"],
      });
    },
  });

  // Delete existing order item mutation
  const deleteOrderItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const response = await fetch(`/api/restaurant/order-items/${itemId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete order item");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/restaurant/orders/room"],
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
      queryClient.invalidateQueries({
        queryKey: ["/api/restaurant/orders/room"],
      });
      toast({ title: "Order status updated" });
    },
  });

  const generateKOTBOTMutation = useMutation({
    mutationFn: async (orderId: string) => {
      console.log(`🎫 Generating KOT/BOT for order ID: ${orderId}`);

      const response = await fetch(
        `/api/restaurant/orders/${orderId}/kot-bot`,
        {
          method: "POST",
          credentials: "include", // Include session cookies
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      console.log(`🎫 KOT/BOT response status: ${response.status}`);

      if (!response.ok) {
        const error = await response.json();
        console.error(`🎫 KOT/BOT error:`, error);
        throw new Error(error.message || "Failed to generate KOT/BOT");
      }

      const result = await response.json();
      console.log(`🎫 KOT/BOT result:`, result);
      return result;
    },
    onSuccess: (data) => {
      console.log(`🎫 KOT/BOT generation successful:`, data);

      queryClient.invalidateQueries({
        queryKey: ["/api/restaurant/orders/room"],
      });
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
        title: data.message || "KOT/BOT Generated Successfully",
        description: description,
      });
    },
    onError: (error: any) => {
      console.error(`🎫 KOT/BOT generation failed:`, error);
      toast({
        title: "Failed to generate KOT/BOT",
        description:
          error.message || "An error occurred while generating KOT/BOT",
        variant: "destructive",
      });
    },
  });

  // New mutation for reservation-based KOT/BOT generation
  const generateReservationKOTBOTMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      console.log(`🎫 Generating KOT/BOT for reservation ID: ${reservationId}`);

      const response = await fetch(
        `/api/restaurant/reservations/${reservationId}/kot-bot`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      console.log(`🎫 Reservation KOT/BOT response status: ${response.status}`);

      if (!response.ok) {
        const error = await response.json();
        console.error(`🎫 Reservation KOT/BOT error:`, error);
        throw new Error(
          error.message || "Failed to generate KOT/BOT for reservation",
        );
      }

      const result = await response.json();
      console.log(`🎫 Reservation KOT/BOT result:`, result);
      return result;
    },
    onSuccess: (data) => {
      console.log(`🎫 Reservation KOT/BOT generation successful:`, data);

      queryClient.invalidateQueries({
        queryKey: ["/api/restaurant/orders/room"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/kot"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/bot"] });

      toast({
        title: data.message || "KOT/BOT Generated Successfully",
        description:
          data.description || "Tickets generated for all orders in reservation",
      });
    },
    onError: (error: any) => {
      console.error(`🎫 Reservation KOT/BOT generation failed:`, error);
      toast({
        title: "Failed to generate KOT/BOT",
        description:
          error.message ||
          "An error occurred while generating KOT/BOT for reservation",
        variant: "destructive",
      });
    },
  });

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      reservationId: "",
      branchId:
        (user as any)?.role === "superadmin" ? 1 : (user as any)?.branchId || 1,
      items: [],
      notes: "",
    },
  });

  // Helper functions
  const resetForm = () => {
    setSelectedReservation(null);
    setCartItems([]);
    setSearchTerm("");
    setSelectedCategory("all");
    setSelectedDietFilter("all");
    setSelectedMenuTypeFilter("all");
    form.reset();
  };

  const getReservationOrders = (reservationId: string) => {
    return (
      (orders as any[])?.filter(
        (order: any) => order.reservationId === reservationId,
      ) || []
    );
  };

  const getAllReservationItems = (reservationId: string) => {
    const reservationOrders = getReservationOrders(reservationId);
    const allItems: any[] = [];

    reservationOrders.forEach((order: any) => {
      if (order.items) {
        order.items.forEach((item: any) => {
          allItems.push({
            ...item,
            dishName: item.dish?.name || `Dish ${item.dishId}`,
            orderItemId: item.id,
            orderId: order.id,
          });
        });
      }
    });

    return allItems;
  };

  // CRUD Operations for cart items
  const addItemToCart = (dish: any) => {
    const existingIndex = cartItems.findIndex(
      (item) => item.dishId === dish.id,
    );

    if (existingIndex >= 0) {
      // Increase quantity of existing cart item
      const updatedItems = [...cartItems];
      updatedItems[existingIndex].quantity += 1;
      setCartItems(updatedItems);
    } else {
      // Add new item to cart
      const newItem: CartItem = {
        dishId: dish.id,
        dishName: dish.name,
        quantity: 1,
        unitPrice: dish.price,
        notes: "",
        isNewItem: true,
      };
      setCartItems([...cartItems, newItem]);
    }
  };

  const updateCartItemQuantity = (dishId: number, quantity: number) => {
    if (quantity <= 0) {
      removeCartItem(dishId);
      return;
    }

    setCartItems((prev) =>
      prev.map((item) =>
        item.dishId === dishId ? { ...item, quantity } : item,
      ),
    );
  };

  const removeCartItem = (dishId: number) => {
    setCartItems((prev) => prev.filter((item) => item.dishId !== dishId));
  };

  const updateCartItemNotes = (dishId: number, notes: string) => {
    setCartItems((prev) =>
      prev.map((item) => (item.dishId === dishId ? { ...item, notes } : item)),
    );
  };

  // CRUD Operations for existing order items
  const addExistingItemToCart = (existingItem: any) => {
    const cartItem: CartItem = {
      dishId: existingItem.dishId,
      dishName: existingItem.dishName,
      quantity: existingItem.quantity,
      unitPrice: existingItem.unitPrice,
      notes: existingItem.specialInstructions || "",
      isNewItem: false,
      originalOrderItemId: existingItem.orderItemId,
    };

    setCartItems((prev) => [...prev, cartItem]);
  };

  const updateExistingItemQuantity = async (
    orderItemId: number,
    newQuantity: number,
    unitPrice: string,
  ) => {
    const totalPrice = (parseFloat(unitPrice) * newQuantity).toFixed(2);

    try {
      await updateOrderItemMutation.mutateAsync({
        itemId: orderItemId,
        quantity: newQuantity,
        totalPrice,
      });

      // Update cart item quantity if it exists in cart
      setCartItems((prev) =>
        prev.map((cartItem) =>
          cartItem.originalOrderItemId === orderItemId
            ? { ...cartItem, quantity: newQuantity }
            : cartItem,
        ),
      );

      toast({ title: "Item quantity updated successfully" });
    } catch (error: any) {
      toast({
        title: "Failed to update item quantity",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteExistingItem = async (orderItemId: number) => {
    try {
      await deleteOrderItemMutation.mutateAsync(orderItemId);

      // Remove from cart if it exists there
      setCartItems((prev) =>
        prev.filter((item) => item.originalOrderItemId !== orderItemId),
      );

      toast({ title: "Item deleted successfully" });
    } catch (error: any) {
      toast({
        title: "Failed to delete item",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const onSubmit = (data: OrderFormData) => {
    if (!selectedReservation) {
      toast({
        title: "Error",
        description: "No reservation selected",
        variant: "destructive",
      });
      return;
    }

    // Only create order for new items
    const newItems = cartItems.filter((item) => item.isNewItem);

    if (newItems.length === 0) {
      toast({
        title: "Error",
        description: "No new items to add",
        variant: "destructive",
      });
      return;
    }

    let branchId: number;
    if ((user as any)?.role === "superadmin") {
      branchId = (branches as any[])?.[0]?.id || 1;
    } else {
      branchId = (user as any)?.branchId || 1;
    }

    const subtotal = newItems.reduce(
      (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
      0,
    );

    let totalTaxAmount = 0;
    const appliedTaxes = [];

    if (orderTaxes) {
      for (const tax of orderTaxes as any[]) {
        const taxAmount = (subtotal * parseFloat(tax.rate)) / 100;
        totalTaxAmount += taxAmount;
        appliedTaxes.push({
          taxId: tax.id,
          taxName: tax.taxName,
          rate: tax.rate,
          amount: taxAmount.toFixed(2),
        });
      }
    }

    const total = subtotal + totalTaxAmount;

    const orderData = {
      reservationId: selectedReservation.id,
      roomId: selectedReservation.reservationRooms?.[0]?.roomId || null,
      branchId,
      orderType: "room",
      customerName:
        `${selectedReservation.guest?.firstName || ""} ${selectedReservation.guest?.lastName || ""}`.trim(),
      customerPhone: selectedReservation.guest?.phone || "",
      subtotal: subtotal.toFixed(2),
      taxAmount: totalTaxAmount.toFixed(2),
      appliedTaxes: appliedTaxes.length > 0 ? appliedTaxes : null,
      totalAmount: total.toFixed(2),
      notes: data.notes || "",
      status: "pending",
    };

    const itemsData = newItems.map((item) => ({
      dishId: item.dishId,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice).toFixed(2),
      totalPrice: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
      specialInstructions: item.notes || null,
    }));

    createOrderMutation.mutate({ order: orderData, items: itemsData });
  };

  const calculateCartSubtotal = () => {
    return cartItems.reduce(
      (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
      0,
    );
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

  const filteredDishes = (dishes as any[])?.filter((dish: any) => {
    // Search filter
    if (searchTerm.trim() !== "") {
      const searchLower = searchTerm.toLowerCase();
      const nameMatch = dish.name?.toLowerCase().includes(searchLower);
      const descriptionMatch = dish.description
        ?.toLowerCase()
        .includes(searchLower);
      if (!nameMatch && !descriptionMatch) {
        return false;
      }
    }

    if (
      selectedCategory !== "all" &&
      dish.categoryId !== parseInt(selectedCategory)
    ) {
      return false;
    }

    if (selectedDietFilter !== "all") {
      if (selectedDietFilter === "vegetarian" && !dish.isVegetarian) {
        return false;
      }
      if (selectedDietFilter === "vegan" && !dish.isVegan) {
        return false;
      }
      if (
        selectedDietFilter === "non-vegetarian" &&
        (dish.isVegetarian || dish.isVegan)
      ) {
        return false;
      }
    }

    if (selectedMenuTypeFilter !== "all") {
      const category = (categories as any[])?.find(
        (cat: any) => cat.id === dish.categoryId,
      );
      if (category && category.menuType !== selectedMenuTypeFilter) {
        return false;
      }
    }

    return true;
  });

  const checkedInReservations =
    (reservations as any[])?.filter(
      (reservation: any) => reservation.status === "checked-in",
    ) || [];

  const handleReservationClick = (reservation: any) => {
    setSelectedReservation(reservation);
    setCartItems([]);
    setSelectedCategory("all");
    form.setValue("reservationId", reservation.id);
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
    const existingOrders = getReservationOrders(selectedReservation.id);
    const existingItems = getAllReservationItems(selectedReservation.id);

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
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <Button variant="outline" onClick={resetForm}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Reservations
                </Button>

                {/* KOT/BOT Generation Button */}
                {existingOrders.length > 0 ? (
                  <Button
                    variant="default"
                    onClick={() => {
                      console.log(
                        `🎫 Generating KOT/BOT for reservation:`,
                        selectedReservation.id,
                      );
                      console.log(
                        `🎫 Available orders:`,
                        existingOrders.length,
                      );

                      // Use the new reservation-based endpoint
                      generateReservationKOTBOTMutation.mutate(
                        selectedReservation.id,
                      );
                    }}
                    disabled={generateReservationKOTBOTMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {generateReservationKOTBOTMutation.isPending
                      ? "Generating..."
                      : "Generate KOT/BOT"}
                  </Button>
                ) : (
                  <div className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded px-3 py-2">
                    📋 Create an order first by adding items and clicking
                    "Create Order" to generate KOT/BOT tickets
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Menu Selection */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="space-y-3">
                      <CardTitle>Menu Items</CardTitle>

                      <div className="flex flex-col gap-2">
                        {/* First row: All Categories & All Diet Types */}
                        <div className="flex gap-2 w-full">
                          <div className="flex-1">
                            <Select
                              value={selectedCategory}
                              onValueChange={setSelectedCategory}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="All Categories" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {(categories as any[])?.map((category: any) => (
                                  <SelectItem
                                    key={category.id}
                                    value={category.id.toString()}
                                  >
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1">
                            <Select
                              value={selectedDietFilter}
                              onValueChange={setSelectedDietFilter}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="All Diet Types" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Diet Types</SelectItem>
                                <SelectItem value="vegetarian">
                                  Vegetarian
                                </SelectItem>
                                <SelectItem value="vegan">Vegan</SelectItem>
                                <SelectItem value="non-vegetarian">
                                  Non-Vegetarian
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {/* Second row: All Menus & Search */}
                        <div className="flex gap-2 w-full">
                          <div className="flex-1">
                            <Select
                              value={selectedMenuTypeFilter}
                              onValueChange={setSelectedMenuTypeFilter}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="All Menus" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Menus</SelectItem>
                                <SelectItem value="Food">Food</SelectItem>
                                <SelectItem value="Bar">Bar</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1">
                            <Input
                              placeholder="Search dishes by name or description..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Search Results Count */}
                    {searchTerm.trim() !== "" && (
                      <div className="mb-3 text-sm text-gray-600">
                        {filteredDishes?.length || 0} dish(es) found for "
                        {searchTerm}"
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                      {filteredDishes?.length === 0 ? (
                        <div className="col-span-2 text-center py-8">
                          <div className="text-gray-400 mb-2">
                            <Utensils className="h-12 w-12 mx-auto" />
                          </div>
                          <p className="text-gray-500">
                            {searchTerm.trim() !== ""
                              ? `No dishes found matching "${searchTerm}"`
                              : "No dishes available with current filters"}
                          </p>
                          {searchTerm.trim() !== "" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSearchTerm("")}
                              className="mt-2"
                            >
                              Clear search
                            </Button>
                          )}
                        </div>
                      ) : (
                        filteredDishes?.map((dish: any) => (
                          <Card
                            key={dish.id}
                            className="hover:shadow-md transition-shadow cursor-pointer"
                          >
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0"> {/* Add min-w-0 */}
                                  <h4 className="font-medium">{dish.name}</h4>
                                  <p className="text-green-600 font-semibold">
                                    {currencySymbol} {dish.price}
                                  </p>
                                  {dish.description && (
                                    <p className="text-sm text-gray-500 mt-1 break-words"> {/* Added break-words */}
                                      {dish.description}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => addItemToCart(dish)}
                                  className="ml-2 flex-shrink-0"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-6">
                {/* Order Summary Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Package className="h-5 w-5 mr-2" />
                      Order Summary
                      {existingOrders.length > 0 && (
                        <Badge className="ml-2">
                          {existingOrders.length} Orders
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {existingOrders.length === 0 ? (
                      <div className="text-center py-6">
                        <Package className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500 text-sm">
                          No previous orders
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto space-y-3">
                        {existingOrders.map((order: any) => (
                          <div
                            key={order.id}
                            className="p-3 bg-gray-50 rounded-lg border"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">
                                  #{order.orderNumber}
                                </span>
                                <Badge className={getStatusColor(order.status)}>
                                  {order.status}
                                </Badge>
                              </div>
                              <span className="text-sm font-semibold text-green-600">
                                {currencySymbol} {order.totalAmount}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 mb-2">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {formatDateInTimezone(
                                  order.createdAt,
                                  timeZone,
                                )}
                              </span>
                            </div>

                            {/* Order Items */}
                            <div className="space-y-1">
                              {order.items?.map((item: any) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between py-1"
                                >
                                  <div className="flex-1">
                                    <span className="text-xs font-medium">
                                      {item.dish?.name}
                                    </span>
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                      <span>
                                        {currencySymbol} {item.unitPrice}
                                      </span>
                                      <span>×</span>
                                      <span>{item.quantity}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    {/* Decrease quantity button */}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (item.quantity > 1) {
                                          updateExistingItemQuantity(
                                            item.id,
                                            item.quantity - 1,
                                            item.unitPrice,
                                          );
                                        }
                                      }}
                                      disabled={
                                        item.quantity <= 1 ||
                                        updateOrderItemMutation.isPending
                                      }
                                      className="h-6 w-6 p-0"
                                      title="Decrease quantity"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>

                                    <span className="text-xs font-medium w-6 text-center">
                                      {item.quantity}
                                    </span>

                                    {/* Increase quantity button */}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        updateExistingItemQuantity(
                                          item.id,
                                          item.quantity + 1,
                                          item.unitPrice,
                                        )
                                      }
                                      disabled={
                                        updateOrderItemMutation.isPending
                                      }
                                      className="h-6 w-6 p-0"
                                      title="Increase quantity"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>

                                    {/* Delete item button */}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (
                                          confirm(
                                            `Are you sure you want to delete "${item.dish?.name}" from the order?`,
                                          )
                                        ) {
                                          deleteExistingItem(item.id);
                                        }
                                      }}
                                      disabled={
                                        deleteOrderItemMutation.isPending
                                      }
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      title="Delete this item"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {order.notes && (
                              <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                                <span className="font-medium text-gray-600">
                                  Notes:{" "}
                                </span>
                                <span className="text-gray-700">
                                  {order.notes}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Cart Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      New Order Cart
                      {cartItems.length > 0 && (
                        <Badge className="ml-2 bg-blue-500">
                          {cartItems.length}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {cartItems.length === 0 ? (
                      <div className="text-center py-8">
                        <ShoppingCart className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500">No items in cart</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Add items from the menu to create a new order
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                          {cartItems.map((item) => (
                            <div
                              key={`${item.dishId}-${item.isNewItem ? "new" : item.originalOrderItemId}`}
                              className={`p-3 rounded border ${item.isNewItem ? "bg-blue-50 border-blue-200" : "bg-yellow-50 border-yellow-200"}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">
                                    {item.dishName}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    {currencySymbol} {item.unitPrice} each
                                  </p>
                                  {!item.isNewItem && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs mt-1"
                                    >
                                      Editing existing item
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    if (item.isNewItem) {
                                      removeCartItem(item.dishId);
                                    } else if (item.originalOrderItemId) {
                                      deleteExistingItem(
                                        item.originalOrderItemId,
                                      );
                                    }
                                  }}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (item.isNewItem) {
                                        updateCartItemQuantity(
                                          item.dishId,
                                          item.quantity - 1,
                                        );
                                      } else if (item.originalOrderItemId) {
                                        updateExistingItemQuantity(
                                          item.originalOrderItemId,
                                          item.quantity - 1,
                                          item.unitPrice,
                                        );
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
                                      if (item.isNewItem) {
                                        updateCartItemQuantity(
                                          item.dishId,
                                          item.quantity + 1,
                                        );
                                      } else if (item.originalOrderItemId) {
                                        updateExistingItemQuantity(
                                          item.originalOrderItemId,
                                          item.quantity + 1,
                                          item.unitPrice,
                                        );
                                      }
                                    }}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                                <p className="font-semibold text-sm text-green-600">
                                  {currencySymbol}{" "}
                                  {(
                                    parseFloat(item.unitPrice) * item.quantity
                                  ).toFixed(2)}
                                </p>
                              </div>

                              {item.isNewItem && (
                                <div className="mt-2">
                                  <Input
                                    placeholder="Special instructions..."
                                    value={item.notes}
                                    onChange={(e) =>
                                      updateCartItemNotes(
                                        item.dishId,
                                        e.target.value,
                                      )
                                    }
                                    className="h-8 text-xs"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Order Totals - only for new items */}
                        {(() => {
                          const newItems = cartItems.filter(
                            (item) => item.isNewItem,
                          );
                          if (newItems.length === 0) return null;

                          const subtotal = newItems.reduce(
                            (sum, item) =>
                              sum + parseFloat(item.unitPrice) * item.quantity,
                            0,
                          );

                          let totalTaxAmount = 0;
                          const appliedTaxes = [];

                          if (orderTaxes) {
                            for (const tax of orderTaxes as any[]) {
                              const taxAmount =
                                (subtotal * parseFloat(tax.rate)) / 100;
                              totalTaxAmount += taxAmount;
                              appliedTaxes.push({
                                taxName: tax.taxName,
                                rate: tax.rate,
                                amount: taxAmount,
                              });
                            }
                          }

                          const total = subtotal + totalTaxAmount;

                          return (
                            <div className="border-t pt-4 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>New Items Subtotal:</span>
                                <span>
                                  {currencySymbol} {subtotal.toFixed(2)}
                                </span>
                              </div>

                              {appliedTaxes.map((tax, index) => (
                                <div
                                  key={index}
                                  className="flex justify-between text-sm text-gray-600"
                                >
                                  <span>
                                    {tax.taxName} ({tax.rate}%):
                                  </span>
                                  <span>
                                    {currencySymbol} {tax.amount.toFixed(2)}
                                  </span>
                                </div>
                              ))}

                              <div className="flex justify-between font-semibold border-t pt-2">
                                <span>New Order Total:</span>
                                <span className="text-green-600">
                                  {currencySymbol} {total.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        <Form {...form}>
                          <form
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="mt-4 space-y-4"
                          >
                            
                            <div className="flex space-x-2">
                              <Button
                                type="submit"
                                className="flex-1"
                                disabled={
                                  createOrderMutation.isPending ||
                                  !cartItems.some((item) => item.isNewItem)
                                }
                              >
                                {createOrderMutation.isPending ? (
                                  <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                    Creating...
                                  </div>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Order
                                  </>
                                )}
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCartItems([])}
                                disabled={createOrderMutation.isPending}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Clear
                              </Button>
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

  // Show reservations grid
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {checkedInReservations.map((reservation: any) => {
              const reservationOrders = getReservationOrders(reservation.id);
              const hasOrder = reservationOrders.length > 0;

              let totalAmount = 0;
              let totalItems = 0;
              let latestOrderNumber = "";
              let latestStatus = "pending";

              reservationOrders.forEach((order: any) => {
                totalAmount += parseFloat(order.totalAmount || "0");
                totalItems += order.items?.length || 0;
                if (
                  !latestOrderNumber ||
                  new Date(order.createdAt) > new Date(latestOrderNumber)
                ) {
                  latestOrderNumber = order.orderNumber;
                  latestStatus = order.status;
                }
              });

              return (
                <Card
                  key={reservation.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${hasOrder
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
                          {reservation.guest?.firstName}{" "}
                          {reservation.guest?.lastName}
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
                          <span>
                            Room:{" "}
                            {reservation.reservationRooms?.[0]?.room?.number ||
                              "N/A"}
                          </span>
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
                              : `${reservationOrders.length} Orders (Latest: #${latestOrderNumber})`}
                          </p>
                          {/* Show latest order timestamp in hotel's timezone */}
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <p className="text-xs text-gray-500">
                              {(() => {
                                if (reservationOrders.length === 0)
                                  return "No orders";

                                const latestOrder = reservationOrders.reduce(
                                  (latest: any, current: any) => {
                                    const latestTime = new Date(
                                      latest.createdAt,
                                    ).getTime();
                                    const currentTime = new Date(
                                      current.createdAt,
                                    ).getTime();
                                    return currentTime > latestTime
                                      ? current
                                      : latest;
                                  },
                                );

                                console.log(
                                  `🕐 Latest order for reservation ${reservation.id}:`,
                                );
                                console.log(
                                  `🕐 - Raw timestamp: ${latestOrder.createdAt}`,
                                );
                                console.log(`🕐 - Order ID: ${latestOrder.id}`);
                                console.log(
                                  `🕐 - Order Number: ${latestOrder.orderNumber}`,
                                );
                                console.log(
                                  `🕐 - Hotel timezone setting: ${timeZone}`,
                                );

                                // Parse the timestamp and show what timezone it's interpreted as
                                const parsedDate = new Date(
                                  latestOrder.createdAt,
                                );
                                console.log(
                                  `🕐 - Parsed as Date object: ${parsedDate.toString()}`,
                                );
                                console.log(
                                  `🕐 - UTC representation: ${parsedDate.toISOString()}`,
                                );
                                console.log(
                                  `🕐 - Local time representation: ${parsedDate.toLocaleString()}`,
                                );

                                // Show current time for comparison
                                const now = new Date();
                                console.log(
                                  `🕐 - Current server time: ${now.toString()}`,
                                );
                                console.log(
                                  `🕐 - Current UTC time: ${now.toISOString()}`,
                                );

                                const formattedTime = formatDateInTimezone(
                                  latestOrder.createdAt,
                                  timeZone,
                                );
                                console.log(
                                  `🕐 - Final formatted display: ${formattedTime}`,
                                );

                                return formattedTime;
                              })()}
                            </p>
                          </div>
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
                      <p className="text-sm font-medium text-gray-500">Room:</p>
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
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-gray-500">
                        Order Created:
                      </p>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <p className="font-semibold">
                          {formatDateInTimezone(
                            viewingOrder.createdAt,
                            timeZone,
                          )}
                        </p>
                      </div>
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
                            <p className="font-medium">
                              {item.dish?.name || `Item ${item.dishId}`}
                            </p>
                            <p className="text-sm text-gray-600">
                              Qty: {item.quantity} × {currencySymbol}{" "}
                              {item.unitPrice}
                            </p>
                            {item.specialInstructions && (
                              <p className="text-xs text-gray-600 italic">
                                {item.specialInstructions}
                              </p>
                            )}
                          </div>
                          <p className="font-semibold text-green-600">
                            {currencySymbol}{" "}
                            {(
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
}
