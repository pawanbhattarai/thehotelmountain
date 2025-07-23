import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CheckCircle, 
  User, 
  Wrench, 
  Fan, 
  XCircle, 
  Calendar 
} from "lucide-react";

export default function RoomStatusOverview() {
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
  });

  const roomStatusItems = [
    {
      key: "available",
      label: "Available",
      icon: CheckCircle,
      iconBg: "bg-success-50",
      iconColor: "text-success",
      count: metrics?.roomStatusCounts?.available || 0,
    },
    {
      key: "occupied",
      label: "Occupied",
      icon: User,
      iconBg: "bg-primary-50",
      iconColor: "text-primary",
      count: metrics?.roomStatusCounts?.occupied || 0,
    },
    {
      key: "maintenance",
      label: "Maintenance",
      icon: Wrench,
      iconBg: "bg-warning-50",
      iconColor: "text-warning",
      count: metrics?.roomStatusCounts?.maintenance || 0,
    },
    {
      key: "housekeeping",
      label: "Housekeeping",
      icon: Fan,
      iconBg: "bg-gray-100",
      iconColor: "text-gray-600",
      count: metrics?.roomStatusCounts?.housekeeping || 0,
    },
    {
      key: "out-of-order",
      label: "Out of Order",
      icon: XCircle,
      iconBg: "bg-error-50",
      iconColor: "text-error",
      count: metrics?.roomStatusCounts?.["out-of-order"] || 0,
    },
    {
      key: "reserved",
      label: "Reserved",
      icon: Calendar,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-500",
      count: metrics?.roomStatusCounts?.reserved || 0,
    },
  ];

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
      <CardHeader className="p-6 border-b border-gray-200">
        <CardTitle className="text-lg font-semibold text-gray-900">Room Status Overview</CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Failed to load room status. Please try again.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {roomStatusItems.map((status) => (
              <div key={status.key} className="text-center">
                <div className={`w-16 h-16 ${status.iconBg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                  <status.icon className={`${status.iconColor} text-xl h-6 w-6`} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{status.count}</p>
                <p className="text-sm text-gray-600">{status.label}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
