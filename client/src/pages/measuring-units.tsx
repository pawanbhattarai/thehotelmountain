import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Edit, Trash2, Ruler, Search } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/ui/pagination-controls";
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
import { insertMeasuringUnitSchema } from "@shared/schema";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import BulkOperations from "@/components/bulk-operations";

type MeasuringUnit = {
  id: number;
  name: string;
  symbol: string;
  baseUnit: string | null;
  conversionFactor: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const formSchema = insertMeasuringUnitSchema.extend({
  name: z.string().min(1, "Unit name is required"),
  symbol: z.string().min(1, "Symbol is required"),
  baseUnit: z.string().optional(),
  conversionFactor: z.string().default("1"),
});

export default function MeasuringUnits() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<MeasuringUnit | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      symbol: "",
      baseUnit: "",
      conversionFactor: "1",
    },
  });

  const { data: units = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/inventory/measuring-units"],
  });

  const pagination = usePagination({
    data: Array.isArray(units) ? units : [],
    itemsPerPage: 10,
    searchTerm,
    searchFields: ["name", "symbol", "baseUnit"],
  });

  const { data: branches } = useQuery({
    queryKey: ['/api/branches'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const response = await fetch("/api/inventory/measuring-units", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inventory/measuring-units"],
      });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Measuring unit created successfully" });
    },
    onError: (error: any) => {
      console.error("Error creating measuring unit:", error);
      toast({
        title: "Failed to create measuring unit",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: { id: number } & Partial<z.infer<typeof formSchema>>) => {
      const response = await fetch(`/api/inventory/measuring-units/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inventory/measuring-units"],
      });
      setDialogOpen(false);
      setEditingUnit(null);
      form.reset();
      toast({ title: "Measuring unit updated successfully" });
    },
    onError: (error: any) => {
      console.error("Error updating measuring unit:", error);
      toast({
        title: "Failed to update measuring unit",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/inventory/measuring-units/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inventory/measuring-units"],
      });
      toast({ title: "Measuring unit deleted successfully" });
    },
    onError: (error: any) => {
      console.error("Error deleting measuring unit:", error);
      toast({
        title: "Failed to delete measuring unit",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    if (editingUnit) {
      updateMutation.mutate({ id: editingUnit.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (unit: MeasuringUnit) => {
    setEditingUnit(unit);
    form.reset({
      name: unit.name,
      symbol: unit.symbol,
      baseUnit: unit.baseUnit || "",
      conversionFactor: unit.conversionFactor,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this measuring unit?")) {
      deleteMutation.mutate(id);
    }
  };

  const openCreateDialog = () => {
    setEditingUnit(null);
    form.reset();
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isMobileMenuOpen={isMobileSidebarOpen}
        setIsMobileMenuOpen={setIsMobileSidebarOpen}
      />
      <div className="main-content">
        <Header
          title="Measuring Units"
          subtitle="Manage inventory measuring units"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
        />
        <main className="p-6">
          {/* Search and Add Button Section */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} className="w-full sm:w-auto bg-primary hover:bg-primary/90">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Unit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingUnit
                      ? "Edit Measuring Unit"
                      : "Create Measuring Unit"}
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
                          <FormLabel>Unit Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Kilogram" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="symbol"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Symbol</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., kg" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="baseUnit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Unit (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Gram" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="conversionFactor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Conversion Factor</FormLabel>
                          <FormControl>
                            <Input placeholder="1" {...field} />
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
                      {!editingUnit && (
                        <Button 
                          type="button" 
                          variant="secondary" 
                          onClick={() => {
                            setDialogOpen(false);
                            setIsBulkDialogOpen(true);
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
                        {editingUnit ? "Update" : "Create Unit"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search units..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Bulk Measuring Units Dialog */}
          <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Measuring Units in Bulk</DialogTitle>
              </DialogHeader>
              <BulkOperations 
                type="measuring-units" 
                branches={Array.isArray(branches) ? branches : []} 
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/inventory/measuring-units'] });
                  setIsBulkDialogOpen(false);
                  toast({ title: "Measuring units created successfully" });
                }} 
                isDirectForm={true}
              />
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Ruler className="mr-2 h-5 w-5" />
                Units List
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
                      <TableHead>Symbol</TableHead>
                      <TableHead>Base Unit</TableHead>
                      <TableHead>Conversion Factor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.paginatedData.map((unit: MeasuringUnit) => (
                      <TableRow key={unit.id}>
                        <TableCell className="font-medium">
                          {unit.name}
                        </TableCell>
                        <TableCell>{unit.symbol}</TableCell>
                        <TableCell>{unit.baseUnit || "-"}</TableCell>
                        <TableCell>{unit.conversionFactor}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              unit.isActive ? "secondary" : "destructive"
                            }
                          >
                            {unit.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(unit)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(unit.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pagination.paginatedData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          {searchTerm ? "No units found matching your search." : "No measuring units found. Create your first unit to get started."}
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
        </main>
      </div>
    </div>
  );
}
