import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MetricsCards from "@/components/dashboard/metrics-cards";
import RecentReservations from "@/components/dashboard/recent-reservations";
import RecentOrders from "@/components/dashboard/recent-orders";
import QuickActions from "@/components/dashboard/quick-actions";
import RoomStatusOverview from "@/components/dashboard/room-status-overview";
import TableStatusOverview from "@/components/dashboard/table-status-overview";
import BranchMetrics from "@/components/dashboard/branch-metrics";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Building2, TrendingUp, Users, TrendingUp as RevenueIcon, Bed, AlertTriangle, Package } from "lucide-react";

// Low Stock Alerts Component
function LowStockAlerts() {
  const { data: lowStockItems = [] } = useQuery({
    queryKey: ["/api/inventory/low-stock"],
  });

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
      <CardHeader className="p-4">
        <CardTitle className="text-base font-semibold text-gray-900 flex items-center">
          <AlertTriangle className="mr-2 h-4 w-4 text-orange-500" />
          Low Stock Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {lowStockItems.length === 0 ? (
          <div className="text-center py-4">
            <Package className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">All items in stock</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {lowStockItems.slice(0, 5).map((item: any) => (
              <div key={item.id} className="flex justify-between items-center p-2 bg-orange-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.sku}</p>
                </div>
                <div className="text-right">
                  <Badge variant="destructive" className="text-xs">
                    {item.currentStock} {item.measuringUnitSymbol || item.measuringUnitName}
                  </Badge>
                </div>
              </div>
            ))}
            {lowStockItems.length > 5 && (
              <p className="text-xs text-gray-500 text-center pt-2">
                +{lowStockItems.length - 5} more items
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    enabled: isAuthenticated,
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

  // Enhanced dashboard for super admin showing all branches performance
  const { data: superAdminMetrics } = useQuery({
    queryKey: ["/api/dashboard/super-admin-metrics"],
    enabled: isAuthenticated && (user as any)?.role === "superadmin",
  });

  const isSuperAdmin = (user as any)?.role === "superadmin";

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        isMobileMenuOpen={isMobileSidebarOpen}
        setIsMobileMenuOpen={setIsMobileSidebarOpen}
      />
      <div className="main-content">
        <Header 
          title="Dashboard"
          subtitle={isSuperAdmin ? "Super Admin - Today's Overview (24 Hours)" : "Today's Hotel Operations Overview (24 Hours)"}
          onMobileMenuToggle={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />
        <main className="content-wrapper">
          {/* Super Admin Global Overview */}
          {isSuperAdmin && superAdminMetrics && (
            <div className="mb-6" style={{ display: 'contents' }}>

              {/* Branch Performance Cards */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Branch Performance
                  </CardTitle>
                  <CardDescription>
                    Real-time performance metrics across all hotel branches
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {(superAdminMetrics as any)?.branchMetrics?.map((branch: any) => (
                      <Card key={branch.branchId} className="border-l-4 border-l-primary">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{branch.branchName}</CardTitle>
                            <Badge variant="outline">ID: {branch.branchId}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Reservations</div>
                              <div className="font-medium">{branch.totalReservations}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Orders</div>
                              <div className="font-medium">{branch.totalOrders || 0}</div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-muted-foreground">Today's Revenue (Reservations, Orders)</div>
                              <div className="font-medium text-green-600">₨. {((branch.revenue || 0) + (branch.restaurantRevenue || 0)).toLocaleString()}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Quick Actions and Low Stock Alerts at the top */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
            <div className="lg:col-span-2">
              <QuickActions />
            </div>
            <LowStockAlerts />
          </div>

          <MetricsCards />

          {/* Show branch metrics only for super admin */}
          {!isSuperAdmin && (user as any)?.role === "superadmin" && <BranchMetrics />}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
            <RecentReservations />
            <RecentOrders />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
            <RoomStatusOverview />
            <TableStatusOverview />
          </div>
        </main>
      </div>
    </div>
  );
}