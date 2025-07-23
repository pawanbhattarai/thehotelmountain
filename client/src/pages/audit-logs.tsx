import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Shield,
  User,
  Clock,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

type AuditLog = {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  details: any;
  branchId: number;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  branch?: {
    name: string;
  };
};

const ACTION_COLORS = {
  LOGIN: "bg-green-100 text-green-800",
  LOGOUT: "bg-blue-100 text-blue-800",
  CREATE: "bg-purple-100 text-purple-800",
  READ: "bg-gray-100 text-gray-800",
  UPDATE: "bg-yellow-100 text-yellow-800",
  DELETE: "bg-red-100 text-red-800",
  PAYMENT: "bg-orange-100 text-orange-800",
  SYSTEM: "bg-cyan-100 text-cyan-800",
  SECURITY: "bg-red-100 text-red-800",
};

const ENTITY_ICONS = {
  guest: User,
  reservation: Calendar,
  payment: Clock,
  user: User,
  system: Shield,
  "audit-logs": Eye,
};

// ADD THIS: API function to fetch audit logs
const fetchAuditLogs = async (filters: any) => {
  const queryParams = new URLSearchParams();

  // Add filters to query params
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      queryParams.append(key, value.toString());
    }
  });

  const response = await fetch(`/api/audit-logs?${queryParams.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch audit logs");
  }
  return response.json();
};

export default function AuditLogs() {
  const { user } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [filters, setFilters] = useState({
    userId: "",
    entity: "all",
    action: "all",
    startDate: "",
    endDate: "",
    limit: 20,
    offset: 0,
  });

  // Convert 'all' values to empty strings for API
  const apiFilters = {
    ...filters,
    entity: filters.entity === "all" ? "" : filters.entity,
    action: filters.action === "all" ? "" : filters.action,
  };

  // FIXED: Added queryFn to useQuery
  const {
    data: auditData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/audit-logs", apiFilters],
    queryFn: () => fetchAuditLogs(apiFilters),
    enabled:
      !!user && (user.role === "superadmin" || user.role === "branch-admin"),
  });

  const auditLogs = auditData?.auditLogs || [];
  const totalCount = auditData?.totalCount || 0;

  // FIXED: Calculate hasMore based on current data
  const hasMore =
    auditData?.hasMore ?? filters.offset + filters.limit < totalCount;

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      offset: 0, // Reset pagination when filters change
    }));
  };

  const handlePrevPage = () => {
    setFilters((prev) => ({
      ...prev,
      offset: Math.max(0, prev.offset - prev.limit),
    }));
  };

  const handleNextPage = () => {
    // FIXED: Added debug logging and better logic
    console.log("Current filters:", filters);
    console.log("Total count:", totalCount);
    console.log("Has more:", hasMore);

    if (hasMore) {
      setFilters((prev) => ({
        ...prev,
        offset: prev.offset + prev.limit,
      }));
    }
  };

  const getActionColor = (action: string) => {
    return (
      ACTION_COLORS[action as keyof typeof ACTION_COLORS] ||
      "bg-gray-100 text-gray-800"
    );
  };

  const getEntityIcon = (entity: string) => {
    const Icon = ENTITY_ICONS[entity as keyof typeof ENTITY_ICONS] || Shield;
    return <Icon className="w-4 h-4" />;
  };

  const formatDetails = (details: any) => {
    if (!details) return "";
    if (typeof details === "string") return details;
    return JSON.stringify(details, null, 2);
  };

  if (!user || (user.role !== "superadmin" && user.role !== "branch-admin")) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar
          isMobileMenuOpen={isMobileSidebarOpen}
          setIsMobileMenuOpen={setIsMobileSidebarOpen}
        />
        <div className="main-content">
          <Header
            title="Audit Logs"
            subtitle="Security and activity monitoring"
            onMobileMenuToggle={() =>
              setIsMobileSidebarOpen(!isMobileSidebarOpen)
            }
          />
          <main className="p-4 lg:p-6">
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Access Denied
                </h2>
                <p className="text-gray-600">
                  Only admin users can view audit logs.
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isMobileMenuOpen={isMobileSidebarOpen}
        setIsMobileMenuOpen={setIsMobileSidebarOpen}
      />
      <div className="main-content">
        <Header
          title="Audit Logs"
          subtitle="Security and activity monitoring"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
        />
        <main className="p-4 lg:p-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-500">
                  {totalCount} total activities
                </span>
              </div>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Filter Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor="userId">User</Label>
                    <Input
                      id="userId"
                      placeholder="User ID"
                      value={filters.userId}
                      onChange={(e) =>
                        handleFilterChange("userId", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="entity">Entity</Label>
                    <Select
                      value={filters.entity}
                      onValueChange={(value) =>
                        handleFilterChange("entity", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All entities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All entities</SelectItem>
                        <SelectItem value="guest">Guest</SelectItem>
                        <SelectItem value="reservation">Reservation</SelectItem>
                        <SelectItem value="payment">Payment</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="audit-logs">Audit Logs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="action">Action</Label>
                    <Select
                      value={filters.action}
                      onValueChange={(value) =>
                        handleFilterChange("action", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All actions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All actions</SelectItem>
                        <SelectItem value="LOGIN">Login</SelectItem>
                        <SelectItem value="LOGOUT">Logout</SelectItem>
                        <SelectItem value="CREATE">Create</SelectItem>
                        <SelectItem value="READ">Read</SelectItem>
                        <SelectItem value="UPDATE">Update</SelectItem>
                        <SelectItem value="DELETE">Delete</SelectItem>
                        <SelectItem value="PAYMENT">Payment</SelectItem>
                        <SelectItem value="SYSTEM">System</SelectItem>
                        <SelectItem value="SECURITY">Security</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={filters.startDate}
                      onChange={(e) =>
                        handleFilterChange("startDate", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={filters.endDate}
                      onChange={(e) =>
                        handleFilterChange("endDate", e.target.value)
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Audit Log List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <Shield className="w-16 h-16 text-red-300 mx-auto mb-4" />
                    <p className="text-red-500">
                      Error loading audit logs: {error.message}
                    </p>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No audit logs found.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {auditLogs.map((log: AuditLog) => (
                      <div
                        key={log.id}
                        className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              {getEntityIcon(log.entity)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <Badge className={getActionColor(log.action)}>
                                  {log.action}
                                </Badge>
                                <span className="text-sm text-gray-600 font-medium">
                                  {log.entity}
                                </span>
                                {log.entityId && (
                                  <span className="text-xs text-gray-500">
                                    #{log.entityId}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-700 mb-2">
                                {log.user ? (
                                  <span>
                                    {log.user.firstName} {log.user.lastName} (
                                    {log.user.email})
                                  </span>
                                ) : (
                                  <span>User: {log.userId}</span>
                                )}
                                {log.branch && (
                                  <span className="text-gray-500 ml-2">
                                    • {log.branch.name}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                <div className="flex items-center space-x-4">
                                  <span className="flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {(() => {
                                      try {
                                        return format(
                                          new Date(log.timestamp),
                                          "PPp",
                                        );
                                      } catch (error) {
                                        return log.timestamp;
                                      }
                                    })()}
                                  </span>
                                  <span>IP: {log.ipAddress}</span>
                                </div>
                              </div>
                              {log.details &&
                                Object.keys(log.details).length > 0 && (
                                  <details className="mt-2">
                                    <summary className="text-xs text-blue-600 cursor-pointer">
                                      View Details
                                    </summary>
                                    <pre className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded overflow-auto">
                                      {formatDetails(log.details)}
                                    </pre>
                                  </details>
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* FIXED: Enhanced Pagination Controls with better debugging */}
                {auditLogs.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="flex items-center text-sm text-gray-500">
                      Showing {filters.offset + 1} to{" "}
                      {Math.min(filters.offset + filters.limit, totalCount)} of{" "}
                      {totalCount} entries
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevPage}
                        disabled={filters.offset === 0}
                        className="flex items-center space-x-1"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Previous</span>
                      </Button>
                      <span className="text-sm text-gray-500">
                        Page {Math.floor(filters.offset / filters.limit) + 1} of{" "}
                        {Math.ceil(totalCount / filters.limit)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={!hasMore}
                        className="flex items-center space-x-1"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
