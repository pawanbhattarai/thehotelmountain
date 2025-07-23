import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Package } from "lucide-react";
import { format } from "date-fns";

export default function StockConsumption() {
  const { data: consumptions = [], isLoading } = useQuery({
    queryKey: ["/api/inventory/consumption"],
  });

  const { data: lowStockItems = [] } = useQuery({
    queryKey: ["/api/inventory/low-stock"],
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isMobileMenuOpen={isMobileSidebarOpen}
        setIsMobileMenuOpen={setIsMobileSidebarOpen}
      />
      <div className="main-content">
        <Header
          title="Stock Consumption"
          subtitle="Track inventory consumption and low stock alerts"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
        />
        <main className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingDown className="mr-2 h-5 w-5" />
                  Recent Consumption
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consumptions.slice(0, 10).map((consumption: any) => (
                        <TableRow key={consumption.id}>
                          <TableCell className="font-medium">
                            {consumption.stockItemName}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <span>
                                {parseFloat(
                                  consumption.quantity || "0",
                                ).toFixed(2)}
                              </span>
                              <span className="text-muted-foreground">
                                {consumption.measuringUnitSymbol}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {consumption.orderId}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(
                              new Date(consumption.createdAt),
                              "MMM dd, yyyy",
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {consumptions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            No consumption records found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="mr-2 h-5 w-5" />
                  Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Reorder Level</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockItems.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <span>
                              {parseFloat(item.currentStock || "0").toFixed(2)}
                            </span>
                            <span className="text-muted-foreground">
                              {item.measuringUnitSymbol}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <span>
                              {parseFloat(item.reorderLevel || "0").toFixed(2)}
                            </span>
                            <span className="text-muted-foreground">
                              {item.measuringUnitSymbol}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">Low Stock</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {lowStockItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          No low stock items. All items are well stocked.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Consumption Records</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Order Type</TableHead>
                      <TableHead>Unit Cost</TableHead>
                      <TableHead>Total Cost</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumptions.map((consumption: any) => (
                      <TableRow key={consumption.id}>
                        <TableCell className="font-medium">
                          {consumption.stockItemName}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <span>
                              {parseFloat(consumption.quantity || "0").toFixed(
                                2,
                              )}
                            </span>
                            <span className="text-muted-foreground">
                              {consumption.measuringUnitSymbol}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{consumption.orderId}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {consumption.orderType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {consumption.unitPrice
                            ? `₨. ${parseFloat(consumption.unitPrice).toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {consumption.totalCost
                            ? `₨. ${parseFloat(consumption.totalCost).toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {format(
                            new Date(consumption.createdAt),
                            "MMM dd, yyyy HH:mm",
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {consumptions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          No consumption records found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
