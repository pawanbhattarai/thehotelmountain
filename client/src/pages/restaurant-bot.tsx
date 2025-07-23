import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  Wine,
  CheckCircle,
  Package,
  Printer,
  Timer,
  Users,
  FileText,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTimeWithBS } from "@/lib/bs-date-converter";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

interface BotItem {
  id: number;
  dishId: number;
  quantity: number;
  specialInstructions?: string;
  dish: {
    name: string;
  };
}

interface BotTicket {
  id: number;
  botNumber: string;
  orderId: string;
  tableId?: number;
  roomId?: number;
  customerName?: string;
  status: "pending" | "preparing" | "ready" | "served";
  itemCount: number;
  notes?: string;
  printedAt?: string;
  startedAt?: string;
  completedAt?: string;
  servedAt?: string;
  createdAt: string;
  table?: {
    name: string;
  };
  order: {
    orderNumber: string;
  };
  items: BotItem[];
}

const statusConfig = {
  pending: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
    icon: Clock,
    action: "Start Preparing",
    nextStatus: "preparing",
  },
  preparing: {
    label: "Preparing",
    color: "bg-blue-100 text-blue-800",
    icon: Wine,
    action: "Mark Ready",
    nextStatus: "ready",
  },
  ready: {
    label: "Ready",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
    action: "Mark Served",
    nextStatus: "served",
  },
  served: {
    label: "Served",
    color: "bg-gray-100 text-gray-800",
    icon: Package,
    action: null,
    nextStatus: null,
  },
};

