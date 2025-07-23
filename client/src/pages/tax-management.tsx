import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaxSchema, type Tax, type InsertTax } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";

export default function TaxManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: taxes, isLoading } = useQuery({
    queryKey: ["/api/taxes"],
  });

  const createTaxMutation = useMutation({
    mutationFn: async (data: InsertTax) => {
      const response = await fetch("/api/taxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create tax");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/taxes"] });
      setIsModalOpen(false);
      setEditingTax(null);
      resetForm();
      toast({ title: "Tax created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create tax",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTaxMutation = useMutation({
    mutationFn: async (data: { id: number; tax: Partial<InsertTax> }) => {
      const response = await fetch(`/api/taxes/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.tax),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update tax");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/taxes"] });
      setIsModalOpen(false);
      setEditingTax(null);
      resetForm();
      toast({ title: "Tax updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update tax",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTaxMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/taxes/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete tax");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/taxes"] });
      toast({ title: "Tax deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete tax",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<InsertTax>({
    resolver: zodResolver(insertTaxSchema),
    defaultValues: {
      taxName: "",
      rate: "0",
      status: "active",
      applyToReservations: false,
      applyToOrders: false,
      notes: "",
    },
  });

  const resetForm = () => {
    form.reset({
      taxName: "",
      rate: "0",
      status: "active",
      applyToReservations: false,
      applyToOrders: false,
      notes: "",
    });
  };

  const onSubmit = (data: InsertTax) => {
    if (editingTax) {
      updateTaxMutation.mutate({ id: editingTax.id, tax: data });
    } else {
      createTaxMutation.mutate(data);
    }
  };

  const handleEdit = (tax: Tax) => {
    setEditingTax(tax);
    form.reset({
      taxName: tax.taxName,
      rate: tax.rate,
      status: tax.status,
      applyToReservations: tax.applyToReservations,
      applyToOrders: tax.applyToOrders,
      notes: tax.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = (tax: Tax) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${tax.taxName}"? This action cannot be undone.`,
      )
    ) {
      deleteTaxMutation.mutate(tax.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "inactive":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  // Check permissions - only superadmin and branch-admin can access
  if (!user || !["superadmin", "branch-admin"].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar
          isMobileMenuOpen={isMobileSidebarOpen}
          setIsMobileMenuOpen={setIsMobileSidebarOpen}
        />
        <div className="main-content">
          <Header
            title="Access Denied"
            subtitle="You don't have permission to access this page"
            onMobileMenuToggle={() =>
              setIsMobileSidebarOpen(!isMobileSidebarOpen)
            }
          />
          <main className="p-6">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">
                  Only administrators can access the Tax/Charges management
                  system.
                </p>
              </CardContent>
            </Card>
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
          title="Tax/Charges Management"
          subtitle="Configure taxes and charges for reservations and orders"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
        />
        <main className="p-6">
          <div className="flex justify-between items-center mb-6">
            <Button
              onClick={() => {
                setEditingTax(null);
                resetForm();
                setIsModalOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Tax/Charge
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="mr-2 h-5 w-5" />
                  Tax/Charges List
                </CardTitle>
              </CardHeader>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">Loading taxes...</div>
              ) : taxes && taxes.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SN</TableHead>
                        <TableHead>Tax Name</TableHead>
                        <TableHead>Rate (%)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Applied To</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {taxes.map((tax: Tax, index: number) => (
                        <TableRow key={tax.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="font-medium">
                            {tax.taxName}
                          </TableCell>
                          <TableCell>
                            {parseFloat(tax.rate).toFixed(2)}%
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`${getStatusColor(tax.status)} text-white`}
                            >
                              {tax.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {tax.applyToReservations && (
                                <Badge variant="outline" className="mr-1">
                                  Reservations
                                </Badge>
                              )}
                              {tax.applyToOrders && (
                                <Badge variant="outline">Orders</Badge>
                              )}
                              {!tax.applyToReservations &&
                                !tax.applyToOrders && (
                                  <span className="text-muted-foreground text-sm">
                                    None
                                  </span>
                                )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {tax.notes || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(tax)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(tax)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    No Taxes/Charges Configured
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first tax or charge configuration to start
                    applying them to reservations and orders.
                  </p>
                  <Button
                    onClick={() => {
                      setEditingTax(null);
                      resetForm();
                      setIsModalOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Tax/Charge
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add/Edit Tax Modal */}
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingTax ? "Edit Tax/Charge" : "Add New Tax/Charge"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="taxName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax Name *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., VAT, Service Tax"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rate (%) *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder="0.00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Active Status</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Only active taxes will be applied to new
                            transactions
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value === "active"}
                            onCheckedChange={(checked) =>
                              field.onChange(checked ? "active" : "inactive")
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <FormLabel>Apply To *</FormLabel>
                    <FormField
                      control={form.control}
                      name="applyToReservations"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value || false}
                              onChange={field.onChange}
                              className="rounded border-gray-300"
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Reservations (Hotel Billing)
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="applyToOrders"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value || false}
                              onChange={field.onChange}
                              className="rounded border-gray-300"
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Orders (Restaurant Billing)
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Additional information about this tax/charge"
                            rows={3}
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
                      onClick={() => setIsModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        createTaxMutation.isPending ||
                        updateTaxMutation.isPending
                      }
                    >
                      {createTaxMutation.isPending ||
                      updateTaxMutation.isPending
                        ? "Saving..."
                        : editingTax
                          ? "Update Tax"
                          : "Create Tax"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}