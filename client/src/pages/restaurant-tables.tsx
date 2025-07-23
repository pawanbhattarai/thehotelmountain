import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, QrCode } from "lucide-react";
import { QRCodeModal } from "@/components/qr-code-modal";
import BulkOperations from "@/components/bulk-operations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";

const tableSchema = z.object({
  name: z.string().min(1, "Table name is required"),
  capacity: z.number().min(1, "Capacity must be at least 1"),
  branchId: z.number(),
  status: z.enum(["open", "occupied", "maintenance"]).optional(),
});

type TableFormData = z.infer<typeof tableSchema>;

export default function RestaurantTables() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkTableDialogOpen, setIsBulkTableDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: tables, isLoading } = useQuery({
    queryKey: ["/api/restaurant/tables"],
  });

  const { data: branches } = useQuery({
    queryKey: ["/api/branches"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: TableFormData) => {
      const response = await fetch("/api/restaurant/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create table");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/tables"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Table created successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<TableFormData>;
    }) => {
      const response = await fetch(`/api/restaurant/tables/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update table");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/tables"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Table updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/restaurant/tables/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete table");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/tables"] });
      toast({ title: "Table deleted successfully" });
    },
  });

  const form = useForm<TableFormData>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      name: "",
      capacity: 1,
      branchId: user?.role !== "superadmin" ? user?.branchId : undefined,
      status: "open",
    },
  });

  const resetForm = () => {
    form.reset({
      name: "",
      capacity: 1,
      branchId: user?.role !== "superadmin" ? user?.branchId : undefined,
      status: "open",
    });
    setEditingTable(null);
  };

  const onSubmit = (data: TableFormData) => {
    if (editingTable) {
      updateMutation.mutate({ id: editingTable.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (table: any) => {
    setEditingTable(table);
    form.reset({
      name: table.name,
      capacity: table.capacity,
      branchId: table.branchId,
      status: table.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this table?")) {
      deleteMutation.mutate(id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-green-500";
      case "occupied":
        return "bg-red-500";
      case "maintenance":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isMobileMenuOpen={isMobileSidebarOpen}
        setIsMobileMenuOpen={setIsMobileSidebarOpen}
      />
      <div className="main-content">
        <Header
          title="Restaurant Tables"
          subtitle="Manage your restaurant tables and seating arrangements"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
        />
        <main className="p-6">
          {/* Add Button Section */}
          <div className="mb-6">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={resetForm}
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Table
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingTable ? "Edit Table" : "Add New Table"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Table Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Table 1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="capacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Capacity</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min={1}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value))
                              }
                            />
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
                            <FormControl>
                              <Select
                                value={field.value?.toString()}
                                onValueChange={(value) =>
                                  field.onChange(parseInt(value))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select branch" />
                                </SelectTrigger>
                                <SelectContent>
                                  {branches?.map((branch: any) => (
                                    <SelectItem
                                      key={branch.id}
                                      value={branch.id.toString()}
                                    >
                                      {branch.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="occupied">
                                  Occupied
                                </SelectItem>
                                <SelectItem value="maintenance">
                                  Maintenance
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      {!editingTable && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setIsDialogOpen(false);
                            setIsBulkTableDialogOpen(true);
                          }}
                        >
                          Add Bulk
                        </Button>
                      )}
                      <Button
                        type="submit"
                        disabled={
                          createMutation.isPending || updateMutation.isPending
                        }
                      >
                        {editingTable ? "Update" : "Create"} Table
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Tables</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table Name</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tables?.length ? (
                      tables.map((table: any) => (
                        <TableRow key={table.id}>
                          <TableCell className="font-medium">
                            {table.name}
                          </TableCell>
                          <TableCell>{table.capacity} people</TableCell>
                          <TableCell>
                            <Badge
                              className={`${getStatusColor(table.status)} text-white`}
                            >
                              {table.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <QRCodeModal
                                type="table"
                                id={table.id}
                                name={table.name}
                              >
                                <Button variant="outline" size="sm">
                                  <QrCode className="h-4 w-4" />
                                </Button>
                              </QRCodeModal>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(table)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(table.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-8 text-gray-500"
                        >
                          No tables found. Create your first table to get
                          started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Bulk Table Dialog */}
          <Dialog
            open={isBulkTableDialogOpen}
            onOpenChange={setIsBulkTableDialogOpen}
          >
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Tables in Bulk</DialogTitle>
              </DialogHeader>
              <BulkOperations
                type="tables"
                branches={Array.isArray(branches) ? branches : []}
                onSuccess={() => {
                  queryClient.invalidateQueries({
                    queryKey: ["/api/restaurant/tables"],
                  });
                  setIsBulkTableDialogOpen(false);
                  toast({ title: "Tables created successfully" });
                }}
                isDirectForm={true}
              />
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
