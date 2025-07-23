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
import { Plus, Package, Truck } from "lucide-react";
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
import { insertStockReceiptSchema } from "@shared/schema";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";

const formSchema = z.object({
  purchaseOrderId: z.number().optional(),
  supplierId: z.number().min(1, "Supplier is required"),
  branchId: z.number().optional(),
  receivedDate: z.string().min(1, "Received date is required"),
  notes: z.string().optional(),
  items: z.array(z.object({
    stockItemId: z.number().min(1, "Stock item is required"),
    quantity: z.string().min(1, "Quantity is required"),
    unitPrice: z.string().min(1, "Unit price is required"),
    totalPrice: z.string(),
    batchNumber: z.string().optional(),
    expiryDate: z.string().optional(),
    notes: z.string().optional(),
    purchaseOrderItemId: z.number().optional(),
  })).min(1, "At least one item is required"),
});

export default function StockReceipts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const { user } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      purchaseOrderId: undefined,
      supplierId: undefined,
      receivedDate: new Date().toISOString().split('T')[0],
      notes: "",
      items: [
        {
          stockItemId: 0,
          quantity: "",
          unitPrice: "",
          totalPrice: "0",
          batchNumber: "",
          expiryDate: "",
          notes: "",
          purchaseOrderItemId: undefined,
        }
      ],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["/api/stock-receipts"],
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["/api/purchase-orders"],
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["/api/inventory/suppliers"],
  });

  const { data: stockItems = [] } = useQuery({
    queryKey: ["/api/inventory/stock-items"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const response = await fetch("/api/stock-receipts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receipt: {
            purchaseOrderId: data.purchaseOrderId || null,
            supplierId: data.supplierId,
            receivedDate: data.receivedDate,
            notes: data.notes,
            branchId: user?.role === "superadmin" ? data.branchId : user?.branchId,
          },
          items: data.items.map(item => ({
            stockItemId: item.stockItemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate || null,
            notes: item.notes,
            purchaseOrderItemId: item.purchaseOrderItemId || null,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create stock receipt");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stock-items"] });
      setDialogOpen(false);
      setSelectedPO(null);
      form.reset();
      toast({ title: "Stock receipt created successfully" });
    },
    onError: (error: any) => {
      console.error("Error creating stock receipt:", error);
      toast({ 
        title: "Failed to create stock receipt", 
        description: error?.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log("Form submission data:", data);
    createMutation.mutate(data);
  };

  const handlePOSelect = async (purchaseOrderId: string) => {
    if (!purchaseOrderId) {
      setSelectedPO(null);
      form.setValue("supplierId", undefined);
      replace([{
        stockItemId: 0,
        quantity: "",
        unitPrice: "",
        totalPrice: "0",
        batchNumber: "",
        expiryDate: "",
        notes: "",
        purchaseOrderItemId: undefined,
      }]);
      return;
    }

    try {
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}`);
      const po = await response.json();
      setSelectedPO(po);

      form.setValue("supplierId", po.supplierId);

      // Pre-fill items from PO
      const poItems = po.items.map((item: any) => ({
        stockItemId: item.stockItemId,
        quantity: (parseFloat(item.quantity) - parseFloat(item.receivedQuantity || 0)).toString(),
        unitPrice: item.unitPrice,
        totalPrice: ((parseFloat(item.quantity) - parseFloat(item.receivedQuantity || 0)) * parseFloat(item.unitPrice)).toFixed(2),
        batchNumber: "",
        expiryDate: "",
        notes: "",
        purchaseOrderItemId: item.id,
      })).filter((item: any) => parseFloat(item.quantity) > 0);

      replace(poItems);
    } catch (error) {
      toast({ title: "Failed to load purchase order details", variant: "destructive" });
    }
  };

  const calculateItemTotal = (index: number) => {
    const quantity = parseFloat(form.watch(`items.${index}.quantity`) || "0");
    const unitPrice = parseFloat(form.watch(`items.${index}.unitPrice`) || "0");
    const total = quantity * unitPrice;
    form.setValue(`items.${index}.totalPrice`, total.toFixed(2));
  };

  const openCreateDialog = () => {
    setSelectedPO(null);
    form.reset();
    setDialogOpen(true);
  };

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isMobileMenuOpen={isMobileSidebarOpen}
        setIsMobileMenuOpen={setIsMobileSidebarOpen}
      />
      <div className="main-content">
        <Header
          title="Stock Receipts"
          subtitle="Receive and record incoming inventory"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
        />
        <main className="p-6">
          <div className="flex justify-between items-center mb-6">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Stock Receipt
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Stock Receipt</DialogTitle>
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
                        name="purchaseOrderId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Purchase Order (Optional)</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                const poId = value === "none" ? undefined : parseInt(value);
                                field.onChange(poId);
                                handlePOSelect(value === "none" ? "" : value);
                              }}
                              value={field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select purchase order" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">None (Direct Receipt)</SelectItem>
                                {purchaseOrders
                                  .filter((po: any) => po.status === "confirmed" || po.status === "partially-received")
                                  .map((po: any) => (
                                    <SelectItem key={po.id} value={po.id.toString()}>
                                      {po.poNumber} - {po.supplierName}
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
                          name="supplierId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Supplier <span className="text-red-500">*</span></FormLabel>
                              <Select
                                onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                                value={field.value?.toString()}
                                disabled={!!selectedPO}
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
                        name="receivedDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Received Date <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Items Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Received Items</h3>
                        {!selectedPO && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => append({
                              stockItemId: 0,
                              quantity: "",
                              unitPrice: "",
                              totalPrice: "0",
                              batchNumber: "",
                              expiryDate: "",
                              notes: "",
                              purchaseOrderItemId: undefined,
                            })}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Item
                          </Button>
                        )}
                      </div>

                      {fields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-1 md:grid-cols-8 gap-4 p-4 border rounded-lg">
                          <div className="md:col-span-2">
                            <FormField
                              control={form.control}
                              name={`items.${index}.stockItemId`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Stock Item <span className="text-red-500">*</span></FormLabel>
                                  <Select
                                    onValueChange={(value) => field.onChange(parseInt(value))}
                                    value={field.value > 0 ? field.value.toString() : ""}
                                    disabled={!!selectedPO}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select item" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {stockItems.map((item: any) => (
                                        <SelectItem key={item.id} value={item.id.toString()}>
                                          {item.name} ({item.measuringUnitSymbol})
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

                          <FormField
                            control={form.control}
                            name={`items.${index}.batchNumber`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Batch #</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Batch"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`items.${index}.expiryDate`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Expiry Date</FormLabel>
                                <FormControl>
                                  <Input
                                    type="date"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {!selectedPO && (
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => remove(index)}
                                disabled={fields.length === 1}
                              >
                                <Truck className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
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
                        Create Stock Receipt
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stock Receipts Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="mr-2 h-5 w-5" />
                Stock Receipts
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
                      <TableHead>Receipt Number</TableHead>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Received Date</TableHead>
                      <TableHead>Total Value</TableHead>
                      <TableHead>Received By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.map((receipt: any) => (
                      <TableRow key={receipt.id}>
                        <TableCell className="font-medium">
                          {receipt.receiptNumber}
                        </TableCell>
                        <TableCell>{receipt.poNumber || "-"}</TableCell>
                        <TableCell>{receipt.supplierName || "-"}</TableCell>
                        <TableCell>
                          {new Date(receipt.receivedDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          ₨. {parseFloat(receipt.totalValue || "0").toFixed(2)}
                        </TableCell>
                        <TableCell>{receipt.receivedByName || "-"}</TableCell>
                      </TableRow>
                    ))}
                    {receipts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          No stock receipts found. Create your first stock receipt to get started.
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