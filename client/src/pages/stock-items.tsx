import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Edit, Trash2, Package } from "lucide-react";
import { useForm } from "react-hook-form";
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
import { insertStockItemSchema } from "@shared/schema";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import BulkOperations from "@/components/bulk-operations";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";

const formSchema = insertStockItemSchema.extend({
  name: z.string().min(1, "Item name is required"),
  categoryId: z.number().min(1, "Category is required"),
  measuringUnitId: z.number().min(1, "Measuring unit is required"),
  defaultPrice: z.union([z.string(), z.number()]).transform((val) => {
    if (val === "" || val === null || val === undefined) return "0";
    return typeof val === 'number' ? val.toString() : val;
  }),
  currentStock: z.union([z.string(), z.number()]).transform((val) => {
    if (val === "" || val === null || val === undefined) return "0";
    return typeof val === 'number' ? val.toString() : val;
  }),
  minimumStock: z.union([z.string(), z.number()]).transform((val) => {
    if (val === "" || val === null || val === undefined) return "0";
    return typeof val === 'number' ? val.toString() : val;
  }),
  maximumStock: z.union([z.string(), z.number()]).transform((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    return typeof val === 'number' ? val.toString() : val;
  }).optional(),
  reorderLevel: z.union([z.string(), z.number()]).transform((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    return typeof val === 'number' ? val.toString() : val;
  }).optional(),
  reorderQuantity: z.union([z.string(), z.number()]).transform((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    return typeof val === 'number' ? val.toString() : val;
  }).optional(),
  // Additional fields for opening stock calculation
  openingQuantity: z.union([z.string(), z.number()]).transform((val) => {
    if (val === "" || val === null || val === undefined) return "0";
    return typeof val === 'number' ? val.toString() : val;
  }).optional(),
  openingRate: z.union([z.string(), z.number()]).transform((val) => {
    if (val === "" || val === null || val === undefined) return "0";
    return typeof val === 'number' ? val.toString() : val;
  }).optional(),
}).omit({
  branchId: true,
  sku: true,
  isActive: true,
});

