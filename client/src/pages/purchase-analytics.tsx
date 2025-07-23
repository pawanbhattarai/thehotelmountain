

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
import { Button } from "@/components/ui/button";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import { 
  Coins, 
  ShoppingCart, 
  TrendingUp, 
  Package,
  Users,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function PurchaseAnalytics() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<string>("30");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(dateRange));
  const endDate = new Date();

  const { data: purchaseAnalytics, isLoading: purchaseLoading } = useQuery({
    queryKey: ["/api/purchase-analytics", selectedBranch, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
    queryFn: () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
      if (selectedBranch !== "all") {
        params.append("branchId", selectedBranch);
      }
      return fetch(`/api/purchase-analytics?${params}`).then(res => res.json());
    },
  });

  const { data: inventoryValuation, isLoading: valuationLoading } = useQuery({
    queryKey: ["/api/inventory-valuation", selectedBranch],
    queryFn: () => {
      const params = selectedBranch !== "all" ? `?branchId=${selectedBranch}` : "";
      return fetch(`/api/inventory-valuation${params}`).then(res => res.json());
    },
  });

  const { data: profitAnalysis, isLoading: profitLoading } = useQuery({
    queryKey: ["/api/profit-analysis", selectedBranch, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
    queryFn: () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
      if (selectedBranch !== "all") {
        params.append("branchId", selectedBranch);
      }
      return fetch(`/api/profit-analysis?${params}`).then(res => res.json());
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["/api/branches"],
    enabled: user?.role === "superadmin",
  });

  if (purchaseLoading || valuationLoading || profitLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-7xl space-y-6">
          <div className="flex justify-center items-center">
            <h1 className="text-3xl font-bold">Purchase Analytics</h1>
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
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="w-full max-w-7xl mx-auto space-y-6">
        {/* Mobile-first responsive header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.history.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold">Purchase Analytics</h1>
          </div>
          
          {/* Responsive filters */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
                <SelectItem value="90">90 Days</SelectItem>
                <SelectItem value="365">1 Year</SelectItem>
              </SelectContent>
            </Select>

            {user?.role === "superadmin" && (
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch: any) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Key Metrics Overview - Mobile-first responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-600 truncate">
                    Total Investment
                  </p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                    Rs.{" "}
                    {purchaseAnalytics?.totalInvestment?.toLocaleString() || "0"}
                  </p>
                  <div className="flex items-center mt-2">
                    <ShoppingCart className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-500 ml-1 truncate">
                      {purchaseAnalytics?.totalOrders || 0} purchase orders
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                  <Coins className="text-white h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-600 truncate">
                    Total Revenue
                  </p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                    Rs.{" "}
                    {profitAnalysis?.totalRevenue?.toLocaleString() || "0"}
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className={`h-4 w-4 flex-shrink-0 ${profitAnalysis?.grossProfit >= 0 ? "text-green-600" : "text-red-600"}`} />
                    <span className="text-sm font-medium text-gray-500 ml-1 truncate">
                      Hotel: Rs. {profitAnalysis?.hotelRevenue?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                  <TrendingUp className="text-white h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-600 truncate">
                    Gross Profit
                  </p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                    Rs.{" "}
                    {profitAnalysis?.grossProfit?.toLocaleString() || "0"}
                  </p>
                  <div className="flex items-center mt-2">
                    <BarChart3 className="h-4 w-4 text-purple-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-500 ml-1 truncate">
                      {profitAnalysis?.profitMargin?.toFixed(1) || 0}% margin
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                  <BarChart3 className="text-white h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-600 truncate">
                    Inventory Value
                  </p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                    Rs.{" "}
                    {inventoryValuation?.totalInventoryValue?.toLocaleString() || "0"}
                  </p>
                  <div className="flex items-center mt-2">
                    <Package className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-500 ml-1 truncate">
                      Current stock value
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                  <Package className="text-white h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Responsive tabs */}
        <Tabs defaultValue="financial" className="space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="grid w-full grid-cols-5 min-w-max">
              <TabsTrigger value="financial" className="text-xs sm:text-sm">Financial</TabsTrigger>
              <TabsTrigger value="suppliers" className="text-xs sm:text-sm">Suppliers</TabsTrigger>
              <TabsTrigger value="inventory" className="text-xs sm:text-sm">Inventory</TabsTrigger>
              <TabsTrigger value="trends" className="text-xs sm:text-sm">Trends</TabsTrigger>
              <TabsTrigger value="profit" className="text-xs sm:text-sm">Profit Analysis</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="financial" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue vs Investment</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                    <AreaChart
                      data={[
                        {
                          name: 'Financial Overview',
                          Investment: profitAnalysis?.totalCosts || 0,
                          Revenue: profitAnalysis?.totalRevenue || 0,
                          Profit: profitAnalysis?.grossProfit || 0,
                        },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`Rs. ${Number(value).toLocaleString()}`, '']} />
                      <Area
                        type="monotone"
                        dataKey="Investment"
                        stackId="1"
                        stroke="#ff7300"
                        fill="#ff7300"
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="Revenue"
                        stackId="2"
                        stroke="#387908"
                        fill="#387908"
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Investment Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                    <BarChart data={purchaseAnalytics?.monthlyTrends || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`Rs. ${Number(value).toLocaleString()}`, 'Amount']} />
                      <Bar dataKey="totalAmount" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Suppliers by Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={purchaseAnalytics?.supplierBreakdown?.slice(0, 5) || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="supplierName" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`Rs. ${Number(value).toLocaleString()}`, 'Amount']} />
                      <Bar dataKey="totalAmount" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Supplier Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:space-y-4">
                    {purchaseAnalytics?.supplierBreakdown?.slice(0, 5).map((supplier: any, index: number) => (
                      <div key={supplier.supplierId} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <span className="font-medium">{supplier.supplierName}</span>
                            <p className="text-sm text-gray-500">{supplier.totalOrders} orders</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">Rs. {Number(supplier.totalAmount).toLocaleString()}</p>
                          <p className="text-sm text-gray-500">
                            Avg: Rs. {(Number(supplier.totalAmount) / supplier.totalOrders).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Inventory Items by Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={inventoryValuation?.itemsValuation?.slice(0, 5) || []}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="totalCost"
                        label={({ stockItemName, percent }) => `${stockItemName} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {(inventoryValuation?.itemsValuation?.slice(0, 5) || []).map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`Rs. ${Number(value).toLocaleString()}`, 'Value']} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>High Value Inventory Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {inventoryValuation?.itemsValuation
                      ?.sort((a: any, b: any) => b.totalCost - a.totalCost)
                      ?.slice(0, 5)
                      ?.map((item: any, index: number) => (
                      <div key={item.stockItemId} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <span className="font-medium">{item.stockItemName}</span>
                            <p className="text-sm text-gray-500">
                              {Number(item.currentStock).toFixed(2)} {item.measuringUnitSymbol}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">Rs. {Number(item.totalCost || 0).toLocaleString()}</p>
                          <p className="text-sm text-gray-500">
                            Avg: Rs. {Number(item.averageCost || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Purchase Trends Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300} className="sm:h-[400px]">
                    <LineChart data={purchaseAnalytics?.monthlyTrends || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`Rs. ${Number(value).toLocaleString()}`, 'Amount']} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="totalAmount" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        name="Purchase Amount"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="profit" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Profit Analysis Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-sm sm:text-base truncate">Total Investment</span>
                      <span className="text-sm sm:text-lg font-bold text-blue-600 ml-2">
                        Rs. {profitAnalysis?.totalCosts?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-sm sm:text-base truncate">Total Revenue</span>
                      <span className="text-sm sm:text-lg font-bold text-green-600 ml-2">
                        Rs. {profitAnalysis?.totalRevenue?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-sm sm:text-base truncate">Gross Profit</span>
                      <span className={`text-sm sm:text-lg font-bold ml-2 ${profitAnalysis?.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Rs. {profitAnalysis?.grossProfit?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-sm sm:text-base truncate">Profit Margin</span>
                      <span className={`text-sm sm:text-lg font-bold ml-2 ${profitAnalysis?.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profitAnalysis?.profitMargin?.toFixed(1) || 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Hotel Revenue', value: profitAnalysis?.hotelRevenue || 0 },
                          { name: 'Restaurant Revenue', value: profitAnalysis?.restaurantRevenue || 0 },
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        <Cell fill="#0088FE" />
                        <Cell fill="#00C49F" />
                      </Pie>
                      <Tooltip formatter={(value) => [`Rs. ${Number(value).toLocaleString()}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

