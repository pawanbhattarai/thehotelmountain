import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
    BarChart3,
    Calendar,
    Bed,
    Users,
    CreditCard,
    Settings,
    Building2,
    UserCheck,
    SquareStack,
    TrendingUp,
    LogOut,
    ChevronDown,
    ChevronRight,
    Menu as MenuIcon,
    X,
    ChefHat,
    Receipt,
    ClipboardList,
    Utensils,
    User,
    Bell,
    Package,
    Shield,
    TrendingDown,
    Layers,
    Scale,
    ShoppingCart,
    Home,
    Hotel,
    UserPlus,
    Truck,
    Coffee,
    FileText,
    Calculator,
    UtensilsCrossed,
    BarChart,
    PieChart,
    LineChart,
    Activity,
    DollarSign,
    MapPin,
    Percent,
    UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NotificationManager } from "@/components/NotificationManager";

interface SidebarProps {
    isMobileMenuOpen?: boolean;
    setIsMobileMenuOpen?: (open: boolean) => void;
}

export default function Sidebar({
    isMobileMenuOpen = false,
    setIsMobileMenuOpen,
}: SidebarProps = {}) {
    const { user, isLoading } = useAuth();
    const { canAccess } = usePermissions();

    // Don't render sidebar content if still loading user permissions
    if (isLoading) {
        return null;
    }
    const [location, navigate] = useLocation();
    const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false);

    // User-controlled persistent menu expansion using localStorage
    const [isPMSExpanded, setIsPMSExpanded] = useState(() => {
        const saved = localStorage.getItem('sidebar-pms-expanded');
        return saved ? JSON.parse(saved) : false;
    });
    const [isSetupExpanded, setIsSetupExpanded] = useState(() => {
        const saved = localStorage.getItem('sidebar-setup-expanded');
        return saved ? JSON.parse(saved) : false;
    });
    const [isRMSExpanded, setIsRMSExpanded] = useState(() => {
        const saved = localStorage.getItem('sidebar-rms-expanded');
        return saved ? JSON.parse(saved) : false;
    });
    const [isReportsExpanded, setIsReportsExpanded] = useState(() => {
        const saved = localStorage.getItem('sidebar-reports-expanded');
        return saved ? JSON.parse(saved) : false;
    });
    const [isInventoryExpanded, setIsInventoryExpanded] = useState(() => {
        const saved = localStorage.getItem('sidebar-inventory-expanded');
        return saved ? JSON.parse(saved) : false;
    });

    // Use props if provided, otherwise use internal state
    const isMenuOpen = setIsMobileMenuOpen
        ? isMobileMenuOpen
        : internalMobileMenuOpen;
    const setMenuOpen = setIsMobileMenuOpen || setInternalMobileMenuOpen;

    // Save expansion state to localStorage when changed
    useEffect(() => {
        localStorage.setItem('sidebar-pms-expanded', JSON.stringify(isPMSExpanded));
    }, [isPMSExpanded]);

    useEffect(() => {
        localStorage.setItem('sidebar-setup-expanded', JSON.stringify(isSetupExpanded));
    }, [isSetupExpanded]);

    useEffect(() => {
        localStorage.setItem('sidebar-rms-expanded', JSON.stringify(isRMSExpanded));
    }, [isRMSExpanded]);

    useEffect(() => {
        localStorage.setItem('sidebar-reports-expanded', JSON.stringify(isReportsExpanded));
    }, [isReportsExpanded]);

    useEffect(() => {
        localStorage.setItem('sidebar-inventory-expanded', JSON.stringify(isInventoryExpanded));
    }, [isInventoryExpanded]);

    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include",
            });
            window.location.href = "/";
        } catch (error) {
            console.error("Logout error:", error);
            window.location.href = "/";
        }
    };

    const isActiveRoute = (path: string) => {
        if (path === "/" && location === "/") return true;
        if (path !== "/" && location.startsWith(path)) return true;
        return false;
    };

    const hasAccess = (allowedRoles: string[], module?: string) => {
        // For backward compatibility with built-in roles
        if (module && user) {
            return canAccess(module);
        }
        return user && allowedRoles.includes((user as any).role);
    };

    const getRoleDisplayName = (role: string) => {
        switch (role) {
            case "superadmin":
                return "Superadmin";
            case "branch-admin":
                return "Branch Admin";
            default:
                return role;
        }
    };

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-white border-r border-gray-200">
            {/* Header */}
            <div className="border-b border-gray-200">
                <div className="flex items-center justify-between px-2 lg:px-2 py-1">
                    <div className="flex items-center">
                        <div className="w-14 h-14 lg:w-20 lg:h-20 rounded-lg flex items-center justify-center">
                            <img
                                src="/sidebar_icon.png"
                                alt="Hotel Mitra Logo"
                                className="h-14 w-14 lg:h-20 lg:w-20 object-contain"
                            />
                        </div>
                        <div className="ml-3 lg:ml-4">
                            <h1 className="text-base lg:text-lg font-bold text-gray-900">
                                Hotel Mitra
                            </h1>
                            <p className="text-xs lg:text-sm text-gray-600">
                                {user
                                    ? getRoleDisplayName((user as any).role)
                                    : "Loading..."}
                            </p>
                        </div>
                    </div>
                    {/* Mobile close button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="lg:hidden h-8 w-8 p-0"
                        onClick={() => setMenuOpen(false)}
                    >
                    </Button>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full px-2 lg:px-3">
                    <nav className="py-3 space-y-1">
                        {/* Dashboard */}
                        {canAccess("dashboard") && (
                            <button
                                onClick={() => {
                                    navigate("/");
                                    setMenuOpen(false);
                                }}
                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-2 transition-colors ${
                                    isActiveRoute("/")
                                        ? "bg-primary text-white"
                                        : "text-gray-700 hover:bg-gray-100"
                                }`}
                            >
                                <BarChart3 className="mr-3 h-4 w-4 flex-shrink-0" />
                                <span className="text-sm font-medium">
                                    Dashboard
                                </span>
                            </button>
                        )}

                        {/* PMS Section */}
                        <Collapsible
                            open={isPMSExpanded}
                            onOpenChange={setIsPMSExpanded}
                        >
                            <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100 rounded-lg mx-2">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    PMS
                                </span>
                                {isPMSExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-gray-500" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-gray-500" />
                                )}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-1 mt-2">
                                {/* Reservations */}
                                {canAccess("reservations") && (
                                    <button
                                        onClick={() => {
                                            navigate("/reservations");
                                            setMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                            isActiveRoute("/reservations")
                                                ? "bg-primary text-white"
                                                : "text-gray-700 hover:bg-gray-100"
                                        }`}
                                    >
                                        <Calendar className="mr-3 h-4 w-4 flex-shrink-0" />
                                        <span className="text-sm font-medium">
                                            Reservations
                                        </span>
                                    </button>
                                )}

                                {/* Room Management */}
                                {canAccess("rooms") && (
                                    <button
                                        onClick={() => {
                                            navigate("/rooms");
                                            setMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                            isActiveRoute("/rooms")
                                                ? "bg-primary text-white"
                                                : "text-gray-700 hover:bg-gray-100"
                                        }`}
                                    >
                                        <Bed className="mr-3 h-4 w-4 flex-shrink-0" />
                                        <span className="text-sm font-medium">
                                            Room Management
                                        </span>
                                    </button>
                                )}

                                {/* Guest Management */}
                                {canAccess("guests") && (
                                    <button
                                        onClick={() => {
                                            navigate("/guests");
                                            setMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                            isActiveRoute("/guests")
                                                ? "bg-primary text-white"
                                                : "text-gray-700 hover:bg-gray-100"
                                        }`}
                                    >
                                        <Users className="mr-3 h-4 w-4 flex-shrink-0" />
                                        <span className="text-sm font-medium">
                                            Guest Management
                                        </span>
                                    </button>
                                )}

                                {/* Room Orders */}
                                {canAccess("room-orders") && (
                                    <button
                                        onClick={() => {
                                            navigate("/room-orders");
                                            setMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                            isActiveRoute("/room-orders")
                                                ? "bg-primary text-white"
                                                : "text-gray-700 hover:bg-gray-100"
                                        }`}
                                    >
                                        <Utensils className="mr-3 h-4 w-4 flex-shrink-0" />
                                        <span className="text-sm font-medium">
                                            Room Orders
                                        </span>
                                    </button>
                                )}

                                {/* Billing */}
                                {canAccess("billing") && (
                                    <button
                                        onClick={() => {
                                            navigate("/billing");
                                            setMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                            isActiveRoute("/billing")
                                                ? "bg-primary text-white"
                                                : "text-gray-700 hover:bg-gray-100"
                                        }`}
                                    >
                                        <CreditCard className="mr-3 h-4 w-4 flex-shrink-0" />
                                        <span className="text-sm font-medium">
                                            Billing
                                        </span>
                                    </button>
                                )}

                                {/* Room Types */}
                                {canAccess("room-types") && (
                                    <button
                                        onClick={() => {
                                            navigate("/room-types");
                                            setMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                            isActiveRoute("/room-types")
                                                ? "bg-primary text-white"
                                                : "text-gray-700 hover:bg-gray-100"
                                        }`}
                                    >
                                        <SquareStack className="mr-3 h-4 w-4 flex-shrink-0" />
                                        <span className="text-sm font-medium">
                                            Room Types
                                        </span>
                                    </button>
                                )}
                            </CollapsibleContent>
                        </Collapsible>

                        {/* RMS Section */}
                        {(canAccess("restaurant-tables") ||
                            canAccess("restaurant-categories") ||
                            canAccess("restaurant-dishes") ||
                            canAccess("restaurant-orders") ||
                            canAccess("restaurant-billing")) && (
                            <div className="border-t border-gray-200 pt-4 mt-4">
                                <Collapsible
                                    open={isRMSExpanded}
                                    onOpenChange={setIsRMSExpanded}
                                >
                                    <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100 rounded-lg mx-2">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                            RMS
                                        </span>
                                        {isRMSExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-gray-500" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 text-gray-500" />
                                        )}
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-1 mt-2">
                                        {/* Tables */}
                                        {canAccess("restaurant-tables") && (
                                            <button
                                                onClick={() => {
                                                    navigate(
                                                        "/restaurant/tables",
                                                    );
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/restaurant/tables",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <Utensils className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    Tables
                                                </span>
                                            </button>
                                        )}

                                        {/* Category */}
                                        {canAccess("restaurant-categories") && (
                                            <button
                                                onClick={() => {
                                                    navigate(
                                                        "/restaurant/categories",
                                                    );
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/restaurant/categories",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <MenuIcon className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    Category
                                                </span>
                                            </button>
                                        )}

                                        {/* Dishes */}
                                        {canAccess("restaurant-dishes") && (
                                            <button
                                                onClick={() => {
                                                    navigate(
                                                        "/restaurant/dishes",
                                                    );
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/restaurant/dishes",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <ChefHat className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    Dishes
                                                </span>
                                            </button>
                                        )}

                                        {/* Orders */}
                                        {canAccess("restaurant-orders") && (
                                            <button
                                                onClick={() => {
                                                    navigate(
                                                        "/restaurant/orders",
                                                    );
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/restaurant/orders",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <ClipboardList className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    Orders
                                                </span>
                                            </button>
                                        )}

                                        {/* KOT */}
                                        {canAccess("restaurant-orders") && (
                                            <button
                                                onClick={() => {
                                                    navigate("/restaurant/kot");
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/restaurant/kot",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <ChefHat className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    KOT
                                                </span>
                                            </button>
                                        )}

                                        {/* BOT */}
                                        {canAccess("restaurant-orders") && (
                                            <button
                                                onClick={() => {
                                                    navigate("/restaurant/bot");
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/restaurant/bot",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <Package className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    BOT
                                                </span>
                                            </button>
                                        )}

                                        {/* Billing */}
                                        {canAccess("restaurant-billing") && (
                                            <button
                                                onClick={() => {
                                                    navigate(
                                                        "/restaurant/billing",
                                                    );
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/restaurant/billing",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <Receipt className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    Billing
                                                </span>
                                            </button>
                                        )}
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                        )}

                        {/* Inventory Section */}
                        {(canAccess("inventory-stock-categories") ||
                            canAccess("inventory-stock-items") ||
                            canAccess("inventory-measuring-units") ||
                            canAccess("inventory-suppliers") ||
                            canAccess("inventory-consumption") ||
                            canAccess("inventory-purchase-orders") ||
                            canAccess("inventory-stock-receipts") ||
                            canAccess("inventory-purchase-analytics")) && (
                            <div className="border-t border-gray-200 pt-4 mt-4">
                                <Collapsible
                                    open={isInventoryExpanded}
                                    onOpenChange={setIsInventoryExpanded}
                                >
                                    <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100 rounded-lg mx-2">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                            Inventory
                                        </span>
                                        {isInventoryExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-gray-500" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 text-gray-500" />
                                        )}
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-1 mt-2">
                                        {/* Measuring Units */}
                                        {canAccess(
                                            "inventory-measuring-units",
                                        ) && (
                                            <button
                                                onClick={() => {
                                                    navigate(
                                                        "/inventory/measuring-units",
                                                    );
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/inventory/measuring-units",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <Scale className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    Measuring Units
                                                </span>
                                            </button>
                                        )}
                                        {/* Stock Categories */}
                                        {canAccess(
                                            "inventory-stock-categories",
                                        ) && (
                                            <button
                                                onClick={() => {
                                                    navigate(
                                                        "/inventory/stock-categories",
                                                    );
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/inventory/stock-categories",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <Layers className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    Stock Categories
                                                </span>
                                            </button>
                                        )}

                                        {/* Stock Items */}
                                        {canAccess("inventory-stock-items") && (
                                            <button
                                                onClick={() => {
                                                    navigate(
                                                        "/inventory/stock-items",
                                                    );
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/inventory/stock-items",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <Package className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    Stock Items
                                                </span>
                                            </button>
                                        )}

                                        {/* Suppliers */}
                                        {canAccess("inventory-suppliers") && (
                                            <button
                                                onClick={() => {
                                                    navigate(
                                                        "/inventory/suppliers",
                                                    );
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/inventory/suppliers",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <Users className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    Suppliers
                                                </span>
                                            </button>
                                        )}

                                        {/* Purchase Orders */}
                                        {canAccess(
                                            "inventory-purchase-orders",
                                        ) && (
                                            <button
                                                onClick={() => {
                                                    navigate(
                                                        "/inventory/purchase-orders",
                                                    );
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/inventory/purchase-orders",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <ShoppingCart className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    Purchase Orders
                                                </span>
                                            </button>
                                        )}

                                        {/* Stock Receipts */}
                                        {canAccess(
                                            "inventory-stock-receipts",
                                        ) && (
                                            <button
                                                onClick={() => {
                                                    navigate(
                                                        "/inventory/stock-receipts",
                                                    );
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/inventory/stock-receipts",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <Package className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    Stock Receipts
                                                </span>
                                            </button>
                                        )}
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                        )}
                        {/* Reports Section */}
                        {(canAccess("analytics") ||
                            canAccess("restaurant-analytics") ||
                            canAccess("inventory-purchase-analytics")) && (
                            <div className="border-t border-gray-200 pt-4 mt-4">
                                <Collapsible
                                    open={isReportsExpanded}
                                    onOpenChange={setIsReportsExpanded}
                                >
                                    <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100 rounded-lg mx-2">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                            Reports
                                        </span>
                                        {isReportsExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-gray-500" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 text-gray-500" />
                                        )}
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-1 mt-2">
                                        {canAccess("analytics") && (
                                            <button
                                                onClick={() => {
                                                    navigate("/analytics");
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute("/analytics")
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <TrendingUp className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    PMS Analytics
                                                </span>
                                            </button>
                                        )}
                                        {canAccess("restaurant-analytics") && (
                                            <button
                                                onClick={() => {
                                                    navigate(
                                                        "/restaurant/analytics",
                                                    );
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/restaurant/analytics",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <ChefHat className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    RMS Analytics
                                                </span>
                                            </button>
                                        )}
                                        {canAccess(
                                            "inventory-purchase-analytics",
                                        ) && (
                                            <button
                                                onClick={() => {
                                                    navigate(
                                                        "/inventory/purchase-analytics",
                                                    );
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/inventory/purchase-analytics",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <TrendingUp className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    Purchase Analytics
                                                </span>
                                            </button>
                                        )}
                                        {/* Stock Consumption */}
                                        {canAccess("inventory-consumption") && (
                                            <button
                                                onClick={() => {
                                                    navigate(
                                                        "/inventory/consumption",
                                                    );
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/inventory/consumption",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <TrendingDown className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    Stock Consumption
                                                </span>
                                            </button>
                                        )}
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                        )}

                        {/* Setup Section */}
                        <div className="border-t border-gray-200 pt-4 mt-4">
                            <Collapsible
                                open={isSetupExpanded}
                                onOpenChange={setIsSetupExpanded}
                            >
                                <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100 rounded-lg mx-2">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Setup
                                    </span>
                                    {isSetupExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-gray-500" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-gray-500" />
                                    )}
                                </CollapsibleTrigger>
                                <CollapsibleContent className="space-y-1 mt-2">
                                    {/* Branch Management */}
                                    {canAccess("branches") && (
                                        <button
                                            onClick={() => {
                                                navigate("/branches");
                                                setMenuOpen(false);
                                            }}
                                            className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                isActiveRoute("/branches")
                                                    ? "bg-primary text-white"
                                                    : "text-gray-700 hover:bg-gray-100"
                                            }`}
                                        >
                                            <Building2 className="mr-3 h-4 w-4 flex-shrink-0" />
                                            <span className="text-sm font-medium">
                                                Branch Management
                                            </span>
                                        </button>
                                    )}

                                    {/* User Management */}
                                    {canAccess("users") && (
                                        <button
                                            onClick={() => {
                                                navigate("/users");
                                                setMenuOpen(false);
                                            }}
                                            className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                isActiveRoute("/users")
                                                    ? "bg-primary text-white"
                                                    : "text-gray-700 hover:bg-gray-100"
                                            }`}
                                        >
                                            <UserCheck className="mr-3 h-4 w-4 flex-shrink-0" />
                                            <span className="text-sm font-medium">
                                                User Management
                                            </span>
                                        </button>
                                    )}

                                    {/* Role Management */}
                                    {user && user.role === "superadmin" && (
                                        <button
                                            onClick={() => {
                                                navigate("/role-management");
                                                setMenuOpen(false);
                                            }}
                                            className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                isActiveRoute(
                                                    "/role-management",
                                                )
                                                    ? "bg-primary text-white"
                                                    : "text-gray-700 hover:bg-gray-100"
                                            }`}
                                        >
                                            <Users className="mr-3 h-4 w-4 flex-shrink-0" />
                                            <span className="text-sm font-medium">
                                                Role Management
                                            </span>
                                        </button>
                                    )}

                                    {/* Tax/Charges */}
                                    {canAccess("tax-management") && (
                                        <button
                                            onClick={() => {
                                                navigate("/tax-management");
                                                setMenuOpen(false);
                                            }}
                                            className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                isActiveRoute("/tax-management")
                                                    ? "bg-primary text-white"
                                                    : "text-gray-700 hover:bg-gray-100"
                                            }`}
                                        >
                                            <Receipt className="mr-3 h-4 w-4 flex-shrink-0" />
                                            <span className="text-sm font-medium">
                                                Tax/Charges
                                            </span>
                                        </button>
                                    )}

                                    {/* Settings */}
                                    {canAccess("settings") && (
                                        <button
                                            onClick={() => {
                                                navigate("/settings");
                                                setMenuOpen(false);
                                            }}
                                            className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                isActiveRoute("/settings")
                                                    ? "bg-primary text-white"
                                                    : "text-gray-700 hover:bg-gray-100"
                                            }`}
                                        >
                                            <Settings className="mr-3 h-4 w-4 flex-shrink-0" />
                                            <span className="text-sm font-medium">
                                                Settings
                                            </span>
                                        </button>
                                    )}

                                    {/* Profile */}
                                    {canAccess("profile") && (
                                        <button
                                            onClick={() => {
                                                navigate("/profile");
                                                setMenuOpen(false);
                                            }}
                                            className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                isActiveRoute("/profile")
                                                    ? "bg-primary text-white"
                                                    : "text-gray-700 hover:bg-gray-100"
                                            }`}
                                        >
                                            <User className="mr-3 h-4 w-4 flex-shrink-0" />
                                            <span className="text-sm font-medium">
                                                Profile
                                            </span>
                                        </button>
                                    )}

                                    {/* Audit Logs */}
                                    {user && user.role === "superadmin" && (
                                        <button
                                            onClick={() => {
                                                navigate("/audit-logs");
                                                setMenuOpen(false);
                                            }}
                                            className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                isActiveRoute("/audit-logs")
                                                    ? "bg-primary text-white"
                                                    : "text-gray-700 hover:bg-gray-100"
                                            }`}
                                        >
                                            <Shield className="mr-3 h-4 w-4 flex-shrink-0" />
                                            <span className="text-sm font-medium">
                                                Audit Logs
                                            </span>
                                        </button>
                                    )}

                                    {/* Notifications */}
                                    {canAccess("notifications") && (
                                        <div>
                                            <button
                                                onClick={() => {
                                                    navigate("/notifications");
                                                    setMenuOpen(false);
                                                }}
                                                className={`w-full flex items-center px-3 py-2 lg:py-2.5 text-left rounded-lg mx-6 transition-colors ${
                                                    isActiveRoute(
                                                        "/notifications",
                                                    )
                                                        ? "bg-primary text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <Bell className="mr-3 h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm font-medium">
                                                    Notifications
                                                </span>
                                            </button>

                                            {/* Notification Manager */}
                                            <div
                                                className="px-3 py-1 mx-6"
                                                style={{
                                                    pointerEvents: "auto",
                                                }}
                                            >
                                                <NotificationManager />
                                            </div>
                                        </div>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>
                        </div>
                    </nav>
                </ScrollArea>
            </div>

            {/* Footer */}
            <div className="p-3 lg:p-4 border-t border-gray-200 flex-shrink-0">
                <div className="flex items-center">
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                            {user
                                ? `${(user as any).firstName || "User"} ${(user as any).lastName || ""}`.trim()
                                : "Loading..."}
                        </p>
                        <p className="text-xs text-gray-600">
                            {(user as any)?.email || "Loading..."}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLogout}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile Sidebar */}
            <div className="lg:hidden">
                <Sheet open={isMenuOpen} onOpenChange={setMenuOpen}>
                    <SheetTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="fixed top-3 left-3 z-50 lg:hidden bg-white shadow-md border"
                        >
                            <MenuIcon className="h-4 w-4" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        side="left"
                        className="w-72 sm:w-80 p-0 max-w-[85vw]"
                    >
                        <SidebarContent />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:bg-white lg:border-r lg:border-gray-200 lg:z-30">
                <SidebarContent />
            </div>
        </>
    );
}
