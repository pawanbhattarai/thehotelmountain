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

export default function RecentReservations() {
  const {
    data: reservations,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/dashboard/today-reservations"],
    queryFn: () =>
      fetch("/api/dashboard/today-reservations?limit=5").then((res) =>
        res.json(),
      ),
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { label: "Confirmed", className: "reservation-confirmed" },
      pending: { label: "Pending", className: "reservation-pending" },
      "checked-in": {
        label: "Checked In",
        className: "reservation-checked-in",
      },
      "checked-out": {
        label: "Checked Out",
        className: "reservation-checked-out",
      },
      cancelled: { label: "Cancelled", className: "reservation-cancelled" },
      "no-show": { label: "No Show", className: "reservation-no-show" },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const calculateNights = (checkIn: string, checkOut: string) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleViewReservation = (reservationId: string) => {
    // In a real implementation, this would navigate to reservation details
    console.log("Viewing reservation:", reservationId);
  };

  const handleEditReservation = (reservationId: string) => {
    // In a real implementation, this would open edit modal
    console.log("Editing reservation:", reservationId);
  };

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
      <CardHeader className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Recent Reservations
          </CardTitle>
          <a
            href="/reservations"
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
              Failed to load reservations. Please try again.
            </p>
          </div>
        ) : !reservations?.length ? (
          <div className="px-6 py-8 text-center">
            <p className="text-gray-500">
              No reservations made today. Create your first reservation to get
              started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guest
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rooms
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check-in
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-200">
                {reservations.map((reservation: any) => (
                  <TableRow key={reservation.id} className="hover:bg-gray-50">
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 text-sm font-medium">
                            {reservation.guest?.firstName?.[0]}
                            {reservation.guest?.lastName?.[0]}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {reservation.guest?.firstName}{" "}
                            {reservation.guest?.lastName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {reservation.guest?.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {reservation.reservationRooms?.length || 0} Room
                        {(reservation.reservationRooms?.length || 0) !== 1
                          ? "s"
                          : ""}
                      </div>
                      <div className="text-xs text-gray-500">
                        {reservation.reservationRooms
                          ?.map((rr: any) => rr.room?.roomType?.name)
                          .filter(Boolean)
                          .join(", ") || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      {reservation.reservationRooms?.length > 0 ? (
                        <div>
                          <div className="text-sm text-gray-900">
                            {formatDate(
                              reservation.reservationRooms[0].checkInDate,
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {calculateNights(
                              reservation.reservationRooms[0].checkInDate,
                              reservation.reservationRooms[0].checkOutDate,
                            )}{" "}
                            nights
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">N/A</div>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(reservation.status)}
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
