import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Shield, Users } from "lucide-react";

interface Module {
  id: string;
  name: string;
  description: string;
}

interface Permission {
  module: string;
  permissions: {
    read: boolean;
    write: boolean;
    delete: boolean;
  };
}

interface CustomRole {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  permissions: Permission[];
}

export default function RoleManagement() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [] as Permission[],
  });

  // Fetch custom roles
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["/api/roles"],
    enabled: isAuthenticated && user?.role === "superadmin",
  });

  // Fetch available modules
  const { data: modules = [], isLoading: modulesLoading } = useQuery<Module[]>({
    queryKey: ["roles-modules-available"],
    queryFn: async () => {
      const response = await fetch("/api/roles/modules/available");
      if (!response.ok) throw new Error("Failed to fetch modules");
      return response.json();
    },
    enabled: isAuthenticated && user?.role === "superadmin",
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      permissions: Permission[];
    }) => {
      const response = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setIsCreateDialogOpen(false);
      setFormData({ name: "", description: "", permissions: [] });
      toast({ title: "Role created successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error creating role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: { name: string; description: string; permissions: Permission[] };
    }) => {
      const response = await fetch(`/api/roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setIsEditDialogOpen(false);
      setSelectedRole(null);
      setFormData({ name: "", description: "", permissions: [] });
      toast({ title: "Role updated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error updating role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/roles/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({ title: "Role deleted successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error deleting role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePermissionChange = (
    moduleId: string,
    permissionType: "read" | "write" | "delete",
    value: boolean,
  ) => {
    setFormData((prev) => {
      const permissions = [...prev.permissions];
      const existingIndex = permissions.findIndex((p) => p.module === moduleId);

      if (existingIndex >= 0) {
        permissions[existingIndex].permissions[permissionType] = value;
      } else {
        permissions.push({
          module: moduleId,
          permissions: {
            read: permissionType === "read" ? value : false,
            write: permissionType === "write" ? value : false,
            delete: permissionType === "delete" ? value : false,
          },
        });
      }

      return { ...prev, permissions };
    });
  };

  const getPermissionValue = (
    moduleId: string,
    permissionType: "read" | "write" | "delete",
  ): boolean => {
    const permission = formData.permissions.find((p) => p.module === moduleId);
    return permission?.permissions[permissionType] || false;
  };

  const handleCreateRole = () => {
    if (!formData.name.trim()) {
      toast({ title: "Role name is required", variant: "destructive" });
      return;
    }
    createRoleMutation.mutate(formData);
  };

  const handleEditRole = (role: CustomRole) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions || [],
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateRole = () => {
    if (!selectedRole || !formData.name.trim()) {
      toast({ title: "Role name is required", variant: "destructive" });
      return;
    }
    updateRoleMutation.mutate({
      id: selectedRole.id,
      data: formData,
    });
  };

  const resetForm = () => {
    setFormData({ name: "", description: "", permissions: [] });
    setSelectedRole(null);
  };

  // Permission check for superadmin
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Unauthorized</h2>
          <p className="text-gray-600">Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  if (user && user.role !== "superadmin") {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="main-content">
          <Header title="Role Management" subtitle="Access Denied" />
          <main className="p-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    Only superadmins can access role management.
                  </p>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  if (isLoading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
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
          title="Role Management"
          subtitle="Create and manage custom roles with granular permissions"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
        />

        <main className="p-6">
          {/* Create Role Button - Now outside the card */}
          <div className="mb-6 flex justify-start">
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
            >
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Role
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Custom Role</DialogTitle>
                  <DialogDescription>
                    Create a new role with specific permissions for different
                    modules
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Role Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="e.g., Test Manager"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        placeholder="Role description"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-base font-semibold">
                      Module Permissions
                    </Label>
                    <div className="mt-4 border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Module</TableHead>
                            <TableHead className="text-center">Read</TableHead>
                            <TableHead className="text-center">Write</TableHead>
                            <TableHead className="text-center">
                              Delete
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {modulesLoading ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center">
                                Loading modules...
                              </TableCell>
                            </TableRow>
                          ) : modules.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center">
                                No modules available
                              </TableCell>
                            </TableRow>
                          ) : (
                            modules.map((module) => (
                              <TableRow key={module.id}>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">
                                      {module.name}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {module.description}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={getPermissionValue(
                                      module.id,
                                      "read",
                                    )}
                                    onCheckedChange={(checked) =>
                                      handlePermissionChange(
                                        module.id,
                                        "read",
                                        checked as boolean,
                                      )
                                    }
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={getPermissionValue(
                                      module.id,
                                      "write",
                                    )}
                                    onCheckedChange={(checked) =>
                                      handlePermissionChange(
                                        module.id,
                                        "write",
                                        checked as boolean,
                                      )
                                    }
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={getPermissionValue(
                                      module.id,
                                      "delete",
                                    )}
                                    onCheckedChange={(checked) =>
                                      handlePermissionChange(
                                        module.id,
                                        "delete",
                                        checked as boolean,
                                      )
                                    }
                                  />
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateRole}
                      disabled={createRoleMutation.isPending}
                    >
                      {createRoleMutation.isPending
                        ? "Creating..."
                        : "Create Role"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Custom Roles</CardTitle>
              <CardDescription>
                Manage custom roles and assign specific permissions to control
                user access
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role: CustomRole) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>
                        {role.description || "No description"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {role.permissions?.slice(0, 3).map((permission) => (
                            <Badge
                              key={permission.module}
                              variant="secondary"
                              className="text-xs"
                            >
                              {modules.find((m) => m.id === permission.module)
                                ?.name || permission.module}
                            </Badge>
                          ))}
                          {role.permissions?.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{role.permissions.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={role.isActive ? "default" : "secondary"}
                        >
                          {role.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditRole(role)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteRoleMutation.mutate(role.id)}
                            disabled={deleteRoleMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {roles.length === 0 && (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No custom roles created yet.</p>
                  <p className="text-sm text-gray-400">
                    Create your first custom role to get started.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Role Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Role: {selectedRole?.name}</DialogTitle>
                <DialogDescription>
                  Update role permissions and settings
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-name">Role Name *</Label>
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g., Test Manager"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-description">Description</Label>
                    <Input
                      id="edit-description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Role description"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-base font-semibold">
                    Module Permissions
                  </Label>
                  <div className="mt-4 border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Module</TableHead>
                          <TableHead className="text-center">Read</TableHead>
                          <TableHead className="text-center">Write</TableHead>
                          <TableHead className="text-center">Delete</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {modulesLoading ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center">
                              Loading modules...
                            </TableCell>
                          </TableRow>
                        ) : modules.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center">
                              No modules available
                            </TableCell>
                          </TableRow>
                        ) : (
                          modules.map((module) => (
                            <TableRow key={module.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">
                                    {module.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {module.description}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={getPermissionValue(
                                    module.id,
                                    "read",
                                  )}
                                  onCheckedChange={(checked) =>
                                    handlePermissionChange(
                                      module.id,
                                      "read",
                                      checked as boolean,
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={getPermissionValue(
                                    module.id,
                                    "write",
                                  )}
                                  onCheckedChange={(checked) =>
                                    handlePermissionChange(
                                      module.id,
                                      "write",
                                      checked as boolean,
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={getPermissionValue(
                                    module.id,
                                    "delete",
                                  )}
                                  onCheckedChange={(checked) =>
                                    handlePermissionChange(
                                      module.id,
                                      "delete",
                                      checked as boolean,
                                    )
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateRole}
                    disabled={updateRoleMutation.isPending}
                  >
                    {updateRoleMutation.isPending
                      ? "Updating..."
                      : "Update Role"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
