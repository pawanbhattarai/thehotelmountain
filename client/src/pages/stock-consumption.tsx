import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Package, Search } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { format } from "date-fns";

export default function StockConsumption() {
  const { data: consumptions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/inventory/consumption"],
  });

  const { data: lowStockItems = [] } = useQuery<any[]>({
    queryKey: ["/api/inventory/low-stock"],
  });

  const consumptionPagination = usePagination({
    data: Array.isArray(consumptions) ? consumptions : [],
    itemsPerPage: 10,
    searchTerm,
    searchFields: ["stockItemName", "orderNumber"],
  });

  const lowStockPagination = usePagination({
    data: Array.isArray(lowStockItems) ? lowStockItems : [],
    itemsPerPage: 10,
    searchTerm: "",
    searchFields: ["name", "categoryName"],
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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
          {/* Search Section */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search consumption records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
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
                      {consumptionPagination.paginatedData.map((consumption: any) => (
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
                      {consumptionPagination.paginatedData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            {searchTerm ? "No consumption records found matching your search." : "No consumption records found."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
                {consumptionPagination.totalItems > 0 && (
                  <PaginationControls
                    currentPage={consumptionPagination.currentPage}
                    totalPages={consumptionPagination.totalPages}
                    onPageChange={consumptionPagination.setCurrentPage}
                    startIndex={consumptionPagination.startIndex}
                    endIndex={consumptionPagination.endIndex}
                    totalItems={consumptionPagination.totalItems}
                  />
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
                    {consumptionPagination.paginatedData.map((consumption: any) => (
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
                    {consumptionPagination.paginatedData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          {searchTerm ? "No consumption records found matching your search." : "No consumption records found."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
              {consumptionPagination.totalItems > 0 && (
                <PaginationControls
                  currentPage={consumptionPagination.currentPage}
                  totalPages={consumptionPagination.totalPages}
                  onPageChange={consumptionPagination.setCurrentPage}
                  startIndex={consumptionPagination.startIndex}
                  endIndex={consumptionPagination.endIndex}
                  totalItems={consumptionPagination.totalItems}
                />
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
