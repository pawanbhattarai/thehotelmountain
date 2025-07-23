import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Upload } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// Bulk Tables Schema
const bulkTablesSchema = z.object({
  tables: z
    .array(
      z.object({
        name: z.string().min(1, "Table name is required"),
        capacity: z.number().min(1, "Capacity must be at least 1"),
        branchId: z.number(),
      }),
    )
    .min(1, "At least one table is required"),
});

// Bulk Categories Schema
const bulkCategoriesSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().min(1, "Category name is required"),
        branchId: z.number(),
        sortOrder: z.number().optional(),
      }),
    )
    .min(1, "At least one category is required"),
});

// Bulk Dishes Schema
const bulkDishesSchema = z.object({
  dishes: z
    .array(
      z.object({
        name: z.string().min(1, "Dish name is required"),
        price: z.string().min(1, "Price is required"),
        categoryId: z.number().min(1, "Category is required"),
        branchId: z.number(),
        description: z.string().optional(),
        spiceLevel: z.enum(["mild", "medium", "hot", "extra-hot"]).optional(),
        preparationTime: z.number().optional(),
        isVegetarian: z.boolean().optional(),
        isVegan: z.boolean().optional(),
      }),
    )
    .min(1, "At least one dish is required"),
});

// Bulk Stock Categories Schema
const bulkStockCategoriesSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().min(1, "Category name is required"),
        description: z.string().optional(),
        branchId: z.number().nullable().optional(),
      }),
    )
    .min(1, "At least one category is required"),
});

// Bulk Measuring Units Schema
const bulkMeasuringUnitsSchema = z.object({
  units: z
    .array(
      z.object({
        name: z.string().min(1, "Unit name is required"),
        symbol: z.string().min(1, "Symbol is required"),
        baseUnit: z.string().optional(),
        conversionFactor: z.string().optional(),
      }),
    )
    .min(1, "At least one unit is required"),
});

// Bulk Suppliers Schema
const bulkSuppliersSchema = z.object({
  suppliers: z
    .array(
      z.object({
        name: z.string().min(1, "Supplier name is required"),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        address: z.string().optional(),
        contactPerson: z.string().optional(),
        taxNumber: z.string().optional(),
        branchId: z.number().nullable().optional(),
      }),
    )
    .min(1, "At least one supplier is required"),
});

// Bulk Stock Items Schema
const bulkStockItemsSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1, "Item name is required"),
        categoryId: z.number().min(1, "Category is required"),
        measuringUnitId: z.number().min(1, "Measuring unit is required"),
        supplierId: z.number().optional(),
        defaultPrice: z.string().transform((val) => (val === "" ? "0" : val)),
        currentStock: z.string().transform((val) => (val === "" ? "0" : val)),
        minimumStock: z.string().transform((val) => (val === "" ? "0" : val)),
        maximumStock: z
          .string()
          .transform((val) => (val === "" ? undefined : val))
          .optional(),
        reorderLevel: z
          .string()
          .transform((val) => (val === "" ? undefined : val))
          .optional(),
        reorderQuantity: z
          .string()
          .transform((val) => (val === "" ? undefined : val))
          .optional(),
        description: z.string().optional(),
        branchId: z.number().nullable().optional(),
      }),
    )
    .min(1, "At least one item is required"),
});

// Bulk Room Types Schema
const bulkRoomTypesSchema = z.object({
  roomTypes: z
    .array(
      z.object({
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
      }),
    )
    .min(1, "At least one room type is required"),
});

// Bulk Rooms Schema
const bulkRoomsSchema = z.object({
  rooms: z
    .array(
      z.object({
        number: z.string().min(1, "Room number is required"),
        floor: z.number().optional(),
        roomTypeId: z.number().min(1, "Room type is required"),
        branchId: z.number().min(1, "Branch is required"),
        status: z
          .enum([
            "available",
            "occupied",
            "maintenance",
            "housekeeping",
            "out-of-order",
            "reserved",
          ])
          .optional(),
      }),
    )
    .min(1, "At least one room is required"),
});

type BulkTablesData = z.infer<typeof bulkTablesSchema>;
type BulkCategoriesData = z.infer<typeof bulkCategoriesSchema>;
type BulkDishesData = z.infer<typeof bulkDishesSchema>;
type BulkStockCategoriesData = z.infer<typeof bulkStockCategoriesSchema>;
type BulkMeasuringUnitsData = z.infer<typeof bulkMeasuringUnitsSchema>;
type BulkSuppliersData = z.infer<typeof bulkSuppliersSchema>;
type BulkStockItemsData = z.infer<typeof bulkStockItemsSchema>;
type BulkRoomTypesData = z.infer<typeof bulkRoomTypesSchema>;
type BulkRoomsData = z.infer<typeof bulkRoomsSchema>;

