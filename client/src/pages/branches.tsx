import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { Plus, Edit2, Trash2, Search } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/ui/pagination-controls";

export default function Branches() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
  });

  const { data: branches, isLoading: branchesLoading } = useQuery({
    queryKey: ["/api/branches"],
    enabled: isAuthenticated,
  });

  const pagination = usePagination({
    data: branches || [],
    itemsPerPage: 10,
    searchTerm,
    searchFields: ["name", "address", "phone", "email"] as any,
  });

  const createBranchMutation = useMutation({
    mutationFn: async (branchData: any) => {
      const response = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branchData),
      });
      if (!response.ok) throw new Error("Failed to create branch");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "Branch created successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create branch",
        variant: "destructive",
      });
    },
  });

  const updateBranchMutation = useMutation({
    mutationFn: async ({ id, ...branchData }: any) => {
      const response = await fetch(`/api/branches/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branchData),
      });
      if (!response.ok) throw new Error("Failed to update branch");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "Branch updated successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update branch",
        variant: "destructive",
      });
    },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: async (branchId: number) => {
      const response = await fetch(`/api/branches/${branchId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete branch");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      toast({ title: "Success", description: "Branch deleted successfully" });
      setIsDeleteDialogOpen(false);
      setSelectedBranch(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete branch",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      phone: "",
      email: "",
    });
    setEditingBranch(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBranch) {
      updateBranchMutation.mutate({ id: editingBranch.id, ...formData });
    } else {
      createBranchMutation.mutate(formData);
    }
  };

  const handleEdit = (branch: any) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address || "",
      phone: branch.phone || "",
      email: branch.email || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (branch: any) => {
    setSelectedBranch(branch);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteBranch = () => {
    if (selectedBranch) {
      deleteBranchMutation.mutate(selectedBranch.id);
    }
  };

  const handleAddBranch = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (user && user.role !== "superadmin") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className="main-content">
          <Header title="Branch Management" subtitle="Access Denied" />
          <main className="p-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    You don't have permission to view this page.
                  </p>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isMobileMenuOpen={isMobileSidebarOpen}
        setIsMobileMenuOpen={setIsMobileSidebarOpen}
      />
      <div className="main-content">
        <Header
          title="Branch Management"
          subtitle="Oversee multiple hotel locations"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
        />
        <main className="p-6">
          <div className="mb-6 flex w-full gap-2 justify-between">
            <div className="flex-1 max-w-xs">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={handleAddBranch}
                    className="w-full h-11 bg-primary hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Branch
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingBranch ? "Edit Branch" : "Add New Branch"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Branch Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Textarea
                        id="address"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={
                        createBranchMutation.isPending ||
                        updateBranchMutation.isPending
                      }
                    >
                      {createBranchMutation.isPending ||
                      updateBranchMutation.isPending
                        ? "Saving..."
                        : editingBranch
                        ? "Update Branch"
                        : "Create Branch"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search branches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full h-11"
              />
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>All Branches</CardTitle>
            </CardHeader>
            <CardContent>
              {branchesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches?.length ? (
                      pagination.paginatedData.map((branch: any) => (
                        <TableRow key={branch.id}>
                          <TableCell className="font-medium">
                            {branch.name}
                          </TableCell>
                          <TableCell>{branch.address || "N/A"}</TableCell>
                          <TableCell>{branch.phone || "N/A"}</TableCell>
                          <TableCell>{branch.email || "N/A"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                branch.isActive ? "default" : "secondary"
                              }
                            >
                              {branch.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(branch.createdAt)}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(branch)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(branch)}
                                disabled={deleteBranchMutation.isPending}
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
                          colSpan={7}
                          className="text-center py-8 text-gray-500"
                        >
                          No branches found. Create your first branch to get
                          started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              <PaginationControls
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={pagination.setCurrentPage}
                startIndex={pagination.startIndex}
                endIndex={pagination.endIndex}
                totalItems={pagination.totalItems}
              />
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete Branch"
        description={`Are you sure you want to delete "${selectedBranch?.name}"? This action cannot be undone.`}
        onConfirm={confirmDeleteBranch}
        isLoading={deleteBranchMutation.isPending}
      />
    </div>
  );
}