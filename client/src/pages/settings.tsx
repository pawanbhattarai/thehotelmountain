import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Building,
  Globe,
  Clock,
  FileText,
  Save,
  Hotel,
  Smartphone,
  Printer,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { NotificationManager } from "@/components/NotificationManager";

const printerConfigSchema = z.object({
  printerName: z.string().min(1, "Printer name is required"),
  printerType: z.enum(["kot", "bot", "billing"]),
  ipAddress: z.string().min(1, "IP address is required").regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Invalid IP address format"),
  port: z.number().min(1).max(65535).default(9100),
  isEnabled: z.boolean().default(true),
  autoDirectPrint: z.boolean().default(false),
  paperWidth: z.number().min(10).max(500).default(80),
  connectionTimeout: z.number().min(1000).max(60000).default(5000),
  retryAttempts: z.number().min(1).max(10).default(3),
  branchId: z.number().min(1).optional(),
});

const hotelSettingsSchema = z.object({
  branchId: z.number().optional(),
  hotelName: z.string().min(1, "Hotel name is required"),
  hotelChain: z.string().optional(),
  logo: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email address"),
  website: z.string().optional(),
  taxNumber: z.string().optional(),
  registrationNumber: z.string().optional(),
  checkInTime: z.string().default("15:00"),
  checkOutTime: z.string().default("11:00"),
  dayCalculationTime: z.string().default("00:00"),
  useCustomDayCalculation: z.boolean().default(false),
  openingTime: z.string().default("06:00"),
  closingTime: z.string().default("23:00"),
  currency: z.string().default("NPR"),
  timeZone: z.string().default("Asia/Kathmandu"),
  billingFooter: z.string().optional(),
  termsAndConditions: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  // Social media and company info
  facebookUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
  tiktokUrl: z.string().optional(),
  youtubeUrl: z.string().optional(),
  contactInfo: z.string().optional(),
  reviewsUrl: z.string().optional(),
  directPrintKotBot: z.boolean().default(false),
  showBSDate: z.boolean().default(false),
  // Printer settings
  printerPaperSize: z.string().default("80mm"),
  printerPaperWidth: z.string().optional(),
  printerPaperHeight: z.string().optional(),
  printerMargins: z.string().optional(),
  printerFontSize: z.string().optional(),
  printerLineHeight: z.string().optional(),
  printerFontFamily: z.string().optional(),
});

type HotelSettingsForm = z.infer<typeof hotelSettingsSchema>;

const currencies = [
  { value: "NPR", label: "NPR - Nepalese Rupee" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "CHF", label: "CHF - Swiss Franc" },
  { value: "CNY", label: "CNY - Chinese Yuan" },
  { value: "INR", label: "INR - Indian Rupee" },
];

