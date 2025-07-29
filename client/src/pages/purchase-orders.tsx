
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Eye, Check, ShoppingCart, Calendar, Search } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { insertPurchaseOrderSchema } from "@shared/schema";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";

const formSchema = z.object({
  supplierId: z.number().min(1, "Supplier is required"),
  orderDate: z.string().min(1, "Order date is required"),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
  branchId: z.number().optional(),
  items: z.array(z.object({
    stockItemId: z.number().min(1, "Stock item is required"),
    quantity: z.string().min(1, "Quantity is required").refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Quantity must be a positive number"),
    unitPrice: z.string().min(1, "Unit price is required").refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Unit price must be a positive number"),
    totalPrice: z.string(),
    notes: z.string().optional(),
  })).min(1, "At least one item is required"),
});

export default function PurchaseOrders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplierId: undefined,
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: "",
      notes: "",
      branchId: user?.branchId || undefined,
      items: [
        {
          stockItemId: undefined,
          quantity: "",
          unitPrice: "",
          totalPrice: "0",
          notes: "",
        }
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/purchase-orders", statusFilter],
    queryFn: () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      return fetch(`/api/purchase-orders${params}`).then(res => res.json());
    },
  });

  const pagination = usePagination({
    data: Array.isArray(orders) ? orders : [],
    itemsPerPage: 10,
    searchTerm,
    searchFields: ["supplierName", "orderNumber", "status"],
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["/api/inventory/suppliers"],
  });

  const { data: stockItems = [] } = useQuery({
    queryKey: ["/api/inventory/stock-items"],
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["/api/branches"],
    enabled: user?.role === "superadmin",
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      console.log("Submitting purchase order data:", data);
      
      // Calculate totals
      const subtotal = data.items.reduce((sum, item) => sum + parseFloat(item.totalPrice || "0"), 0);
      
      const orderData = {
        supplierId: data.supplierId,
        orderDate: data.orderDate,
        expectedDeliveryDate: data.expectedDeliveryDate || null,
        notes: data.notes || "",
        branchId: user?.role === "superadmin" ? (data.branchId || user?.branchId) : user?.branchId,
        subtotal: subtotal.toString(),
        taxAmount: "0",
        discountAmount: "0",
        totalAmount: subtotal.toString(),
      };

      const itemsData = data.items.map(item => ({
        stockItemId: item.stockItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        notes: item.notes || "",
        receivedQuantity: "0",
      }));

      console.log("Sending to API:", { order: orderData, items: itemsData });

      const response = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order: orderData,
          items: itemsData,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create purchase order");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setDialogOpen(false);
      form.reset({
        supplierId: undefined,
        orderDate: new Date().toISOString().split('T')[0],
        expectedDeliveryDate: "",
        notes: "",
        branchId: user?.branchId || undefined,
        items: [
          {
            stockItemId: undefined,
            quantity: "",
            unitPrice: "",
            totalPrice: "0",
            notes: "",
          }
        ],
      });
      toast({ title: "Purchase order created successfully" });
    },
    onError: (error: any) => {
      console.error("Error creating purchase order:", error);
      toast({ 
        title: "Failed to create purchase order", 
        description: error?.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/purchase-orders/${id}/approve`, {
        method: "POST",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to approve purchase order");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Purchase order approved successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to approve purchase order", 
        description: error?.message,
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/purchase-orders/${id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete purchase order");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Purchase order deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete purchase order", variant: "destructive" });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log("Form submission data:", data);
    createMutation.mutate(data);
  };

  const handleView = async (id: number) => {
    try {
      const response = await fetch(`/api/purchase-orders/${id}`);
      const order = await response.json();
      setViewingOrder(order);
      setViewDialogOpen(true);
    } catch (error) {
      toast({ title: "Failed to load purchase order details", variant: "destructive" });
    }
  };

  const handleApprove = (id: number) => {
    if (confirm("Are you sure you want to approve this purchase order?")) {
      approveMutation.mutate(id);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this purchase order?")) {
      deleteMutation.mutate(id);
    }
  };

  const openCreateDialog = () => {
    setEditingOrder(null);
    form.reset();
    setDialogOpen(true);
  };

  const calculateItemTotal = (index: number) => {
    const quantity = parseFloat(form.watch(`items.${index}.quantity`) || "0");
    const unitPrice = parseFloat(form.watch(`items.${index}.unitPrice`) || "0");
    const total = quantity * unitPrice;
    form.setValue(`items.${index}.totalPrice`, total.toFixed(2));
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      confirmed: "bg-green-100 text-green-800",
      "partially-received": "bg-yellow-100 text-yellow-800",
      received: "bg-emerald-100 text-emerald-800",
      cancelled: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || statusColors.draft}>
        {status.replace("-", " ").toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isMobileMenuOpen={isMobileSidebarOpen}
        setIsMobileMenuOpen={setIsMobileSidebarOpen}
      />
      <div className="main-content">
        <Header
          title="Purchase Orders"
          subtitle="Manage inventory purchase orders"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
        />
        <main className="p-6">
          {/* Search and Filter Section */}
          <div className="mb-6 flex flex-col lg:flex-row gap-4 justify-between">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="partially-received">Partially Received</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search purchase orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} className="w-full lg:w-auto bg-primary hover:bg-primary/90">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Purchase Order
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Purchase Order</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    {/* Header Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="supplierId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Supplier <span className="text-red-500">*</span></FormLabel>
                            <Select
                              onValueChange={(value) => field.onChange(parseInt(value))}
                              value={field.value?.toString() || ""}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select supplier" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {suppliers.map((supplier: any) => (
                                  <SelectItem key={supplier.id} value={supplier.id.toString()}>
                                    {supplier.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="orderDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Order Date <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="expectedDeliveryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expected Delivery Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {user?.role === "superadmin" && (
                        <FormField
                          control={form.control}
                          name="branchId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Branch</FormLabel>
                              <Select
                                onValueChange={(value) => field.onChange(parseInt(value))}
                                value={field.value?.toString()}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select branch" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {branches.map((branch: any) => (
                                    <SelectItem key={branch.id} value={branch.id.toString()}>
                                      {branch.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    {/* Items Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Order Items</h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => append({
                            stockItemId: undefined,
                            quantity: "",
                            unitPrice: "",
                            totalPrice: "0",
                            notes: "",
                          })}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Item
                        </Button>
                      </div>

                      {fields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 border rounded-lg">
                          <div className="md:col-span-2">
                            <FormField
                              control={form.control}
                              name={`items.${index}.stockItemId`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Stock Item</FormLabel>
                                  <Select
                                    onValueChange={(value) => field.onChange(parseInt(value))}
                                    value={field.value?.toString() || ""}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select item" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {stockItems.map((item: any) => (
                                        <SelectItem key={item.id} value={item.id.toString()}>
                                          {item.name} ({item.measuringUnitSymbol || item.unitSymbol || "unit"})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Quantity</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.001"
                                    placeholder="0"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      calculateItemTotal(index);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`items.${index}.unitPrice`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Unit Price</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      calculateItemTotal(index);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`items.${index}.totalPrice`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Total</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    {...field}
                                    readOnly
                                    className="bg-gray-50"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => remove(index)}
                              disabled={fields.length === 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter any additional notes"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending}
                      >
                        Create Purchase Order
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Purchase Orders Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ShoppingCart className="mr-2 h-5 w-5" />
                Purchase Orders
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
                      <TableHead>PO Number</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.paginatedData.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.poNumber}
                        </TableCell>
                        <TableCell>{order.supplierName || "-"}</TableCell>
                        <TableCell>
                          {new Date(order.orderDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          ₨. {parseFloat(order.totalAmount || "0").toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(order.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleView(order.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {order.status === "draft" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApprove(order.id)}
                                disabled={approveMutation.isPending}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            {order.status === "draft" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(order.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pagination.paginatedData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          {searchTerm ? "No purchase orders found matching your search." : "No purchase orders found. Create your first purchase order to get started."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
              {pagination.totalItems > 0 && (
                <PaginationControls
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  onPageChange={pagination.setCurrentPage}
                  startIndex={pagination.startIndex}
                  endIndex={pagination.endIndex}
                  totalItems={pagination.totalItems}
                />
              )}
            </CardContent>
          </Card>

          {/* View Purchase Order Dialog */}
          <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Purchase Order Details</DialogTitle>
              </DialogHeader>
              
              {viewingOrder && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium">Purchase Order: {viewingOrder.poNumber}</h3>
                      <p className="text-sm text-gray-600">Status: {getStatusBadge(viewingOrder.status)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Order Date: {new Date(viewingOrder.orderDate).toLocaleDateString()}</p>
                      {viewingOrder.expectedDeliveryDate && (
                        <p className="text-sm text-gray-600">Expected Delivery: {new Date(viewingOrder.expectedDeliveryDate).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>

                  {/* Supplier Info */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Supplier Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p><strong>Name:</strong> {viewingOrder.supplierName}</p>
                        <p><strong>Email:</strong> {viewingOrder.supplierEmail || "-"}</p>
                      </div>
                      <div>
                        <p><strong>Phone:</strong> {viewingOrder.supplierPhone || "-"}</p>
                        <p><strong>Address:</strong> {viewingOrder.supplierAddress || "-"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Order Items</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Received</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewingOrder.items?.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.stockItemName}</TableCell>
                            <TableCell>
                              {parseFloat(item.quantity).toFixed(3)} {item.measuringUnitSymbol}
                            </TableCell>
                            <TableCell>₨. {parseFloat(item.unitPrice).toFixed(2)}</TableCell>
                            <TableCell>₨. {parseFloat(item.totalPrice).toFixed(2)}</TableCell>
                            <TableCell>
                              {parseFloat(item.receivedQuantity || 0).toFixed(3)} {item.measuringUnitSymbol}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Totals */}
                  <div className="border-t pt-4">
                    <div className="flex justify-end">
                      <div className="w-64 space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>₨. {parseFloat(viewingOrder.subtotal || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tax:</span>
                          <span>₨. {parseFloat(viewingOrder.taxAmount || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Discount:</span>
                          <span>₨. {parseFloat(viewingOrder.discountAmount || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-medium border-t pt-2">
                          <span>Total:</span>
                          <span>₨. {parseFloat(viewingOrder.totalAmount || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {viewingOrder.notes && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2">Notes</h4>
                      <p className="text-sm text-gray-600">{viewingOrder.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
