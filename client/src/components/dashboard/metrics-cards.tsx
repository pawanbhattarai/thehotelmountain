import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, ShoppingCart, TrendingUp, DollarSign } from "lucide-react";

export default function MetricsCards() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
  });

  const { data: restaurantMetrics } = useQuery({
    queryKey: ["/api/restaurant/dashboard/metrics"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-24 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metricsData = [
    {
      title: "Total Reservations",
      value: (metrics as any)?.todayReservations || 0,
      icon: Calendar,
      iconBg: "bg-primary-50",
      iconColor: "text-primary",
    },
    {
      title: "Total Orders",
      value: (restaurantMetrics as any)?.totalOrders || 0,
      icon: ShoppingCart,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      title: "Revenue (Reservations)",
      value: `Rs. ${((metrics as any)?.todayRevenue || 0).toLocaleString()}`,
      icon: TrendingUp,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      title: "Revenue (Orders)",
      value: `Rs. ${((restaurantMetrics as any)?.totalRevenue || 0).toLocaleString()}`,
      icon: TrendingUp,
      iconBg: "bg-yellow-50",
      iconColor: "text-yellow-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {metricsData.map((metric, index) => (
        <Card
          key={index}
          className="bg-white rounded-xl shadow-sm border border-gray-200"
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {metric.title}
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {metric.value}
                </p>
              </div>
              <div
                className={`w-12 h-12 ${metric.iconBg} rounded-xl flex items-center justify-center`}
              >
                <metric.icon
                  className={`${metric.iconColor} text-xl h-6 w-6`}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