const timeZones = [
  { value: "Asia/Kathmandu", label: "Asia/Kathmandu - Nepal Time" },
  { value: "UTC", label: "UTC - Coordinated Universal Time" },
  { value: "America/New_York", label: "EST - Eastern Time" },
  { value: "America/Chicago", label: "CST - Central Time" },
  { value: "America/Denver", label: "MST - Mountain Time" },
  { value: "America/Los_Angeles", label: "PST - Pacific Time" },
  { value: "Europe/London", label: "GMT - Greenwich Mean Time" },
  { value: "Europe/Paris", label: "CET - Central European Time" },
  { value: "Asia/Tokyo", label: "JST - Japan Standard Time" },
  { value: "Asia/Shanghai", label: "CST - China Standard Time" },
  { value: "Asia/Kolkata", label: "IST - India Standard Time" },
];

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/hotel-settings"],
  });

  const form = useForm<HotelSettingsForm>({
    resolver: zodResolver(hotelSettingsSchema),
    defaultValues: {
      hotelName: "",
      hotelChain: "",
      logo: "",
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      phone: "",
      email: "",
      website: "",
      taxNumber: "",
      registrationNumber: "",
      checkInTime: "15:00",
      checkOutTime: "11:00",
      dayCalculationTime: "00:00",
      useCustomDayCalculation: false,
      openingTime: "06:00",
      closingTime: "23:00",
      currency: "NPR",
      timeZone: "Asia/Kathmandu",
      billingFooter: "",
      termsAndConditions: "",
      cancellationPolicy: "",
      // Social media and company info
      facebookUrl: "",
      instagramUrl: "",
      tiktokUrl: "",
      youtubeUrl: "",
      contactInfo: "",
      reviewsUrl: "",
      directPrintKotBot: false,
      showBSDate: false,
      // Printer settings
      printerPaperSize: "80mm",
      printerPaperWidth: "",
      printerPaperHeight: "",
      printerMargins: "",
      printerFontSize: "",
      printerLineHeight: "",
      printerFontFamily: "",
    },
  });

  const { reset, setValue, watch } = form;

  // Reset form when settings data loads
  useEffect(() => {
    if (settings) {
      reset({
        branchId: (settings as any).branchId || undefined,
        hotelName: (settings as any).hotelName || "",
        hotelChain: (settings as any).hotelChain || "",
        logo: (settings as any).logo || "",
        address: (settings as any).address || "",
        city: (settings as any).city || "",
        state: (settings as any).state || "",
        country: (settings as any).country || "",
        postalCode: (settings as any).postalCode || "",
        phone: (settings as any).phone || "",
        email: (settings as any).email || "",
        website: (settings as any).website || "",
        taxNumber: (settings as any).taxNumber || "",
        registrationNumber: (settings as any).registrationNumber || "",
        checkInTime: (settings as any).checkInTime || "15:00",
        checkOutTime: (settings as any).checkOutTime || "11:00",
        dayCalculationTime: (settings as any).dayCalculationTime || "00:00",
        useCustomDayCalculation:
          (settings as any).useCustomDayCalculation || false,
        openingTime: (settings as any).openingTime || "06:00",
        closingTime: (settings as any).closingTime || "23:00",
        currency: (settings as any).currency || "NPR",
        timeZone: (settings as any).timeZone || "Asia/Kathmandu",
        billingFooter: (settings as any).billingFooter || "",
        termsAndConditions: (settings as any).termsAndConditions || "",
        cancellationPolicy: (settings as any).cancellationPolicy || "",
        facebookUrl: (settings as any).facebookUrl || "",
        instagramUrl: (settings as any).instagramUrl || "",
        tiktokUrl: (settings as any).tiktokUrl || "",
        youtubeUrl: (settings as any).youtubeUrl || "",
        contactInfo: (settings as any).contactInfo || "",
        reviewsUrl: (settings as any).reviewsUrl || "",
        directPrintKotBot: (settings as any).directPrintKotBot || false,
        showBSDate: (settings as any).showBSDate || false,
        // Printer settings
        printerPaperSize: (settings as any).printerPaperSize || "80mm",
        printerPaperWidth: (settings as any).printerPaperWidth || "",
        printerPaperHeight: (settings as any).printerPaperHeight || "",
        printerMargins: (settings as any).printerMargins || "",
        printerFontSize: (settings as any).printerFontSize || "",
        printerLineHeight: (settings as any).printerLineHeight || "",
        printerFontFamily: (settings as any).printerFontFamily || "",
      });
    }
  }, [settings, reset]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: HotelSettingsForm) => {
      const response = await fetch("/api/hotel-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save settings");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hotel-settings"] });
      toast({
        title: "Settings saved",
        description: "Hotel settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  // Printer Configuration state and queries
  const [editingPrinter, setEditingPrinter] = useState<any>(null);
  const [showPrinterForm, setShowPrinterForm] = useState(false);

  const { data: printerConfigs, isLoading: printersLoading } = useQuery({
    queryKey: ["/api/printer-configurations"],
  });

  const printerForm = useForm({
    resolver: zodResolver(printerConfigSchema),
    defaultValues: {
      printerName: "",
      printerType: "kot" as const,
      ipAddress: "",
      port: 9100,
      isEnabled: true,
      autoDirectPrint: false,
      paperWidth: 80,
      connectionTimeout: 5000,
      retryAttempts: 3,
    },
  });

  const createPrinterMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/printer-configurations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create printer configuration");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/printer-configurations"] });
      setShowPrinterForm(false);
      printerForm.reset();
      toast({
        title: "Success",
        description: "Printer configuration created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create printer configuration",
        variant: "destructive",
      });
    },
  });

  const updatePrinterMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/printer-configurations/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update printer configuration");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/printer-configurations"] });
      setEditingPrinter(null);
      setShowPrinterForm(false);
      printerForm.reset();
      toast({
        title: "Success", 
        description: "Printer configuration updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update printer configuration",
        variant: "destructive",
      });
    },
  });

  const deletePrinterMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/printer-configurations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete printer configuration");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/printer-configurations"] });
      toast({
        title: "Success",
        description: "Printer configuration deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete printer configuration",
        variant: "destructive",
      });
    },
  });

  const testPrinterMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/printer-configurations/${id}/test`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to test printer connection");
      }

      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/printer-configurations"] });
      toast({
        title: result.success ? "Connection Successful" : "Connection Failed",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test printer connection",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: HotelSettingsForm) => {
    saveSettingsMutation.mutate(data);
  };

  const handleSaveClick = async () => {
    const isValid = await form.trigger();
    if (isValid) {
      const formData = form.getValues();
      onSubmit(formData);
    }
  };

  const handlePrinterSubmit = (data: any) => {
    if (editingPrinter) {
      updatePrinterMutation.mutate({ id: editingPrinter.id, data });
    } else {
      createPrinterMutation.mutate(data);
    }
  };

  const handleEditPrinter = (printer: any) => {
    setEditingPrinter(printer);
    printerForm.reset({
      printerName: printer.printerName,
      printerType: printer.printerType.toLowerCase(),
      ipAddress: printer.ipAddress,
      port: printer.port,
      isEnabled: printer.isEnabled,
      autoDirectPrint: printer.autoDirectPrint,
      paperWidth: printer.paperWidth,
      connectionTimeout: printer.connectionTimeout,
      retryAttempts: printer.retryAttempts,
    });
    setShowPrinterForm(true);
  };

  const handleAddPrinter = () => {
    setEditingPrinter(null);
    printerForm.reset();
    setShowPrinterForm(true);
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6">
        <Header
          title="Hotel Settings"
          subtitle="Configure your hotel information and policies"
        />
        <div className="mt-6 animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar
        isMobileMenuOpen={isMobileSidebarOpen}
        setIsMobileMenuOpen={setIsMobileSidebarOpen}
      />

      <div className="main-content">
        <Header
          title="Hotel Settings"
          subtitle="Configure hotel information, policies, and operational settings"
          onMobileMenuToggle={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
          action={
            <Button
              onClick={handleSaveClick}
              disabled={saveSettingsMutation.isPending}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          }
        />

        <main className="p-4 lg:p-6 space-y-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                <span className="hidden sm:inline">General</span>
              </TabsTrigger>
              <TabsTrigger
                value="operational"
                className="flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Operations</span>
              </TabsTrigger>
              <TabsTrigger value="printers" className="flex items-center gap-2">
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">Printers</span>
              </TabsTrigger>
              <TabsTrigger value="billing" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Billing</span>
              </TabsTrigger>
              <TabsTrigger value="policies" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Policies</span>
              </TabsTrigger>
            </TabsList>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <TabsContent value="general" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Hotel className="h-5 w-5" />
                        Hotel Information
                      </CardTitle>
                      <CardDescription>
                        Basic information about your hotel property
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="hotelName">Hotel Name *</Label>
                          <Input
                            id="hotelName"
                            {...form.register("hotelName")}
                            placeholder="Grand Hotel & Resort"
                          />
                          {form.formState.errors.hotelName && (
                            <p className="text-sm text-red-600">
                              {form.formState.errors.hotelName.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="hotelChain">Hotel Chain</Label>
                          <Input
                            id="hotelChain"
                            {...form.register("hotelChain")}
                            placeholder="Luxury Hotels International"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="timeZone">Time Zone</Label>
                          <Select
                            value={watch("timeZone")}
                            onValueChange={(value) =>
                              setValue("timeZone", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Asia/Kathmandu">
                                Asia/Kathmandu (Nepal Time)
                              </SelectItem>
                              <SelectItem value="UTC">UTC</SelectItem>
                              <SelectItem value="America/New_York">
                                America/New_York (EST)
                              </SelectItem>
                              <SelectItem value="Europe/London">
                                Europe/London (GMT)
                              </SelectItem>
                              <SelectItem value="Asia/Tokyo">
                                Asia/Tokyo (JST)
                              </SelectItem>
                              <SelectItem value="Asia/Dubai">
                                Asia/Dubai (GST)
                              </SelectItem>
                              <SelectItem value="Asia/Kolkata">
                                Asia/Kolkata (IST)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="logo">Logo URL</Label>
                        <Input
                          id="logo"
                          {...form.register("logo")}
                          placeholder="https://example.com/logo.png"
                        />
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h4 className="font-medium">Address Information</h4>

                        <div className="space-y-2">
                          <Label htmlFor="address">Street Address *</Label>
                          <Textarea
                            id="address"
                            {...form.register("address")}
                            placeholder="123 Main Street, Suite 100"
                            rows={2}
                          />
                          {form.formState.errors.address && (
                            <p className="text-sm text-red-600">
                              {form.formState.errors.address.message}
                            </p>
                          )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                          <div className="space-y-2">
                            <Label htmlFor="city">City *</Label>
                            <Input
                              id="city"
                              {...form.register("city")}
                              placeholder="Kathmandu"
                            />
                            {form.formState.errors.city && (
                              <p className="text-sm text-red-600">
                                {form.formState.errors.city.message}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="state">State/Province *</Label>
                            <Input
                              id="state"
                              {...form.register("state")}
                              placeholder="Bagmati"
                            />
                            {form.formState.errors.state && (
                              <p className="text-sm text-red-600">
                                {form.formState.errors.state.message}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="country">Country *</Label>
                            <Input
                              id="country"
                              {...form.register("country")}
                              placeholder="Nepal"
                            />
                            {form.formState.errors.country && (
                              <p className="text-sm text-red-600">
                                {form.formState.errors.country.message}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="postalCode">Postal Code *</Label>
                            <Input
                              id="postalCode"
                              {...form.register("postalCode")}
                              placeholder="44600"
                            />
                            {form.formState.errors.postalCode && (
                              <p className="text-sm text-red-600">
                                {form.formState.errors.postalCode.message}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h4 className="font-medium">Contact Information</h4>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number *</Label>
                            <Input
                              id="phone"
                              {...form.register("phone")}
                              placeholder="+977-1-4123456"
                            />
                            {form.formState.errors.phone && (
                              <p className="text-sm text-red-600">
                                {form.formState.errors.phone.message}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="email">Email Address *</Label>
                            <Input
                              id="email"
                              type="email"
                              {...form.register("email")}
                              placeholder="info@grandhotel.com"
                            />
                            {form.formState.errors.email && (
                              <p className="text-sm text-red-600">
                                {form.formState.errors.email.message}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="website">Website</Label>
                          <Input
                            id="website"
                            {...form.register("website")}
                            placeholder="https://www.grandhotel.com"
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* Social Media & Company Info Section */}
                      <div className="space-y-6">
                        <h4 className="font-medium">
                          Social Media & Company Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="facebookUrl">Facebook URL</Label>
                            <Input
                              id="facebookUrl"
                              placeholder="https://facebook.com/yourpage"
                              {...form.register("facebookUrl")}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="instagramUrl">Instagram URL</Label>
                            <Input
                              id="instagramUrl"
                              placeholder="https://instagram.com/yourpage"
                              {...form.register("instagramUrl")}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="tiktokUrl">TikTok URL</Label>
                            <Input
                              id="tiktokUrl"
                              placeholder="https://tiktok.com/@yourpage"
                              {...form.register("tiktokUrl")}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="youtubeUrl">YouTube URL</Label>
                            <Input
                              id="youtubeUrl"
                              placeholder="https://youtube.com/c/yourpage"
                              {...form.register("youtubeUrl")}
                            />
                          </div>

                          <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="contactInfo">
                              Company Description
                            </Label>
                            <Textarea
                              id="contactInfo"
                              placeholder="Brief description about your restaurant/hotel"
                              {...form.register("contactInfo")}
                              rows={3}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="reviewsUrl">Reviews URL</Label>
                            <Input
                              id="reviewsUrl"
                              placeholder="https://google.com/reviews or TripAdvisor link"
                              {...form.register("reviewsUrl")}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="operational" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Operational Settings
                      </CardTitle>
                      <CardDescription>
                        Configure check-in/out times, currency, and timezone
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="checkInTime">Check-in Time</Label>
                          <Input
                            id="checkInTime"
                            type="time"
                            {...form.register("checkInTime")}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="checkOutTime">Check-out Time</Label>
                          <Input
                            id="checkOutTime"
                            type="time"
                            {...form.register("checkOutTime")}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="openingTime">
                            Hotel Opening Time
                          </Label>
                          <Input
                            id="openingTime"
                            type="time"
                            {...form.register("openingTime")}
                          />
                          <p className="text-sm text-muted-foreground">
                            Time when guest ordering becomes available
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="closingTime">
                            Hotel Closing Time
                          </Label>
                          <Input
                            id="closingTime"
                            type="time"
                            {...form.register("closingTime")}
                          />
                          <p className="text-sm text-muted-foreground">
                            Time when guest ordering stops
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="useCustomDayCalculation"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                  Custom Day Calculation
                                </FormLabel>
                                <FormDescription>
                                  Enable custom day calculation time instead of
                                  standard 24-hour periods
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        {form.watch("useCustomDayCalculation") && (
                          <div className="space-y-2">
                            <Label htmlFor="dayCalculationTime">
                              Day Calculation Time
                            </Label>
                            <Input
                              id="dayCalculationTime"
                              type="time"
                              {...form.register("dayCalculationTime")}
                            />
                            <p className="text-sm text-muted-foreground">
                              Time when a new day starts for billing purposes.
                              This determines how nights are calculated.
                            </p>
                            <div className="space-y-2">
                              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                                <strong>Example:</strong> If set to 12:00 PM:
                                <br />
                                • Check-in: July 14, 2:00 PM
                                <br />
                                • Check-out: July 16, 1:00 PM
                                <br />
                                • Result: 3 nights (crosses 2 day boundaries at
                                12:00 PM)
                                <br />
                                <br />
                                With default 00:00 (midnight), the same stay
                                would be 2 nights.
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="currency">Currency</Label>
                          <Select
                            value={watch("currency")}
                            onValueChange={(value) =>
                              setValue("currency", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                            <SelectContent>
                              {currencies.map((currency) => (
                                <SelectItem
                                  key={currency.value}
                                  value={currency.value}
                                >
                                  {currency.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="timeZone">Time Zone</Label>
                          <Select
                            value={watch("timeZone")}
                            onValueChange={(value) =>
                              setValue("timeZone", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent>
                              {timeZones.map((tz) => (
                                <SelectItem key={tz.value} value={tz.value}>
                                  {tz.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h4 className="font-medium">Legal Information</h4>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="taxNumber">Tax Number</Label>
                            <Input
                              id="taxNumber"
                              {...form.register("taxNumber")}
                              placeholder="TAX123456789"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="registrationNumber">
                              Registration Number
                            </Label>
                            <Input
                              id="registrationNumber"
                              {...form.register("registrationNumber")}
                              placeholder="REG987654321"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="printers" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Printer className="h-5 w-5" />
                        KOT/BOT Printer Configuration
                      </CardTitle>
                      <CardDescription>
                        Configure network thermal printers for Kitchen Order Tickets (KOT) and Beverage Order Tickets (BOT)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Printer List */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Configured Printers</h4>
                          <Button
                            onClick={handleAddPrinter}
                            className="flex items-center gap-2"
                          >
                            <Printer className="h-4 w-4" />
                            Add Printer
                          </Button>
                        </div>

                        {printersLoading ? (
                          <div className="space-y-2">
                            <div className="h-16 bg-gray-200 rounded animate-pulse"></div>
                            <div className="h-16 bg-gray-200 rounded animate-pulse"></div>
                          </div>
                        ) : printerConfigs && Array.isArray(printerConfigs) && printerConfigs.length > 0 ? (
                          <div className="space-y-4">
                            {(printerConfigs as any[]).map((printer: any) => (
                              <div
                                key={printer.id}
                                className="border rounded-lg p-4 space-y-3"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <h5 className="font-medium">{printer.printerName}</h5>
                                      <Badge
                                        variant={
                                          printer.printerType === 'kot' ? 'default' : 
                                          printer.printerType === 'bot' ? 'secondary' : 'outline'
                                        }
                                      >
                                        {printer.printerType.toUpperCase()}
                                      </Badge>
                                      <Badge
                                        variant={
                                          printer.connectionStatus === 'connected' ? 'default' :
                                          printer.connectionStatus === 'disconnected' ? 'secondary' : 'destructive'
                                        }
                                      >
                                        {printer.connectionStatus || 'unknown'}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {printer.ipAddress}:{printer.port} • {printer.paperWidth}mm paper
                                    </p>
                                    {printer.errorMessage && (
                                      <p className="text-xs text-red-600">
                                        Error: {printer.errorMessage}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => testPrinterMutation.mutate(printer.id)}
                                      disabled={testPrinterMutation.isPending}
                                    >
                                      {testPrinterMutation.isPending ? "Testing..." : "Test"}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditPrinter(printer)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => deletePrinterMutation.mutate(printer.id)}
                                      disabled={deletePrinterMutation.isPending}
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Enabled:</span>{" "}
                                    {printer.isEnabled ? "Yes" : "No"}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Auto Print:</span>{" "}
                                    {printer.autoDirectPrint ? "Yes" : "No"}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Timeout:</span>{" "}
                                    {printer.connectionTimeout}ms
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Last Test:</span>{" "}
                                    {printer.lastTestPrint ? new Date(printer.lastTestPrint).toLocaleString() : "Never"}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Printer className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No printers configured yet</p>
                            <p className="text-sm">Add a KOT or BOT printer to get started</p>
                          </div>
                        )}
                      </div>

                      {/* Printer Form Modal */}
                      {showPrinterForm && (
                        <div className="border rounded-lg p-6 bg-gray-50">
                          <h4 className="font-medium mb-4">
                            {editingPrinter ? "Edit Printer Configuration" : "Add New Printer"}
                          </h4>
                          <Form {...printerForm}>
                            <form onSubmit={printerForm.handleSubmit(handlePrinterSubmit)} className="space-y-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                  control={printerForm.control}
                                  name="printerName"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Printer Name</FormLabel>
                                      <FormControl>
                                        <Input placeholder="Kitchen Printer 1" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={printerForm.control}
                                  name="printerType"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Printer Type</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select printer type" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="kot">KOT (Kitchen Order Ticket)</SelectItem>
                                          <SelectItem value="bot">BOT (Beverage Order Ticket)</SelectItem>
                                          <SelectItem value="billing">Billing Printer</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                  control={printerForm.control}
                                  name="ipAddress"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>IP Address</FormLabel>
                                      <FormControl>
                                        <Input placeholder="192.168.1.100" {...field} />
                                      </FormControl>
                                      <FormDescription>
                                        Network IP address of the thermal printer
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={printerForm.control}
                                  name="port"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Port</FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="number"
                                          placeholder="9100" 
                                          {...field}
                                          onChange={(e) => field.onChange(Number(e.target.value))}
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        TCP port (usually 9100 for thermal printers)
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="grid gap-4 md:grid-cols-3">
                                <FormField
                                  control={printerForm.control}
                                  name="paperWidth"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Paper Width (mm)</FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="number"
                                          placeholder="80" 
                                          {...field}
                                          onChange={(e) => field.onChange(Number(e.target.value))}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={printerForm.control}
                                  name="connectionTimeout"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Timeout (ms)</FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="number"
                                          placeholder="5000" 
                                          {...field}
                                          onChange={(e) => field.onChange(Number(e.target.value))}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={printerForm.control}
                                  name="retryAttempts"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Retry Attempts</FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="number"
                                          placeholder="3" 
                                          {...field}
                                          onChange={(e) => field.onChange(Number(e.target.value))}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="space-y-4">
                                <FormField
                                  control={printerForm.control}
                                  name="isEnabled"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                      <div className="space-y-0.5">
                                        <FormLabel className="text-base">Enable Printer</FormLabel>
                                        <FormDescription>
                                          Allow this printer to receive print jobs
                                        </FormDescription>
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={printerForm.control}
                                  name="autoDirectPrint"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                      <div className="space-y-0.5">
                                        <FormLabel className="text-base">Auto Direct Print</FormLabel>
                                        <FormDescription>
                                          Automatically print when KOT/BOT is generated
                                        </FormDescription>
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="flex justify-end gap-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setShowPrinterForm(false);
                                    setEditingPrinter(null);
                                    printerForm.reset();
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="submit"
                                  disabled={createPrinterMutation.isPending || updatePrinterMutation.isPending}
                                >
                                  {createPrinterMutation.isPending || updatePrinterMutation.isPending
                                    ? "Saving..."
                                    : editingPrinter
                                    ? "Update Printer"
                                    : "Add Printer"}
                                </Button>
                              </div>
                            </form>
                          </Form>
                        </div>
                      )}

                      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                        <h5 className="font-medium text-blue-900 mb-2">Setup Instructions:</h5>
                        <div className="space-y-1 text-sm text-blue-800">
                          <p>• Ensure your thermal printer is connected to the network</p>
                          <p>• Configure the printer IP address to be static</p>
                          <p>• Use port 9100 for most thermal printers</p>
                          <p>• Test the connection before enabling auto-print</p>
                          <p>• KOT printers should be placed in the kitchen area</p>
                          <p>• BOT printers should be placed in the bar/beverage area</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="billing" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Billing Configuration
                      </CardTitle>
                      <CardDescription>
                        Configure billing footer and invoice information
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="billingFooter">Billing Footer</Label>
                        <Textarea
                          id="billingFooter"
                          {...form.register("billingFooter")}
                          placeholder="Thank you for choosing our hotel. For questions about your invoice, please contact us at billing@grandhotel.com or call +977-1-4123456."
                          rows={4}
                        />
                        <p className="text-sm text-muted-foreground">
                          This text will appear at the bottom of all invoices
                          and receipts
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Printer className="h-5 w-5" />
                        Printer Configuration
                      </CardTitle>
                      <CardDescription>
                        Configure printer settings for dynamic paper sizes and
                        receipt printing
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between space-y-2 mb-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="directPrintKotBot">
                            Direct Print KOT/BOT
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically print KOT and BOT tickets when orders
                            are created
                          </p>
                        </div>
                        <Switch
                          id="directPrintKotBot"
                          checked={watch("directPrintKotBot") || false}
                          onCheckedChange={(checked) =>
                            setValue("directPrintKotBot", checked)
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between space-y-2 mb-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="showBSDate">
                            Show BS Date in Prints
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Display Bikram Sambat (BS) date alongside AD date in
                            bills and tickets
                          </p>
                        </div>
                        <Switch
                          id="showBSDate"
                          checked={watch("showBSDate") || false}
                          onCheckedChange={(checked) =>
                            setValue("showBSDate", checked)
                          }
                        />
                      </div>
                      <Separator />
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="printerPaperSize">Paper Size</Label>
                          <Select
                            value={watch("printerPaperSize") as string}
                            onValueChange={(value) =>
                              setValue("printerPaperSize", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select paper size" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="80mm">
                                80mm (Thermal Receipt)
                              </SelectItem>
                              <SelectItem value="58mm">
                                58mm (Small Thermal)
                              </SelectItem>
                              <SelectItem value="A4">A4 (210x297mm)</SelectItem>
                              <SelectItem value="A5">A5 (148x210mm)</SelectItem>
                              <SelectItem value="custom">
                                Custom Size
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="printerPaperWidth">Paper Width</Label>
                          <Input
                            id="printerPaperWidth"
                            {...form.register("printerPaperWidth")}
                            placeholder="80mm"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="printerPaperHeight">
                            Paper Height
                          </Label><Input
                            id="printerPaperHeight"
                            {...form.register("printerPaperHeight")}
                            placeholder="auto or 297mm"
                          />
                          <p className="text-sm text-muted-foreground">
                            Use 'auto' for continuous paper (thermal printers)
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="printerMargins">Margins</Label>
                          <Input
                            id="printerMargins"
                            {...form.register("printerMargins")}
                            placeholder="2mm"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="printerFontSize">Font Size</Label>
                          <Input
                            id="printerFontSize"
                            {...form.register("printerFontSize")}
                            placeholder="10px"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="printerLineHeight">Line Height</Label>
                          <Input
                            id="printerLineHeight"
                            {...form.register("printerLineHeight")}
                            placeholder="1.2"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="printerFontFamily">Font Family</Label>
                        <Input
                          id="printerFontFamily"
                          {...form.register("printerFontFamily")}
                          placeholder="Arial, sans-serif"
                        />
                      </div>

                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <h5 className="font-medium text-blue-900 mb-2">
                          Common Printer Settings:
                        </h5>
                        <div className="space-y-1 text-sm text-blue-800">
                          <p>
                            <strong>80mm Thermal:</strong> Width: 80mm, Height:
                            auto, Margins: 2mm, Font: 10px
                          </p>
                          <p>
                            <strong>58mm Thermal:</strong> Width: 58mm, Height:
                            auto, Margins: 1mm, Font: 8px
                          </p>
                          <p>
                            <strong>A4 Standard:</strong> Width: 210mm, Height:
                            297mm, Margins: 10mm, Font: 12px
                          </p>
                        </div>
                      </div>

                      <Separator className="my-6" />

                      {/* Network Printer Configuration Section */}
                      <div className="space-y-4">
                        <h4 className="font-medium">Network Printer Configuration</h4>
                        <p className="text-sm text-muted-foreground">
                          Configure KOT (Kitchen Order Ticket) and BOT (Beverage Order Ticket) network thermal printers
                        </p>

                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            Network printer configuration has been moved to the dedicated "Printers" tab above for better organization.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="policies" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Hotel Policies
                      </CardTitle>
                      <CardDescription>
                        Define terms and conditions and cancellation policies
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="termsAndConditions">
                          Terms and Conditions
                        </Label>
                        <Textarea
                          id="termsAndConditions"
                          {...form.register("termsAndConditions")}
                          placeholder="Enter your hotel's terms and conditions..."
                          rows={6}
                        />
                        <p className="text-sm text-muted-foreground">
                          These terms will be displayed during booking and on
                          invoices
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cancellationPolicy">
                          Cancellation Policy
                        </Label>
                        <Textarea
                          id="cancellationPolicy"
                          {...form.register("cancellationPolicy")}
                          placeholder="Enter your cancellation policy..."
                          rows={6}
                        />
                        <p className="text-sm text-muted-foreground">
                          Specify your cancellation terms and any applicable
                          fees
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </form>
            </Form>
          </Tabs>
        </main>
      </div>
    </div>
  );
}

// Printer Configuration Component
function PrinterConfigurationSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [testingId, setTestingId] = useState<number | null>(null);

  // Fetch printer configurations
  const { data: configurations = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/printer-configurations"],
    staleTime: 60000,
  });

  // Create/update printer configuration
  const savePrinterConfig = useMutation({
    mutationFn: async (data: any) => {
      const url = data.id 
        ? `/api/printer-configurations/${data.id}` 
        : "/api/printer-configurations";
      const method = data.id ? "PUT" : "POST";
      
      // Ensure branchId is set if not provided (default to 1 for the demo)
      const configData = {
        ...data,
        branchId: data.branchId || 1
      };
      
      console.log("Sending printer config to API:", { url, method, data: configData });
      
      const response = await apiRequest(method, url, configData);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save configuration' }));
        throw new Error(errorData.message || 'Failed to save configuration');
      }
      
      const result = await response.json();
      console.log("API response:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("Printer configuration saved successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/printer-configurations"] });
      setEditingConfig(null);
      toast({
        title: "Success",
        description: "Printer configuration saved successfully",
      });
    },
    onError: (error: any) => {
      console.error("Failed to save printer configuration:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save printer configuration",
        variant: "destructive",
      });
    },
  });

  // Test printer connection
  const testPrinterConnection = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/printer-configurations/${id}/test`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Test connection failed' }));
        throw new Error(errorData.message || 'Test connection failed');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/printer-configurations"] });
      toast({
        title: data.success ? "Connection Successful" : "Connection Failed",
        description: data.success 
          ? "Printer is connected and ready" 
          : data.error || "Unable to connect to printer",
        variant: data.success ? "default" : "destructive",
      });
      setTestingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test printer connection",
        variant: "destructive",
      });
      setTestingId(null);
    },
  });

  // Delete printer configuration
  const deletePrinterConfig = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/printer-configurations/${id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete configuration' }));
        throw new Error(errorData.message || 'Failed to delete configuration');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/printer-configurations"] });
      toast({
        title: "Success",
        description: "Printer configuration deleted successfully",
      });
    },
  });

  const handleSaveConfig = (data: any) => {
    savePrinterConfig.mutate(data);
  };

  const handleTestConnection = (id: number) => {
    setTestingId(id);
    testPrinterConnection.mutate(id);
  };

  const printerTypes = [
    { value: "kot", label: "KOT (Kitchen Order Ticket)" },
    { value: "bot", label: "BOT (Beverage Order Ticket)" },
    { value: "billing", label: "Billing Printer" },
  ];

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading printer configurations...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Existing Configurations */}
      {configurations.map((config: any) => (
        <Card key={config.id} className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4" />
                <CardTitle className="text-base">
                  {config.printerType} Printer
                </CardTitle>
                <Badge variant={config.connectionStatus === "connected" ? "default" : "destructive"}>
                  {config.connectionStatus || "unknown"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTestConnection(config.id)}
                  disabled={testingId === config.id}
                >
                  {testingId === config.id ? "Testing..." : "Test"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingConfig(config)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deletePrinterConfig.mutate(config.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </CardHeader>
          
<CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Name:</span> {config.printerName}
              </div>
              <div>
                <span className="font-medium">IP Address:</span> {config.ipAddress}
              </div>
              <div>
                <span className="font-medium">Port:</span> {config.port}
              </div>
              <div>
                <span className="font-medium">Paper Width:</span> {config.paperWidth}mm
              </div>
              <div>
                <span className="font-medium">Status:</span>{" "}
                {config.isEnabled ? "Enabled" : "Disabled"}
              </div>
              <div>
                <span className="font-medium">Auto Print:</span>{" "}
                {config.autoDirectPrint ? "Yes" : "No"}
              </div>
            </div>
            {config.errorMessage && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                <span className="font-medium">Error:</span> {config.errorMessage}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Add New Configuration Form */}
      {editingConfig === null && configurations.length < 2 && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setEditingConfig({})}
            >
              <Printer className="h-4 w-4 mr-2" />
              Add Printer Configuration
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Configuration Form */}
      {editingConfig !== null && (
        <PrinterConfigForm
          config={editingConfig}
          onSave={handleSaveConfig}
          onCancel={() => setEditingConfig(null)}
          isSaving={savePrinterConfig.isPending}
          printerTypes={printerTypes}
          existingTypes={configurations.map((c: any) => c.printerType)}
        />
      )}
    </div>
  );
}

// Printer Configuration Form Component
function PrinterConfigForm({
  config,
  onSave,
  onCancel,
  isSaving,
  printerTypes,
  existingTypes,
}: {
  config: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  isSaving: boolean;
  printerTypes: Array<{ value: string; label: string }>;
  existingTypes: string[];
}) {
  const [formData, setFormData] = useState({
    printerType: config.printerType || "",
    printerName: config.printerName || "",
    ipAddress: config.ipAddress || "",
    port: config.port || 9100,
    paperWidth: config.paperWidth || 80,
    connectionTimeout: config.connectionTimeout || 5000,
    retryAttempts: config.retryAttempts || 3,
    characterEncoding: config.characterEncoding || "UTF-8",
    isEnabled: config.isEnabled !== undefined ? config.isEnabled : true,
    autoDirectPrint: config.autoDirectPrint || false,
  });

  const availableTypes = printerTypes.filter(
    (type) => type.value === config.printerType || !existingTypes.includes(type.value)
  );

  const handleSubmit = () => {
    
    // Validate required fields
    if (!formData.printerType || !formData.printerName || !formData.ipAddress) {
      console.error("Missing required fields:", {
        printerType: formData.printerType,
        printerName: formData.printerName,
        ipAddress: formData.ipAddress
      });
      
      // Show error message to user
      alert("Please fill in all required fields: Printer Type, Printer Name, and IP Address");
      return;
    }
    
    // Include the config ID if editing
    const submitData = {
      ...formData,
      ...(config.id && { id: config.id })
    };
    
    console.log("Submitting printer config:", submitData);
    onSave(submitData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {config.id ? "Edit" : "Add"} Printer Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          
<div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="printerType">Printer Type</Label>
                  <Select
                    value={formData.printerType || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, printerType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select printer type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="printerName">Printer Name</Label>
                  <Input
                    id="printerName"
                    type="text"
                    value={formData.printerName || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, printerName: e.target.value })
                    }
                    placeholder="Kitchen Printer 1"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ipAddress">IP Address</Label>
                  <Input
                    id="ipAddress"
                    type="text"
                    value={formData.ipAddress || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, ipAddress: e.target.value })
                    }
                    placeholder="192.168.1.100"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port || 9100}
                    onChange={(e) =>
                      setFormData({ ...formData, port: parseInt(e.target.value) || 9100 })
                    }
                    placeholder="9100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paperWidth">Paper Width (mm)</Label>
                  <Input
                    id="paperWidth"
                    type="number"
                    value={formData.paperWidth || 80}
                    onChange={(e) =>
                      setFormData({ ...formData, paperWidth: parseInt(e.target.value) || 80 })
                    }
                    placeholder="80"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="connectionTimeout">Connection Timeout (ms)</Label>
                  <Input
                    id="connectionTimeout"
                    type="number"
                    value={formData.connectionTimeout || 5000}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        connectionTimeout: parseInt(e.target.value) || 5000,
                      })
                    }
                    placeholder="5000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retryAttempts">Retry Attempts</Label>
                  <Input
                    id="retryAttempts"
                    type="number"
                    value={formData.retryAttempts || 3}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        retryAttempts: parseInt(e.target.value) || 3,
                      })
                    }
                    placeholder="3"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="characterEncoding">Character Encoding</Label>
                  <Select
                    value={formData.characterEncoding || "UTF-8"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, characterEncoding: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTF-8">UTF-8</SelectItem>
                      <SelectItem value="ASCII">ASCII</SelectItem>
                      <SelectItem value="ISO-8859-1">ISO-8859-1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isEnabled"
                    checked={formData.isEnabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isEnabled: checked })
                    }
                  />
                  <Label htmlFor="isEnabled">Enable Printer</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="autoDirectPrint"
                    checked={formData.autoDirectPrint}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, autoDirectPrint: checked })
                    }
                  />
                  <Label htmlFor="autoDirectPrint">Auto Direct Print</Label>
                </div>
              </div>
          <div className="bg-blue-50 p-3 rounded-lg text-sm">
            <p className="font-medium text-blue-900 mb-1">Network Printer Setup:</p>
            <ul className="text-blue-800 space-y-1 text-xs">
              <li>• Ensure printer is connected to the same network</li>
              <li>• Standard thermal printer port is 9100</li>
              <li>• Test connection after configuration</li>
              <li>• Enable direct print for automatic KOT/BOT printing</li>
            </ul>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}