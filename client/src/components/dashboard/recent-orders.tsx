import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Edit } from "lucide-react";

export default function RecentOrders() {
  const {
    data: orders,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/restaurant/dashboard/today-orders"],
    queryFn: () =>
      fetch("/api/restaurant/dashboard/today-orders?limit=5").then((res) =>
        res.json(),
      ),
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
      confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-800" },
      preparing: {
        label: "Preparing",
        className: "bg-orange-100 text-orange-800",
      },
      ready: { label: "Ready", className: "bg-green-100 text-green-800" },
      served: { label: "Served", className: "bg-gray-100 text-gray-800" },
      cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800" },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <Badge variant="secondary" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleViewOrder = (orderId: string) => {
    // In a real implementation, this would navigate to order details
    console.log("Viewing order:", orderId);
  };

  const handleEditOrder = (orderId: string) => {
    // In a real implementation, this would open edit modal
    console.log("Editing order:", orderId);
  };

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
      <CardHeader className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Recent Orders
          </CardTitle>
          <a
            href="/restaurant-orders"
            className="text-primary text-sm font-medium hover:text-primary/80"
          >
            View All
          </a>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="px-6 py-8 text-center">
            <p className="text-gray-500">
              Failed to load orders. Please try again.
            </p>
          </div>
        ) : !orders?.length ? (
          <div className="px-6 py-8 text-center">
            <p className="text-gray-500">
              No orders made today. Create your first order to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Table
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-200">
                {orders.map((order: any) => (
                  <TableRow key={order.id} className="hover:bg-gray-50">
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.orderNumber}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {order.tableName || `Table ${order.tableNumber}`}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatTime(order.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(order.status)}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        Rs. {parseFloat(order.totalAmount).toFixed(2)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
