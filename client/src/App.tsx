import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useSSE } from "@/hooks/useSSE";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Reservations from "@/pages/reservations";
import Rooms from "@/pages/rooms";
import Guests from "@/pages/guests";
import Branches from "@/pages/branches";
import Users from "@/pages/users";
import RoleManagement from "@/pages/role-management";
import Profile from "@/pages/profile";
import RoomTypes from "@/pages/room-types";
import Billing from "@/pages/billing";
import Settings from "@/pages/settings";
import Analytics from "@/pages/analytics";
import RestaurantTables from "@/pages/restaurant-tables";
import RestaurantMenu from "@/pages/restaurant-menu";
import RestaurantOrders from "@/pages/restaurant-orders";
import RestaurantBilling from "@/pages/restaurant-billing";
import RestaurantCategories from "@/pages/restaurant-categories";
import RestaurantDishes from "@/pages/restaurant-dishes";
import RestaurantKOT from "@/pages/restaurant-kot";
import RestaurantBOT from "@/pages/restaurant-bot";
import TaxManagement from "@/pages/tax-management";
import StockCategories from "@/pages/stock-categories";
import StockItems from "@/pages/stock-items";
import MeasuringUnits from "@/pages/measuring-units";
import Suppliers from "@/pages/suppliers";
import StockConsumption from "@/pages/stock-consumption";
import DishIngredients from "@/pages/dish-ingredients";
import PurchaseOrders from "@/pages/purchase-orders";
import StockReceipts from "@/pages/stock-receipts";
import PurchaseAnalytics from "@/pages/purchase-analytics";
import { lazy, Suspense, useState } from "react";
import QROrderPage from "@/pages/qr-order";
import RoomOrders from "@/pages/room-orders";
import AuditLogs from "@/pages/audit-logs";

const RestaurantAnalytics = lazy(() => import("./pages/restaurant-analytics"));

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isConnected: sseConnected } = useSSE();

  return (
    <>
      <PWAInstallPrompt />
      <Switch>
        {/* Public QR order page - no authentication required */}
        <Route path="/order/:token">
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
              </div>
            }
          >
            <QROrderPage />
          </Suspense>
        </Route>
        {isLoading || !isAuthenticated ? (
          <Route path="/" component={Login} />
        ) : (
          <>
            <Route path="/" component={Dashboard} />
            <Route path="/reservations" component={Reservations} />
            <Route path="/rooms" component={Rooms} />
            <Route path="/room-types" component={RoomTypes} />
            <Route path="/guests" component={Guests} />
            <Route path="/branches" component={Branches} />
            <Route path="/users" component={Users} />
            <Route path="/role-management" component={RoleManagement} />
            <Route path="/profile" component={Profile} />
            <Route path="/billing" component={Billing} />
            <Route path="/analytics" component={Analytics} />
            <Route
              path="/restaurant/analytics"
              component={() => (
                <Suspense
                  fallback={
                    <div className="min-h-screen flex items-center justify-center">
                      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
                    </div>
                  }
                >
                  <RestaurantAnalytics />
                </Suspense>
              )}
            />
            <Route path="/settings" component={Settings} />
            <Route path="/profile" component={Profile} />
            <Route path="/restaurant/tables" component={RestaurantTables} />
            <Route path="/restaurant/menu" component={RestaurantMenu} />
            <Route
              path="/restaurant/categories"
              component={RestaurantCategories}
            />
            <Route path="/restaurant/dishes" component={RestaurantDishes} />
            <Route path="/restaurant/orders" component={RestaurantOrders} />
            <Route path="/room-orders" component={RoomOrders} />
            <Route path="/restaurant/kot" component={RestaurantKOT} />
            <Route path="/restaurant/bot" component={RestaurantBOT} />
            <Route path="/restaurant/billing" component={RestaurantBilling} />
            <Route path="/tax-management" component={TaxManagement} />
            <Route
              path="/inventory/stock-categories"
              component={StockCategories}
            />
            <Route path="/inventory/stock-items" component={StockItems} />
            <Route
              path="/inventory/measuring-units"
              component={MeasuringUnits}
            />
            <Route path="/inventory/suppliers" component={Suppliers} />
            <Route path="/inventory/consumption" component={StockConsumption} />
            <Route
              path="/restaurant/dishes/:dishId/ingredients"
              component={DishIngredients}
            />
            <Route path="/inventory/purchase-orders" component={PurchaseOrders} />
            <Route path="/inventory/stock-receipts" component={StockReceipts} />
            <Route path="/inventory/purchase-analytics" component={PurchaseAnalytics} />
            <Route path="/audit-logs" component={AuditLogs} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <PWAInstallPrompt />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;