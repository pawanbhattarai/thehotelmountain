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
  TrendingUp,
  Users,
  Banknote,
  BedDouble,
  Star,
  ArrowLeft,
} from "lucide-react";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function Analytics() {
  const [period, setPeriod] = useState("30d");

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ["/api/analytics/revenue", period],
  });

  const { data: occupancyData, isLoading: occupancyLoading } = useQuery({
    queryKey: ["/api/analytics/occupancy", period],
  });

  const { data: guestData, isLoading: guestLoading } = useQuery({
    queryKey: ["/api/analytics/guests"],
  });

  const { data: roomData, isLoading: roomLoading } = useQuery({
    queryKey: ["/api/analytics/rooms"],
  });

  const { data: operationsData, isLoading: operationsLoading } = useQuery({
    queryKey: ["/api/analytics/operations"],
  });

  if (
    revenueLoading ||
    occupancyLoading ||
    guestLoading ||
    roomLoading ||
    operationsLoading
  ) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-center items-center">
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
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
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-7xl space-y-6">
        <div className="flex justify-between items-center">
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
            <div className="flex justify-center items-center">
              <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            </div>
          </div>
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
                    {(revenueData as any)?.totalRevenue?.toLocaleString() ||
                      "0"}
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUp
                      className={`h-4 w-4 ${(revenueData as any)?.revenueGrowth >= 0 ? "text-green-600" : "text-red-600"}`}
                    />
                    <span
                      className={`text-sm font-medium ml-1 ${(revenueData as any)?.revenueGrowth >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {(revenueData as any)?.revenueGrowth?.toFixed(1)}% vs last
                      month
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
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
                    Average Occupancy
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {(occupancyData as any)?.averageOccupancy?.toFixed(1) ||
                      "0"}
                    %
                  </p>
                  <div className="flex items-center mt-2">
                    <BedDouble className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-500 ml-1">
                      {(occupancyData as any)?.dailyOccupancy?.length || 0} days
                      tracked
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                  <BedDouble className="text-white h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Guests
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {(guestData as any)?.totalGuests?.toLocaleString() || "0"}
                  </p>
                  <div className="flex items-center mt-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-500 ml-1">
                      {(guestData as any)?.newGuestsThisMonth || 0} new this
                      month
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                  <Users className="text-white h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Avg Booking Value
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    NPR{" "}
                    {(
                      revenueData as any
                    )?.averageBookingValue?.toLocaleString() || "0"}
                  </p>
                  <div className="flex items-center mt-2">
                    <Star className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-gray-500 ml-1">
                      per reservation
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center">
                  <Star className="text-white h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="revenue" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
            <TabsTrigger value="guests">Guests</TabsTrigger>
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
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
                        formatter={(value) => [`₨ ${value}`, "Revenue"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#8884d8"
                        fill="#8884d8"
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={(revenueData as any)?.monthlyRevenue || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => [`₨ ${value}`, "Revenue"]}
                      />
                      <Bar dataKey="revenue" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="occupancy" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Daily Occupancy Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={(occupancyData as any)?.dailyOccupancy || []}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => [`${value}%`, "Occupancy"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="occupancyRate"
                        stroke="#8884d8"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Peak Occupancy Days</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {((occupancyData as any)?.peakOccupancyDays || [])
                      .slice(0, 5)
                      .map((day: any, index: number) => (
                        <div
                          key={day.date}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {index + 1}
                            </div>
                            <span className="font-medium">{day.date}</span>
                          </div>
                          <span className="text-lg font-bold text-green-600">
                            {day.occupancyRate}%
                          </span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="guests" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Guest Demographics</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={guestData?.guestsByNationality || []}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                        label={({ nationality, count }) =>
                          `${nationality}: ${count}`
                        }
                      >
                        {guestData?.guestsByNationality?.map(
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

              <Card>
                <CardHeader>
                  <CardTitle>Top Guests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {guestData?.topGuests
                      ?.slice(0, 5)
                      .map((guest: any, index: number) => (
                        <div
                          key={guest.guest.id}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <span className="font-medium">
                                {guest.guest.firstName} {guest.guest.lastName}
                              </span>
                              <p className="text-sm text-gray-500">
                                {guest.totalBookings} bookings
                              </p>
                            </div>
                          </div>
                          <span className="text-lg font-bold text-green-600">
                            NPR {guest.totalSpent}
                          </span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rooms" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Room Type Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={roomData?.roomTypePerformance || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="roomType.name" />
                      <YAxis />
                      <Tooltip />
                      <Bar
                        dataKey="totalRevenue"
                        fill="#8884d8"
                        name="Revenue (NPR)"
                      />
                      <Bar
                        dataKey="totalBookings"
                        fill="#82ca9d"
                        name="Bookings"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="operations" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Check-in Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={operationsData?.checkInTrends || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip formatter={(value) => [value, "Check-ins"]} />
                      <Bar dataKey="count" fill="#8884d8" />
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
                      <span className="font-medium">Average Stay Duration</span>
                      <span className="text-lg font-bold">
                        {operationsData?.averageStayDuration} days
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Cancellation Rate</span>
                      <span className="text-lg font-bold text-red-600">
                        {operationsData?.cancellationRate}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">No-Show Rate</span>
                      <span className="text-lg font-bold text-orange-600">
                        {operationsData?.noShowRate}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
