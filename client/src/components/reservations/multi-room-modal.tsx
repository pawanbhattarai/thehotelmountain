import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Search, X, FileText } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { formatCurrency } from "@/lib/currency";
import { calculateNightsWithDayCalculation } from "@shared/billing-utils";

interface RoomData {
  roomTypeId: string;
  adults: number;
  children: number;
  checkInDate: string;
  checkOutDate: string;
  specialRequests: string;
  ratePerNight: number;
  totalAmount: number;
}

interface MultiRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  editData?: any;
  isEdit?: boolean;
}

export default function MultiRoomModal({
  isOpen,
  onClose,
  editData,
  isEdit = false,
}: MultiRoomModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [guestData, setGuestData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    idType: "passport",
    idNumber: "",
    address: "",
    nationality: "",
  });

  const [existingGuest, setExistingGuest] = useState(null);
  const [isSearchingGuest, setIsSearchingGuest] = useState(false);
  const [selectedIdFile, setSelectedIdFile] = useState<File | null>(null);
  const [isUploadingId, setIsUploadingId] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  // Reset key to force re-render when switching between new/edit modes
  const [formKey, setFormKey] = useState(0);

  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [rooms, setRooms] = useState<RoomData[]>([]);

  const [isGuestSearchOpen, setIsGuestSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string>("");
  const [existingFileName, setExistingFileName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [discountData, setDiscountData] = useState({
    discountType: "",
    discountValue: "",
    discountReason: "",
  });

  const [showDiscount, setShowDiscount] = useState(false);

  const { data: roomTypes } = useQuery({
    queryKey: ["/api/room-types"],
    enabled: isOpen && !!user,
  });

  const { data: branches } = useQuery({
    queryKey: ["/api/branches"],
    enabled: isOpen && !!user && user?.role === "superadmin",
  });

  const { data: taxesAndCharges } = useQuery({
    queryKey: ["/api/taxes-and-charges"],
    enabled: isOpen && !!user,
  });

  const { data: hotelSettings } = useQuery({
    queryKey: ["/api/hotel-settings"],
    enabled: isOpen && !!user,
  });

  const getCurrentDateTime = () => {
    const now = new Date();

    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    // Use local browser timezone for datetime-local inputs
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hour}:${minute}`;
  };

  const getDefaultCheckOut = () => {
    const now = new Date();
    now.setDate(now.getDate() + 1); // Default to next day

    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    // Use local browser timezone for datetime-local inputs
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hour}:${minute}`;
  };

  // Initialize rooms when hotel settings are loaded
  // Removed this useEffect as it conflicts with edit initialization
  // It's been moved to the main initialization effect

  // Set default branch ID for superadmin users
  useEffect(() => {
    if (
      user?.role === "superadmin" &&
      branches &&
      branches.length > 0 &&
      !selectedBranchId
    ) {
      setSelectedBranchId(branches[0].id.toString());
    }
  }, [branches, user?.role, selectedBranchId]);

  const {
    data: availableRooms,
    error: roomsError,
    isLoading: roomsLoading,
  } = useQuery({
    queryKey: [
      "/api/rooms",
      selectedBranchId || user?.branchId,
      isEdit ? "all" : "available",
    ],
    queryFn: async () => {
      const branchId =
        user?.role === "superadmin" ? selectedBranchId : user?.branchId;
      if (!branchId) {
        return [];
      }

      try {
        // In edit mode, fetch all rooms for the branch, not just available ones
        const statusFilter = isEdit ? "" : "&status=available";
        const response = await apiRequest(
          "GET",
          `/api/rooms?branchId=${branchId}${statusFilter}`,
        );
        if (!response.ok) {
          console.error("Room fetch failed with status:", response.status);
          throw new Error(`Failed to fetch rooms: ${response.status}`);
        }
        const rooms = await response.json();
        return rooms;
      } catch (error) {
        console.error("Error fetching rooms:", error);
        throw error;
      }
    },
    enabled: isOpen && !!user && !!(selectedBranchId || user?.branchId),
  });

  const createReservationMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/reservations", data);
    },
    onSuccess: async (response) => {
      // Upload ID document if file is selected
      if (selectedIdFile && response?.guestId) {
        try {
          setIsUploadingId(true);
          const formData = new FormData();
          formData.append("idDocument", selectedIdFile);

          await fetch(`/api/guests/${response.guestId}/upload-id`, {
            method: "POST",
            body: formData,
          });

          toast({
            title: "Success",
            description:
              "Reservation created and ID document uploaded successfully!",
          });
        } catch (error) {
          console.error("File upload failed:", error);
          toast({
            title: "Warning",
            description:
              "Reservation created but ID document upload failed. You can upload it later.",
            variant: "destructive",
          });
        } finally {
          setIsUploadingId(false);
        }
      } else {
        toast({
          title: "Success",
          description: "Reservation created successfully!",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      onClose();
      resetForm();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to create reservation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const searchGuestByPhone = async (phone: string) => {
    if (!phone || phone.length < 5) {
      setExistingGuest(null);
      return;
    }

    setIsSearchingGuest(true);
    try {
      const response = await apiRequest(
        "GET",
        `/api/guests?phone=${encodeURIComponent(phone)}`,
      );

      if (response.ok) {
        const guest = await response.json();

        if (guest) {
          setExistingGuest(guest);
          // Auto-fill guest data from existing guest
          setGuestData({
            firstName: guest.firstName || "",
            lastName: guest.lastName || "",
            email: guest.email || "",
            phone: guest.phone || "",
            idType: guest.idType || "passport",
            idNumber: guest.idNumber || "",
            address: guest.address || "",
            nationality: guest.nationality || "",
          });

          // Set existing file info if guest has ID document
          if (guest.idDocumentPath) {
            setExistingFileUrl(`/api/guests/${guest.id}/id-document`);
            setExistingFileName(guest.idDocumentOriginalName || "ID Document");
          } else {
            setExistingFileUrl("");
            setExistingFileName("");
          }
          const creditBalance = parseFloat(guest.creditBalance || "0");
          const creditText =
            creditBalance > 0
              ? ` || Credit Balance: Rs.${creditBalance.toFixed(2)}`
              : "";
        } else {
          setExistingGuest(null);
          // Clear existing file info when no guest found
          setExistingFileUrl("");
          setExistingFileName("");
        }
      } else {
        setExistingGuest(null);
        setExistingFileUrl("");
        setExistingFileName("");
      }
    } catch (error) {
      console.error("Error searching guest:", error);
      setExistingGuest(null);
      setExistingFileUrl("");
      setExistingFileName("");
    } finally {
      setIsSearchingGuest(false);
    }
  };

  const resetForm = () => {
    setGuestData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      idType: "passport",
      idNumber: "",
      address: "",
      nationality: "",
    });
    setExistingGuest(null);
    setSelectedBranchId("");
    setSelectedIdFile(null);
    setExistingFileUrl("");
    setExistingFileName("");
    setIsUploadingId(false);
    setUploadSuccess(false);
    setDiscountData({
      discountType: "",
      discountValue: "",
      discountReason: "",
    });
    setShowDiscount(false);
    if (hotelSettings) {
      setRooms([
        {
          roomTypeId: "",
          adults: 1,
          children: 0,
          checkInDate: getCurrentDateTime(),
          checkOutDate: getDefaultCheckOut(),
          ratePerNight: 0,
          totalAmount: 0,
        },
      ]);
    }
  };

  const addRoom = () => {
    setRooms([
      ...rooms,
      {
        roomTypeId: "",
        adults: 1,
        children: 0,
        checkInDate: getCurrentDateTime(),
        checkOutDate: getDefaultCheckOut(),
        specialRequests: "",
        ratePerNight: 0,
        totalAmount: 0,
      },
    ]);
  };

  const removeRoom = (index: number) => {
    if (rooms.length > 1) {
      setRooms(rooms.filter((_, i) => i !== index));
    }
  };

  const updateRoom = (index: number, field: keyof RoomData, value: any) => {
    const updatedRooms = [...rooms];
    updatedRooms[index] = { ...updatedRooms[index], [field]: value };

    // Calculate total amount when relevant fields change
    if (
      field === "roomTypeId" ||
      field === "checkInDate" ||
      field === "checkOutDate"
    ) {
      const selectedRoom = availableRooms?.find(
        (room: any) => room.id === parseInt(updatedRooms[index].roomTypeId),
      );
      if (
        selectedRoom &&
        updatedRooms[index].checkInDate &&
        updatedRooms[index].checkOutDate
      ) {
        const checkInDate = updatedRooms[index].checkInDate;
        const checkOutDate = updatedRooms[index].checkOutDate;
        const rate = parseFloat(selectedRoom.roomType.basePrice);

        const dayCalculationTime = hotelSettings?.dayCalculationTime || "00:00";
        const timeZone = hotelSettings?.timeZone || "Asia/Kathmandu";
        const useCustomDayCalculation =
          hotelSettings?.useCustomDayCalculation || false;
        const nights = calculateNightsWithDayCalculation(
          checkInDate,
          checkOutDate,
          dayCalculationTime,
          timeZone,
          useCustomDayCalculation,
        );
        const totalAmount = nights * rate;

        updatedRooms[index].ratePerNight = rate;
        updatedRooms[index].totalAmount = totalAmount;
      }
    }

    setRooms(updatedRooms);
  };

  // Calculate summary
  const summary = useMemo(() => {
    const totalRooms = rooms.length;
    const totalNights = rooms.reduce((sum, room) => {
      if (room.checkInDate && room.checkOutDate) {
        const dayCalculationTime = hotelSettings?.dayCalculationTime || "00:00";
        const timeZone = hotelSettings?.timeZone || "Asia/Kathmandu";
        const useCustomDayCalculation =
          hotelSettings?.useCustomDayCalculation || false;

        // Use the same calculation method as updateRoom for consistency
        const nights = calculateNightsWithDayCalculation(
          room.checkInDate,
          room.checkOutDate,
          dayCalculationTime,
          timeZone,
          useCustomDayCalculation,
        );

        return sum + nights;
      }
      return sum;
    }, 0);
    const subtotal = rooms.reduce(
      (sum, room) => sum + parseFloat(room.totalAmount || "0"),
      0,
    );

    // Calculate taxes and charges for reservations
    let taxes = 0;

    if (taxesAndCharges && Array.isArray(taxesAndCharges)) {
      const activeTaxes = taxesAndCharges.filter(
        (item) => item.status === "active" && item.applyToReservations,
      );

      taxes = activeTaxes.reduce((sum, item) => {
        const rate = parseFloat(item.rate) || 0;
        const amount = (subtotal * rate) / 100;
        return sum + amount;
      }, 0);
    }

    // Calculate discount
    let discount = 0;
    if (discountData.discountType && discountData.discountValue) {
      const discountValue = parseFloat(discountData.discountValue) || 0;
      if (discountData.discountType === "percentage") {
        discount = (subtotal * discountValue) / 100;
      } else if (discountData.discountType === "fixed") {
        discount = discountValue;
      }
    }

    // Ensure discount doesn't exceed subtotal + taxes
    const maxDiscount = subtotal + taxes;
    discount = Math.min(discount, maxDiscount);

    const total = Math.max(0, subtotal + taxes - discount);

    return {
      totalRooms,
      totalNights,
      subtotal,
      taxes,
      discount,
      total,
    };
  }, [
    rooms,
    taxesAndCharges,
    discountData.discountType,
    discountData.discountValue,
    hotelSettings?.dayCalculationTime,
    hotelSettings?.timeZone,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      if (!guestData.firstName.trim() || !guestData.lastName.trim()) {
        throw new Error("Guest first name and last name are required");
      }

      const branchId =
        user?.role === "superadmin" ? selectedBranchId : user?.branchId;
      if (!branchId) {
        throw new Error("Please select a branch");
      }

      if (rooms.length === 0) {
        throw new Error("At least one room is required");
      }

      // Validate room data
      for (const room of rooms) {
        if (
          !room.roomTypeId ||
          !room.checkInDate ||
          !room.checkOutDate ||
          !room.adults
        ) {
          throw new Error("All room fields are required");
        }
        if (new Date(room.checkInDate) >= new Date(room.checkOutDate)) {
          throw new Error("Check-out date must be after check-in date");
        }
      }

      // Use the summary from useMemo hook instead of calculateSummary function
      const payloadData = {
        guest: {
          ...guestData,
          branchId: parseInt(branchId.toString()),
        },
        reservation: {
          branchId: parseInt(branchId.toString()),
          status: "confirmed",
          totalAmount: summary.total.toString(),
          notes: "",
          discountType: discountData.discountType || null,
          discountValue: discountData.discountValue
            ? parseFloat(discountData.discountValue)
            : null,
          discountReason: discountData.discountReason || null,
        },
        rooms: rooms.map((room) => ({
          id: room.id, // Include existing reservation room ID for updates
          roomId: room.roomId || parseInt(room.roomTypeId), // Use roomId if available, fallback to roomTypeId for new rooms
          checkInDate: room.checkInDate,
          checkOutDate: room.checkOutDate,
          adults: room.adults,
          children: room.children,
          ratePerNight: room.ratePerNight.toString(),
          totalAmount: room.totalAmount.toString(),
          specialRequests: room.specialRequests,
        })),
      };

      // Preparing payload data for submission
      // Branch selection logic for room fetching

      let result;
      if (isEdit && editData) {
        // For editing, send both reservation and rooms data
        const editPayload = {
          ...payloadData.reservation,
          rooms: payloadData.rooms, // Include rooms data for datetime updates
        };
        
        result = await apiRequest(
          "PATCH",
          `/api/reservations/${editData.id}`,
          editPayload,
        );

        // Also update guest information
        await apiRequest(
          "PUT",
          `/api/guests/${editData.guestId}`,
          payloadData.guest,
        );

        // Handle file upload separately for existing reservations
        if (selectedIdFile) {
          const formData = new FormData();
          formData.append("idDocument", selectedIdFile);

          const uploadResponse = await fetch(
            `/api/guests/${editData.guestId}/upload-id`,
            {
              method: "POST",
              body: formData,
            },
          );

          if (!uploadResponse.ok) {
            throw new Error("Failed to upload ID document");
          }
        }
      } else {
        // For new reservations, use FormData to handle file upload
        const formData = new FormData();

        // Append JSON data as strings
        formData.append("guest", JSON.stringify(payloadData.guest));
        formData.append("reservation", JSON.stringify(payloadData.reservation));
        formData.append("rooms", JSON.stringify(payloadData.rooms));

        // Append file if selected
        if (selectedIdFile) {
          formData.append("idDocument", selectedIdFile);
        }

        const response = await fetch("/api/reservations", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to create reservation");
        }

        result = await response.json();
      }

      toast({
        title: "Success",
        description: isEdit
          ? "Reservation updated successfully!"
          : "Reservation created successfully!",
      });

      onClose();
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
    } catch (error: any) {
      console.error("Error creating/updating reservation:", error);

      if (error.status === 401) {
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

      toast({
        title: "Error",
        description:
          error.message || "Failed to save reservation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestSearch = async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    try {
      const guests = await apiRequest(
        "GET",
        `/api/guests/search?q=${encodeURIComponent(query)}`,
      );
      setSearchResults(guests || []);
    } catch (error) {
      console.error("Error searching guests:", error);
      setSearchResults([]);
    }
  };

  const handleSelectGuest = (guest: any) => {
    setGuestData({
      firstName: guest.firstName || "",
      lastName: guest.lastName || "",
      email: guest.email || "",
      phone: guest.phone || "",
      idType: guest.idType || "passport",
      idNumber: guest.idNumber || "",
      address: guest.address || "",
      nationality: guest.nationality || "",
    });

    // Set existing file info if guest has ID document
    if (guest.idDocumentPath) {
      setExistingFileUrl(`/api/guests/${guest.id}/id-document`);
      setExistingFileName(guest.idDocumentOriginalName || "ID Document");
    } else {
      setExistingFileUrl("");
      setExistingFileName("");
    }

    setSearchResults([]);
    setIsGuestSearchOpen(false);
  };

  const calculateSummary = () => {
    const totalRooms = rooms.length;
    const totalNights = rooms.reduce((sum, room) => {
      if (room.checkInDate && room.checkOutDate) {
        const checkIn = new Date(room.checkInDate);
        const checkOut = new Date(room.checkOutDate);
        return (
          sum +
          Math.ceil(
            (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
          )
        );
      }
      return sum;
    }, 0);
    const subtotal = rooms.reduce((sum, room) => sum + room.totalAmount, 0);

    // Calculate dynamic taxes and charges for reservations only
    let taxes = 0;

    if (taxesAndCharges && Array.isArray(taxesAndCharges)) {
      taxes = taxesAndCharges
        .filter((item) => item.status === "active" && item.applyToReservations)
        .reduce((sum, item) => {
          const rate = parseFloat(item.rate) || 0;
          return sum + (subtotal * rate) / 100;
        }, 0);
    }

    // Calculate discount
    let discount = 0;
    if (discountData.discountType && discountData.discountValue) {
      const discountValue = parseFloat(discountData.discountValue) || 0;
      if (discountData.discountType === "percentage") {
        discount = (subtotal * discountValue) / 100;
      } else if (discountData.discountType === "fixed") {
        discount = discountValue;
      }
    }

    // Ensure discount doesn't exceed subtotal + taxes
    const maxDiscount = subtotal + taxes;
    discount = Math.min(discount, maxDiscount);

    const total = Math.max(0, subtotal + taxes - discount);

    return { totalRooms, totalNights, subtotal, taxes, discount, total };
  };

  // Initialize form with edit data - IMMEDIATE loading for better UX
  useEffect(() => {
    if (isEdit && editData && isOpen) {
      console.log("🔄 EDIT: Initializing form with edit data immediately");
      setFormKey(prev => prev + 1); // Force re-render for immediate update
      
      // Processing edit data for existing reservation
      setGuestData({
        firstName: editData.guest.firstName || "",
        lastName: editData.guest.lastName || "",
        email: editData.guest.email || "",
        phone: editData.guest.phone || "",
        idType: editData.guest.idType || "passport",
        idNumber: editData.guest.idNumber || "",
        address: editData.guest.address || "",
        nationality: editData.guest.nationality || "",
      });

      // Set existing file info if guest has ID document
      if (editData.guest.idDocumentPath) {
        setExistingFileUrl(`/api/guests/${editData.guest.id}/id-document`);
        setExistingFileName(
          editData.guest.idDocumentOriginalName || "ID Document",
        );
      } else {
        setExistingFileUrl("");
        setExistingFileName("");
      }

      // Set branch ID for superadmin users
      if (user?.role === "superadmin" && editData.reservationRooms.length > 0) {
        setSelectedBranchId(
          editData.reservationRooms[0].room.branchId.toString(),
        );
      }

      const roomsData = editData.reservationRooms.map((rr: any) => {
        // Processing room reservation data

        // Convert dates to datetime-local format (YYYY-MM-DDTHH:MM)
        const formatDateTimeLocal = (dateString: string) => {
          if (!dateString) {
            return getCurrentDateTime();
          }

          // If already in correct format (YYYY-MM-DDTHH:MM), return as is
          if (
            typeof dateString === "string" &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateString)
          ) {
            return dateString;
          }

          // Handle database timestamp format: "2025-07-22 22:35:00" or "2025-07-22T22:35:00"
          let normalizedStr = dateString.replace(" ", "T"); // Replace space with T

          // Remove seconds and milliseconds, keep only YYYY-MM-DDTHH:MM
          if (
            normalizedStr.includes(":") &&
            normalizedStr.split(":").length >= 2
          ) {
            const parts = normalizedStr.split(":");
            normalizedStr = parts[0] + ":" + parts[1]; // Keep only hours and minutes
          }

          // Validate the format
          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalizedStr)) {
            return normalizedStr;
          }

          // Fallback: Parse without timezone conversion (preserve exact time)
          console.warn(
            "Unexpected date format:",
            dateString,
            "attempting manual parsing without timezone conversion",
          );
          
          // Try to extract components from various formats without Date constructor
          let year, month, day, hours, minutes;
          
          // Handle ISO format with timezone: "2025-07-25T07:49:00.000Z"
          if (dateString.includes('T') && dateString.includes('Z')) {
            const [datePart, timePart] = dateString.split('T');
            [year, month, day] = datePart.split('-').map(Number);
            [hours, minutes] = timePart.split(':').map(Number);
          } 
          // Handle other formats by trying to parse manually
          else {
            console.error("Cannot parse date format:", dateString);
            return getCurrentDateTime();
          }

          const formattedMonth = String(month).padStart(2, "0");
          const formattedDay = String(day).padStart(2, "0");
          const formattedHours = String(hours).padStart(2, "0");
          const formattedMinutes = String(minutes).padStart(2, "0");

          return `${year}-${formattedMonth}-${formattedDay}T${formattedHours}:${formattedMinutes}`;
        };

        return {
          id: rr.id, // Include reservation room ID for updates
          roomId: rr.roomId, // Include roomId for backend
          roomTypeId: rr.room.id.toString(),
          checkInDate: formatDateTimeLocal(rr.checkInDate),
          checkOutDate: formatDateTimeLocal(rr.checkOutDate),
          adults: rr.adults,
          children: rr.children,
          ratePerNight: parseFloat(rr.ratePerNight),
          totalAmount: parseFloat(rr.totalAmount),
          specialRequests: rr.specialRequests || "",
        };
      });

      // Setting rooms data for edit mode
      console.log("🔄 EDIT: Setting rooms data:", roomsData.length, "rooms");
      setRooms(roomsData);

      // Set discount data for edit mode
      const hasDiscount = editData.discountType && editData.discountValue;
      setShowDiscount(!!hasDiscount);
      setDiscountData({
        discountType: editData.discountType || "",
        discountValue: editData.discountValue
          ? editData.discountValue.toString()
          : "",
        discountReason: editData.discountReason || "",
      });
      
      console.log("✅ EDIT: Form initialization completed");
    } else if (!isEdit && isOpen && hotelSettings) {
      console.log("🔄 NEW: Resetting form for new reservation");
      setFormKey(prev => prev + 1); // Force re-render for immediate update
      
      // Reset form for new reservation
      setGuestData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        idType: "passport",
        idNumber: "",
        address: "",
        nationality: "",
      });
      setExistingFileUrl("");
      setExistingFileName("");
      setDiscountData({
        discountType: "",
        discountValue: "",
        discountReason: "",
      });
      setShowDiscount(false);
      setRooms([
        {
          roomTypeId: "",
          adults: 1,
          children: 0,
          checkInDate: getCurrentDateTime(),
          checkOutDate: getDefaultCheckOut(),
          ratePerNight: 0,
          totalAmount: 0,
          specialRequests: "",
        },
      ]);
    }
  }, [isEdit, editData?.id, isOpen, user?.role, hotelSettings]);

  // Separate effect to handle the first initialization of rooms to prevent conflicts
  useEffect(() => {
    if (!isEdit && isOpen && hotelSettings && rooms.length === 0) {
      console.log("🔄 NEW: Initializing empty form for new reservation");
      setRooms([
        {
          roomTypeId: "",
          adults: 1,
          children: 0,
          checkInDate: getCurrentDateTime(),
          checkOutDate: getDefaultCheckOut(),
          ratePerNight: 0,
          totalAmount: 0,
          specialRequests: "",
        },
      ]);
    }
  }, [isEdit, isOpen, hotelSettings, rooms.length]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Room Reservation</DialogTitle>
        </DialogHeader>

        <form key={formKey} onSubmit={handleSubmit} className="space-y-6">
          {/* Branch Selection for Superadmin */}
          {user?.role === "superadmin" && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Branch Selection
              </h3>
              <div>
                <Label htmlFor="branchId">Select Branch *</Label>
                <Select
                  value={selectedBranchId}
                  onValueChange={(value) => setSelectedBranchId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map((branch: any) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Guest Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Guest Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={guestData.firstName}
                  onChange={(e) =>
                    setGuestData({ ...guestData, firstName: e.target.value })
                  }
                  placeholder="Enter first name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={guestData.lastName}
                  onChange={(e) =>
                    setGuestData({ ...guestData, lastName: e.target.value })
                  }
                  placeholder="Enter last name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={guestData.email}
                  onChange={(e) =>
                    setGuestData({ ...guestData, email: e.target.value })
                  }
                  placeholder="guest@email.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="relative">
                  <Input
                    id="phone"
                    value={guestData.phone}
                    onChange={(e) => {
                      const phone = e.target.value;
                      setGuestData({ ...guestData, phone });

                      // Clear existing guest when phone changes
                      if (existingGuest && phone !== existingGuest.phone) {
                        setExistingGuest(null);
                        setExistingFileUrl("");
                        setExistingFileName("");
                      }

                      // Search for existing guest after user stops typing
                      clearTimeout((window as any).guestSearchTimeout);
                      (window as any).guestSearchTimeout = setTimeout(() => {
                        if (phone && phone.length >= 5) {
                          searchGuestByPhone(phone);
                        }
                      }, 800);
                    }}
                    onBlur={(e) => {
                      // Also trigger search on blur if phone is long enough
                      const phone = e.target.value;
                      if (phone && phone.length >= 5 && !existingGuest) {
                        searchGuestByPhone(phone);
                      }
                    }}
                    placeholder="+9779745673009"
                    required
                  />
                  {isSearchingGuest && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    </div>
                  )}
                </div>
                {existingGuest && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-green-800">
                        Found
                      </span>
                    </div>
                    <div className="text-sm text-green-700 mt-1">
                      {existingGuest.firstName} {existingGuest.lastName} (
                      <span className="text-xs">
                        {existingGuest.reservationCount || 0} previous
                        reservations
                        {parseFloat(existingGuest.creditBalance || "0") > 0 &&
                          ` || Credit: Rs.${parseFloat(existingGuest.creditBalance || "0").toFixed(2)}`}
                        {existingGuest.idDocumentPath && " • Has ID document"})
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="idType">ID Type</Label>
                <Select
                  value={guestData.idType}
                  onValueChange={(value) =>
                    setGuestData({ ...guestData, idType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="driving-license">
                      Driving License
                    </SelectItem>
                    <SelectItem value="national-id">National ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="idNumber">ID Number</Label>
                <Input
                  id="idNumber"
                  value={guestData.idNumber}
                  onChange={(e) =>
                    setGuestData({ ...guestData, idNumber: e.target.value })
                  }
                  placeholder="Enter ID number"
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={guestData.address}
                  onChange={(e) =>
                    setGuestData({ ...guestData, address: e.target.value })
                  }
                  placeholder="Enter address"
                />
              </div>
              <div>
                <Label htmlFor="nationality">Nationality</Label>
                <Input
                  id="nationality"
                  value={guestData.nationality}
                  onChange={(e) =>
                    setGuestData({ ...guestData, nationality: e.target.value })
                  }
                  placeholder="Enter nationality"
                />
              </div>
            </div>

            {/* ID Document Upload */}
            <div className="space-y-2">
              <Label htmlFor="idDocument">ID Document (Optional)</Label>

              {/* Show existing file if available */}
              {existingFileUrl && !selectedIdFile && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">
                        Current: {existingFileName}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Open file in new tab
                        window.open(
                          `/api/guests/${editData?.guestId || "temp"}/id-document`,
                          "_blank",
                        );
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View
                    </Button>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Upload a new file to replace the current one
                  </p>
                </div>
              )}

              <Input
                id="idDocument"
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Validate file size (5MB max)
                    if (file.size > 5 * 1024 * 1024) {
                      toast({
                        title: "Error",
                        description: "File size must be less than 5MB",
                        variant: "destructive",
                      });
                      e.target.value = "";
                      return;
                    }

                    // Validate file type
                    const allowedTypes = [
                      "image/jpeg",
                      "image/png",
                      "image/webp",
                      "application/pdf",
                    ];
                    if (!allowedTypes.includes(file.type)) {
                      toast({
                        title: "Error",
                        description:
                          "Only JPEG, PNG, WebP, and PDF files are allowed",
                        variant: "destructive",
                      });
                      e.target.value = "";
                      return;
                    }

                    setSelectedIdFile(file);
                    // Clear existing file display when new file is selected
                    setExistingFileUrl("");
                    setExistingFileName("");
                  }
                }}
                className="cursor-pointer"
              />
              {selectedIdFile && (
                <p className="text-sm text-green-600">
                  New file selected: {selectedIdFile.name} (
                  {(selectedIdFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
              <p className="text-xs text-gray-500">
                Supported formats: JPEG, PNG, WebP, PDF (max 5MB)
              </p>
            </div>
          </div>

          {/* Discount Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Discount Information
              </h3>
              <div className="flex items-center space-x-2">
                <Label
                  htmlFor="discount-toggle"
                  className="text-sm text-gray-600"
                >
                  Apply Discount
                </Label>
                <Switch
                  id="discount-toggle"
                  checked={showDiscount}
                  onCheckedChange={(checked) => {
                    setShowDiscount(checked);
                    if (!checked) {
                      // Clear discount data when toggle is turned off
                      setDiscountData({
                        discountType: "",
                        discountValue: "",
                        discountReason: "",
                      });
                    }
                  }}
                />
              </div>
            </div>

            {showDiscount && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="discountType">Discount Type</Label>
                  <Select
                    value={discountData.discountType}
                    onValueChange={(value) =>
                      setDiscountData({ ...discountData, discountType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select discount type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Discount</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="discountValue">
                    Discount Value{" "}
                    {discountData.discountType === "percentage"
                      ? "(%)"
                      : discountData.discountType === "fixed"
                        ? "(Rs.)"
                        : ""}
                  </Label>
                  <Input
                    id="discountValue"
                    type="number"
                    min="0"
                    max={
                      discountData.discountType === "percentage"
                        ? "100"
                        : undefined
                    }
                    step="0.01"
                    value={discountData.discountValue}
                    onChange={(e) =>
                      setDiscountData({
                        ...discountData,
                        discountValue: e.target.value,
                      })
                    }
                    placeholder={
                      discountData.discountType === "percentage" ? "10" : "500"
                    }
                    disabled={
                      !discountData.discountType ||
                      discountData.discountType === "none"
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="discountReason">Discount Reason</Label>
                  <Input
                    id="discountReason"
                    value={discountData.discountReason}
                    onChange={(e) =>
                      setDiscountData({
                        ...discountData,
                        discountReason: e.target.value,
                      })
                    }
                    placeholder="e.g., Regular customer, Group booking"
                    disabled={
                      !discountData.discountType ||
                      discountData.discountType === "none"
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Room Selection */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Room Selection
              </h3>
              <Button type="button" onClick={addRoom} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Room
              </Button>
            </div>

            {rooms.map((room, index) => (
              <Card key={index} className="mb-4">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Room {index + 1}
                    </CardTitle>
                    {rooms.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRoom(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label>Available Room *</Label>
                      {roomsError && (
                        <div className="text-red-500 text-sm mb-2">
                          Error loading rooms: {roomsError.message}
                        </div>
                      )}
                      <Select
                        value={room.roomTypeId}
                        onValueChange={(value) =>
                          updateRoom(index, "roomTypeId", value)
                        }
                        disabled={roomsLoading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              roomsLoading
                                ? "Loading rooms..."
                                : roomsError
                                  ? "Error loading rooms"
                                  : "Select available room"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {roomsLoading ? (
                            <SelectItem value="loading" disabled>
                              Loading available rooms...
                            </SelectItem>
                          ) : roomsError ? (
                            <SelectItem value="error" disabled>
                              Error loading rooms
                            </SelectItem>
                          ) : availableRooms && availableRooms.length > 0 ? (
                            availableRooms.map((availableRoom: any) => (
                              <SelectItem
                                key={availableRoom.id}
                                value={availableRoom.id.toString()}
                              >
                                Room {availableRoom.number} -{" "}
                                {availableRoom.roomType.name} - Rs.
                                {parseFloat(
                                  availableRoom.roomType.basePrice,
                                ).toFixed(2)}
                                /night
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-rooms" disabled>
                              No available rooms found
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {availableRooms && (
                        <div className="text-xs text-gray-500 mt-1">
                          {availableRooms.length} room(s) available
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div>
    <Label htmlFor={`checkIn-${index}`}>
      Check-in Date & Time *
    </Label>
    <div 
      className="relative cursor-pointer"
      onClick={() => document.getElementById(`checkIn-${index}`).showPicker?.()}
    >
      <Input
        id={`checkIn-${index}`}
        type="datetime-local"
        value={room.checkInDate}
        onChange={(e) =>
          updateRoom(index, "checkInDate", e.target.value)
        }
        required
        className="cursor-pointer"
      />
    </div>
  </div>
  <div>
    <Label htmlFor={`checkOut-${index}`}>
      Check-out Date & Time *
    </Label>
    <div 
      className="relative cursor-pointer"
      onClick={() => document.getElementById(`checkOut-${index}`).showPicker?.()}
    >
      <Input
        id={`checkOut-${index}`}
        type="datetime-local"
        value={room.checkOutDate}
        onChange={(e) =>
          updateRoom(index, "checkOutDate", e.target.value)
        }
        required
        className="cursor-pointer"
      />
    </div>
  </div>
</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Adults</Label>
                      <Select
                        value={room.adults.toString()}
                        onValueChange={(value) =>
                          updateRoom(index, "adults", parseInt(value))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Adult</SelectItem>
                          <SelectItem value="2">2 Adults</SelectItem>
                          <SelectItem value="3">3 Adults</SelectItem>
                          <SelectItem value="4">4 Adults</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Children</Label>
                      <Select
                        value={room.children.toString()}
                        onValueChange={(value) =>
                          updateRoom(index, "children", parseInt(value))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 Children</SelectItem>
                          <SelectItem value="1">1 Child</SelectItem>
                          <SelectItem value="2">2 Children</SelectItem>
                          <SelectItem value="3">3 Children</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Special Requests</Label>
                    <Textarea
                      value={room.specialRequests}
                      onChange={(e) =>
                        updateRoom(index, "specialRequests", e.target.value)
                      }
                      placeholder="Any special requirements for this room..."
                      rows={3}
                    />
                  </div>

                  {room.totalAmount > 0 && (
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        Rate: Rs.{room.ratePerNight.toFixed(2)}/night
                      </p>
                      <p className="font-medium">
                        Room Total: Rs.{room.totalAmount.toFixed(2)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Reservation Summary */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-base">Reservation Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Rooms:</span>
                <span className="font-medium">{summary.totalRooms}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Nights/Days:</span>
                <span className="font-medium">{summary.totalNights}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">
                  Rs.{summary.subtotal.toFixed(2)}
                </span>
              </div>
              {/* Dynamic Taxes and Charges */}
              {taxesAndCharges && taxesAndCharges.length > 0 && (
                <>
                  {taxesAndCharges
                    .filter(
                      (item) =>
                        item.status === "active" && item.applyToReservations,
                    )
                    .map((item, index) => {
                      const rate = parseFloat(item.rate) || 0;
                      const amount = (summary.subtotal * rate) / 100;
                      return (
                        <div
                          key={index}
                          className="flex justify-between text-xs"
                        >
                          <span className="text-gray-500">
                            {item.taxName || item.name} ({rate.toFixed(1)}%):
                          </span>
                          <span className="font-medium">
                            Rs.{amount.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  {summary.taxes > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Total Taxes & Charges:
                      </span>
                      <span className="font-medium">
                        Rs.{summary.taxes.toFixed(2)}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Discount Section */}
              {summary.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>
                    Discount (
                    {discountData.discountType === "percentage"
                      ? `${parseFloat(discountData.discountValue).toFixed(1)}%`
                      : "Fixed"}
                    {discountData.discountReason &&
                      ` - ${discountData.discountReason}`}
                    ):
                  </span>
                  <span className="font-medium">
                    -Rs.{summary.discount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-300 pt-2">
                <span className="font-semibold text-gray-900">
                  Total Amount:
                </span>
                <span className="font-bold text-lg text-primary">
                  Rs.{summary.total.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                createReservationMutation.isPending ||
                isUploadingId
              }
              className="bg-primary hover:bg-primary/90"
            >
              {isSubmitting || createReservationMutation.isPending
                ? "Creating Reservation..."
                : isUploadingId
                  ? "Uploading ID Document..."
                  : "Confirm Reservation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
//The code has been modified to handle file uploads during reservation creation and display existing files.