export default function RestaurantBOT() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pending");

  const { data: botTickets = [], isLoading } = useQuery({
    queryKey: ["/api/restaurant/bot", activeTab],
    queryFn: async () => {
      const status = activeTab === "all" ? "" : activeTab;
      const response = await fetch(`/api/restaurant/bot?status=${status}`);
      if (!response.ok) throw new Error("Failed to fetch BOT tickets");
      return response.json();
    },
    refetchInterval: 2000, // Real-time polling every 2 seconds for immediate updates
  });

  // Real-time updates via polling (WebSocket disabled in dev mode)

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      botId,
      status,
    }: {
      botId: number;
      status: string;
    }) => {
      const response = await fetch(`/api/restaurant/bot/${botId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update BOT status");
      return response.json();
    },
    onSuccess: () => {
      // Real-time update via WebSocket, but also invalidate for safety
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/bot"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/orders"] });
      toast({
        title: "Success",
        description: "BOT status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update BOT status",
        variant: "destructive",
      });
    },
  });

  const markPrintedMutation = useMutation({
    mutationFn: async (botId: number) => {
      const response = await fetch(`/api/restaurant/bot/${botId}/print`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to mark BOT as printed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/bot"] });
      toast({
        title: "Success",
        description: "BOT marked as printed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark BOT as printed",
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = (botId: number, nextStatus: string) => {
    updateStatusMutation.mutate({ botId, status: nextStatus });
  };

  const { data: hotelSettings } = useQuery({
    queryKey: ["/api/hotel-settings"],
    enabled: !!user,
  });

  const handlePrint = (botId: number, bot: BotTicket) => {
    // Mark as printed and generate dynamic print layout
    markPrintedMutation.mutate(botId);

    printBOT(bot);
  };

  const printBOT = async (bot: BotTicket) => {
    const printWindow = window.open("", "_blank");
    const printContent = await generateBOTHTML(bot);
    printWindow?.document.write(printContent);
    printWindow?.document.close();
    printWindow?.print();
  };

  const generateBOTHTML = async (bot: BotTicket) => {
    // Get printer settings from hotel settings
    const printerSettings = hotelSettings || {};
    const paperWidth = printerSettings.printerPaperWidth || "80mm";
    const paperHeight = printerSettings.printerPaperHeight || "auto";
    const margins = printerSettings.printerMargins || "2mm";
    const fontSize = printerSettings.printerFontSize || "10px";
    const lineHeight = printerSettings.printerLineHeight || "1.2";
    const paperSize = printerSettings.printerPaperSize || "80mm";
    const fontFamily = printerSettings.printerFontFamily || (paperSize === "80mm" || paperSize === "58mm" ? "monospace" : "Arial, sans-serif");

    // Determine if this is a thermal receipt printer
    const isThermal = paperSize === "80mm" || paperSize === "58mm";

    const showBSDate = hotelSettings?.billing?.showBSDate || false;

    let currentDateTime = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    let bsDateTime = "";

    if (showBSDate) {
      bsDateTime = await formatDateTimeWithBS(new Date());
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>BOT - ${bot.botNumber}</title>
        <style>
          @page {
            size: ${paperWidth} ${paperHeight === "auto" ? "auto" : paperHeight};
            margin: ${margins};
          }
          body { 
          font-family: ${fontFamily};
            padding: ${isThermal ? "5px" : "20px"}; 
            margin: 0;
            line-height: ${lineHeight};
            color: #333;
            font-size: ${fontSize};
            width: 100%;
            max-width: ${paperWidth === "80mm" ? "72mm" : paperWidth === "58mm" ? "50mm" : "100%"};
          }
          .header { 
            text-align: center; 
            margin-bottom: ${isThermal ? "10px" : "30px"}; 
            border-bottom: ${isThermal ? "1px dashed #333" : "2px solid #333"};
            padding-bottom: ${isThermal ? "8px" : "20px"};
          }
          .bar-name {
            font-size: ${isThermal ? "14px" : "24px"};
            font-weight: bold;
            color: #333;
            margin: ${isThermal ? "4px 0" : "10px 0"};
            word-wrap: break-word;
          }
          .bot-title {
            font-size: ${isThermal ? "12px" : "20px"};
            font-weight: bold;
            margin: ${isThermal ? "8px 0 4px 0" : "20px 0 10px 0"};
            color: #333;
          }
          .bot-info {
            display: ${isThermal ? "block" : "flex"};
            justify-content: space-between;
            margin-bottom: ${isThermal ? "8px" : "20px"};
            padding: ${isThermal ? "4px 0" : "15px"};
            background-color: ${isThermal ? "transparent" : "#f8f9fa"};
            border-radius: ${isThermal ? "0" : "5px"};
            ${isThermal ? "border-bottom: 1px dashed #333;" : ""}
          }
          .order-details, .table-details {
            flex: ${isThermal ? "none" : "1"};
            margin-bottom: ${isThermal ? "8px" : "0"};
          }
          .order-details {
            margin-right: ${isThermal ? "0" : "20px"};
          }
          .detail-label {
            font-weight: bold;
            color: #333;
          }
          .items-section {
            margin-bottom: 20px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: ${isThermal ? "8px" : "20px"};
            font-size: ${isThermal ? "8px" : "inherit"};
          }
          .items-table th, .items-table td {
            border: ${isThermal ? "none" : "1px solid #ddd"};
            padding: ${isThermal ? "2px 4px" : "8px"};
            text-align: left;
            ${isThermal ? "border-bottom: 1px dashed #ccc;" : ""}
          }
          .items-table th {
            background-color: ${isThermal ? "transparent" : "#f2f2f2"};
            font-weight: bold;
            ${isThermal ? "border-bottom: 1px solid #333;" : ""}
          }
          .items-table td:last-child {
            text-align: center;
          }

          .notes-section {
            margin: ${isThermal ? "8px 0" : "20px 0"};
            padding: ${isThermal ? "4px" : "15px"};
            background-color: ${isThermal ? "transparent" : "#fff3cd"};
            border: ${isThermal ? "1px dashed #333" : "1px solid #ffeaa7"};
            border-radius: ${isThermal ? "0" : "5px"};
          }
          .footer {
            margin-top: ${isThermal ? "10px" : "30px"};
            text-align: center;
            font-size: ${isThermal ? "8px" : "12px"};
            color: #666;
            border-top: ${isThermal ? "1px dashed #ccc" : "1px solid #ddd"};
            padding-top: ${isThermal ? "4px" : "15px"};
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="bot-title">BAR ORDER TICKET (BOT)</div>
          <div style="font-size: ${isThermal ? "10px" : "14px"}; font-weight: bold;">${bot.botNumber}</div>
        </div>

        <div class="bot-info">
          <div class="order-details">
            <div><span class="detail-label">Order:</span> ${bot.order.orderNumber}</div>
            ${bot.customerName ? `<div><span class="detail-label">Customer:</span> ${bot.customerName}</div>` : ""}
          </div>
          <div class="table-details">
           <div><span class="detail-label">BOT Time:</span> ${currentDateTime}</div>
            ${showBSDate ? `<div><span class="detail-label">BOT Time(BS):</span> ${bsDateTime}</div>` : ""}
            ${bot.table ? `<div><span class="detail-label">Table:</span> ${bot.table.name}</div>` : ""}
            <div><span class="detail-label">Items:</span> ${bot.itemCount}</div>
          </div>
        </div>

        <div class="items-section">
          <h3>Beverages to Prepare</h3>
          <table class="items-table">
            <thead>
              <tr>
                <th>Beverage Name</th>
                <th>Qty</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${bot.items
                .map(
                  (item) => `
                <tr>
                  <td><strong>${item.dish.name}</strong></td>
                  <td style="text-align: center; font-weight: bold;">${item.quantity}x</td>
                  <td>${item.specialInstructions || "-"}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <div class="status-section">
          STATUS: ${bot.status.toUpperCase()}
        </div>

        ${
          bot.notes
            ? `
          <div class="notes-section">
            <strong>Order Notes:</strong><br>
            ${bot.notes}
          </div>
        `
            : ""
        }
      </body>
      </html>
    `;
  };

  const getTimeDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffInMinutes = Math.floor(
      (end.getTime() - start.getTime()) / (1000 * 60),
    );
    return `${diffInMinutes}m`;
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="main-content">
          <Header
            title="Bar Order Tickets (BOT)"
            subtitle="Manage bar orders and track preparation status"
          />
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-64">
        {/* Header */}
        <Header
          title="Bar Order Tickets (BOT)"
          subtitle="Manage bar orders and track preparation status"
        />

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <TabsList className="grid w-full grid-cols-5 sm:w-auto">
                  <TabsTrigger
                    value="all"
                    className="text-xs sm:text-sm font-medium"
                  >
                    All
                  </TabsTrigger>
                  <TabsTrigger
                    value="pending"
                    className="text-xs sm:text-sm font-medium"
                  >
                    Pending
                  </TabsTrigger>
                  <TabsTrigger
                    value="preparing"
                    className="text-xs sm:text-sm font-medium"
                  >
                    Preparing
                  </TabsTrigger>
                  <TabsTrigger
                    value="ready"
                    className="text-xs sm:text-sm font-medium"
                  >
                    Ready
                  </TabsTrigger>
                  <TabsTrigger
                    value="served"
                    className="text-xs sm:text-sm font-medium"
                  >
                    Served
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium">
                    Total BOTs: {botTickets.length}
                  </span>
                </div>
              </div>

              <TabsContent value={activeTab} className="space-y-4">
                {botTickets.length === 0 ? (
                  <div className="text-center py-12 lg:py-20">
                    <Wine className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-medium">No BOT tickets</h3>
                    <p className="text-muted-foreground mt-2">
                      {activeTab === "all"
                        ? "No BOT tickets found"
                        : `No ${activeTab} BOT tickets found`}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                    {botTickets.map((bot: BotTicket) => {
                      const config = statusConfig[bot.status];
                      const StatusIcon = config.icon;

                      return (
                        <Card
                          key={bot.id}
                          className="relative hover:shadow-lg transition-shadow"
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base lg:text-lg font-semibold truncate">
                                {bot.botNumber}
                              </CardTitle>
                              <Badge className={config.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">
                                  {config.label}
                                </span>
                              </Badge>
                            </div>

                            <div className="space-y-2 text-xs lg:text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <FileText className="h-3 w-3 lg:h-4 lg:w-4 flex-shrink-0" />
                                <span className="truncate">
                                  Order: {bot.order.orderNumber}
                                </span>
                              </div>

                              {bot.table && (
                                <div className="flex items-center gap-2">
                                  <Wine className="h-3 w-3 lg:h-4 lg:w-4 flex-shrink-0" />
                                  <span className="truncate">
                                    Table: {bot.table.name}
                                  </span>
                                </div>
                              )}

                              {bot.customerName && (
                                <div className="flex items-center gap-2">
                                  <Users className="h-3 w-3 lg:h-4 lg:w-4 flex-shrink-0" />
                                  <span className="truncate">
                                    {bot.customerName}
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center gap-2">
                                <Timer className="h-3 w-3 lg:h-4 lg:w-4 flex-shrink-0" />
                                <span className="truncate">
                                  {bot.status === "pending" &&
                                    `Created ${getTimeDuration(bot.createdAt)} ago`}
                                  {bot.status === "preparing" &&
                                    bot.startedAt &&
                                    `Preparing for ${getTimeDuration(bot.startedAt)}`}
                                  {bot.status === "ready" &&
                                    bot.completedAt &&
                                    `Ready since ${getTimeDuration(bot.completedAt)}`}
                                  {bot.status === "served" &&
                                    bot.servedAt &&
                                    `Served ${getTimeDuration(bot.servedAt)} ago`}
                                </span>
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="space-y-3 lg:space-y-4">
                            <div>
                              <h4 className="font-medium mb-2 text-sm lg:text-base">
                                Items ({bot.itemCount})
                              </h4>
                              <div className="space-y-2">
                                {bot.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex justify-between items-start p-2 bg-muted rounded text-sm"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <span className="font-medium">
                                        {item.dish.name}
                                      </span>
                                      {item.specialInstructions && (
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                          Note: {item.specialInstructions}
                                        </p>
                                      )}
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className="ml-2 text-xs"
                                    >
                                      {item.quantity}x
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {bot.notes && (
                              <div className="p-2 bg-yellow-50 rounded">
                                <p className="text-xs lg:text-sm">
                                  <strong>Order Notes:</strong> {bot.notes}
                                </p>
                              </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-2">
                              {!bot.printedAt && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePrint(bot.id, bot)}
                                  disabled={markPrintedMutation.isPending}
                                  className="w-full sm:w-auto"
                                >
                                  <Printer className="h-4 w-4 mr-1" />
                                  <span className="hidden sm:inline">
                                    Print
                                  </span>
                                </Button>
                              )}

                              {config.action && config.nextStatus && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleStatusUpdate(
                                      bot.id,
                                      config.nextStatus!,
                                    )
                                  }
                                  disabled={updateStatusMutation.isPending}
                                  className="flex-1"
                                >
                                  {config.action}
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}