import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, SquareStack, Trash2, Search } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/ui/pagination-controls";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  insertRoomTypeSchema,
  type RoomType,
  type Branch,
} from "@shared/schema";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import { useAuth } from "@/hooks/useAuth";
import BulkOperations from "@/components/bulk-operations";

const roomTypeFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  basePrice: z
    .string()
    .min(1, "Base price is required")
    .refine((val) => !isNaN(parseFloat(val)), {
      message: "Base price must be a valid number",
    }),
  maxOccupancy: z.number().min(1, "Max occupancy must be at least 1"),
  branchId: z.number().nullable().optional(),
});

type RoomTypeFormData = z.infer<typeof roomTypeFormSchema>;

export default function RoomTypes() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRoomType, setEditingRoomType] = useState<RoomType | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>(
    null,
  );
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { data: roomTypes, isLoading } = useQuery<RoomType[]>({
    queryKey: ["/api/room-types"],
    enabled: isAuthenticated,
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    enabled: isAuthenticated,
  });

  const pagination = usePagination({
    data: roomTypes || [],
    itemsPerPage: 10,
    searchTerm,
    searchFields: ["name", "description"] as any,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/room-types", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create room type");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/room-types"] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Room type created successfully" });
    },
    onError: (error: any) => {
      console.error("Create room type error:", error);
      const errorMessage = error?.message || "Failed to create room type";
      toast({ title: errorMessage, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/room-types/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update room type");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/room-types"] });
      setEditingRoomType(null);
      form.reset();
      toast({ title: "Room type updated successfully" });
    },
    onError: (error: any) => {
      console.error("Update room type error:", error);
      const errorMessage = error?.message || "Failed to update room type";
      toast({ title: errorMessage, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/room-types/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete room type");
      }

      return response.status === 204 ? null : response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/room-types"] });
      toast({ title: "Room type deleted successfully" });
      setIsDeleteDialogOpen(false);
      setSelectedRoomType(null);
    },
    onError: (error: any) => {
      console.error("Delete room type error:", error);
      const errorMessage = error?.message || "Failed to delete room type";
      toast({ title: errorMessage, variant: "destructive" });
    },
  });

  const form = useForm<RoomTypeFormData>({
    resolver: zodResolver(roomTypeFormSchema),
    defaultValues: {
      name: "",
      description: "",
      basePrice: "",
      maxOccupancy: 1,
      branchId: null,
    },
  });

  const onSubmit = (data: RoomTypeFormData) => {
    console.log("Form submitted with data:", data);

    const submitData = {
      name: data.name,
      description: data.description || null,
      basePrice: data.basePrice, // Keep as string for decimal field
      maxOccupancy: data.maxOccupancy,
      branchId: data.branchId || null,
    };

    if (editingRoomType) {
      console.log("Updating room type:", editingRoomType.id);
      updateMutation.mutate({ id: editingRoomType.id, data: submitData });
    } else {
      console.log("Creating new room type");
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (roomType: RoomType) => {
    setEditingRoomType(roomType);
    form.reset({
      name: roomType.name,
      description: roomType.description || "",
      basePrice: roomType.basePrice.toString(),
      maxOccupancy: roomType.maxOccupancy,
      branchId: roomType.branchId,
    });
  };

  const handleCloseDialog = (open: boolean) => {
    console.log("Dialog open state changing to:", open);
    if (!open) {
      setIsCreateOpen(false);
      setEditingRoomType(null);
      form.reset({
        name: "",
        description: "",
        basePrice: "",
        maxOccupancy: 1,
        branchId: null,
      });
    }
  };

  const handleDelete = (roomType: RoomType) => {
    setSelectedRoomType(roomType);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteRoomType = () => {
    if (selectedRoomType) {
      deleteMutation.mutate(selectedRoomType.id);
    }
  };

  const getBranchName = (branchId: number | null) => {
    if (!branchId) return "All Branches";
    return branches?.find((b) => b.id === branchId)?.name || "Unknown Branch";
  };

  const resetForm = () => {
    form.reset({
      name: "",
      description: "",
      basePrice: "",
      maxOccupancy: 1,
      branchId: null,
    });
    setEditingRoomType(null);
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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

    if (!authLoading && isAuthenticated && user && user.role !== "superadmin") {
      toast({
        title: "Access Denied",
        description: "Only superadmin can access room types management.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, user, toast]);

  if (authLoading) {
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
    <div className="min h-screen bg-gray-50">
      <Sidebar
        isMobileMenuOpen={isMobileSidebarOpen}
        setIsMobileMenuOpen={setIsMobileSidebarOpen}
      />
      <div className="main-content">
        <Header
          title="Room Types"
          subtitle="Manage room categories and pricing"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex w-full mb-6 gap-2 justify-between">
            <div className="flex-1 max-w-xs">
              <Dialog
                open={isCreateOpen || !!editingRoomType}
                onOpenChange={handleCloseDialog}
              >
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      resetForm();
                      setIsCreateOpen(true);
                    }}
                    className="w-full h-11"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Room Type
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] mx-4 max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg">
                      {editingRoomType ? "Edit Room Type" : "Create Room Type"}
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
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. Standard Room"
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
                                placeholder="Room description and amenities"
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Two fields on one row */}
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="basePrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Base Price per Night</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="maxOccupancy"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Max Occupancy</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(parseInt(e.target.value))
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="branchId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Branch</FormLabel>
                            <Select
                              onValueChange={(value) =>
                                field.onChange(
                                  value === "unassigned"
                                    ? null
                                    : parseInt(value),
                                )
                              }
                              value={
                                field.value
                                  ? field.value.toString()
                                  : "unassigned"
                              }
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a branch" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="unassigned">
                                  All Branches (Unassigned)
                                </SelectItem>
                                {branches?.map((branch) => (
                                  <SelectItem
                                    key={branch.id}
                                    value={branch.id.toString()}
                                  >
                                    {branch.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleCloseDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button type="button" variant="outline">
                              Add Bulk
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[600px] mx-4 max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Add Multiple Room Types</DialogTitle>
                            </DialogHeader>
                            <BulkOperations
                              type="room-types"
                              branches={branches}
                              onSuccess={() => {
                                queryClient.invalidateQueries({
                                  queryKey: ["/api/room-types"],
                                });
                                handleCloseDialog(false);
                              }}
                              isDirectForm={true}
                            />
                          </DialogContent>
                        </Dialog>
                        <Button
                          type="submit"
                          disabled={
                            createMutation.isPending || updateMutation.isPending
                          }
                        >
                          {createMutation.isPending || updateMutation.isPending
                            ? "Saving..."
                            : editingRoomType
                              ? "Update"
                              : "Create"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="relative flex-1 max-w-xs ml-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search room types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full h-11"
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Room Types</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !roomTypes || roomTypes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 md:py-12 px-4">
                  <SquareStack className="h-10 w-10 md:h-12 md:w-12 text-gray-400 mb-4" />
                  <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2 text-center">
                    No room types found
                  </h3>
                  <p className="text-sm md:text-base text-gray-600 text-center mb-4 max-w-sm">
                    Create your first room type to start managing rooms
                  </p>
                  <Button
                    onClick={() => {
                      console.log(
                        "Create Room Type button clicked (empty state)",
                      );
                      resetForm();
                      setIsCreateOpen(true);
                    }}
                    className="w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Room Type
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {pagination.paginatedData.map((roomType) => (
                    <Card
                      key={roomType.id}
                      className="hover:shadow-lg transition-shadow"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base md:text-lg truncate">
                              {roomType.name}
                            </CardTitle>
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {getBranchName(roomType.branchId)}
                            </Badge>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(roomType)}
                              className="p-2"
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(roomType)}
                              disabled={deleteMutation.isPending}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {roomType.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {roomType.description}
                            </p>
                          )}
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                            <span className="text-sm font-medium">
                              Base Price:
                            </span>
                            <span className="text-lg font-bold text-primary">
                              Rs. {roomType.basePrice}/night
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                            <span className="text-sm font-medium">
                              Max Occupancy:
                            </span>
                            <span className="text-sm">
                              {roomType.maxOccupancy} guests
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
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
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedRoomType?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRoomType}
              disabled={deleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
