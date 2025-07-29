import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Edit, Trash2, Package, Search } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { insertStockCategorySchema } from "@shared/schema";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import BulkOperations from "@/components/bulk-operations";

type StockCategory = {
  id: number;
  name: string;
  description: string | null;
  branchId: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const formSchema = insertStockCategorySchema.extend({
  name: z.string().min(1, "Category name is required"),
});

export default function StockCategories() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCategory, setEditingCategory] = useState<StockCategory | null>(
    null,
  );
  const { user } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const { data: categories = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/inventory/stock-categories"],
  });

  const pagination = usePagination({
    data: Array.isArray(categories) ? categories : [],
    itemsPerPage: 10,
    searchTerm,
    searchFields: ["name", "description"],
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["/api/branches"],
    enabled: user?.role === "superadmin",
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      console.log("API request data:", data);
      const response = await fetch("/api/inventory/stock-categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create stock category");
      }
      
      return response.json();
    },
    onSuccess: (response) => {
      console.log("Category created successfully:", response);
      queryClient.invalidateQueries({
        queryKey: ["/api/inventory/stock-categories"],
      });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Stock category created successfully" });
    },
    onError: (error: any) => {
      console.error("Error creating category:", error);
      toast({
        title: "Failed to create stock category",
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
      const response = await fetch(`/api/inventory/stock-categories/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update stock category");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inventory/stock-categories"],
      });
      setDialogOpen(false);
      setEditingCategory(null);
      form.reset();
      toast({ title: "Stock category updated successfully" });
    },
    onError: () => {
      toast({
        title: "Failed to update stock category",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/inventory/stock-categories/${id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete stock category");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inventory/stock-categories"],
      });
      toast({ title: "Stock category deleted successfully" });
    },
    onError: () => {
      toast({
        title: "Failed to delete stock category",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log("Form data being submitted:", data);
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, ...data });
    } else {
      // Ensure branchId is properly set for non-superadmin users
      const categoryData = {
        ...data,
        branchId: user?.role === "superadmin" ? data.branchId : user?.branchId || null,
      };
      console.log("Creating category with data:", categoryData);
      createMutation.mutate(categoryData);
    }
  };

  const handleEdit = (category: StockCategory) => {
    setEditingCategory(category);
    form.reset({
      name: category.name,
      description: category.description || "",
      branchId: category.branchId,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this stock category?")) {
      deleteMutation.mutate(id);
    }
  };

  const openCreateDialog = () => {
    setEditingCategory(null);
    form.reset({
      name: "",
      description: "",
      branchId: user?.role === "superadmin" ? undefined : user?.branchId,
    });
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
          title="Stock Categories"
          subtitle="Manage inventory stock categories"
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
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingCategory
                      ? "Edit Stock Category"
                      : "Create Stock Category"}
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
                          <FormLabel>Category Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter category name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter description"
                              {...field}
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
                                value={field.value === null ? "null" : field.value?.toString() || ""} 
                                onValueChange={(value) => {
                                  if (value === "null") {
                                    field.onChange(null);
                                  } else {
                                    field.onChange(parseInt(value));
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select branch (optional for global category)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="null">All Branches (Global)</SelectItem>
                                  {Array.isArray(branches) && branches.filter((branch: any) => branch.isActive).map((branch: any) => (
                                    <SelectItem key={branch.id} value={branch.id.toString()}>
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
                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      {!editingCategory && (
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
                        {editingCategory ? "Update" : "Create Category"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Bulk Stock Categories Dialog */}
          <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Stock Categories in Bulk</DialogTitle>
              </DialogHeader>
              <BulkOperations 
                type="stock-categories" 
                branches={Array.isArray(branches) ? branches : []} 
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/inventory/stock-categories'] });
                  setIsBulkDialogOpen(false);
                  toast({ title: "Stock categories created successfully" });
                }} 
                isDirectForm={true}
              />
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="mr-2 h-5 w-5" />
                Categories List
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
                      <TableHead>Description</TableHead>
                      <TableHead>Branch</TableHead>

                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.paginatedData.map((category: StockCategory) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">
                          {category.name}
                        </TableCell>
                        <TableCell>{category.description || "-"}</TableCell>
                        <TableCell>
                          {category.branchId ? (
                            <Badge variant="outline">
                              {branches.find((b: any) => b.id === category.branchId)?.name || `Branch ${category.branchId}`}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">All Branches</Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={
                              category.isActive ? "secondary" : "destructive"
                            }
                          >
                            {category.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(category)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(category.id)}
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
                        <TableCell colSpan={5} className="text-center py-8">
                          {searchTerm ? "No categories found matching your search." : "No stock categories found. Create your first category to get started."}
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
