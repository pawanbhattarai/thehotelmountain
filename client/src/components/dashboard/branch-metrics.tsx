import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, TrendingUp } from "lucide-react";

export default function BranchMetrics() {
  const {
    data: metrics,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
  });

  if (isLoading) {
    return (
      <Card className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
        <CardHeader className="p-6 border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Branch Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !metrics?.branchMetrics) {
    return (
      <Card className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
        <CardHeader className="p-6 border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Branch Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <p className="text-gray-500">
              Failed to load branch metrics. Please try again.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 mb-8">
      {/* Branch Performance Table */}
      <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
        <CardHeader className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-600" />
            <CardTitle className="text-lg font-semibold text-gray-900">
              Branch Performance
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead>Total Rooms</TableHead>
                <TableHead>Booked Rooms</TableHead>
                <TableHead>Available Rooms</TableHead>
                <TableHead>Occupancy Rate</TableHead>
                <TableHead>Today's Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.branchMetrics.map((branch) => {
                const occupancyRate =
                  branch.totalRooms > 0
                    ? ((branch.bookedRooms / branch.totalRooms) * 100).toFixed(
                        1,
                      )
                    : "0";

                return (
                  <TableRow key={branch.branchId}>
                    <TableCell className="font-medium">
                      {branch.branchName}
                    </TableCell>
                    <TableCell>{branch.totalRooms}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="bg-blue-50 text-blue-700"
                      >
                        {branch.bookedRooms}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="bg-green-50 text-green-700"
                      >
                        {branch.availableRooms}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          parseFloat(occupancyRate) >= 80
                            ? "bg-red-50 text-red-700"
                            : parseFloat(occupancyRate) >= 60
                              ? "bg-yellow-50 text-yellow-700"
                              : "bg-green-50 text-green-700"
                        }
                      >
                        {occupancyRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      ₨{(branch.revenue || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
