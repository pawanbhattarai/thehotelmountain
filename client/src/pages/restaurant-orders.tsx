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
  tableId: z.number().min(1, "Table is required"),
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

// Extend your item type to include a unique client-side ID
interface SelectedOrderItem {
  uniqueId: string; // Add a unique ID for each instance
  dishId: number;
  dishName: string;
  quantity: number;
  unitPrice: string;
  notes: string;
  isExistingItem: boolean;
}

export default function RestaurantOrders() {
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedOrderItem[]>([]); // Use the new interface
  const [originalItems, setOriginalItems] = useState<SelectedOrderItem[]>([]); // Use the new interface
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDietFilter, setSelectedDietFilter] = useState<string>("all");
  const [selectedMenuTypeFilter, setSelectedMenuTypeFilter] =
    useState<string>("all");
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Simple counter for unique IDs (for new items)
  const [itemCounter, setItemCounter] = useState(0);

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/restaurant/orders"],
    refetchInterval: 2000, // Real-time polling every 2 seconds for immediate updates
  });

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ["/api/restaurant/tables"],
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

  const createOrderMutation = useMutation({
    mutationFn: async (data: { order: any; items: any[] }) => {
      console.log("Sending order creation request:", data);
      const response = await fetch("/api/restaurant/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();
      console.log("Order creation response:", responseData);

      if (!response.ok) {
        throw new Error(responseData.message || "Failed to create order");
      }
      return responseData;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/orders"] });
      const existingOrder = selectedTable
        ? getTableOrder(selectedTable.id)
        : null;

      // Automatically generate KOT/BOT for new orders
      if (!existingOrder && data?.id) {
        try {
          await generateKOTBOTMutation.mutateAsync(data.id);
          toast({
            title: "Order created successfully",
            description:
              "Your order has been placed and KOT/BOT generated automatically!",
          });
        } catch (error) {
          toast({
            title: "Order created but KOT/BOT generation failed",
            description: "Please generate KOT/BOT manually from the order view",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: existingOrder
            ? "Order updated successfully"
            : "Order created successfully",
          description: existingOrder
            ? "Items have been added to the order!"
            : "Your order has been placed!",
        });
      }

      setSelectedTable(null);
      setSelectedItems([]);
      setOriginalItems([]);
      setItemCounter(0); // Reset counter on successful order
    },
    onError: (error: any) => {
      console.error("Order creation failed:", error);
      toast({
        title: "Failed to create order",
        description:
          error.message || "An error occurred while creating the order",
        variant: "destructive",
      });
    },
  });

  // New mutation for updating existing orders (handles deletions)
  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, order, items }: { orderId: string; order: any; items: any[] }) => {
      const response = await fetch(`/api/restaurant/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order, items }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update order");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/orders"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/restaurant/dashboard/today-orders"],
      });

      toast({
        title: "Order updated successfully!",
        description: data.orderNumber
          ? `Order ${data.orderNumber} has been updated`
          : "Order has been updated!",
      });

      setSelectedTable(null);
      setSelectedItems([]);
      setOriginalItems([]);
      setItemCounter(0);
    },
    onError: (error: any) => {
      console.error("Order update failed:", error);
      toast({
        title: "Failed to update order",
        description:
          error.message || "An error occurred while updating the order",
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
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/orders"] });
      toast({ title: "Order status updated" });
    },
  });

  const generateKOTBOTMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(
        `/api/restaurant/orders/${orderId}/kot-bot`,
        {
          method: "POST",
        },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate KOT/BOT");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/orders"] });
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
        description: description,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate KOT/BOT",
        description:
          error.message || "An error occurred while generating KOT/BOT",
        variant: "destructive",
      });
    },
  });

  // Keep the old KOT mutation for backward compatibility (if needed elsewhere)
  const generateKOTMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/restaurant/orders/${orderId}/kot`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate KOT");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/kot"] });
      toast({
        title: "KOT generated successfully",
        description: `KOT ${data.kotNumber} has been created and sent to kitchen`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate KOT",
        description: error.message || "An error occurred while generating KOT",
        variant: "destructive",
      });
    },
  });

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      tableId: selectedTable?.id || 0,
      branchId: user?.role === "superadmin" ? 1 : user?.branchId || 1,
      items: [],
      notes: "",
    },
  });

  // Update form values when table changes
  React.useEffect(() => {
    if (selectedTable) {
      form.setValue("tableId", selectedTable.id);
    }
  }, [selectedTable, form]);

  const onSubmit = (data: OrderFormData) => {
    console.log("Form submitted with data:", data);
    console.log("Selected items:", selectedItems);
    console.log("Selected table:", selectedTable);

    const existingOrder = getTableOrder(selectedTable.id);

    if (selectedItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the order",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTable) {
      toast({
        title: "Error",
        description: "No table selected",
        variant: "destructive",
      });
      return;
    }

    // For existing orders, only submit new/changed items
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

    // Calculate subtotal based on items to send (new items only for existing orders)
    let subtotal;
    if (existingOrder) {
      // Calculate subtotal only for new items
      subtotal = selectedItems
        .filter((item) => !item.isExistingItem)
        .reduce(
          (total, item) => total + parseFloat(item.unitPrice) * item.quantity,
          0,
        );

      // Add differences for increased quantities of existing items
      selectedItems.forEach((currentItem) => {
        if (currentItem.isExistingItem) {
          // Find the original item based on dishId (since originalItems won't have uniqueId yet)
          const originalItem = originalItems.find(
            (orig) =>
              orig.dishId === currentItem.dishId &&
              orig.uniqueId === currentItem.uniqueId,
          );
          if (originalItem && currentItem.quantity > originalItem.quantity) {
            const additionalQuantity =
              currentItem.quantity - originalItem.quantity;
            subtotal += parseFloat(currentItem.unitPrice) * additionalQuantity;
          }
        }
      });
    } else {
      // For new orders, calculate total subtotal
      subtotal = calculateSubtotal();
    }

    // Calculate taxes dynamically
    let totalTaxAmount = 0;
    const appliedTaxes = [];

    if (orderTaxes) {
      for (const tax of orderTaxes) {
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
      tableId: selectedTable.id,
      branchId: branchId,
      subtotal: subtotal.toString(),
      taxAmount: totalTaxAmount.toString(),
      totalAmount: total.toString(),
      notes: data.notes || "",
      status: "pending" as const,
      orderType: "dine-in" as const,
      paymentStatus: "pending" as const,
    };

    // Decide whether to create or update the order
    if (existingOrder) {
      // For existing orders, send all current items to replace the entire order
      const allItemsData = selectedItems.map((item) => ({
        dishId: item.dishId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: (parseFloat(item.unitPrice) * item.quantity).toString(),
        specialInstructions: item.notes || "",
        status: "pending" as const,
      }));

      // Recalculate totals based on all items (not just new ones)
      const fullSubtotal = calculateSubtotal();
      let fullTaxAmount = 0;
      
      if (orderTaxes) {
        for (const tax of orderTaxes) {
          fullTaxAmount += (fullSubtotal * parseFloat(tax.rate)) / 100;
        }
      }

      const fullTotal = fullSubtotal + fullTaxAmount;

      const fullOrderData = {
        tableId: selectedTable.id,
        branchId: branchId,
        subtotal: fullSubtotal.toString(),
        taxAmount: fullTaxAmount.toString(),
        totalAmount: fullTotal.toString(),
        notes: data.notes || "",
        status: "pending" as const,
        orderType: "dine-in" as const,
        paymentStatus: "pending" as const,
      };

      console.log("Updating existing order with data:", {
        orderId: existingOrder.id,
        order: fullOrderData,
        items: allItemsData,
        totalItems: allItemsData.length,
        originalItemsCount: originalItems.length,
      });

      updateOrderMutation.mutate({
        orderId: existingOrder.id,
        order: fullOrderData,
        items: allItemsData,
      });
    } else {
      // For new orders, only send new items
      let itemsToSend = selectedItems.filter((item) => !item.isExistingItem);

      const itemsData = itemsToSend.map((item) => ({
        dishId: item.dishId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: (parseFloat(item.unitPrice) * item.quantity).toString(),
        specialInstructions: item.notes || "",
        status: "pending" as const,
      }));

      // Validate that we have items to send
      if (itemsData.length === 0) {
        toast({
          title: "No items to add",
          description: "Please add at least one item to create an order",
          variant: "default",
        });
        return;
      }

      console.log("Creating new order with data:", {
        order: orderData,
        items: itemsData,
        itemsCount: itemsData.length,
      });

      createOrderMutation.mutate({
        order: orderData,
        items: itemsData,
      });
    }
  };

  const addItem = (dish: any) => {
    if (!dish || !dish.id || dish.price === undefined) {
      toast({
        title: "Error",
        description: "Invalid item data",
        variant: "destructive",
      });
      return;
    }

    // Check if the same dish already exists in the current order (not including existing items from previous orders)
    const existingItemIndex = selectedItems.findIndex(
      (item) => item.dishId === dish.id && !item.isExistingItem
    );

    if (existingItemIndex >= 0) {
      // Item already exists, increment quantity by 1
      const updatedItems = [...selectedItems];
      updatedItems[existingItemIndex].quantity += 1;
      setSelectedItems(updatedItems);
    } else {
      // Item doesn't exist, create new entry
      const newUniqueId = `item-${Date.now()}-${itemCounter}`;
      setItemCounter((prev) => prev + 1);

      const newItem: SelectedOrderItem = {
        uniqueId: newUniqueId,
        dishId: dish.id,
        dishName: dish.name,
        quantity: 1,
        unitPrice: dish.price.toString(),
        notes: "",
        isExistingItem: false,
      };
      setSelectedItems((items) => [...items, newItem]);
    }
  };

  // Modified removeItem to use uniqueId
  const removeItem = (uniqueId: string) => {
    setSelectedItems((items) =>
      items.filter((item) => item.uniqueId !== uniqueId),
    );
  };

  // Modified updateItemQuantity to use uniqueId
  const updateItemQuantity = (uniqueId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(uniqueId);
    } else {
      setSelectedItems((items) =>
        items.map((item) =>
          item.uniqueId === uniqueId ? { ...item, quantity } : item,
        ),
      );
    }
  };

  const calculateSubtotal = () => {
    return selectedItems.reduce(
      (total, item) => total + parseFloat(item.unitPrice) * item.quantity,
      0,
    );
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    let totalTaxAmount = 0;
    if (orderTaxes) {
      for (const tax of orderTaxes) {
        totalTaxAmount += (subtotal * parseFloat(tax.rate)) / 100;
      }
    }
    return subtotal + totalTaxAmount;
  };

  const getFilteredDishes = () => {
    const menuDishes = dishes || [];

    return menuDishes.filter((item: any) => {
      // Filter by category
      if (
        selectedCategory !== "all" &&
        item.categoryId !== parseInt(selectedCategory)
      ) {
        return false;
      }

      // Filter by diet type
      if (selectedDietFilter !== "all") {
        if (selectedDietFilter === "vegetarian" && !item.isVegetarian) {
          return false;
        }
        if (selectedDietFilter === "vegan" && !item.isVegan) {
          return false;
        }
        if (
          selectedDietFilter === "non-vegetarian" &&
          (item.isVegetarian || item.isVegan)
        ) {
          return false;
        }
      }

      // Filter by menu type (Food vs Bar)
      if (selectedMenuTypeFilter !== "all") {
        const category = categories?.find(
          (cat: any) => cat.id === item.categoryId,
        );
        if (category && category.menuType !== selectedMenuTypeFilter) {
          return false;
        }
      }

      return true;
    });
  };

  const getTableOrder = (tableId: number) => {
    return orders?.find(
      (order: any) =>
        order.tableId === tableId &&
        order.status !== "completed" &&
        order.status !== "cancelled",
    );
  };

  const handleTableClick = (table: any) => {
    setSelectedTable(table);
    setSelectedItems([]);
    setOriginalItems([]);
    setSelectedCategory("all");
    setItemCounter(0); // Reset counter when selecting a new table

    // If table has an existing order, load its items for display only
    const existingOrder = getTableOrder(table.id);
    if (existingOrder && existingOrder.items) {
      // When loading existing items, assign them a uniqueId based on their `id` from the backend
      // or a new client-side uniqueId if the backend doesn't provide an item-specific ID.
      // For this example, let's assume `item.id` from the backend can serve as uniqueId for existing items.
      const orderItems: SelectedOrderItem[] = existingOrder.items.map(
        (item: any) => ({
          uniqueId: `existing-${item.id}`, // Use a prefix to differentiate from new items
          dishId: item.dishId,
          dishName: item.dish?.name || "Unknown Dish",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.specialInstructions || "",
          isExistingItem: true, // Mark as existing item
        }),
      );
      setSelectedItems(orderItems);
      setOriginalItems(JSON.parse(JSON.stringify(orderItems))); // Deep copy for comparison
    }
  };

  // Check if order has been modified
  const hasOrderChanged = () => {
    // Deep comparison of selectedItems and originalItems
    return JSON.stringify(selectedItems) !== JSON.stringify(originalItems);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "preparing":
        return "bg-orange-100 text-orange-800";
      case "ready":
        return "bg-green-100 text-green-800";
      case "served":
        return "bg-gray-100 text-gray-800";
      case "completed":
        return "bg-emerald-100 text-emerald-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (tablesLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar
          isMobileMenuOpen={isMobileSidebarOpen}
          setIsMobileMenuOpen={setIsMobileSidebarOpen}
        />
        <div className="main-content">
          <Header
            title="Restaurant Orders"
            subtitle="Manage table orders"
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

  // Show order interface for selected table
  if (selectedTable) {
    const existingOrder = getTableOrder(selectedTable.id);

    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar
          isMobileMenuOpen={isMobileSidebarOpen}
          setIsMobileMenuOpen={setIsMobileSidebarOpen}
        />
        <div className="main-content">
          <Header
            title={`Table ${selectedTable.name} - Order`}
            subtitle={
              existingOrder
                ? "Add more items to existing order"
                : "Create new order"
            }
            onMobileMenuToggle={() =>
              setIsMobileSidebarOpen(!isMobileSidebarOpen)
            }
          />
          <main className="p-6">
            {/* Back Button */}
            <div className="mb-6">
              <Button
                variant="outline"
                onClick={() => setSelectedTable(null)}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tables
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
                          Total: Rs. {existingOrder.totalAmount}
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
                          onClick={() =>
                            generateKOTBOTMutation.mutate(existingOrder.id)
                          }
                          disabled={generateKOTBOTMutation.isPending}
                          className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          {generateKOTBOTMutation.isPending
                            ? "Generating..."
                            : "Generate KOT/BOT"}
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
                            <SelectItem value="vegetarian">
                              Vegetarian
                            </SelectItem>
                            <SelectItem value="vegan">Vegan</SelectItem>
                            <SelectItem value="non-vegetarian">
                              Non-Vegetarian
                            </SelectItem>
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
                      {getFilteredDishes().map((dish: any) => (
                        <Card
                          key={dish.id}
                          className="hover:shadow-md transition-shadow cursor-pointer"
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <h4 className="font-medium">{dish.name}</h4>
                                  {dish.isVegetarian && (
                                    <div
                                      className="w-3 h-3 bg-green-500 rounded-full"
                                      title="Vegetarian"
                                    ></div>
                                  )}
                                  {dish.isVegan && (
                                    <div
                                      className="w-3 h-3 bg-green-600 rounded-full"
                                      title="Vegan"
                                    ></div>
                                  )}
                                  {!dish.isVegetarian && !dish.isVegan && (
                                    <div
                                      className="w-3 h-3 bg-red-500 rounded-full"
                                      title="Non-Vegetarian"
                                    ></div>
                                  )}
                                </div>
                                <p className="text-green-600 font-semibold">
                                  Rs. {dish.price}
                                </p>
                                {dish.description && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    {dish.description}
                                  </p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                onClick={() => addItem(dish)}
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
                    {selectedItems.length === 0 ? (
                      <div className="text-center py-8">
                        <ShoppingCart className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500">No items selected</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                          {selectedItems.map((item, index) => {
                            // Use uniqueId as key here
                            const itemKey =
                              item.uniqueId || `temp-item-${index}`; // Fallback for safety
                            return (
                              <div
                                key={itemKey}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded"
                              >
                                <div className="flex-1">
                                  <h4 className="font-medium text-sm">
                                    {item.dishName}
                                  </h4>
                                  <p className="text-xs text-gray-600">
                                    Rs. {item.unitPrice} each
                                  </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateItemQuantity(
                                        item.uniqueId,
                                        item.quantity - 1,
                                      )
                                    }
                                    className="h-6 w-6 p-0"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-6 text-center text-sm">
                                    {item.quantity}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateItemQuantity(
                                        item.uniqueId,
                                        item.quantity + 1,
                                      )
                                    }
                                    className="h-6 w-6 p-0"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeItem(item.uniqueId)}
                                    className="h-6 w-6 p-0 text-red-500"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="border-t pt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Subtotal:</span>
                            <span>Rs. {calculateSubtotal().toFixed(2)}</span>
                          </div>
                          {(() => {
                            let totalTaxAmount = 0;
                            const appliedTaxes = [];

                            if (orderTaxes) {
                              for (const tax of orderTaxes) {
                                const taxAmount =
                                  (calculateSubtotal() * parseFloat(tax.rate)) /
                                  100;
                                totalTaxAmount += taxAmount;
                                appliedTaxes.push({
                                  taxName: tax.taxName,
                                  rate: tax.rate,
                                  amount: taxAmount,
                                });
                              }
                            }

                            return (
                              <>
                                {appliedTaxes.map((tax, index) => (
                                  <div
                                    key={index}
                                    className="flex justify-between mb-2"
                                  >
                                    <span>
                                      {tax.taxName} ({tax.rate}%):
                                    </span>
                                    <span>Rs. {tax.amount.toFixed(2)}</span>
                                  </div>
                                ))}
                                {appliedTaxes.length === 0 && (
                                  <div className="flex justify-between mb-2">
                                    <span>Tax:</span>
                                    <span>Rs. 0.00</span>
                                  </div>
                                )}
                                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                                  <span>Total:</span>
                                  <span>
                                    Rs.{" "}
                                    {(
                                      calculateSubtotal() + totalTaxAmount
                                    ).toFixed(2)}
                                  </span>
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
                                (getTableOrder(selectedTable?.id) &&
                                  !hasOrderChanged())
                              }
                              onClick={(e) => {
                                e.preventDefault();
                                console.log(
                                  "Button clicked, submitting form...",
                                );
                                form.handleSubmit(onSubmit)(e);
                              }}
                            >
                              {createOrderMutation.isPending ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                  {getTableOrder(selectedTable?.id)
                                    ? "Updating..."
                                    : "Creating..."}
                                </div>
                              ) : getTableOrder(selectedTable?.id) ? (
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

  // Show tables grid
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isMobileMenuOpen={isMobileSidebarOpen}
        setIsMobileMenuOpen={setIsMobileSidebarOpen}
      />
      <div className="main-content">
        <Header
          title="Restaurant Tables"
          subtitle="Click on a table to manage orders"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
        />
        <main className="p-6">
          {/* Tables Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {tables?.map((table: any) => {
              const tableOrder = getTableOrder(table.id);
              const isOccupied = !!tableOrder;

              return (
                <Card
                  key={table.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    isOccupied
                      ? "border-l-4 border-l-orange-500 bg-orange-50"
                      : "border-l-4 border-l-green-500 bg-green-50"
                  }`}
                  onClick={() => handleTableClick(table)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Utensils
                          className={`h-5 w-5 ${isOccupied ? "text-orange-600" : "text-green-600"}`}
                        />
                        <h3 className="font-semibold text-lg">
                          Table {table.name}
                        </h3>
                      </div>
                      <div
                        className={`w-3 h-3 rounded-full ${isOccupied ? "bg-orange-500" : "bg-green-500"}`}
                      ></div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2" />
                          <span>Capacity: {table.capacity}</span>
                        </div>
                        {isOccupied && tableOrder && (
                          <Badge className={getStatusColor(tableOrder.status)}>
                            {tableOrder.status}
                          </Badge>
                        )}
                      </div>

                      {isOccupied && tableOrder && (
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">
                            Order #{tableOrder.orderNumber}
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-green-600">
                              Rs. {tableOrder.totalAmount}
                            </p>
                            <p className="text-xs text-gray-500">
                              {tableOrder.items?.length || 0} items
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

          {!tables?.length && (
            <div className="text-center py-12">
              <Utensils className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 font-medium">No tables found</p>
              <p className="text-sm text-gray-400">
                Add tables to start taking orders.
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
                        Table:
                      </p>
                      <p className="font-semibold">
                        {viewingOrder.table?.name}
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
                        Rs. {viewingOrder.totalAmount}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Created:
                      </p>
                      <p className="text-sm">
                        {new Date(viewingOrder.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Order Items</h4>
                    <div className="space-y-2">
                      {viewingOrder.items?.map((item: any) => (
                        <div
                          key={item.id} // Assuming item.id from backend is unique for order items
                          className="flex justify-between items-center p-2 bg-gray-50 rounded"
                        >
                          <div>
                            <p className="font-medium">{item.dish?.name}</p>
                            <p className="text-sm text-gray-600">
                              Qty: {item.quantity} × Rs. {item.unitPrice}
                            </p>
                          </div>
                          <p className="font-semibold text-green-600">
                            Rs.{" "}
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
                      disabled={generateKOTBOTMutation.isPending}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {generateKOTBOTMutation.isPending
                        ? "Generating..."
                        : "Generate KOT/BOT"}
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
