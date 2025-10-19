
import React, { useState, useEffect, useCallback } from "react";
import { User, PartnershipType, Notification } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Loader from "@/components/ui/loader";
import {
  UserPlus,
  Edit3,
  Trash2,
  Shield,
  Power,
  PowerOff,
  Clock,
  Download,
  Upload
} from "lucide-react";
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import ProtectedRoute from "../components/common/ProtectedRoute";
import { sendNewUserRequestEmail, createUserDirectly, deleteUserCompletely, updateUserAccess } from "@/api/functions";
import { format } from "date-fns";
import { useToast } from "../components/common/Toast";


const attendeeTypes = ["VIP", "Partner", "Exhibitor", "Media"];

// userTypesForUsersOnly is replaced by dynamic partnerTypes and N/A
// const userTypesForUsersOnly = [
//     "Founding Partner", "Strategic Partner", "Platinum Sponsor", "Palladium Sponsor",
//     "Gold Sponsor", "Silver Sponsor", "Exhibitor", "In-kind Sponsor", "N/A"
// ];

export default function SystemUsers() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [partnerTypes, setPartnerTypes] = useState([]); // <-- State for dynamic partner types
  const [formData, setFormData] = useState({
    preferred_name: '',
    company_name: '',
    email: '',
    system_role: 'User',
    user_type: 'N/A',
    mobile: '',
    registration_slots: attendeeTypes.reduce((acc, type) => ({...acc, [type]: 0}), {}),
    account_status: 'active',
    has_access: false
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [userToToggle, setUserToToggle] = useState(null);
  const [showAddUserRequestDialog, setShowAddUserRequestDialog] = useState(false);
  const [newUserRequestData, setNewUserRequestData] = useState({
    full_name: '',
    email: '',
    password: '',
    company_name: '',
    system_role: 'User',
    user_type: 'N/A',
    registration_slots: attendeeTypes.reduce((acc, type) => ({...acc, [type]: 0}), {}),
    has_access: false
  });
  const [isSendingUserRequest, setIsSendingUserRequest] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setHasPermissionError(false); // Reset permission error on new load
    try {
      const me = await User.me();
      setCurrentUser(me);

      // Check if user has permission to manage system users
      const canManageUsers = me.role === 'admin' || me.system_role === 'Admin' || me.system_role === 'Super User';
      
      if (!canManageUsers) {
        setHasPermissionError(true);
        setIsLoading(false);
        return;
      }

      try {
        const [userData, partnerTypeData] = await Promise.all([
          User.list("-created_at"),
          PartnershipType.list()
        ]);

        setPartnerTypes(partnerTypeData);

        if (me.system_role === 'Super User') {
          // Super Users see themselves and all 'User' type users
          setUsers(userData.filter(u => u.id === me.id || u.system_role === 'User'));
        } else {
          // Admins see everyone
          setUsers(userData);
        }
      } catch (dataError) {
        console.error("Error loading user data:", dataError);
        // Assuming "Permission denied" or similar message in the error object for API access issues
        if (dataError.message?.includes('Permission denied')) {
          setHasPermissionError(true);
        } else {
          toast({
            title: "Error",
            description: "Failed to load system data. Please try again.",
            variant: "destructive",
          });
        }
      }

    } catch (error) {
      console.error("Error loading current user:", error);
      toast({
        title: "Error",
        description: "Failed to verify user permissions. Please try again.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormData({
      preferred_name: '',
      company_name: '',
      email: '',
      system_role: 'User',
      user_type: 'N/A',
      mobile: '',
      registration_slots: attendeeTypes.reduce((acc, type) => ({...acc, [type]: 0}), {}),
      account_status: 'active',
      has_access: false
    });
    setEditingUser(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newFormData = { ...prev, [field]: value };
      
      // Auto-fill registration slots when user_type changes
      if (field === 'user_type' && value && value !== 'N/A') {
        const selectedPartnerType = partnerTypes.find(p => p.name === value);
        if (selectedPartnerType) {
          newFormData.registration_slots = {
            VIP: selectedPartnerType.slots_vip || 0,
            Partner: selectedPartnerType.slots_partner || 0,
            Exhibitor: selectedPartnerType.slots_exhibitor || 0,
            Media: selectedPartnerType.slots_media || 0,
          };
        }
      } else if (field === 'user_type' && value === 'N/A') {
        // Reset slots to 0 when N/A is selected
        newFormData.registration_slots = {
          VIP: 0,
          Partner: 0,
          Exhibitor: 0,
          Media: 0,
        };
      }
      
      return newFormData;
    });
  };

  const handleNewUserRequestDataChange = (field, value) => {
    setNewUserRequestData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Auto-fill registration slots when user_type changes
      if (field === 'user_type' && value && value !== 'N/A') {
        const selectedPartnerType = partnerTypes.find(p => p.name === value);
        if (selectedPartnerType) {
          newData.registration_slots = {
            VIP: selectedPartnerType.slots_vip || 0,
            Partner: selectedPartnerType.slots_partner || 0,
            Exhibitor: selectedPartnerType.slots_exhibitor || 0,
            Media: selectedPartnerType.slots_media || 0,
          };
        }
      } else if (field === 'user_type' && value === 'N/A') {
        // Reset slots to 0 when N/A is selected
        newData.registration_slots = {
          VIP: 0,
          Partner: 0,
          Exhibitor: 0,
          Media: 0,
        };
      }
      
      return newData;
    });
  };

  const handleSlotChange = (attendeeType, value) => {
    setFormData(prev => ({
      ...prev,
      registration_slots: {
        ...prev.registration_slots,
        [attendeeType]: parseInt(value) || 0
      }
    }));
  };

  const handleNewUserSlotChange = (attendeeType, value) => {
    setNewUserRequestData(prev => ({
      ...prev,
      registration_slots: {
        ...prev.registration_slots,
        [attendeeType]: parseInt(value) || 0
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!editingUser) return;

    try {
      const userData = {
        preferred_name: formData.preferred_name,
        company_name: formData.company_name,
        system_role: formData.system_role,
        user_type: formData.user_type,
        mobile: formData.mobile,
        registration_slots: formData.registration_slots, // Start with current form data's slots
        account_status: formData.account_status || 'active',
        has_access: formData.has_access
      };

      // ** AUTO-POPULATE SLOTS FROM PARTNERSHIP TYPE **
      // Only apply if the user is a 'User' type and has a specific partnership type selected
      if (formData.system_role === 'User' && formData.user_type && formData.user_type !== 'N/A') {
        const selectedPartnerType = partnerTypes.find(p => p.name === formData.user_type);
        if (selectedPartnerType) {
          userData.registration_slots = {
            VIP: selectedPartnerType.slots_vip || 0,
            Partner: selectedPartnerType.slots_partner || 0,
            Exhibitor: selectedPartnerType.slots_exhibitor || 0,
            Media: selectedPartnerType.slots_media || 0,
          };
        }
      } else if (formData.system_role === 'Admin' || formData.system_role === 'Super User') {
          // Admins and Super Users have unlimited slots conceptually, store as empty object or special value
          userData.registration_slots = {};
      }


      await User.update(editingUser.id, userData);

      // Additionally call the updateUserAccess API to ensure has_access is properly set
      if (formData.system_role === 'Super User' || formData.system_role === 'Admin' || formData.system_role === 'User') {
        try {
          await updateUserAccess({
            userId: editingUser.id,
            systemRole: formData.system_role,
            hasAccess: formData.has_access
          });
        } catch (accessError) {
          console.warn('Failed to update user access via API:', accessError);
          // Don't fail the entire update if this fails, just log it
        }
      }

      loadData();
      setShowEditDialog(false);
      resetForm();

      toast({
        title: "Success",
        description: "User permissions updated successfully!",
        variant: "success",
      });
    } catch (error) {
      console.error("Error saving user:", error);
      toast({
        title: "Error",
        description: "Failed to save user. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    const initialSlots = attendeeTypes.reduce((acc, type) => ({
      ...acc,
      [type]: user.registration_slots?.[type] || 0
    }), {});
    setFormData({
      preferred_name: user.preferred_name || '',
      company_name: user.company_name || '',
      email: user.email || '',
      system_role: user.system_role || 'User',
      user_type: user.user_type || 'N/A',
      mobile: user.mobile || '',
      registration_slots: initialSlots,
      account_status: user.account_status || 'active',
      has_access: user.has_access || false
    });
    setShowEditDialog(true);
  };

  const confirmDelete = (user) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    setIsDeletingUser(true);
    try {
      // Use the new comprehensive delete function
      await deleteUserCompletely(userToDelete.id);
      
      loadData();
      setShowDeleteDialog(false);
      setUserToDelete(null);

      toast({
        title: "Success",
        description: "User deleted successfully from both database and authentication.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: `Failed to delete user: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const confirmToggleStatus = (user) => {
    setUserToToggle(user);
    setShowStatusDialog(true);
  };

  const handleToggleAccountStatus = async () => {
    if (!userToToggle) return;

    const newStatus = userToToggle.account_status === 'active' ? 'inactive' : 'active';

    try {
      await User.update(userToToggle.id, { account_status: newStatus });
      loadData();
      setShowStatusDialog(false);
      setUserToToggle(null);

      toast({
        title: "Success",
        description: `Account ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully.`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error updating account status:", error);
      toast({
        title: "Error",
        description: "Failed to update account status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSlotUpdate = async (userId, slotUpdates) => {
    try {
      const userToUpdate = users.find(u => u.id === userId);
      if (!userToUpdate) {
        toast({
          title: "Error",
          description: "User not found.",
          variant: "destructive",
        });
        return;
      }

      const currentSlots = userToUpdate.registration_slots || {};

      // Ensure all attendee types are present in the slots object
      const updatedSlots = {
        VIP: 0,
        Partner: 0,
        Exhibitor: 0,
        Media: 0,
        ...currentSlots,
        ...slotUpdates
      };

      await User.update(userId, { registration_slots: updatedSlots });
      await loadData();
      toast({
        title: "Success",
        description: "Registration slots updated successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to update user slots:", error);
      toast({
        title: "Error",
        description: "Failed to update registration slots.",
        variant: "destructive",
      });
    }
  };

  const handleRequestNewUser = async () => {
    if (!newUserRequestData.full_name || !newUserRequestData.email || !newUserRequestData.password || !newUserRequestData.company_name) {
      toast({ title: "Missing Information", description: "Please provide full name, email, password, and company name.", variant: "destructive" });
      return;
    }
    setIsSendingUserRequest(true);
    try {
      // Create user directly in Supabase Auth and users table
      const result = await createUserDirectly({
        fullName: newUserRequestData.full_name,
        email: newUserRequestData.email,
        password: newUserRequestData.password,
        companyName: newUserRequestData.company_name,
        systemRole: newUserRequestData.system_role,
        userType: newUserRequestData.user_type,
        registrationSlots: newUserRequestData.registration_slots,
        preferredName: newUserRequestData.full_name,
        hasAccess: newUserRequestData.has_access
      });
      
      if (result.success) {
        // Additionally call the updateUserAccess API to ensure has_access is properly set
        try {
          await updateUserAccess({
            userId: result.user.id,
            systemRole: newUserRequestData.system_role,
            hasAccess: newUserRequestData.has_access
          });
        } catch (accessError) {
          console.warn('Failed to update user access via API after creation:', accessError);
          // Don't fail the entire creation if this fails, just log it
        }

        toast({ 
          title: "User Created Successfully", 
          description: `User ${newUserRequestData.full_name} has been created and can now log in.`, 
          variant: "success" 
        });
        setShowAddUserRequestDialog(false);
        setNewUserRequestData({ 
          full_name: '', 
          email: '', 
          password: '', 
          company_name: '', 
          system_role: 'User', 
          user_type: 'N/A', 
          registration_slots: attendeeTypes.reduce((acc, type) => ({...acc, [type]: 0}), {}),
          has_access: false
        });
        // Refresh the users list
        loadData();
      }
    } catch (error) {
      console.error("Failed to create user:", error);
      toast({ 
        title: "Error", 
        description: `Failed to create user: ${error.message}`, 
        variant: "destructive" 
      });
    }
    setIsSendingUserRequest(false);
  };

  const handleDownloadTemplate = () => {
    try {
      // Function to sanitize sheet names (remove invalid characters)
      const sanitizeSheetName = (name) => {
        return name.replace(/[:\\/\?\*\[\]]/g, ' ').substring(0, 31); // Excel sheet names max 31 chars
      };

      // Create a new workbook
      const wb = XLSX.utils.book_new();
      
      // Define all the columns with their headers and validation data
      const templateData = [
        // Header row
        [
          'Full Name', 'Email', 'Password', 'Company Name', 'System User Type', 'Partner Type',
          'VIP Slots', 'Partner Slots', 'Exhibitor Slots', 'Media Slots', 'Has Access'
        ],
        // Example row with sample data
        [
          'John Doe', 'john.doe@example.com', 'SecurePassword123!', 'Example Corp', 'User', 'Strategic Partner',
          '5', '10', '8', '3', 'No'
        ]
      ];

      // Create the main worksheet
      const ws = XLSX.utils.aoa_to_sheet(templateData);

      // Set column widths for better readability
      const colWidths = [
        { wch: 20 }, // Full Name
        { wch: 30 }, // Email
        { wch: 20 }, // Password
        { wch: 25 }, // Company Name
        { wch: 18 }, // System User Type
        { wch: 25 }, // Partner Type
        { wch: 12 }, // VIP Slots
        { wch: 15 }, // Partner Slots
        { wch: 18 }, // Exhibitor Slots
        { wch: 15 }, // Media Slots
        { wch: 15 }  // Has Access
      ];
      ws['!cols'] = colWidths;

      // Add the main sheet
      XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName('System Users Template'));

      // Create dropdown reference sheets
      const dropdownSheets = {
        'System User Types': ['Admin', 'Super User', 'User'],
        'Partner Types': ['N/A', ...partnerTypes.map(pt => pt.name)],
        'Yes No Options': ['Yes', 'No']
      };

      // Add dropdown reference sheets
      Object.entries(dropdownSheets).forEach(([sheetName, data]) => {
        const dropdownData = [['Options'], ...data.map(item => [item])];
        const dropdownWs = XLSX.utils.aoa_to_sheet(dropdownData);
        dropdownWs['!cols'] = [{ wch: 50 }];
        XLSX.utils.book_append_sheet(wb, dropdownWs, sanitizeSheetName(sheetName));
      });

      // Create instructions sheet
      const instructionsData = [
        ['Future Minerals Forum - System Users Bulk Upload Template'],
        [''],
        ['INSTRUCTIONS:'],
        [''],
        ['1. Fill in the System Users Template sheet with user information'],
        ['2. Use the dropdown reference sheets for valid values'],
        ['3. Required fields are marked in the example row'],
        ['4. Each email must be unique across all rows'],
        ['5. Password should be secure (minimum 8 characters recommended)'],
        [''],
        ['FIELD DESCRIPTIONS:'],
        [''],
        ['• Full Name: Complete name of the system user'],
        ['• Email: Unique email address for login (required)'],
        ['• Password: Login password for the user (required)'],
        ['• Company Name: Organization the user represents (required)'],
        ['• System User Type: Select from Admin, Super User, or User'],
        ['• Partner Type: Required only for "User" type. Select from available partner types or "N/A"'],
        ['• Registration Slots: Number of slots for each attendee type (only for "User" type)'],
        ['• Has Access: Only for "Super User" type. Select "Yes" or "No"'],
        [''],
        ['VALIDATION RULES:'],
        [''],
        ['• Email addresses must be valid and unique'],
        ['• Password must be provided for each user'],
        ['• System User Type must be one of: Admin, Super User, User'],
        ['• Partner Type is required for "User" type, ignored for others'],
        ['• Registration slots are only applicable for "User" type'],
        ['• Has Access field is only applicable for "Super User" type'],
        ['• Admin and Super User types have unlimited registration slots'],
        [''],
        ['SLOT ALLOCATION:'],
        [''],
        ['• Admin: Unlimited slots for all attendee types'],
        ['• Super User: Unlimited slots for all attendee types'],
        ['• User with Partner Type: Slots auto-populated from partner type settings'],
        ['• User with "N/A" Partner Type: Use manually specified slot values'],
        [''],
        ['For questions, contact the system administrator.']
      ];

      const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
      instructionsWs['!cols'] = [{ wch: 80 }];
      
      // Style the instructions sheet
      instructionsWs['A1'] = { 
        v: 'Future Minerals Forum - System Users Bulk Upload Template',
        s: { font: { bold: true, sz: 16 } }
      };

      XLSX.utils.book_append_sheet(wb, instructionsWs, sanitizeSheetName('Instructions'));

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `FMF_SystemUsers_Template_${currentDate}.xlsx`;

      // Write and download the file
      XLSX.writeFile(wb, filename);

      toast({
        title: "Template Downloaded",
        description: `Excel template "${filename}" has been downloaded successfully.`,
        variant: "success"
      });

    } catch (error) {
      console.error('Error generating Excel template:', error);
      toast({
        title: "Download Failed",
        description: "Failed to generate Excel template. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleBulkUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    let createdUsers = [];

    try {
      // Read the Excel file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error('Excel file must contain at least a header row and one data row');
      }

      // Get headers and data rows
      const headers = jsonData[0];
      const dataRows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));

      if (dataRows.length === 0) {
        throw new Error('No data rows found in the Excel file');
      }

      // Validate headers match expected format
      const expectedHeaders = [
        'Full Name', 'Email', 'Password', 'Company Name', 'System User Type', 'Partner Type',
        'VIP Slots', 'Partner Slots', 'Exhibitor Slots', 'Media Slots', 'Has Access'
      ];

      // Check if headers match (allow some flexibility in order)
      const missingHeaders = expectedHeaders.filter(header => !headers.includes(header));
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
      }

      // Validate and process each row
      const processedUsers = [];
      const validationErrors = [];
      const emailSet = new Set(); // To track unique emails

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNumber = i + 2; // +2 because Excel is 1-indexed and we skip header
        
        try {
          const userData = {};
          
          // Map Excel columns to database fields
          const fieldMapping = {
            'Full Name': 'full_name',
            'Email': 'email',
            'Password': 'password',
            'Company Name': 'company_name',
            'System User Type': 'system_role',
            'Partner Type': 'user_type',
            'VIP Slots': 'vip_slots',
            'Partner Slots': 'partner_slots',
            'Exhibitor Slots': 'exhibitor_slots',
            'Media Slots': 'media_slots',
            'Has Access': 'has_access'
          };

          // Extract data from row
          headers.forEach((header, index) => {
            const fieldName = fieldMapping[header];
            if (fieldName && row[index] !== undefined) {
              let value = row[index];
              
              // Handle special field types
              if (fieldName === 'has_access') {
                value = value === 'Yes' || value === true;
              } else if (fieldName.endsWith('_slots')) {
                value = parseInt(value) || 0;
              }
              
              userData[fieldName] = value;
            }
          });

          // Validate required fields
          const requiredFields = ['full_name', 'email', 'password', 'company_name', 'system_role'];
          const missingFields = requiredFields.filter(field => 
            !userData[field] || userData[field] === ''
          );

          if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(userData.email)) {
            throw new Error('Invalid email format');
          }

          // Check for duplicate emails
          if (emailSet.has(userData.email.toLowerCase())) {
            throw new Error(`Duplicate email address: ${userData.email}`);
          }
          emailSet.add(userData.email.toLowerCase());

          // Validate system role
          const validSystemRoles = getSystemUserTypesForDropdown();
          if (!validSystemRoles.includes(userData.system_role)) {
            throw new Error(`Invalid system user type: ${userData.system_role}. Must be one of: ${validSystemRoles.join(', ')}`);
          }

          // Validate partner type for User role
          if (userData.system_role === 'User') {
            if (!userData.user_type) {
              throw new Error('Partner Type is required for User system role');
            }
            
            const validPartnerTypes = ['N/A', ...partnerTypes.map(pt => pt.name)];
            if (!validPartnerTypes.includes(userData.user_type)) {
              throw new Error(`Invalid partner type: ${userData.user_type}. Must be one of: ${validPartnerTypes.join(', ')}`);
            }
          } else {
            // For Admin and Super User, partner type should be N/A
            userData.user_type = 'N/A';
          }

          // Validate has_access for Super User
          if (userData.system_role === 'Super User') {
            if (userData.has_access === undefined) {
              throw new Error('Has Access field is required for Super User system role');
            }
          } else {
            // For other roles, has_access should be false
            userData.has_access = false;
          }

          // Set up registration slots
          let registrationSlots = {};
          
          if (userData.system_role === 'User') {
            if (userData.user_type && userData.user_type !== 'N/A') {
              // Auto-populate from partner type
              const selectedPartnerType = partnerTypes.find(p => p.name === userData.user_type);
              if (selectedPartnerType) {
                registrationSlots = {
                  VIP: selectedPartnerType.slots_vip || 0,
                  Partner: selectedPartnerType.slots_partner || 0,
                  Exhibitor: selectedPartnerType.slots_exhibitor || 0,
                  Media: selectedPartnerType.slots_media || 0,
                };
              }
            } else {
              // Use manually specified slots
              registrationSlots = {
                VIP: userData.vip_slots || 0,
                Partner: userData.partner_slots || 0,
                Exhibitor: userData.exhibitor_slots || 0,
                Media: userData.media_slots || 0,
              };
            }
          } else {
            // Admin and Super User have unlimited slots (empty object)
            registrationSlots = {};
          }

          // Clean up the userData for createUserDirectly function
          const cleanUserData = {
            fullName: userData.full_name,
            email: userData.email,
            password: userData.password,
            companyName: userData.company_name,
            systemRole: userData.system_role,
            userType: userData.user_type,
            registrationSlots: registrationSlots,
            preferredName: userData.full_name,
            hasAccess: userData.has_access || false
          };

          processedUsers.push(cleanUserData);

        } catch (error) {
          validationErrors.push(`Row ${rowNumber}: ${error.message}`);
        }
      }

      // If there are validation errors, stop and show them
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed:\n${validationErrors.slice(0, 5).join('\n')}${validationErrors.length > 5 ? `\n... and ${validationErrors.length - 5} more errors` : ''}`);
      }

      // Create users in database
      for (const userData of processedUsers) {
        try {
          const result = await createUserDirectly(userData);
          
          if (result.success) {
            createdUsers.push(result.user);

            // Additionally call the updateUserAccess API to ensure has_access is properly set
            if (userData.systemRole === 'Super User' || userData.systemRole === 'Admin' || userData.systemRole === 'User') {
              try {
                await updateUserAccess({
                  userId: result.user.id,
                  systemRole: userData.systemRole,
                  hasAccess: userData.hasAccess
                });
              } catch (accessError) {
                console.warn('Failed to update user access via API after bulk creation:', accessError);
                // Don't fail the entire creation if this fails, just log it
              }
            }
          } else {
            throw new Error(result.error || 'Failed to create user');
          }

        } catch (error) {
          // If creation fails, rollback all created users
          console.error(`Failed to create user ${userData.email}:`, error);
          
          // Delete all previously created users
          for (const createdUser of createdUsers) {
            try {
              await deleteUserCompletely(createdUser.id);
            } catch (deleteError) {
              console.error('Failed to rollback user:', deleteError);
            }
          }
          
          throw new Error(`Failed to create user ${userData.email}: ${error.message}`);
        }
      }

      toast({
        title: "Bulk Upload Successful",
        description: `Successfully created ${createdUsers.length} system users. Welcome emails have been sent.`,
        variant: "success"
      });

      // Reset file input and reload data
      event.target.value = '';
      await loadData();

    } catch (error) {
      console.error('Bulk upload failed:', error);
      
      // Rollback any created users
      for (const createdUser of createdUsers) {
        try {
          await deleteUserCompletely(createdUser.id);
        } catch (deleteError) {
          console.error('Failed to rollback user:', deleteError);
        }
      }

      toast({
        title: "Bulk Upload Failed",
        description: error.message,
        variant: "destructive"
      });

      // Reset file input
      event.target.value = '';
    } finally {
      setIsUploading(false);
    }
  };

  const getTotalSlots = (slots) => {
    return Object.values(slots || {}).reduce((sum, count) => sum + (count || 0), 0);
  };

  const getTotalUsedSlots = (usedSlots) => {
    return Object.values(usedSlots || {}).reduce((sum, count) => sum + (count || 0), 0);
  };

  const getDisplayName = (user) => {
    return user.preferred_name || user.full_name || user.email || 'Unknown User';
  };

  const canPerformAction = (targetUser) => {
      if (!currentUser || !targetUser) return false;
      if (currentUser.role === 'admin' || currentUser.system_role === 'Admin') return true; // Admins can do anything
      // Super Users can manage Users unless the target user is themselves or of a higher type
      if (currentUser.system_role === 'Super User') {
          if (targetUser.system_role === 'User') return true;
          if (targetUser.id === currentUser.id && targetUser.system_role === 'Super User') return true; // Super User can edit themselves
      }
      return false;
  }

  const getSystemUserTypesForDropdown = () => {
      if (!currentUser) return [];
      if (currentUser.role === 'admin' || currentUser.system_role === 'Admin') return ["Admin", "Super User", "User"];
      if (currentUser.system_role === 'Super User') return ["User"]; // Super Users can only create/manage 'User' type
      return [];
  }

  if (hasPermissionError) {
    return (
      <ProtectedRoute pageName="SystemUsers">
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col items-center justify-center min-h-96">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Access Restricted</h1>
                <p className="text-gray-600 max-w-md">
                  You don't have permission to manage system users. Only administrators and super users can access this section.
                </p>
                <div className="pt-4">
                  <Link to={createPageUrl("Dashboard")}>
                    <Button variant="outline">
                      Return to Dashboard
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute pageName="SystemUsers">
      <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">System Users</h1>
              <p className="text-gray-500 mt-1">Manage user accounts and registration permissions</p>
            </div>
            {currentUser && (currentUser.role === 'admin' || currentUser.system_role === 'Admin' || currentUser.system_role === 'Super User') && (
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </Button>
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2"
                  onClick={() => document.getElementById('bulk-upload-input').click()}
                  disabled={isUploading}
                >
                  <Upload className="w-4 h-4" />
                  {isUploading ? 'Uploading...' : 'Bulk Upload'}
                </Button>
                <input
                  id="bulk-upload-input"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleBulkUpload}
                  style={{ display: 'none' }}
                />
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowAddUserRequestDialog(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add New System User
                </Button>
              </div>
            )}
          </div>

          {/* New User Request Dialog */}
          <Dialog open={showAddUserRequestDialog} onOpenChange={setShowAddUserRequestDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New System User</DialogTitle>
                <DialogDescription>
                  Create a new system user account with the specified details. The system user will be able to log in immediately.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="new_user_full_name">Full Name</Label>
                  <Input
                    id="new_user_full_name"
                    placeholder="Enter the full name of the new system user"
                    value={newUserRequestData.full_name}
                    onChange={(e) => setNewUserRequestData(prev => ({ ...prev, full_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="new_user_email">Email</Label>
                  <Input
                    id="new_user_email"
                    type="email"
                    placeholder="Enter the email for invitation"
                    value={newUserRequestData.email}
                    onChange={(e) => setNewUserRequestData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="new_user_password">Password</Label>
                  <Input
                    id="new_user_password"
                    type="password"
                    placeholder="Enter the password for the new system user"
                    value={newUserRequestData.password}
                    onChange={(e) => setNewUserRequestData(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="new_user_company">Company Name</Label>
                  <Input
                    id="new_user_company"
                    placeholder="Enter the company name"
                    value={newUserRequestData.company_name}
                    onChange={(e) => setNewUserRequestData(prev => ({ ...prev, company_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="new_user_type">System User Type</Label>
                  <Select value={newUserRequestData.system_role} onValueChange={(value) => handleNewUserRequestDataChange('system_role', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user type" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSystemUserTypesForDropdown().map(type => (
                         <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newUserRequestData.system_role === 'Super User' && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has_access"
                      checked={newUserRequestData.has_access}
                      onCheckedChange={(checked) => setNewUserRequestData(prev => ({ ...prev, has_access: checked }))}
                    />
                    <Label htmlFor="has_access" className="text-sm">
                      Allow this Super User to approve/disapprove attendees
                    </Label>
                  </div>
                )}

                {newUserRequestData.system_role === 'User' && (
                  <div>
                    <Label htmlFor="new_user_sponsor_type">Partner Type</Label>
                    <Select value={newUserRequestData.user_type} onValueChange={(value) => handleNewUserRequestDataChange('user_type', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select partner type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="N/A">N/A</SelectItem>
                        {partnerTypes.map(type => (
                          <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {newUserRequestData.system_role === 'User' && (
                  <div>
                    <Label className="text-base font-semibold mb-4 block">Registration Slots</Label>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      {attendeeTypes.map((type) => (
                        <div key={type} className="flex items-center justify-between">
                          <Label className="text-sm">{type}</Label>
                          <Input
                            type="number"
                            min="0"
                            className="w-20"
                            value={newUserRequestData.registration_slots[type] || 0}
                            onChange={(e) => handleNewUserSlotChange(type, e.target.value)}
                            disabled={newUserRequestData.user_type !== 'N/A'}
                          />
                        </div>
                      ))}
                    </div>
                    {newUserRequestData.user_type !== 'N/A' && (
                      <p className="text-sm text-gray-500 mt-2">
                        Slots are automatically determined by the selected Partnership Type.
                      </p>
                    )}
                  </div>
                )}

                {(newUserRequestData.system_role === 'Admin' || newUserRequestData.system_role === 'Super User') && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      Admins and Super Users have unlimited registration slots.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowAddUserRequestDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRequestNewUser} disabled={isSendingUserRequest}>
                  {isSendingUserRequest ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Creating...
                    </div>
                  ) : (
                    "Create System User"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm User Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete {userToDelete?.email}? This will permanently revoke their access to the system.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeletingUser}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeletingUser}>
                  {isDeletingUser ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Deleting...
                    </div>
                  ) : (
                    "Delete User"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Status Toggle Confirmation Dialog */}
          <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Account Status Change</DialogTitle>
                <DialogDescription>
                  Are you sure you want to {userToToggle?.account_status === 'active' ? 'deactivate' : 'activate'} {userToToggle?.email}?
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleToggleAccountStatus}>
                  {userToToggle?.account_status === 'active' ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Edit User Permissions for {editingUser?.email}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="preferred_name">Preferred Name</Label>
                    <Input
                      id="preferred_name"
                      value={formData.preferred_name}
                      onChange={(e) => handleInputChange('preferred_name', e.target.value)}
                      placeholder="Enter preferred display name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company_name">Company Name</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => handleInputChange('company_name', e.target.value)}
                      placeholder="Enter company name"
                    />
                  </div>
                </div>
                 <div>
                    <Label htmlFor="mobile">Mobile Number</Label>
                    <Input
                      id="mobile"
                      value={formData.mobile}
                      onChange={(e) => handleInputChange('mobile', e.target.value)}
                      placeholder="Enter mobile number"
                    />
                  </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="bg-gray-100"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="system_user_type">System User Type</Label>
                        <Select value={formData.system_role} onValueChange={(value) => handleInputChange('system_role', value)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {getSystemUserTypesForDropdown().map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                  <div>
                    <Label htmlFor="account_status">Account Status</Label>
                    <Select value={formData.account_status || 'active'} onValueChange={(value) => handleInputChange('account_status', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.system_role === 'Super User' && (
                  <div className="flex items-center space-x-2"> 
                    <Checkbox
                      id="edit_has_access"
                      checked={formData.has_access}
                      onCheckedChange={(checked) => handleInputChange('has_access', checked)}
                    />
                    <Label htmlFor="edit_has_access" className="text-sm">
                      Allow this Super User to approve/disapprove attendees
                    </Label>
                  </div>
                )}

                {formData.system_role === 'User' && (
                     <div>
                        <Label htmlFor="user_type">System User Type</Label>
                        <Select value={formData.user_type} onValueChange={(value) => handleInputChange('user_type', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select system user type"/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="N/A">N/A</SelectItem>
                                {partnerTypes.map(type => (
                                    <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {(formData.system_role === 'User') && ( // Super Users and Admins have unlimited, so their slots aren't directly editable here
                  <div>
                    <Label className="text-base font-semibold mb-4 block">Registration Slots</Label>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      {attendeeTypes.map((type) => (
                        <div key={type} className="flex items-center justify-between">
                          <Label className="text-sm">{type}</Label>
                          <Input
                            type="number"
                            min="0"
                            className="w-20"
                            value={formData.registration_slots[type] || 0}
                            onChange={(e) => handleSlotChange(type, e.target.value)}
                            // Disable if a specific partnership type is selected for a 'User'
                            disabled={formData.system_role === 'User' && formData.user_type !== 'N/A'}
                          />
                        </div>
                      ))}
                    </div>
                    {formData.system_role === 'User' && formData.user_type !== 'N/A' && (
                        <p className="text-sm text-gray-500 mt-2">
                            Slots are automatically determined by the selected Partnership Type.
                        </p>
                    )}
                  </div>
                )}
                {(formData.system_role === 'Admin' || formData.system_role === 'Super User') && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                            Admins and Super Users have unlimited registration slots.
                        </p>
                    </div>
                )}


                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowEditDialog(false); resetForm(); }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    Update User
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                System Users ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>User</TableHead>
                      <TableHead>System Type</TableHead>
                      {users.filter(user => {
                        // Only filter out current user if they are a Super User
                        if (currentUser?.system_role === 'Super User') {
                          return user.id !== currentUser.id;
                        }
                        // Admins can see all users including themselves
                        return true;
                      }).some(user => user.system_role === 'User') && <TableHead>Sponsor/Partner Type</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Slots (Avail/Total)</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array(3).fill(0).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={users.filter(user => {
                            // Only filter out current user if they are a Super User
                            if (currentUser?.system_role === 'Super User') {
                              return user.id !== currentUser.id;
                            }
                            // Admins can see all users including themselves
                            return true;
                          }).some(user => user.system_role === 'User') ? 7 : 6} className="h-16">
                            <div className="flex items-center justify-center">
                              <Loader size="small" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      users.filter(user => {
                        // Only filter out current user if they are a Super User
                        if (currentUser?.system_role === 'Super User') {
                          return user.id !== currentUser.id;
                        }
                        // Admins can see all users including themselves
                        return true;
                      }).map((user) => {
                        const totalSlots = getTotalSlots(user.registration_slots);
                        const usedSlots = getTotalUsedSlots(user.used_slots);
                        const availableSlots = totalSlots - usedSlots;
                        const displayName = getDisplayName(user);
                        const isActive = user.account_status === 'active' || !user.account_status;

                        return (
                          <TableRow key={user.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="w-10 h-10">
                                   <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                                    {displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold text-gray-900">{displayName}</p>
                                  <p className="text-sm text-gray-500">{user.email}</p>
                                  {user.company_name && <p className="text-xs text-gray-400">{user.company_name}</p>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={user.system_role === 'Admin' ? 'bg-red-100 text-red-800' : (user.system_role === 'Super User' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800')}>
                                <Shield className="w-3 h-3 mr-1" />{user.system_role}
                              </Badge>
                            </TableCell>
                            {users.filter(user => {
                              // Only filter out current user if they are a Super User
                              if (currentUser?.system_role === 'Super User') {
                                return user.id !== currentUser.id;
                              }
                              // Admins can see all users including themselves
                              return true;
                            }).some(u => u.system_role === 'User') && (
                              <TableCell>
                                {user.system_role === 'User' ? (
                                  user.user_type && user.user_type !== 'N/A' ? (
                                    <Badge variant="outline">{user.user_type}</Badge>
                                  ) : (
                                    <span className="text-gray-400">N/A</span>
                                  )
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              <Badge className={isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                {isActive ? (
                                  <><Power className="w-3 h-3 mr-1" />Active</>
                                ) : (
                                  <><PowerOff className="w-3 h-3 mr-1" />Inactive</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <Clock className="w-3 h-3" />
                                {user.last_login_date
                                  ? format(new Date(user.last_login_date), 'MMM d, yyyy')
                                  : 'Never'
                                }
                              </div>
                            </TableCell>
                            <TableCell>
                                {user.system_role === 'Admin' || user.system_role === 'Super User' ? (
                                    <span className="font-semibold text-lg">∞</span>
                                ) : (
                                    <span className={`font-semibold ${availableSlots > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {availableSlots}/{totalSlots}
                                    </span>
                                )}
                            </TableCell>
                            <TableCell>
                              {canPerformAction(user) ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEdit(user)}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </Button>
                                  {user.id !== currentUser.id && ( // Prevent deactivating/deleting self
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => confirmToggleStatus(user)}
                                      className={isActive
                                        ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                        : "text-green-600 hover:text-green-700 hover:bg-green-50"
                                      }
                                    >
                                      {isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                    </Button>
                                  )}
                                  {currentUser.system_role === 'Admin' && user.id !== currentUser.id && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => confirmDelete(user)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">No actions</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {users.length === 0 && !isLoading && !hasPermissionError && (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Users Found</h3>
                <p className="text-gray-500 mb-6">Add new users using the "Add New User" button.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

function UserSlotEditor({ user, onUpdate, onCancel }) {
  const [slots, setSlots] = useState({
    VIP: user.registration_slots?.VIP || 0,
    Partner: user.registration_slots?.Partner || 0,
    Exhibitor: user.registration_slots?.Exhibitor || 0,
    Media: user.registration_slots?.Media || 0
  });

  const attendeeTypes = ["VIP", "Partner", "Exhibitor", "Media"];

  const handleSlotChange = (type, value) => {
    setSlots(prev => ({
      ...prev,
      [type]: parseInt(value) || 0
    }));
  };

  const handleSave = () => {
    onUpdate(user.id, slots);
  };

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold mb-2 block">Edit Registration Slots for {user.preferred_name || user.email}</Label>
      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
        {attendeeTypes.map((type) => (
          <div key={type} className="flex items-center justify-between">
            <Label className="text-sm">{type}</Label>
            <Input
              type="number"
              min="0"
              className="w-20"
              value={slots[type] || 0}
              onChange={(e) => handleSlotChange(type, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save Slots
        </Button>
      </div>
    </div>
  );
}