export default function StockItems() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const { user } = useAuth();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      categoryId: 0,
      measuringUnitId: 0,
      supplierId: undefined,
      defaultPrice: "0",
      currentStock: "0",
      minimumStock: "0",
      maximumStock: "",
      reorderLevel: "",
      reorderQuantity: "",
      description: "",
      openingQuantity: "0",
      openingRate: "0",
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["/api/inventory/stock-items"],
  });

  const { data: stockCategories = [] } = useQuery({
    queryKey: ["/api/inventory/stock-categories"],
  });

  const { data: measuringUnits = [] } = useQuery({
    queryKey: ["/api/inventory/measuring-units"],
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["/api/inventory/suppliers"],
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["/api/branches"],
    enabled: user?.role === "superadmin",
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      // Process the data to remove the extra opening stock fields and set currentStock properly
      const processedData = {
        ...data,
        currentStock: data.openingQuantity || "0",
        defaultPrice: data.openingRate || data.defaultPrice || "0",
        // Remove the temporary fields
        openingQuantity: undefined,
        openingRate: undefined,
      };
      console.log("Creating stock item with data:", processedData);
      const response = await fetch("/api/inventory/stock-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(processedData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create stock item");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inventory/stock-items"],
      });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Stock item created successfully" });
    },
    onError: (error: any) => {
      console.error("Error creating stock item:", error);
      toast({ 
        title: "Failed to create stock item", 
        description: error?.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: { id: number } & Partial<z.infer<typeof formSchema>>) => {
      const response = await fetch(`/api/inventory/stock-items/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update stock item");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inventory/stock-items"],
      });
      setDialogOpen(false);
      setEditingItem(null);
      form.reset();
      toast({ title: "Stock item updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update stock item", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/inventory/stock-items/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete stock item");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inventory/stock-items"],
      });
      toast({ title: "Stock item deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete stock item", variant: "destructive" });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log("Form submission data:", data);

    // Ensure required fields are properly set
    const submitData = {
      ...data,
      categoryId: Number(data.categoryId),
      measuringUnitId: Number(data.measuringUnitId),
      supplierId: data.supplierId ? Number(data.supplierId) : undefined,
      branchId: user?.role === "superadmin" ? (data as any).branchId || user.branchId : user?.branchId,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    form.reset({
      name: item.name,
      categoryId: item.categoryId,
      measuringUnitId: item.measuringUnitId,
      supplierId: item.supplierId,
      defaultPrice: item.defaultPrice || "0",
      currentStock: item.currentStock || "0",
      minimumStock: item.minimumStock || "0",
      description: item.description || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (item: any) => {
    setSelectedItem(item);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (!selectedItem) return;

    try {
      await deleteMutation.mutateAsync(selectedItem.id);
      setIsDeleteDialogOpen(false);
      setSelectedItem(null);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const openCreateDialog = () => {
    setEditingItem(null);
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
          title="Stock Items"
          subtitle="Manage inventory stock items"
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
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? "Edit Stock Item" : "Create Stock Item"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    {/* Row 1: Item Name and Measuring Unit */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="Enter name of Stock" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="measuringUnitId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Measuring Unit <span className="text-red-500">*</span></FormLabel>
                            <Select
                              onValueChange={(value) =>
                                field.onChange(parseInt(value))
                              }
                              value={field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Measuring Unit of the item" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {measuringUnits.map((unit: any) => (
                                  <SelectItem
                                    key={unit.id}
                                    value={unit.id.toString()}
                                  >
                                    {unit.name} ({unit.symbol})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Row 2: Default Price and Group (Category) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="defaultPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Default Price</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">Rs</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0"
                                  className="pl-10"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Group</FormLabel>
                            <Select
                              onValueChange={(value) =>
                                field.onChange(parseInt(value))
                              }
                              value={field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Group for Item" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {stockCategories.map((category: any) => (
                                  <SelectItem
                                    key={category.id}
                                    value={category.id.toString()}
                                  >
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Opening Stock Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium">Opening Stock</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="openingQuantity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.001"
                                  placeholder="00.00"
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    // Calculate value when quantity or rate changes
                                    const quantity = parseFloat(e.target.value) || 0;
                                    const rate = parseFloat(form.getValues('openingRate')) || 0;
                                    const value = quantity * rate;
                                    form.setValue('currentStock', quantity.toString());
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="openingRate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rate</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">Rs</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0"
                                    className="pl-10"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      // Calculate value when quantity or rate changes
                                      const rate = parseFloat(e.target.value) || 0;
                                      const quantity = parseFloat(form.getValues('openingQuantity')) || 0;
                                      const value = quantity * rate;
                                      form.setValue('defaultPrice', rate.toString());
                                    }}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="currentStock"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Value</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">Rs</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0"
                                    className="pl-10 bg-gray-50"
                                    {...field}
                                    readOnly
                                    value={(() => {
                                      const quantity = parseFloat(form.watch('openingQuantity')) || 0;
                                      const rate = parseFloat(form.watch('openingRate')) || 0;
                                      return (quantity * rate).toFixed(2);
                                    })()}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Row 3: Reorder Level and Reorder QTY */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="reorderLevel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reorder Level</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.001"
                                placeholder="Enter reorder level"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="reorderQuantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reorder QTY</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.001"
                                placeholder="Enter reorder quantity"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="minimumStock"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum Stock</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.001"
                                placeholder="0"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Description Field */}
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter description"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                        className="w-full sm:w-auto"
                      >
                        Cancel
                      </Button>
                      {!editingItem && (
                        <Button 
                          type="button" 
                          variant="secondary" 
                          onClick={() => {
                            setDialogOpen(false);
                            setIsBulkDialogOpen(true);
                          }}
                          className="w-full sm:w-auto"
                        >
                          Add Bulk
                        </Button>
                      )}
                      <Button
                        type="submit"
                        disabled={
                          createMutation.isPending || updateMutation.isPending
                        }
                        className="w-full sm:w-auto"
                      >
                        {editingItem ? "Update" : "Create Item"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

          </div>

          {/* Bulk Stock Items Dialog */}
          <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Stock Items in Bulk</DialogTitle>
              </DialogHeader>
              <BulkOperations 
                type="stock-items" 
                branches={Array.isArray(branches) ? branches : []} 
                stockCategories={Array.isArray(stockCategories) ? stockCategories : []}
                measuringUnits={Array.isArray(measuringUnits) ? measuringUnits : []}
                suppliers={Array.isArray(suppliers) ? suppliers : []}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/inventory/stock-items'] });
                  setIsBulkDialogOpen(false);
                  toast({ title: "Stock items created successfully" });
                }} 
                isDirectForm={true}
              />
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="mr-2 h-5 w-5" />
                Stock Items
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
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell>{item.categoryName || "-"}</TableCell>
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
                        <TableCell>{item.measuringUnitName}</TableCell>
                        <TableCell>
                          ₨. {parseFloat(item.defaultPrice || "0").toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              parseFloat(item.currentStock || "0") <=
                              parseFloat(item.minimumStock || "0")
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {parseFloat(item.currentStock || "0") <=
                            parseFloat(item.minimumStock || "0")
                              ? "Low Stock"
                              : "In Stock"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(item)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          No stock items found. Create your first item to get
                          started.
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
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        title="Delete Stock Item"
        description={`Are you sure you want to delete ${selectedItem?.name}? This action cannot be undone.`}
        onConfirm={confirmDeleteItem}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}