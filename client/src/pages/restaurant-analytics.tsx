import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import { TrendingUp, Banknote, Utensils, Clock, Star } from "lucide-react";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function RestaurantAnalytics() {
  const [period, setPeriod] = useState("30d");

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ["/api/restaurant/analytics/revenue", period],
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/restaurant/analytics/orders", period],
  });

  const { data: dishesData, isLoading: dishesLoading } = useQuery({
    queryKey: ["/api/restaurant/analytics/dishes"],
  });

  const { data: tablesData, isLoading: tablesLoading } = useQuery({
    queryKey: ["/api/restaurant/analytics/tables"],
  });

  const { data: operationsData, isLoading: operationsLoading } = useQuery({
    queryKey: ["/api/restaurant/analytics/operations"],
  });

  if (
    revenueLoading ||
    ordersLoading ||
    dishesLoading ||
    tablesLoading ||
    operationsLoading
  ) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Restaurant Analytics</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Restaurant Analytics</h1>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 Days</SelectItem>
            <SelectItem value="30d">30 Days</SelectItem>
            <SelectItem value="90d">90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Revenue
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  NPR{" "}
                  {(revenueData as any)?.totalRevenue?.toLocaleString() || "0"}
                </p>
                <div className="flex items-center mt-2">
                  <TrendingUp
                    className={`h-4 w-4 ${(revenueData as any)?.revenueGrowth >= 0 ? "text-green-600" : "text-red-600"}`}
                  />
                  <span
                    className={`text-sm font-medium ml-1 ${(revenueData as any)?.revenueGrowth >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {(revenueData as any)?.revenueGrowth?.toFixed(1)}% vs last
                    period
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                <Banknote className="text-white h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Orders
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {(ordersData as any)?.totalOrders?.toLocaleString() || "0"}
                </p>
                <div className="flex items-center mt-2">
                  <Utensils className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-500 ml-1">
                    {(ordersData as any)?.ordersToday || 0} today
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                <Utensils className="text-white h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Average Order Value
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  NPR{" "}
                  {(ordersData as any)?.averageOrderValue?.toLocaleString() ||
                    "0"}
                </p>
                <div className="flex items-center mt-2">
                  <Star className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-gray-500 ml-1">
                    per order
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center">
                <Star className="text-white h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Table Turnover
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {(tablesData as any)?.averageTurnover?.toFixed(1) || "0"}
                </p>
                <div className="flex items-center mt-2">
                  <Clock className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-500 ml-1">
                    times per day
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                <Clock className="text-white h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="dishes">Dishes</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Daily Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={(revenueData as any)?.dailyRevenue || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => [`NPR ${value}`, "Revenue"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hourly Revenue Pattern</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={(revenueData as any)?.hourlyRevenue || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => [`NPR ${value}`, "Revenue"]}
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Daily Orders Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={(ordersData as any)?.dailyOrders || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => [value, "Orders"]} />
                    <Line
                      type="monotone"
                      dataKey="orders"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={ordersData?.ordersByStatus || []}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      label={({ status, count }) => `${status}: ${count}`}
                    >
                      {ordersData?.ordersByStatus?.map(
                        (entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ),
                      )}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dishes" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Selling Dishes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dishesData?.topDishes
                    ?.slice(0, 5)
                    .map((dish: any, index: number) => (
                      <div
                        key={dish.id}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <span className="font-medium">{dish.name}</span>
                            <p className="text-sm text-gray-500">
                              {dish.totalOrders} orders
                            </p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-green-600">
                          NPR {dish.totalRevenue}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dishesData?.categoryPerformance || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="categoryName" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="totalRevenue"
                      fill="#f59e0b"
                      name="Revenue (NPR)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tables" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Table Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tablesData?.tablePerformance || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tableName" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="totalRevenue"
                      fill="#06b6d4"
                      name="Revenue (NPR)"
                    />
                    <Bar dataKey="totalOrders" fill="#84cc16" name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Table Utilization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tablesData?.tableUtilization
                    ?.slice(0, 5)
                    .map((table: any, index: number) => (
                      <div
                        key={table.id}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <span className="font-medium">
                              {table.tableName}
                            </span>
                            <p className="text-sm text-gray-500">
                              Capacity: {table.capacity}
                            </p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-blue-600">
                          {table.utilizationRate}%
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Peak Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={operationsData?.peakHours || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip formatter={(value) => [value, "Orders"]} />
                    <Bar dataKey="orderCount" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Operational Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">
                      Average Preparation Time
                    </span>
                    <span className="text-lg font-bold">
                      {operationsData?.avgPreparationTime} min
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Average Service Time</span>
                    <span className="text-lg font-bold">
                      {operationsData?.avgServiceTime} min
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Order Cancellation Rate</span>
                    <span className="text-lg font-bold text-red-600">
                      {operationsData?.cancellationRate}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Customer Satisfaction</span>
                    <span className="text-lg font-bold text-green-600">
                      {operationsData?.customerSatisfaction}/5
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