interface BulkOperationsProps {
  type:
    | "tables"
    | "categories"
    | "dishes"
    | "stock-categories"
    | "measuring-units"
    | "suppliers"
    | "stock-items"
    | "room-types"
    | "rooms";
  branches: any[];
  categories?: any[];
  stockCategories?: any[];
  measuringUnits?: any[];
  suppliers?: any[];
  roomTypes?: any[];
  onSuccess: () => void;
  isDirectForm?: boolean;
}

export default function BulkOperations({
  type,
  branches,
  categories,
  stockCategories,
  measuringUnits,
  suppliers,
  roomTypes,
  onSuccess,
  isDirectForm = false,
}: BulkOperationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Tables Form
  const tablesForm = useForm<BulkTablesData>({
    resolver: zodResolver(bulkTablesSchema),
    defaultValues: {
      tables: [
        {
          name: "",
          capacity: 4,
          branchId:
            user?.role === "superadmin"
              ? branches?.[0]?.id || 1
              : user?.branchId || 1,
        },
      ],
    },
  });

  const {
    fields: tableFields,
    append: appendTable,
    remove: removeTable,
  } = useFieldArray({
    control: tablesForm.control,
    name: "tables",
  });

  // Categories Form
  const categoriesForm = useForm<BulkCategoriesData>({
    resolver: zodResolver(bulkCategoriesSchema),
    defaultValues: {
      categories: [
        {
          name: "",
          branchId:
            user?.role === "superadmin"
              ? branches?.[0]?.id || 1
              : user?.branchId || 1,
          sortOrder: 0,
        },
      ],
    },
  });

  const {
    fields: categoryFields,
    append: appendCategory,
    remove: removeCategory,
  } = useFieldArray({
    control: categoriesForm.control,
    name: "categories",
  });

  // Stock Categories Form
  const stockCategoriesForm = useForm<BulkStockCategoriesData>({
    resolver: zodResolver(bulkStockCategoriesSchema),
    defaultValues: {
      categories: [
        {
          name: "",
          description: "",
          branchId: user?.role === "superadmin" ? null : user?.branchId || null,
        },
      ],
    },
  });

  const {
    fields: stockCategoryFields,
    append: appendStockCategory,
    remove: removeStockCategory,
  } = useFieldArray({
    control: stockCategoriesForm.control,
    name: "categories",
  });

  // Measuring Units Form
  const measuringUnitsForm = useForm<BulkMeasuringUnitsData>({
    resolver: zodResolver(bulkMeasuringUnitsSchema),
    defaultValues: {
      units: [
        {
          name: "",
          symbol: "",
          baseUnit: "",
          conversionFactor: "1",
        },
      ],
    },
  });

  const {
    fields: unitFields,
    append: appendUnit,
    remove: removeUnit,
  } = useFieldArray({
    control: measuringUnitsForm.control,
    name: "units",
  });

  // Suppliers Form
  const suppliersForm = useForm<BulkSuppliersData>({
    resolver: zodResolver(bulkSuppliersSchema),
    defaultValues: {
      suppliers: [
        {
          name: "",
          email: "",
          phone: "",
          address: "",
          contactPerson: "",
          taxNumber: "",
          branchId: user?.role === "superadmin" ? null : user?.branchId || null,
        },
      ],
    },
  });

  const {
    fields: supplierFields,
    append: appendSupplier,
    remove: removeSupplier,
  } = useFieldArray({
    control: suppliersForm.control,
    name: "suppliers",
  });

  // Stock Items Form
  const stockItemsForm = useForm<BulkStockItemsData>({
    resolver: zodResolver(bulkStockItemsSchema),
    defaultValues: {
      items: [
        {
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
          branchId: user?.role === "superadmin" ? null : user?.branchId || null,
        },
      ],
    },
  });

  const {
    fields: stockItemFields,
    append: appendStockItem,
    remove: removeStockItem,
  } = useFieldArray({
    control: stockItemsForm.control,
    name: "items",
  });

  // Room Types Form
  const roomTypesForm = useForm<BulkRoomTypesData>({
    resolver: zodResolver(bulkRoomTypesSchema),
    defaultValues: {
      roomTypes: [
        {
          name: "",
          description: "",
          basePrice: "",
          maxOccupancy: 1,
          branchId: user?.role === "superadmin" ? null : user?.branchId || null,
        },
      ],
    },
  });

  const {
    fields: roomTypeFields,
    append: appendRoomType,
    remove: removeRoomType,
  } = useFieldArray({
    control: roomTypesForm.control,
    name: "roomTypes",
  });

  // Rooms Form
  const roomsForm = useForm<BulkRoomsData>({
    resolver: zodResolver(bulkRoomsSchema),
    defaultValues: {
      rooms: [
        {
          number: "",
          floor: undefined,
          roomTypeId: roomTypes?.[0]?.id || 0,
          branchId:
            user?.role === "superadmin"
              ? branches?.[0]?.id || 1
              : user?.branchId || 1,
          status: "available",
        },
      ],
    },
  });

  const {
    fields: roomFields,
    append: appendRoom,
    remove: removeRoom,
  } = useFieldArray({
    control: roomsForm.control,
    name: "rooms",
  });

  // Dishes Form
  const dishesForm = useForm<BulkDishesData>({
    resolver: zodResolver(bulkDishesSchema),
    defaultValues: {
      dishes: [
        {
          name: "",
          price: "",
          categoryId: categories?.[0]?.id || 1,
          branchId:
            user?.role === "superadmin"
              ? branches?.[0]?.id || 1
              : user?.branchId || 1,
          description: "",
          isVegetarian: false,
          isVegan: false,
        },
      ],
    },
  });

  const {
    fields: dishFields,
    append: appendDish,
    remove: removeDish,
  } = useFieldArray({
    control: dishesForm.control,
    name: "dishes",
  });

  // Mutations
  const createTablesMutation = useMutation({
    mutationFn: async (data: BulkTablesData) => {
      const response = await fetch("/api/restaurant/tables/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create tables");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/tables"] });
      setIsOpen(false);
      tablesForm.reset();
      onSuccess();
      toast({ title: "Tables created successfully" });
    },
  });

  const createCategoriesMutation = useMutation({
    mutationFn: async (data: BulkCategoriesData) => {
      const response = await fetch("/api/restaurant/categories/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create categories");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/restaurant/categories"],
      });
      setIsOpen(false);
      categoriesForm.reset();
      onSuccess();
      toast({ title: "Categories created successfully" });
    },
  });

  const createDishesMutation = useMutation({
    mutationFn: async (data: BulkDishesData) => {
      const response = await fetch("/api/restaurant/dishes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create dishes");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/dishes"] });
      setIsOpen(false);
      dishesForm.reset();
      onSuccess();
      toast({ title: "Dishes created successfully" });
    },
  });

  // Inventory Mutations
  const createStockCategoriesMutation = useMutation({
    mutationFn: async (data: BulkStockCategoriesData) => {
      const response = await fetch("/api/inventory/stock-categories/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create stock categories");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inventory/stock-categories"],
      });
      setIsOpen(false);
      stockCategoriesForm.reset();
      onSuccess();
      toast({ title: "Stock categories created successfully" });
    },
  });

  const createMeasuringUnitsMutation = useMutation({
    mutationFn: async (data: BulkMeasuringUnitsData) => {
      const response = await fetch("/api/inventory/measuring-units/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create measuring units");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inventory/measuring-units"],
      });
      setIsOpen(false);
      measuringUnitsForm.reset();
      onSuccess();
      toast({ title: "Measuring units created successfully" });
    },
  });

  const createSuppliersMutation = useMutation({
    mutationFn: async (data: BulkSuppliersData) => {
      const response = await fetch("/api/inventory/suppliers/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create suppliers");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/suppliers"] });
      setIsOpen(false);
      suppliersForm.reset();
      onSuccess();
      toast({ title: "Suppliers created successfully" });
    },
  });

  const createStockItemsMutation = useMutation({
    mutationFn: async (data: BulkStockItemsData) => {
      const response = await fetch("/api/inventory/stock-items/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create stock items");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inventory/stock-items"],
      });
      setIsOpen(false);
      stockItemsForm.reset();
      onSuccess();
      toast({ title: "Stock items created successfully" });
    },
  });

  const createRoomTypesMutation = useMutation({
    mutationFn: async (data: BulkRoomTypesData) => {
      const response = await fetch("/api/room-types/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create room types");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/room-types"] });
      setIsOpen(false);
      roomTypesForm.reset();
      onSuccess();
      toast({ title: "Room types created successfully" });
    },
  });

  const createRoomsMutation = useMutation({
    mutationFn: async (data: BulkRoomsData) => {
      const response = await fetch("/api/rooms/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create rooms");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      setIsOpen(false);
      roomsForm.reset();
      onSuccess();
      toast({ title: "Rooms created successfully" });
    },
  });

  const getTitle = () => {
    switch (type) {
      case "tables":
        return "Add Multiple Tables";
      case "categories":
        return "Add Multiple Categories";
      case "dishes":
        return "Add Multiple Dishes";
      case "stock-categories":
        return "Add Multiple Stock Categories";
      case "measuring-units":
        return "Add Multiple Measuring Units";
      case "suppliers":
        return "Add Multiple Suppliers";
      case "stock-items":
        return "Add Multiple Stock Items";
      case "room-types":
        return "Add Multiple Room Types";
      case "rooms":
        return "Add Multiple Rooms";
    }
  };

  const renderTablesForm = () => (
    <Form {...tablesForm}>
      <form
        onSubmit={tablesForm.handleSubmit((data) => {
          // Filter out empty rows (rows without name)
          const validTables = data.tables.filter(
            (table) => table.name.trim() !== "",
          );
          if (validTables.length === 0) {
            toast({
              title: "Please fill at least one table",
              variant: "destructive",
            });
            return;
          }
          createTablesMutation.mutate({ tables: validTables });
        })}
        className="space-y-4"
      >
        {tableFields.map((field, index) => (
          <Card key={field.id} className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">Table {index + 1}</h4>
              {tableFields.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeTable(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={tablesForm.control}
                name={`tables.${index}.name`}
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
                control={tablesForm.control}
                name={`tables.${index}.capacity`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value))
                        }
                        placeholder="4"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {user?.role === "superadmin" && (
                <FormField
                  control={tablesForm.control}
                  name={`tables.${index}.branchId`}
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </Card>
        ))}

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              appendTable({
                name: "",
                capacity: 4,
                branchId:
                  user?.role === "superadmin"
                    ? branches?.[0]?.id || 1
                    : user?.branchId || 1,
              })
            }
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add 1 Row
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              for (let i = 0; i < 2; i++) {
                appendTable({
                  name: "",
                  capacity: 4,
                  branchId:
                    user?.role === "superadmin"
                      ? branches?.[0]?.id || 1
                      : user?.branchId || 1,
                });
              }
            }}
            size="sm"
          >
            Add 2 Rows
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              for (let i = 0; i < 5; i++) {
                appendTable({
                  name: "",
                  capacity: 4,
                  branchId:
                    user?.role === "superadmin"
                      ? branches?.[0]?.id || 1
                      : user?.branchId || 1,
                });
              }
            }}
            size="sm"
          >
            Add 5 Rows
          </Button>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createTablesMutation.isPending}
        >
          {createTablesMutation.isPending ? "Creating..." : "Create Tables"}
        </Button>
      </form>
    </Form>
  );

  const renderCategoriesForm = () => (
    <Form {...categoriesForm}>
      <form
        onSubmit={categoriesForm.handleSubmit((data) => {
          // Filter out empty rows (rows without name)
          const validCategories = data.categories.filter(
            (category) => category.name.trim() !== "",
          );
          if (validCategories.length === 0) {
            toast({
              title: "Please fill at least one category",
              variant: "destructive",
            });
            return;
          }
          createCategoriesMutation.mutate({ categories: validCategories });
        })}
        className="space-y-4"
      >
        {categoryFields.map((field, index) => (
          <Card key={field.id} className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">Category {index + 1}</h4>
              {categoryFields.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeCategory(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={categoriesForm.control}
                name={`categories.${index}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Appetizers" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoriesForm.control}
                name={`categories.${index}.sortOrder`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort Order</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 0)
                        }
                        placeholder="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {user?.role === "superadmin" && (
                <FormField
                  control={categoriesForm.control}
                  name={`categories.${index}.branchId`}
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </Card>
        ))}

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              appendCategory({
                name: "",
                branchId:
                  user?.role === "superadmin"
                    ? branches?.[0]?.id || 1
                    : user?.branchId || 1,
                sortOrder: 0,
              })
            }
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add 1 Row
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              for (let i = 0; i < 2; i++) {
                appendCategory({
                  name: "",
                  branchId:
                    user?.role === "superadmin"
                      ? branches?.[0]?.id || 1
                      : user?.branchId || 1,
                  sortOrder: 0,
                });
              }
            }}
            size="sm"
          >
            Add 2 Rows
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              for (let i = 0; i < 5; i++) {
                appendCategory({
                  name: "",
                  branchId:
                    user?.role === "superadmin"
                      ? branches?.[0]?.id || 1
                      : user?.branchId || 1,
                  sortOrder: 0,
                });
              }
            }}
            size="sm"
          >
            Add 5 Rows
          </Button>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createCategoriesMutation.isPending}
        >
          {createCategoriesMutation.isPending
            ? "Creating..."
            : "Create Categories"}
        </Button>
      </form>
    </Form>
  );

  const renderDishesForm = () => (
    <Form {...dishesForm}>
      <form
        onSubmit={dishesForm.handleSubmit((data) => {
          // Filter out empty rows (rows without name and price)
          const validDishes = data.dishes.filter(
            (dish) => dish.name.trim() !== "" && dish.price.trim() !== "",
          );
          if (validDishes.length === 0) {
            toast({
              title: "Please fill at least one dish with name and price",
              variant: "destructive",
            });
            return;
          }
          createDishesMutation.mutate({ dishes: validDishes });
        })}
        className="space-y-4"
      >
        {dishFields.map((field, index) => (
          <Card key={field.id} className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">Dish {index + 1}</h4>
              {dishFields.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeDish(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={dishesForm.control}
                name={`dishes.${index}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dish Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Chicken Curry" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={dishesForm.control}
                name={`dishes.${index}.price`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (Rs.)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="350" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={dishesForm.control}
                name={`dishes.${index}.categoryId`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value?.toString()}
                        onValueChange={(value) =>
                          field.onChange(parseInt(value))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories?.map((category) => (
                            <SelectItem
                              key={category.id}
                              value={category.id.toString()}
                            >
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={dishesForm.control}
                name={`dishes.${index}.spiceLevel`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spice Level</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select spice level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mild">Mild</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hot">Hot</SelectItem>
                          <SelectItem value="extra-hot">Extra Hot</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={dishesForm.control}
                name={`dishes.${index}.isVegetarian`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Diet Type</FormLabel>
                    <FormControl>
                      <div className="flex gap-3">
                        <div
                          className={`flex items-center px-3 py-2 border-2 rounded-md cursor-pointer transition-all ${
                            field.value === true
                              ? "border-green-500 bg-green-50"
                              : "border-gray-200 hover:border-green-300"
                          }`}
                          onClick={() => {
                            field.onChange(true);
                            dishesForm.setValue(`dishes.${index}.isVegan`, false);
                          }}
                        >
                          <div className="w-4 h-4 border-2 border-green-500 rounded-sm flex items-center justify-center mr-2">
                            <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
                          </div>
                          <span className="text-sm font-medium text-green-600">VEG</span>
                        </div>
                        <div
                          className={`flex items-center px-3 py-2 border-2 rounded-md cursor-pointer transition-all ${
                            field.value === false && !dishesForm.watch(`dishes.${index}.isVegan`)
                              ? "border-red-500 bg-red-50"
                              : "border-gray-200 hover:border-red-300"
                          }`}
                          onClick={() => {
                            field.onChange(false);
                            dishesForm.setValue(`dishes.${index}.isVegan`, false);
                          }}
                        >
                          <div className="w-4 h-4 border-2 border-red-500 rounded-sm flex items-center justify-center mr-2">
                            <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
                          </div>
                          <span className="text-sm font-medium text-red-600">NON-VEG</span>
                        </div>
                        <div
                          className={`flex items-center px-3 py-2 border-2 rounded-md cursor-pointer transition-all ${
                            dishesForm.watch(`dishes.${index}.isVegan`)
                              ? "border-green-600 bg-green-100"
                              : "border-gray-200 hover:border-green-400"
                          }`}
                          onClick={() => {
                            field.onChange(true);
                            dishesForm.setValue(`dishes.${index}.isVegan`, true);
                          }}
                        >
                          <div className="w-4 h-4 border-2 border-green-600 rounded-sm flex items-center justify-center mr-2">
                            <div className="w-2.5 h-2.5 bg-green-600 rounded-full"></div>
                          </div>
                          <span className="text-sm font-medium text-green-700">VEGAN</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={dishesForm.control}
                name={`dishes.${index}.description`}
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Dish description..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>
        ))}

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              appendDish({
                name: "",
                price: "",
                categoryId: categories?.[0]?.id || 1,
                branchId:
                  user?.role === "superadmin"
                    ? branches?.[0]?.id || 1
                    : user?.branchId || 1,
                description: "",
                isVegetarian: true,
                isVegan: false,
              })
            }
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add 1 Row
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              for (let i = 0; i < 2; i++) {
                appendDish({
                  name: "",
                  price: "",
                  categoryId: categories?.[0]?.id || 1,
                  branchId:
                    user?.role === "superadmin"
                      ? branches?.[0]?.id || 1
                      : user?.branchId || 1,
                  description: "",
                  isVegetarian: true,
                  isVegan: false,
                });
              }
            }}
            size="sm"
          >
            Add 2 Rows
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              for (let i = 0; i < 5; i++) {
                appendDish({
                  name: "",
                  price: "",
                  categoryId: categories?.[0]?.id || 1,
                  branchId:
                    user?.role === "superadmin"
                      ? branches?.[0]?.id || 1
                      : user?.branchId || 1,
                  description: "",
                  isVegetarian: true,
                  isVegan: false,
                });
              }
            }}
            size="sm"
          >
            Add 5 Rows
          </Button>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createDishesMutation.isPending}
        >
          {createDishesMutation.isPending ? "Creating..." : "Create Dishes"}
        </Button>
      </form>
    </Form>
  );

  const renderStockCategoriesForm = () => (
    <Form {...stockCategoriesForm}>
      <form
        onSubmit={stockCategoriesForm.handleSubmit((data) => {
          const validCategories = data.categories.filter(
            (category) => category.name.trim() !== "",
          );
          if (validCategories.length === 0) {
            toast({
              title: "Please fill at least one category",
              variant: "destructive",
            });
            return;
          }
          createStockCategoriesMutation.mutate({ categories: validCategories });
        })}
        className="space-y-4"
      >
        {stockCategoryFields.map((field, index) => (
          <Card key={field.id} className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">Stock Category {index + 1}</h4>
              {stockCategoryFields.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeStockCategory(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={stockCategoriesForm.control}
                name={`categories.${index}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Food Items" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={stockCategoriesForm.control}
                name={`categories.${index}.description`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Category description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>
        ))}

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              appendStockCategory({
                name: "",
                description: "",
                branchId:
                  user?.role === "superadmin" ? null : user?.branchId || null,
              })
            }
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add 1 Row
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              for (let i = 0; i < 5; i++) {
                appendStockCategory({
                  name: "",
                  description: "",
                  branchId:
                    user?.role === "superadmin" ? null : user?.branchId || null,
                });
              }
            }}
            size="sm"
          >
            Add 5 Rows
          </Button>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createStockCategoriesMutation.isPending}
        >
          {createStockCategoriesMutation.isPending
            ? "Creating..."
            : "Create Stock Categories"}
        </Button>
      </form>
    </Form>
  );

  const renderMeasuringUnitsForm = () => (
    <Form {...measuringUnitsForm}>
      <form
        onSubmit={measuringUnitsForm.handleSubmit((data) => {
          const validUnits = data.units.filter(
            (unit) => unit.name.trim() !== "" && unit.symbol.trim() !== "",
          );
          if (validUnits.length === 0) {
            toast({
              title: "Please fill at least one unit",
              variant: "destructive",
            });
            return;
          }
          createMeasuringUnitsMutation.mutate({ units: validUnits });
        })}
        className="space-y-4"
      >
        {unitFields.map((field, index) => (
          <Card key={field.id} className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">Measuring Unit {index + 1}</h4>
              {unitFields.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeUnit(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField
                control={measuringUnitsForm.control}
                name={`units.${index}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Kilogram" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={measuringUnitsForm.control}
                name={`units.${index}.symbol`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Symbol</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., kg" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={measuringUnitsForm.control}
                name={`units.${index}.baseUnit`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Unit</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., gram" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={measuringUnitsForm.control}
                name={`units.${index}.conversionFactor`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conversion Factor</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>
        ))}

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              appendUnit({
                name: "",
                symbol: "",
                baseUnit: "",
                conversionFactor: "1",
              })
            }
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add 1 Row
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              for (let i = 0; i < 5; i++) {
                appendUnit({
                  name: "",
                  symbol: "",
                  baseUnit: "",
                  conversionFactor: "1",
                });
              }
            }}
            size="sm"
          >
            Add 5 Rows
          </Button>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createMeasuringUnitsMutation.isPending}
        >
          {createMeasuringUnitsMutation.isPending
            ? "Creating..."
            : "Create Measuring Units"}
        </Button>
      </form>
    </Form>
  );

  const renderSuppliersForm = () => (
    <Form {...suppliersForm}>
      <form
        onSubmit={suppliersForm.handleSubmit((data) => {
          const validSuppliers = data.suppliers.filter(
            (supplier) => supplier.name.trim() !== "",
          );
          if (validSuppliers.length === 0) {
            toast({
              title: "Please fill at least one supplier",
              variant: "destructive",
            });
            return;
          }
          createSuppliersMutation.mutate({ suppliers: validSuppliers });
        })}
        className="space-y-4"
      >
        {supplierFields.map((field, index) => (
          <Card key={field.id} className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">Supplier {index + 1}</h4>
              {supplierFields.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeSupplier(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={suppliersForm.control}
                name={`suppliers.${index}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., ABC Supplies" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={suppliersForm.control}
                name={`suppliers.${index}.email`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="supplier@example.com"
                        type="email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={suppliersForm.control}
                name={`suppliers.${index}.phone`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+1 234 567 8900" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={suppliersForm.control}
                name={`suppliers.${index}.contactPerson`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="John Doe" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>
        ))}

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              appendSupplier({
                name: "",
                email: "",
                phone: "",
                address: "",
                contactPerson: "",
                taxNumber: "",
                branchId:
                  user?.role === "superadmin" ? null : user?.branchId || null,
              })
            }
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add 1 Row
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              for (let i = 0; i < 5; i++) {
                appendSupplier({
                  name: "",
                  email: "",
                  phone: "",
                  address: "",
                  contactPerson: "",
                  taxNumber: "",
                  branchId:
                    user?.role === "superadmin" ? null : user?.branchId || null,
                });
              }
            }}
            size="sm"
          >
            Add 5 Rows
          </Button>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createSuppliersMutation.isPending}
        >
          {createSuppliersMutation.isPending
            ? "Creating..."
            : "Create Suppliers"}
        </Button>
      </form>
    </Form>
  );

  const renderStockItemsForm = () => (
    <Form {...stockItemsForm}>
      <form
        onSubmit={stockItemsForm.handleSubmit((data) => {
          const validItems = data.items.filter(
            (item) =>
              item.name.trim() !== "" &&
              item.categoryId > 0 &&
              item.measuringUnitId > 0,
          );
          if (validItems.length === 0) {
            toast({
              title:
                "Please fill at least one item with name, category, and unit",
              variant: "destructive",
            });
            return;
          }

          // Process the items to handle empty numeric fields
          const processedItems = validItems.map((item) => ({
            ...item,
            defaultPrice: item.defaultPrice || "0",
            currentStock: item.currentStock || "0",
            minimumStock: item.minimumStock || "0",
            maximumStock: item.maximumStock || undefined,
            reorderLevel: item.reorderLevel || undefined,
            reorderQuantity: item.reorderQuantity || undefined,
          }));

          createStockItemsMutation.mutate({ items: processedItems });
        })}
        className="space-y-4"
      >
        {stockItemFields.map((field, index) => (
          <Card key={field.id} className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">Stock Item {index + 1}</h4>
              {stockItemFields.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeStockItem(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={stockItemsForm.control}
                name={`items.${index}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Rice" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={stockItemsForm.control}
                name={`items.${index}.categoryId`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value?.toString()}
                        onValueChange={(value) =>
                          field.onChange(parseInt(value))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {stockCategories?.map((category: any) => (
                            <SelectItem
                              key={category.id}
                              value={category.id.toString()}
                            >
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={stockItemsForm.control}
                name={`items.${index}.measuringUnitId`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value?.toString()}
                        onValueChange={(value) =>
                          field.onChange(parseInt(value))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {measuringUnits?.map((unit: any) => (
                            <SelectItem
                              key={unit.id}
                              value={unit.id.toString()}
                            >
                              {unit.name} ({unit.symbol})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={stockItemsForm.control}
                name={`items.${index}.defaultPrice`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="0.00"
                        type="number"
                        step="0.01"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={stockItemsForm.control}
                name={`items.${index}.currentStock`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Stock</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="0"
                        type="number"
                        step="0.001"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={stockItemsForm.control}
                name={`items.${index}.minimumStock`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Stock</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="0"
                        type="number"
                        step="0.001"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>
        ))}

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              appendStockItem({
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
                branchId:
                  user?.role === "superadmin" ? null : user?.branchId || null,
              })
            }
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add 1 Row
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              for (let i = 0; i < 5; i++) {
                appendStockItem({
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
                  branchId:
                    user?.role === "superadmin" ? null : user?.branchId || null,
                });
              }
            }}
            size="sm"
          >
            Add 5 Rows
          </Button>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createStockItemsMutation.isPending}
        >
          {createStockItemsMutation.isPending
            ? "Creating..."
            : "Create Stock Items"}
        </Button>
      </form>
    </Form>
  );

  const renderRoomTypesForm = () => (
    <Form {...roomTypesForm}>
      <form
        onSubmit={roomTypesForm.handleSubmit((data) => {
          const validRoomTypes = data.roomTypes.filter(
            (roomType) =>
              roomType.name.trim() !== "" && roomType.basePrice.trim() !== "",
          );
          if (validRoomTypes.length === 0) {
            toast({
              title: "Please fill at least one room type with name and price",
              variant: "destructive",
            });
            return;
          }
          createRoomTypesMutation.mutate({ roomTypes: validRoomTypes });
        })}
        className="space-y-4"
      >
        {roomTypeFields.map((field, index) => (
          <Card key={field.id} className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">Room Type {index + 1}</h4>
              {roomTypeFields.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeRoomType(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={roomTypesForm.control}
                name={`roomTypes.${index}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room Type Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Standard Room" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={roomTypesForm.control}
                name={`roomTypes.${index}.basePrice`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Price per Night</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="2500.00"
                        type="number"
                        step="0.01"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={roomTypesForm.control}
                name={`roomTypes.${index}.maxOccupancy`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Occupancy</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                        placeholder="2"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {user?.role === "superadmin" && (
                <FormField
                  control={roomTypesForm.control}
                  name={`roomTypes.${index}.branchId`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value?.toString() || "unassigned"}
                          onValueChange={(value) =>
                            field.onChange(
                              value === "unassigned" ? null : parseInt(value),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select branch" />
                          </SelectTrigger>
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={roomTypesForm.control}
                name={`roomTypes.${index}.description`}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Room description and amenities"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>
        ))}

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              appendRoomType({
                name: "",
                description: "",
                basePrice: "",
                maxOccupancy: 1,
                branchId:
                  user?.role === "superadmin" ? null : user?.branchId || null,
              })
            }
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add 1 Row
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              for (let i = 0; i < 5; i++) {
                appendRoomType({
                  name: "",
                  description: "",
                  basePrice: "",
                  maxOccupancy: 1,
                  branchId:
                    user?.role === "superadmin" ? null : user?.branchId || null,
                });
              }
            }}
            size="sm"
          >
            Add 5 Rows
          </Button>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createRoomTypesMutation.isPending}
        >
          {createRoomTypesMutation.isPending
            ? "Creating..."
            : "Create Room Types"}
        </Button>
      </form>
    </Form>
  );

  const renderRoomsForm = () => (
    <Form {...roomsForm}>
      <form
        onSubmit={roomsForm.handleSubmit((data) => {
          const validRooms = data.rooms.filter(
            (room) =>
              room.number.trim() !== "" &&
              room.roomTypeId > 0 &&
              room.branchId > 0,
          );
          if (validRooms.length === 0) {
            toast({
              title:
                "Please fill at least one room with number, type, and branch",
              variant: "destructive",
            });
            return;
          }
          createRoomsMutation.mutate({ rooms: validRooms });
        })}
        className="space-y-4"
      >
        {roomFields.map((field, index) => (
          <Card key={field.id} className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">Room {index + 1}</h4>
              {roomFields.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeRoom(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div
              className={`grid grid-cols-1 gap-4 ${user?.role === "superadmin" ? "md:grid-cols-4" : "md:grid-cols-3"}`}
            >
              <FormField
                control={roomsForm.control}
                name={`rooms.${index}.number`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="101" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={roomsForm.control}
                name={`rooms.${index}.floor`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Floor</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value
                              ? parseInt(e.target.value)
                              : undefined,
                          )
                        }
                        placeholder="1"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={roomsForm.control}
                name={`rooms.${index}.roomTypeId`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room Type</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value?.toString()}
                        onValueChange={(value) =>
                          field.onChange(parseInt(value))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select room type" />
                        </SelectTrigger>
                        <SelectContent>
                          {roomTypes?.map((roomType) => (
                            <SelectItem
                              key={roomType.id}
                              value={roomType.id.toString()}
                            >
                              {roomType.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {user?.role === "superadmin" && (
                <FormField
                  control={roomsForm.control}
                  name={`rooms.${index}.branchId`}
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </Card>
        ))}

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              appendRoom({
                number: "",
                floor: undefined,
                roomTypeId: roomTypes?.[0]?.id || 0,
                branchId:
                  user?.role === "superadmin"
                    ? branches?.[0]?.id || 1
                    : user?.branchId || 1,
                status: "available",
              })
            }
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add 1 Room
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              for (let i = 0; i < 2; i++) {
                appendRoom({
                  number: "",
                  floor: undefined,
                  roomTypeId: roomTypes?.[0]?.id || 0,
                  branchId:
                    user?.role === "superadmin"
                      ? branches?.[0]?.id || 1
                      : user?.branchId || 1,
                  status: "available",
                });
              }
            }}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add 2 Rooms
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              for (let i = 0; i < 5; i++) {
                appendRoom({
                  number: "",
                  floor: undefined,
                  roomTypeId: roomTypes?.[0]?.id || 0,
                  branchId:
                    user?.role === "superadmin"
                      ? branches?.[0]?.id || 1
                      : user?.branchId || 1,
                  status: "available",
                });
              }
            }}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add 5 Rooms
          </Button>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createRoomsMutation.isPending}
        >
          {createRoomsMutation.isPending ? "Creating..." : "Create Rooms"}
        </Button>
      </form>
    </Form>
  );
  const renderContent = () => {
    switch (type) {
      case "tables":
        return renderTablesForm();
      case "categories":
        return renderCategoriesForm();
      case "dishes":
        return renderDishesForm();
      case "stock-categories":
        return renderStockCategoriesForm();
      case "measuring-units":
        return renderMeasuringUnitsForm();
      case "suppliers":
        return renderSuppliersForm();
      case "stock-items":
        return renderStockItemsForm();
      case "room-types":
        return renderRoomTypesForm();
      case "rooms":
        return renderRoomsForm();
      default:
        return null;
    }
  };

  if (isDirectForm) {
    return renderContent();
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          {getTitle()}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}