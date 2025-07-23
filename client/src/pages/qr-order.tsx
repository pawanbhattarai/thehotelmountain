import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart,
  Plus,
  Minus,
  Home,
  UtensilsCrossed,
  MoreHorizontal,
  Facebook,
  Instagram,
  Youtube,
  Phone,
  Star,
  Clock,
  Users,
  Search,
  ExternalLink,
  AlertCircle
} from "lucide-react";

interface LocationInfo {
  type: "table" | "room";
  id: number;
  branchId: number;
  name: string;
}

interface MenuCategory {
  id: number;
  name: string;
  branchId: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface MenuDish {
  id: number;
  name: string;
  price: string;
  image?: string;
  categoryId: number;
  branchId: number;
  description: string;
  ingredients: string;
  isVegetarian: boolean;
  isVegan: boolean;
  spiceLevel: string;
  preparationTime: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  category: MenuCategory;
}

interface OrderItem {
  dishId: number;
  name: string;
  price: string;
  quantity: number;
  specialInstructions?: string;
}

interface HotelSettings {
  hotelName?: string;
  phone?: string;
  email?: string;
  address?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  contactInfo?: string;
  reviewsUrl?: string;
  website?: string;
}

type TabType = "dishes" | "cart" | "more";

export default function QROrderPage() {
  const [location] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("dishes");

  // Phone verification states
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verificationPhone, setVerificationPhone] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Order states
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [orderStatus, setOrderStatus] = useState<string>("");
  const [orderCreatedAt, setOrderCreatedAt] = useState<Date | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);
  const [canModifyOrder, setCanModifyOrder] = useState(true);
  const [existingItems, setExistingItems] = useState<OrderItem[]>([]);

  // Menu data
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [hasActiveReservation, setHasActiveReservation] = useState<boolean>(true);
  const [activeReservation, setActiveReservation] = useState<any>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");

  // Settings
  const [hotelSettings, setHotelSettings] = useState<HotelSettings>({});
  const [isHotelClosed, setIsHotelClosed] = useState(false);
  const [hotelHours, setHotelHours] = useState<{
    openingTime: string;
    closingTime: string;
    currentTime: string;
  } | null>(null);

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDietFilter, setSelectedDietFilter] = useState<string>("all");
  const [selectedMenuTypeFilter, setSelectedMenuTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const token = location.split("/").pop();

  useEffect(() => {
    if (token) {
      fetchOrderInfo();
      fetchHotelSettings();
      const interval = setInterval(checkExistingOrder, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  useEffect(() => {
    if (existingOrderId && orderCreatedAt) {
      const interval = setInterval(() => {
        const now = new Date();
        const diffInMinutes =
          (now.getTime() - orderCreatedAt.getTime()) / (1000 * 60);
        setCanModifyOrder(diffInMinutes <= 2);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [existingOrderId, orderCreatedAt]);

  useEffect(() => {
    calculateEstimatedTime();
  }, [cart, dishes]);

  const fetchHotelSettings = async () => {
    try {
      const response = await fetch("/api/hotel-settings");
      if (response.ok) {
        const settings = await response.json();
        setHotelSettings(settings);
      }
    } catch (error) {
      console.error("Failed to fetch hotel settings:", error);
    }
  };

  const fetchOrderInfo = async () => {
    try {
      const response = await fetch(`/api/order/info/${token}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError("Invalid QR code or table not found");
        } else if (response.status === 423) {
          // Hotel is closed
          const errorData = await response.json();
          setIsHotelClosed(true);
          setHotelHours({
            openingTime: errorData.openingTime,
            closingTime: errorData.closingTime,
            currentTime: errorData.currentTime,
          });
          setError(errorData.message);
        } else {
          setError("Failed to load order information");
        }
        setLoading(false);
        return;
      }
      const data = await response.json();

      setLocationInfo(data.location);
      setHasActiveReservation(data.hasActiveReservation);
      setActiveReservation(data.activeReservation);

      if (data.hasActiveReservation) {
        // For room orders, we need phone verification first
        if (data.location.type === "room") {
          // Don't load menu until phone is verified
          setLoading(false);
          return;
        }

        // For table orders, proceed normally
        setCategories(data.menu.categories || []);
        setDishes(data.menu.dishes || []);

        // Pre-fill customer details from reservation
        if (data.activeReservation) {
          setCustomerName(`${data.activeReservation.guest.firstName} ${data.activeReservation.guest.lastName}`);
          setCustomerPhone(data.activeReservation.guest.phone);
        }

        await checkExistingOrder();
      }
    } catch (error) {
      console.error("Error fetching order info:", error);
      setError("Invalid QR code or expired link");
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneNumber = async () => {
    if (!verificationPhone.trim()) {
      setVerificationError("Please enter your phone number");
      return;
    }

    setVerifying(true);
    setVerificationError("");

    try {
      const response = await fetch(`/api/order/verify-phone/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: verificationPhone }),
      });

      const data = await response.json();

      if (response.status === 423) {
        // Hotel is closed
        setIsHotelClosed(true);
        setHotelHours({
          openingTime: data.openingTime,
          closingTime: data.closingTime,
          currentTime: data.currentTime,
        });
        setError(data.message);
        setVerificationError(data.message);
        return;
      }

      if (response.ok && data.verified) {
        setPhoneVerified(true);
        setCategories(data.menu.categories || []);
        setDishes(data.menu.dishes || []);

        // Pre-fill customer details from reservation
        if (data.activeReservation) {
          setCustomerName(`${data.activeReservation.guest.firstName} ${data.activeReservation.guest.lastName}`);
          setCustomerPhone(data.activeReservation.guest.phone);
        }

        await checkExistingOrder();

        toast({
          title: "Success",
          description: "Phone number verified successfully!",
        });
      } else {
        setVerificationError(data.message || "Phone number does not match the reservation");
      }
    } catch (error) {
      setVerificationError("Failed to verify phone number. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const checkExistingOrder = async () => {
    try {
      const response = await fetch(`/api/order/existing/${token}`);
      if (response.ok) {
        const orderData = await response.json();
        setExistingOrderId(orderData.id);
        setOrderNumber(orderData.orderNumber);
        setOrderStatus(orderData.status);
        setOrderCreatedAt(new Date(orderData.createdAt));
        setCustomerName(orderData.customerName || "");
        setCustomerPhone(orderData.customerPhone || "");
        setNotes(orderData.notes || "");

        if (orderData.items) {
          const existingItems = orderData.items.map((item: any) => {
            const dish = dishes.find((d) => d.id === item.dishId);
            return {
              dishId: item.dishId,
              name: dish?.name || item.dish?.name || "Unknown",
              price: item.unitPrice,
              quantity: item.quantity,
              specialInstructions: item.specialInstructions,
            };
          });
          setExistingItems(existingItems);
          setCart(existingItems);
        }
      }
    } catch (error) {
      // No existing order found
    }
  };

  const calculateEstimatedTime = () => {
    let totalTime = 0;
    cart.forEach((item) => {
      const dish = dishes.find((d) => d.id === item.dishId);
      if (dish && dish.preparationTime) {
        totalTime = Math.max(totalTime, dish.preparationTime * item.quantity);
      }
    });
    setEstimatedTime(totalTime);
  };

  const addToCart = (dish: MenuDish) => {
    const existingCartItem = cart.find((item) => item.dishId === dish.id);

    if (existingCartItem) {
      // Increase quantity of existing cart item (always allowed)
      setCart(
        cart.map((item) =>
          item.dishId === dish.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
    } else {
      // Add new item to cart (always allowed, even after modification time)
      setCart([
        ...cart,
        {
          dishId: dish.id,
          name: dish.name,
          price: dish.price,
          quantity: 1,
        },
      ]);
    }
  };

  const updateQuantity = (dishId: number, quantity: number) => {
    const existingItem = existingItems.find((item) => item.dishId === dishId);

    // If this is an existing item from the original order and modification time has expired
    if (existingItem && !canModifyOrder && existingOrderId) {
      toast({
        title: "Cannot Modify",
        description: "Cannot modify existing order items after 2 minutes",
        variant: "destructive",
      });
      return;
    }

    // Prevent decreasing quantity below existing order quantity for any existing item
    if (existingItem && quantity < existingItem.quantity) {
      toast({
        title: "Cannot Decrease",
        description: "Cannot decrease quantity below the original order amount",
        variant: "destructive",
      });
      return;
    }

    // For new items (not in existing order), allow removal completely
    if (quantity === 0 && !existingItem) {
      setCart(cart.filter((item) => item.dishId !== dishId));
    } else {
      // Set minimum quantity to existing order quantity if item was previously ordered
      const minQuantity = existingItem?.quantity || 0;
      setCart(
        cart.map((item) =>
          item.dishId === dishId
            ? { ...item, quantity: Math.max(quantity, minQuantity) }
            : item,
        ),
      );
    }
  };

  const getTotal = () => {
    return cart.reduce(
      (total, item) => total + parseFloat(item.price) * item.quantity,
      0,
    );
  };

  const submitOrder = async () => {
    // For table orders, require customer details
    if (locationInfo?.type === "table" && (!customerName || !customerPhone)) {
      toast({
        title: "Error",
        description: "Please enter your name and phone number",
        variant: "destructive",
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "Error",
        description: "Please add items to your cart",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = existingOrderId
        ? `/api/order/update/${existingOrderId}`
        : `/api/order/submit/${token}`;

      const response = await fetch(endpoint, {
        method: existingOrderId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            dishId: item.dishId,
            quantity: item.quantity,
            specialInstructions: item.specialInstructions,
          })),
          customerName,
          customerPhone,
          notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 423) {
          // Hotel is closed
          setIsHotelClosed(true);
          setHotelHours({
            openingTime: errorData.openingTime,
            closingTime: errorData.closingTime,
            currentTime: errorData.currentTime,
          });
          setError(errorData.message);
        }
        throw new Error(errorData.message || "Failed to submit order");
      }

      const data = await response.json();
      setOrderNumber(data.orderNumber);
      setExistingOrderId(data.orderId);
      setOrderCreatedAt(new Date());

      toast({
        title: existingOrderId ? "Order Updated!" : "Order Placed!",
        description: `Your order ${data.orderNumber} has been ${existingOrderId ? "updated" : "placed"} successfully`,
      });

      await checkExistingOrder();
      setActiveTab("cart");
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to place order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const clearTable = async () => {
    try {
      const response = await fetch(`/api/order/clear/${token}`, {
        method: "POST",
      });

      if (response.ok) {
        setExistingOrderId(null);
        setOrderNumber("");
        setOrderStatus("");
        setOrderCreatedAt(null);
        setCart([]);
        setExistingItems([]);
        setCustomerName("");
        setCustomerPhone("");
        setNotes("");

        toast({
          title: "Table Cleared",
          description: "Table is now available for new orders",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear table",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "confirmed":
        return "bg-blue-500";
      case "preparing":
        return "bg-orange-500";
      case "ready":
        return "bg-green-500";
      case "served":
        return "bg-gray-500";
      case "completed":
        return "bg-green-600";
      default:
        return "bg-gray-400";
    }
  };

  const getTimeRemaining = () => {
    if (!orderCreatedAt) return null;
    const now = new Date();
    const diffInMinutes =
      (now.getTime() - orderCreatedAt.getTime()) / (1000 * 60);
    const remaining = Math.max(0, 2 - diffInMinutes);
    return remaining;
  };

  const getFilteredDishes = () => {
    let filtered = dishes;

    // Filter by category first
    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (dish) => dish.categoryId === parseInt(selectedCategory),
      );
    }

    // Filter by diet type
    if (selectedDietFilter !== "all") {
      filtered = filtered.filter((dish) => {
        if (selectedDietFilter === "vegetarian" && !dish.isVegetarian) {
          return false;
        }
        if (selectedDietFilter === "vegan" && !dish.isVegan) {
          return false;
        }
        if (selectedDietFilter === "non-vegetarian" && (dish.isVegetarian || dish.isVegan)) {
          return false;
        }
        return true;
      });
    }

    // Filter by menu type (Food vs Bar)
    if (selectedMenuTypeFilter !== "all") {
      filtered = filtered.filter((dish) => {
        const category = categories.find((cat) => cat.id === dish.categoryId);
        return category && category.menuType === selectedMenuTypeFilter;
      });
    }

    // Then filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (dish) =>
          dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          dish.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          categories
            .find((cat) => cat.id === dish.categoryId)
            ?.name.toLowerCase()
            .includes(searchQuery.toLowerCase()),
      );
    }

    return filtered;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading menu...</p>
        </div>
      </div>
    );
  }

  // Show no reservation message for rooms without active reservations
  if (!hasActiveReservation && locationInfo?.type === "room") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-lg font-semibold">
                  {hotelSettings.hotelName || "Hotel"}
                </h1>
                <p className="text-sm text-gray-600">
                  {locationInfo?.name}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
                <UtensilsCrossed className="w-8 h-8 text-orange-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Active Reservation</h2>
              <p className="text-gray-600 mb-4">
                This room has no active reservation. Please contact the front desk to place an order or check in.
              </p>
              {hotelSettings.phone && (
                <Button
                  onClick={() => window.open(`tel:${hotelSettings.phone}`)}
                  className="w-full"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call Front Desk
                </Button>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "dishes":
        return (
          <div className="space-y-4">
            {/* Comprehensive Filter and Search */}
            <div className="sticky top-0 bg-gray-50 py-3 z-10">
              {/* Search Bar */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search dishes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {/* Category Filter */}
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
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
                  <SelectTrigger className="w-full">
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
            </div>

            {/* Dishes Grid */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {getFilteredDishes().map((dish) => {
                const cartItem = cart.find((item) => item.dishId === dish.id);
                const existingItem = existingItems.find(
                  (item) => item.dishId === dish.id,
                );

                return (
                  <Card
                    key={dish.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-2 md:p-4">
                      <div className="flex flex-col mb-2">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-xs md:text-sm leading-tight">
                            {dish.name}
                          </h4>
                          {dish.isVegetarian && (
                            <div className="w-2 h-2 bg-green-500 rounded-full" title="Vegetarian"></div>
                          )}
                          {dish.isVegan && (
                            <div className="w-2 h-2 bg-green-600 rounded-full" title="Vegan"></div>
                          )}
                          {!dish.isVegetarian && !dish.isVegan && (
                            <div className="w-2 h-2 bg-red-500 rounded-full" title="Non-Vegetarian"></div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs md:text-sm font-semibold text-green-600">
                            Rs. {parseFloat(dish.price).toFixed(0)}
                          </span>
                          {dish.preparationTime && (
                            <div className="flex items-center gap-1 text-blue-600 text-xs">
                              <Clock className="w-3 h-3" />
                              <span>{dish.preparationTime}min</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {dish.description && (
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2 hidden md:block">
                          {dish.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-1 mb-2 md:mb-3">
                        {dish.category && (
                          <Badge
                            variant="secondary"
                            className="text-xs px-1 py-0 hidden md:inline-flex"
                          >
                            {dish.category.name}
                          </Badge>
                        )}
                        {dish.isVegetarian && (
                          <Badge
                            variant="outline"
                            className="text-xs px-1 py-0"
                          >
                            Veg
                          </Badge>
                        )}
                        {dish.isVegan && (
                          <Badge
                            variant="outline"
                            className="text-xs px-1 py-0"
                          >
                            Vegan
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-center">
                        {cartItem ? (
                          <div className="flex items-center gap-1 md:gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 w-6 md:h-8 md:w-8 p-0"
                              onClick={() =>
                                updateQuantity(dish.id, cartItem.quantity - 1)
                              }
                              disabled={
                                // Disable if would go below existing order quantity
                                (existingItem &&
                                  cartItem.quantity <= existingItem.quantity) ||
                                // Or if this is an existing item and modification time expired
                                (existingItem &&
                                  !canModifyOrder &&
                                  existingOrderId) || isHotelClosed
                              }
                            >
                              <Minus className="h-2 w-2 md:h-3 md:w-3" />
                            </Button>
                            <span className="min-w-[1.5rem] md:min-w-[2rem] text-center font-medium text-xs md:text-sm">
                              {cartItem.quantity}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 w-6 md:h-8 md:w-8 p-0"
                              onClick={() =>
                                updateQuantity(dish.id, cartItem.quantity + 1)
                              }
                              disabled={isHotelClosed}
                            >
                              <Plus className="h-2 w-2 md:h-3 md:w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => addToCart(dish)}
                            className="h-6 md:h-8 px-2 md:px-3 text-xs"
                            disabled={isHotelClosed}
                          >
                            <Plus className="h-2 w-2 md:h-3 md:w-3 mr-1" />
                            <span className="hidden md:inline">Add</span>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {getFilteredDishes().length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  No dishes found in this category
                </p>
              </div>
            )}
          </div>
        );

      case "cart":
        return (
          <div className="space-y-4">
            {existingOrderId && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Order #{orderNumber}</h3>
                    <span
                      className={`px-2 py-1 rounded text-white text-xs ${getStatusColor(orderStatus)}`}
                    >
                      {orderStatus.toUpperCase()}
                    </span>
                  </div>
                  {estimatedTime > 0 && (
                    <p className="text-sm text-gray-600 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Estimated preparation: {estimatedTime} minutes
                    </p>
                  )}
                  {!canModifyOrder && (
                    <p className="text-red-600 text-xs">
                      Order modification time expired
                    </p>
                  )}
                  {canModifyOrder && getTimeRemaining() !== null && (
                    <p className="text-orange-600 text-xs">
                      {Math.ceil(getTimeRemaining()!)} minutes left to modify
                    </p>
                  )}
                  {orderStatus === "completed" && (
                    <Button
                      onClick={clearTable}
                      className="w-full mt-2 bg-green-600 hover:bg-green-700"
                      size="sm"
                      disabled={isHotelClosed}
                    >
                      Clear Table & New Order
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Your cart is empty</p>
                <Button onClick={() => setActiveTab("dishes")} className="mt-4" disabled={isHotelClosed}>
                  Browse Menu
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <Card key={item.dishId}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium">{item.name}</h4>
                          <span className="text-sm font-semibold">
                            Rs.{" "}
                            {(parseFloat(item.price) * item.quantity).toFixed(
                              0,
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={() =>
                                updateQuantity(item.dishId, item.quantity - 1)
                              }
                              disabled={
                                // Find if this item was in the original order
                                (() => {
                                  const existingItem = existingItems.find(
                                    (ei) => ei.dishId === item.dishId,
                                  );
                                  return (
                                    // Disable if would go below existing order quantity
                                    (existingItem &&
                                      item.quantity <= existingItem.quantity) ||
                                    // Or if this is an existing item and modification time expired
                                    (existingItem &&
                                      !canModifyOrder &&
                                      existingOrderId) || isHotelClosed
                                  );
                                })()
                              }
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="min-w-[2rem] text-center font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={() =>
                                updateQuantity(item.dishId, item.quantity + 1)
                              }
                              disabled={isHotelClosed}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="text-sm text-gray-600">
                            Rs. {parseFloat(item.price).toFixed(0)} each
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {locationInfo?.type === "table" && (
                  <Card>
                    <CardContent className="p-4">
                      ```text
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="customerName">Name *</Label>
                          <Input
                            id="customerName"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Your full name"
                            disabled={isHotelClosed}
                          />
                        </div>
                        <div>
                          <Label htmlFor="customerPhone">Phone Number *</Label>
                          <Input
                            id="customerPhone"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="Your phone number"
                            disabled={isHotelClosed}
                          />
                        </div>
                        <div>
                          <Label htmlFor="notes">Special Instructions</Label>
                          <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any special requests or notes"
                            rows={2}
                            disabled={isHotelClosed}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {locationInfo?.type === "room" && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-gray-700">Order Details for:</h4>
                          <p className="text-gray-600">{customerName}</p>
                          <p className="text-sm text-gray-500">{customerPhone}</p>
                          <p className="text-sm text-gray-500">
                            Reservation: {activeReservation?.confirmationNumber}
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="notes">Special Instructions</Label>
                          <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any special requests or notes"
                            rows={2}
                            disabled={isHotelClosed}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center text-lg font-semibold mb-4">
                      <span>Total</span>
                      <span>Rs. {getTotal().toFixed(0)}</span>
                    </div>
                    <Button
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 text-lg font-semibold"
                      onClick={submitOrder}
                      disabled={
                        submitting ||
                        cart.length === 0 ||
                        (!canModifyOrder &&
                          existingOrderId &&
                          orderStatus !== "pending") || isHotelClosed
                      }
                    >
                      {submitting
                        ? existingOrderId
                          ? "Updating Order..."
                          : "Creating Order..."
                        : existingOrderId
                          ? "Update Order"
                          : "Place Order"}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        );

      case "more":
        return (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Company Information
                </h3>
                <div className="space-y-4">
                  {hotelSettings.hotelName && (
                    <div>
                      <h4 className="font-medium text-gray-700">Restaurant</h4>
                      <p className="text-gray-600">{hotelSettings.hotelName}</p>
                    </div>
                  )}

                  {hotelSettings.contactInfo && (
                    <div>
                      <h4 className="font-medium text-gray-700">About Us</h4>
                      <p className="text-gray-600">
                        {hotelSettings.contactInfo}
                      </p>
                    </div>
                  )}

                  {hotelSettings.address && (
                    <div>
                      <h4 className="font-medium text-gray-700">Address</h4>
                      <p className="text-gray-600">{hotelSettings.address}</p>
                    </div>
                  )}

                  {hotelSettings.phone && (
                    <div>
                      <h4 className="font-medium text-gray-700">Contact Us</h4>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <a
                          href={`tel:${hotelSettings.phone}`}
                          className="text-blue-600"
                        >
                          {hotelSettings.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {hotelSettings.email && (
                    <div className="flex items-center gap-2">
                      <span>📧</span>
                      <a
                        href={`mailto:${hotelSettings.email}`}
                        className="text-blue-600"
                      >
                        {hotelSettings.email}
                      </a>
                    </div>
                  )}

                  {hotelSettings.website && (
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      <a
                        href={hotelSettings.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600"
                      >
                        {hotelSettings.website}
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Follow Us Section - Only show if at least one social media URL exists */}
            {(hotelSettings.facebookUrl ||
              hotelSettings.instagramUrl ||
              hotelSettings.tiktokUrl ||
              hotelSettings.youtubeUrl) && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Follow Us</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {hotelSettings.facebookUrl &&
                      hotelSettings.facebookUrl.trim() !== "" && (
                        <a
                          href={hotelSettings.facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <Facebook className="w-5 h-5 text-blue-600" />
                          <span>Facebook</span>
                        </a>
                      )}

                    {hotelSettings.instagramUrl &&
                      hotelSettings.instagramUrl.trim() !== "" && (
                        <a
                          href={hotelSettings.instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <Instagram className="w-5 h-5 text-pink-600" />
                          <span>Instagram</span>
                        </a>
                      )}

                    {hotelSettings.tiktokUrl &&
                      hotelSettings.tiktokUrl.trim() !== "" && (
                        <a
                          href={hotelSettings.tiktokUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <span className="w-5 h-5 text-black font-bold">
                            TT
                          </span>
                          <span>TikTok</span>
                        </a>
                      )}

                    {hotelSettings.youtubeUrl &&
                      hotelSettings.youtubeUrl.trim() !== "" && (
                        <a
                          href={hotelSettings.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <Youtube className="w-5 h-5 text-red-600" />
                          <span>YouTube</span>
                        </a>
                      )}
                  </div>
                </CardContent>
              </Card>
            )}

            {hotelSettings.reviewsUrl &&
              hotelSettings.reviewsUrl.trim() !== "" && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Review Us</h3>
                    <a
                      href={hotelSettings.reviewsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 w-full"
                    >
                      <Star className="w-5 h-5 text-yellow-500" />
                      <span>Leave a Review</span>
                    </a>
                  </CardContent>
                </Card>
              )}

            {/* Copyright Section */}
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-xs text-gray-500">
                  Powered by{" "}
                  <a
                    href="https://maptechnepal.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                  >
                    <img
                      src="https://maptechnepal.com/_next/static/media/company__logo.388080d1.webp"
                      alt="MapTech Nepal"
                      className="h-4 w-auto inline"
                    />
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  // Phone verification screen for room orders
  if (locationInfo?.type === "room" && hasActiveReservation && !phoneVerified) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold">
                  {hotelSettings.hotelName || "Restaurant"}
                </h1>
                <p className="text-sm text-gray-600">
                  Room {locationInfo?.name}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Phone Verification */}
        <main className="flex-1 max-w-md mx-auto w-full px-4 py-8">
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <Phone className="w-16 h-16 mx-auto text-blue-600 mb-4" />
                <h2 className="text-xl font-semibold mb-2">Phone Verification</h2>
                <p className="text-gray-600 text-sm">
                  Please enter the phone number you provided during reservation to access room service
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter your phone number"
                    value={verificationPhone}
                    onChange={(e) => setVerificationPhone(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && verifyPhoneNumber()}
                    className="mt-1"
                    disabled={isHotelClosed}
                  />
                </div>

                {verificationError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-red-600 text-sm">{verificationError}</p>
                  </div>
                )}

                <Button
                  onClick={verifyPhoneNumber}
                  className="w-full"
                  disabled={verifying || isHotelClosed}
                >
                  {verifying ? "Verifying..." : "Verify Phone Number"}
                </Button>

                <div className="text-center">
                  <p className="text-xs text-gray-500">
                    Can't access? Please call the front desk for assistance
                  </p>
                  {hotelSettings.phone && (
                    <a
                      href={`tel:${hotelSettings.phone}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-2 inline-block"
                    >
                      📞 {hotelSettings.phone}
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hotel Closed Dialog - Popup similar to phone verification */}
      <Dialog open={isHotelClosed} onOpenChange={() => {}}>
        <DialogContent className="w-full max-w-md shadow-lg">
          <div className="text-center p-2">
            <Clock className="w-16 h-16 mx-auto text-orange-600 mb-4" />
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl font-semibold text-center">
                We are Currently Closed
              </DialogTitle>
            </DialogHeader>
            <p className="text-gray-600 text-sm mb-6">
              Please proceed during opening hours
            </p>

            {hotelHours && (
              <div className="mb-6 p-4 bg-orange-50 rounded-lg text-sm">
                <p className="font-medium text-gray-700 mb-2">Operating Hours:</p>
                <p className="text-gray-600">{hotelHours.openingTime} - {hotelHours.closingTime}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Current time: {hotelHours.currentTime}
                </p>
              </div>
            )}

            <div className="text-center">
              <p className="text-xs text-gray-500 mb-4">
                Need assistance? Contact us during operating hours
              </p>
              {hotelSettings?.phone && (
                <Button
                  onClick={() => window.open(`tel:${hotelSettings.phone}`)}
                  className="w-full"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call {hotelSettings.phone}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">
                {hotelSettings.hotelName || "Restaurant"}
              </h1>
              <p className="text-sm text-gray-600">
                {locationInfo?.type === "table" ? "Table" : "Room"}{" "}
                {locationInfo?.name}
              </p>
            </div>
            {cart.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">{cart.length} items</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4">
        
        {renderTabContent()}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t sticky bottom-0 z-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex justify-around py-2">
            <button
              onClick={() => setActiveTab("dishes")}
              className={`flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === "dishes"
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-800"
              }`}
              disabled={isHotelClosed}
            >
              <UtensilsCrossed className="w-5 h-5" />
              <span className="text-xs font-medium">Dishes</span>
            </button>

            <button
              onClick={() => setActiveTab("cart")}
              className={`flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors relative ${
                activeTab === "cart"
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-800"
              }`}
              disabled={isHotelClosed}
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="text-xs font-medium">Order</span>
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  {cart.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("more")}
              className={`flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === "more"
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-800"
              }`}
              disabled={isHotelClosed}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-xs font-medium">More</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}