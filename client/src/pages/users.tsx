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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function Users() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    id: "",
    email: "",
    firstName: "",
    lastName: "",
    role: "front-desk",
    branchId: "",
    password: "",
    customRoleIds: [] as number[],
  });
  const [searchTerm, setSearchTerm] = useState("");

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
    enabled: isAuthenticated && user?.role === "superadmin",
  });

  const { data: branches } = useQuery({
    queryKey: ["/api/branches"],
    enabled: isAuthenticated && user?.role === "superadmin",
  });

  const { data: customRoles } = useQuery({
    queryKey: ["/api/roles"],
    enabled: isAuthenticated && user?.role === "superadmin",
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      if (!response.ok) throw new Error("Failed to create user");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "User created successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...userData }: any) => {
      const response = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      if (!response.ok) throw new Error("Failed to update user");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "User updated successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete user");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Success", description: "User deleted successfully" });
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      id: "",
      email: "",
      firstName: "",
      lastName: "",
      role: "front-desk",
      branchId: "",
      password: "",
      customRoleIds: [],
    });
    setEditingUser(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Convert branchId to number or null for unassigned
    const submitData = {
      ...formData,
      branchId:
        formData.branchId === "unassigned" || formData.branchId === ""
          ? null
          : parseInt(formData.branchId, 10),
    };

    if (editingUser) {
      updateUserMutation.mutate(submitData);
    } else {
      createUserMutation.mutate(submitData);
    }
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setFormData({
      id: user.id,
      email: user.email || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role,
      branchId: user.branchId?.toString() || "unassigned",
      password: "",
      customRoleIds: user.customRoleIds || [],
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (user: any) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteUser = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  const getBranchName = (branchId: number) => {
    const branch = branches?.find((b: any) => b.id === branchId);
    return branch?.name || "Unassigned";
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      superadmin: {
        label: "Super Admin",
        className: "bg-red-100 text-red-800",
      },
      "branch-admin": {
        label: "Branch Admin",
        className: "bg-blue-100 text-blue-800",
      },
      "front-desk": {
        label: "Front Desk",
        className: "bg-green-100 text-green-800",
      },
    };
    const config =
      roleConfig[role as keyof typeof roleConfig] || roleConfig["front-desk"];
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const pagination = usePagination({
    data: users || [],
    itemsPerPage: 10,
    searchTerm,
    searchFields: ["firstName", "lastName", "email", "role"] as any,
  });

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
          <Header title="User Management" subtitle="Access Denied" />
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
          title="User Management"
          subtitle="Manage staff accounts and permissions"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
        />
        <main className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="shrink-0">
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingUser ? "Edit User" : "Add New User"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="id">User ID</Label>
                    <Input
                      id="id"
                      value={formData.id}
                      onChange={(e) =>
                        setFormData({ ...formData, id: e.target.value })
                      }
                      required
                      disabled={!!editingUser}
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
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      required={!editingUser}
                      placeholder={
                        editingUser
                          ? "Leave blank to keep current password"
                          : "Enter password"
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          firstName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => {
                        setFormData({ 
                          ...formData, 
                          role: value,
                          customRoleIds: value === "custom" ? formData.customRoleIds : []
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="front-desk">Front Desk</SelectItem>
                        <SelectItem value="branch-admin">
                          Branch Admin
                        </SelectItem>
                        <SelectItem value="superadmin">Super Admin</SelectItem>
                        <SelectItem value="custom">Custom Role</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.role === "custom" && (
                    <div>
                      <Label>Custom Roles</Label>
                      <div className="space-y-2 mt-2">
                        {customRoles?.map((role: any) => (
                          <div key={role.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`role-${role.id}`}
                              checked={formData.customRoleIds.includes(role.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    customRoleIds: [...formData.customRoleIds, role.id]
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    customRoleIds: formData.customRoleIds.filter(id => id !== role.id)
                                  });
                                }
                              }}
                              className="rounded"
                            />
                            <label htmlFor={`role-${role.id}`} className="text-sm">
                              {role.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="branchId">Branch</Label>
                    <Select
                      value={formData.branchId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, branchId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
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
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      createUserMutation.isPending ||
                      updateUserMutation.isPending
                    }
                  >
                    {createUserMutation.isPending ||
                    updateUserMutation.isPending
                      ? "Saving..."
                      : editingUser
                        ? "Update User"
                        : "Create User"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagination.paginatedData?.length ? (
                        pagination.paginatedData.map((user: any) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.firstName} {user.lastName}
                            </TableCell>
                            <TableCell>{user.email || "N/A"}</TableCell>
                            <TableCell>{getRoleBadge(user.role)}</TableCell>
                            <TableCell>
                              {getBranchName(user.branchId)}
                            </TableCell>
                            <TableCell>
                              {user.lastLogin
                                ? new Date(user.lastLogin).toLocaleDateString()
                                : "Never"}
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(user)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(user)}
                                  disabled={deleteUserMutation.isPending}
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
                            colSpan={6}
                            className="text-center py-8 text-gray-500"
                          >
                            {searchTerm
                              ? "No users match your search criteria."
                              : "No users found. Create your first user to get started."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  <PaginationControls
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    onPageChange={pagination.setCurrentPage}
                    startIndex={pagination.startIndex}
                    endIndex={pagination.endIndex}
                    totalItems={pagination.totalItems}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete User"
        description={`Are you sure you want to delete "${selectedUser?.firstName} ${selectedUser?.lastName}"? This action cannot be undone.`}
        onConfirm={confirmDeleteUser}
        isLoading={deleteUserMutation.isPending}
      />
    </div>
  );
}