
import React, { useState, useEffect, useCallback } from "react";
import { Attendee, User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import NotificationService from "@/services/notificationService";
import {
  Search,
  Filter,
  Download,
  UserPlus,
  Check,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Mail,
  Phone,
  Building,
  MapPin,
  User as UserIcon, // Renamed to avoid conflict with entity User
  Edit3, // Added Edit3 icon for the edit button
  Info, // Added Info icon for alert
  Printer, // Added Printer icon
  FileBadge, // Added FileBadge icon
  FileQuestion, // Added FileQuestion icon
  FileText, // Added FileText icon for PDF
  ExternalLink, // Added ExternalLink icon
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox"; // Added Checkbox import
import { format } from "date-fns";
import ProtectedRoute from "../components/common/ProtectedRoute";
import { sendModificationRequestEmail } from "@/api/functions"; // Added new import
import { sendWelcomeEmail } from "@/api/functions"; // Added import for sendWelcomeEmail
import { useToast } from "../components/common/Toast";
import { EmailTemplate } from "@/api/entities"; // Added import for EmailTemplate

const statusColors = {
  pending: "bg-orange-100 text-orange-800 border-orange-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  declined: "bg-red-100 text-red-800 border-red-200",
  change_requested: "bg-yellow-100 text-yellow-800 border-yellow-200"
};

const typeColors = {
  "VIP": "bg-purple-100 text-purple-800",
  "Partner": "bg-pink-100 text-pink-800",
  "Exhibitor": "bg-cyan-100 text-cyan-800",
  "Media": "bg-yellow-100 text-yellow-800"
};

const exportToCsv = (filename, rows) => {
  if (!rows || !rows.length) {
    return;
  }
  const separator = ',';
  const keys = Object.keys(rows[0]);

  const csvContent = [
    keys.map(key => `"${key.replace(/"/g, '""')}"`).join(separator),
    ...rows.map(row => keys.map(k => {
      let cell = row[k] === null || row[k] === undefined ? '' : row[k];
      if (cell instanceof Date) {
        cell = cell.toISOString();
      } else if (Array.isArray(cell)) {
        cell = cell.join('; ');
      } else {
        cell = String(cell);
      }
      
      if (cell.includes('"') || cell.includes(separator) || cell.includes('\n') || cell.includes('\r')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(separator))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function Attendees() {
  const [attendees, setAttendees] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [filteredAttendees, setFilteredAttendees] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [registererFilter, setRegistererFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  
  // New state variables for modification request feature
  const [showModificationDialog, setShowModificationDialog] = useState(false);
  const [modificationFields, setModificationFields] = useState([]);
  const [modificationNote, setModificationNote] = useState("");
  const [isSendingModification, setIsSendingModification] = useState(false);

  // New state for image lightbox
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      // Only full Admins can see all users - not Super Users
      const canSeeAllUsers = user.role === 'admin' || user.system_role === 'Admin';
      
      let usersData = [];
      if (canSeeAllUsers) {
        try {
          usersData = await User.list();
        } catch (userError) {
          console.warn("Could not load users for filter:", userError);
          // Continue without user data for filtering
        }
      }
      setAllUsers(usersData);

      // Check if user can see all attendees or only their own
      const canSeeAllAttendees = user.role === 'admin' || 
                                 user.system_role === 'Admin' || 
                                 user.system_role === 'Super User';
      
      let attendeesData = [];
      if (canSeeAllAttendees) {
        // Admin/Super User: Get all attendees
        attendeesData = await Attendee.list("-created_at");
      } else {
        // Regular User: Only get attendees they registered
        attendeesData = await Attendee.getByRegisteredBy(user.id);
      }
      
      setAttendees(attendeesData);
      
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const getUserDisplayName = (userId) => {
    if (!userId) return 'System';
    const user = allUsers.find(u => u.id === userId);
    if (!user) return 'Unknown User';
    return user.preferred_name || user.full_name || user.email || 'Unknown User';
  };

  const getRegistererName = (attendee) => {
    // Check if registration was via invitation
    if (attendee.registration_method === 'invitation') {
      return 'Invitation';
    }

    // Note: attendee.created_by might store email, attendee.registered_by stores user ID
    // If created_by is an email that matches a user, or registered_by is a user ID
    const registeredByUser = allUsers.find(u => u.id === attendee.registered_by);
    if (registeredByUser) {
        return registeredByUser.preferred_name || registeredByUser.full_name || registeredByUser.email;
    }
    const createdByUserEmail = allUsers.find(u => u.email === attendee.created_by);
    if (createdByUserEmail) {
        return createdByUserEmail.preferred_name || createdByUserEmail.full_name || createdByUserEmail.email;
    }
    return attendee.created_by || 'System'; // Fallback to email string or 'System'
  };

  const canEditAttendee = (attendee) => {
    if (!currentUser) return false;
    
    const isAdmin = currentUser.role === 'admin' || currentUser.system_role === 'Admin';
    const isCreator = attendee.created_by === currentUser.email || attendee.registered_by === currentUser.id;
    
    // Admins can edit any attendee at any time
    if (isAdmin) return true;
    
    // Regular users can only edit their own attendees if they are pending
    return isCreator && attendee.status === 'pending';
  };

  // Updated logic for canRequestModification: only admins and super users with access can request modifications for pending invitation registrations
  const canRequestModification = (attendee) => {
    if (!currentUser) return false;
    
    const isAdmin = currentUser.role === 'admin' || currentUser.system_role === 'Admin';
    const isSuperUserWithAccess = currentUser.system_role === 'Super User' && currentUser.has_access;
    // Only admins and super users with access can request modifications for pending invitation registrations
    return (isAdmin || isSuperUserWithAccess) && attendee.status === 'pending' && attendee.registration_method === 'invitation';
  };

  const availableFields = [
    { key: 'personal_info', label: 'Personal Information', fields: ['title', 'first_name', 'last_name', 'date_of_birth', 'nationality', 'country_of_residence', 'religion'] },
    { key: 'contact_info', label: 'Contact Information', fields: ['email', 'mobile_number'] },
    { key: 'professional_info', label: 'Professional Information', fields: ['organization', 'job_title', 'level', 'work_address', 'work_city', 'work_country', 'linkedin_account'] },
    { key: 'documents', label: 'Documents & Photos', fields: ['face_photo_url', 'id_photo_url', 'id_type'] },
  ];

  const handleRequestModification = async () => {
    if (!selectedAttendee || modificationFields.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one section that needs modification.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingModification(true);
    try {
      // First update the attendee status to "change_requested"
      await Attendee.update(selectedAttendee.id, { status: 'change_requested' });
      
      // Create notification for admins about the modification request
      try {
        await NotificationService.notifyAttendeeModificationRequested(selectedAttendee, currentUser);
      } catch (notificationError) {
        console.error('Failed to create notification for attendee modification request:', notificationError);
        // Don't fail the request if notification fails
      }

      // Create modification link with production domain
      const modificationUrl = `https://www.pis.futuremineralsforum.com.sa${createPageUrl(`PublicRegistration?modify=${selectedAttendee.id}`)}`;
      
      // Create attendee info table HTML
      const attendeeInfoHtml = `
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f8fafc;">
            <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: left;">Field</th>
            <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: left;">Current Value</th>
          </tr>
          <tr><td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: bold;">Name</td><td style="border: 1px solid #e5e7eb; padding: 8px;">${selectedAttendee.title || ''} ${selectedAttendee.first_name || ''} ${selectedAttendee.last_name || ''}</td></tr>
          <tr><td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: bold;">Email</td><td style="border: 1px solid #e5e7eb; padding: 8px;">${selectedAttendee.email || ''}</td></tr>
          <tr><td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: bold;">Organization</td><td style="border: 1px solid #e5e7eb; padding: 8px;">${selectedAttendee.organization || 'Not provided'}</td></tr>
          <tr><td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: bold;">Job Title</td><td style="border: 1px solid #e5e7eb; padding: 8px;">${selectedAttendee.job_title || 'Not provided'}</td></tr>
          <tr><td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: bold;">Attendee Type</td><td style="border: 1px solid #e5e7eb; padding: 8px;">${selectedAttendee.attendee_type || ''}</td></tr>
          <tr><td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: bold;">Nationality</td><td style="border: 1px solid #e5e7eb; padding: 8px;">${selectedAttendee.nationality || ''}</td></tr>
        </table>
      `;

      const fieldsToModify = modificationFields.map(f => availableFields.find(af => af.key === f)?.label).join(', ');

      const noteBlockHtml = modificationNote ? `<p style="margin: 15px 0 5px 0;"><strong>Additional Notes:</strong></p><p style="margin: 5px 0;">${modificationNote}</p>` : '';

      // Fetch the email template
      const templates = await EmailTemplate.filter({ name: 'modification_request' });
      const template = templates?.[0];

      if (!template) {
        throw new Error('Modification request email template not found');
      }

      // Check if the email template is active
      if (!template.is_active) {
        console.log('Modification request email template is disabled, skipping email send');
        toast({
          title: "Email Disabled",
          description: "Modification request email template is currently disabled.",
          variant: "warning",
        });
        return;
      }

      let emailSubject = template.subject;
      let emailBody = template.body
        .replace(/{{first_name}}/g, selectedAttendee.first_name || '')
        .replace(/{{last_name}}/g, selectedAttendee.last_name || '')
        .replace(/{{fields_to_modify}}/g, fieldsToModify)
        .replace(/{{modification_note_block}}/g, noteBlockHtml)
        .replace(/{{attendee_info_html}}/g, attendeeInfoHtml)
        .replace(/{{modification_url}}/g, modificationUrl);

      await sendModificationRequestEmail({
        to: selectedAttendee.email,
        subject: emailSubject,
        body: emailBody
      });

      toast({
        title: "Success",
        description: `Modification request sent successfully to ${selectedAttendee.email}`,
        variant: "success",
      });
      
      setShowModificationDialog(false);
      setModificationFields([]);
      setModificationNote("");
      loadData(); // Reload data to reflect status change
    } catch (error) {
      console.error("Failed to send modification request:", error);
      toast({
        title: "Error",
        description: "Failed to send modification request. Please try again.",
        variant: "destructive",
      });
    }
    setIsSendingModification(false);
  };


  const handleExport = () => {
    const dataToExport = filteredAttendees.map(a => ({
      // Basic Information
      'ID': a.id,
      'REFERENCE': a.id.slice(-8).toUpperCase(),
      'ATTENDEE TYPE': a.attendee_type,
      'STATUS': a.status,
      'REGISTRATION METHOD': a.registration_method || 'manual',
      'DATE CREATED': format(new Date(a.created_at), 'yyyy-MM-dd HH:mm'),
      'DATE UPDATED': a.updated_at ? format(new Date(a.updated_at), 'yyyy-MM-dd HH:mm') : '',
      
      // Personal Information
      'TITLE': a.title || '',
      'FIRST NAME': a.first_name,
      'LAST NAME': a.last_name,
      'EMAIL': a.email,
      'MOBILE NUMBER': a.mobile_number || '',
      'COUNTRY CODE': a.country_code || '',
      'NATIONALITY': a.nationality || '',
      'COUNTRY OF RESIDENCE': a.country_of_residence || '',
      'DATE OF BIRTH': a.date_of_birth ? format(new Date(a.date_of_birth), 'yyyy-MM-dd') : '',
      'RELIGION': a.religion || '',
      
      // Professional Information
      'ORGANIZATION': a.organization || '',
      'JOB TITLE': a.job_title || '',
      'LEVEL': a.level || '',
      'LEVEL SPECIFY': a.level_specify || '',
      'WORK ADDRESS': a.work_address || '',
      'WORK CITY': a.work_city || '',
      'WORK COUNTRY': a.work_country || '',
      'LINKEDIN ACCOUNT': a.linkedin_account || '',
      
      // ID Information
      'ID TYPE': a.id_type || '',
      'ID NUMBER': a.id_number || '',
      'ISSUE DATE': (a.id_type === 'Passport' && a.issue_date) ? format(new Date(a.issue_date), 'yyyy-MM-dd') : '',
      'EXPIRY DATE': a.expiry_date ? format(new Date(a.expiry_date), 'yyyy-MM-dd') : '',
      'ISSUE PLACE': a.issue_place || '',
      'NEED VISA': a.need_visa ? 'Yes' : 'No',
      
      // Photos and Documents
      'FACE PHOTO URL': a.face_photo_url || '',
      'ID PHOTO URL': a.id_photo_url || '',
      
      // Survey Information
      'AREAS OF INTEREST': a.areas_of_interest?.join('; ') || '',
      'PRIMARY NATURE OF BUSINESS': a.primary_nature_of_business || '',
      'PREVIOUS ATTENDANCE': a.previous_attendance ? 'Yes' : 'No',
      'PREVIOUS YEARS': a.previous_years?.join('; ') || '',
      
      // System Information
      'REGISTERED BY': getRegistererName(a),
      'BADGE GENERATED': a.badge_generated ? 'Yes' : 'No',
      'BADGE QR CODE': a.badge_qr_code || '',
      'MODIFICATION TOKEN': a.modification_token || '',
    }));
    exportToCsv(`attendees-${new Date().toISOString().split('T')[0]}.csv`, dataToExport);
  };

  const applyFilters = useCallback(() => {
    let filtered = [...attendees];

    if (searchTerm) {
      const lowercasedSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(attendee =>
        attendee.first_name?.toLowerCase().includes(lowercasedSearch) ||
        attendee.last_name?.toLowerCase().includes(lowercasedSearch) ||
        attendee.email?.toLowerCase().includes(lowercasedSearch) ||
        attendee.organization?.toLowerCase().includes(lowercasedSearch) ||
        (attendee.id && attendee.id.slice(-8).toLowerCase().includes(lowercasedSearch))
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(attendee => attendee.status === statusFilter);
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(attendee => attendee.attendee_type === typeFilter);
    }

    // Apply registerer filter only if currentUser is a full admin with access to all users
    if ((currentUser?.role === 'admin' || currentUser?.system_role === 'Admin') && registererFilter !== "all" && allUsers.length > 0) {
      if (registererFilter === 'invitation') {
        // Filter for invitation registrations
        filtered = filtered.filter(attendee => attendee.registration_method === 'invitation');
      } else {
        // Filter by user ID
        filtered = filtered.filter(attendee => {
          const registererUserId = attendee.registered_by || attendee.created_by;
          return registererUserId === registererFilter;
        });
      }
    }

    setFilteredAttendees(filtered);
    setCurrentPage(1);
  }, [attendees, searchTerm, statusFilter, typeFilter, registererFilter, currentUser, allUsers]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const updateAttendeeStatus = async (attendeeId, newStatus) => {
    try {
      const attendeeToUpdate = attendees.find(a => a.id === attendeeId);
      await Attendee.update(attendeeId, { status: newStatus });
      
      // Send approval welcome email when status changes to approved
      if (newStatus === 'approved' && attendeeToUpdate) {
        try {
          await sendWelcomeEmail({ 
            attendeeData: {
              ...attendeeToUpdate,
              id: attendeeId
            }
          });
        } catch (emailError) {
          console.error("Failed to send approval welcome email:", emailError);
          toast({
            title: "Status Updated",
            description: `Attendee approved successfully, but welcome email could not be sent.`,
            variant: "warning",
          });
        }
      }
      
      loadData();
      toast({
        title: "Status Updated",
        description: `Attendee status changed to ${newStatus}.`,
        variant: "success",
      });
      if (newStatus === 'approved' || newStatus === 'declined') {
        setShowDetailsDialog(false);
      }
    } catch (error) {
      console.error("Error updating attendee status:", error);
      toast({
        title: "Error",
        description: "Failed to update attendee status.",
        variant: "destructive",
      });
    }
  };

  const handleRowClick = (attendee) => {
    setSelectedAttendee(attendee);
    setShowDetailsDialog(true);
  };

  const isPdfFile = (url) => {
    if (!url) return false;
    return url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf');
  };

  const handleImageClick = (url) => {
    if (!url) return;
    setEnlargedImageUrl(url);
    setShowImageDialog(true);
  };
  
  const handlePrint = () => {
    if (!selectedAttendee) return;

    const {
        title, first_name, last_name, email, mobile_number, country_code, nationality, country_of_residence,
        organization, job_title, level, linkedin_account, work_address, work_city, work_country,
        id_type, id_number, expiry_date, issue_place, need_visa,
        date_of_birth, religion, face_photo_url, id_photo_url, status, attendee_type,
        areas_of_interest, primary_nature_of_business, previous_attendance, previous_years,
        registration_method, created_at
    } = selectedAttendee;
    
    const isIdPdf = isPdfFile(id_photo_url);

    const printHtml = `
      <html>
        <head>
          <title>Attendee Profile - ${first_name || ''} ${last_name || ''}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Inter', sans-serif; color: #1f2937; margin: 0; background-color: #f8fafc; }
            .page { padding: 1.5rem; }
            .page-container { max-width: 800px; margin: auto; background-color: #fff; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            
            .print-top-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; padding: 1rem; margin-bottom: 1.5rem; }
            .print-top-bar img { height: 50px; }
            .print-top-bar h1 { font-size: 1.25rem; font-weight: 700; color: #111827; margin: 0; }

            .approval-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding: 0 1.5rem; }
            .qr-code-print-container { text-align: center; border: 1px dashed #e5e7eb; padding: 0.5rem; border-radius: 0.5rem; }
            .qr-code-print-container img { width: 100px; height: 100px; margin: 0 auto; display: block; }
            .qr-code-ref { font-family: monospace; font-size: 1rem; letter-spacing: 2px; color: #111827; margin: 0.25rem 0 0 0; }
            .approval-status-container { text-align: right; }
            .approval-status-badge { font-size: 1.5rem; padding: 0.75rem 1.5rem; font-weight: 700; border-radius: 9999px; }


            .profile-header { display: flex; gap: 1.5rem; align-items: center; margin-bottom: 1.5rem; padding: 0 1.5rem; }
            .profile-photo { width: 120px; height: 120px; object-fit: cover; border-radius: 0.5rem; border: 1px solid #e5e7eb; }
            .profile-info h2 { font-size: 2rem; font-weight: 700; margin: 0 0 0.5rem 0; }
            .badge-container { display: flex; flex-wrap: wrap; gap: 0.5rem; }
            .badge { display: inline-block; padding: 0.25rem 0.75rem; font-size: 0.8rem; font-weight: 600; border-radius: 9999px; border: 1px solid; }
            .status-approved { background-color: #dcfce7; color: #166534; border-color: #bbf7d0; }
            .status-pending { background-color: #ffedd5; color: #9a3412; border-color: #fed7aa; }
            .status-declined { background-color: #fee2e2; color: #991b1b; border-color: #fecaca; }
            .status-change_requested { background-color: #fef9c3; color: #854d0e; border-color: #fde68a; }
            .type-vip { background-color: #f3e8ff; color: #6b21a8; border-color: #e9d5ff; }
            .type-partner { background-color: #fce7f3; color: #be185d; border-color: #f9a8d4; }
            .type-exhibitor { background-color: #cffafe; color: #0e7490; border-color: #a5f3fc; }
            .type-media { background-color: #fef9c3; color: #854d0e; border-color: #fde68a; }
            .section { margin-bottom: 1.5rem; padding: 0 1.5rem; break-inside: avoid; }
            .section-title { font-size: 1.1rem; font-weight: 600; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem; margin-bottom: 1rem; color: #1e3a8a; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem 1.5rem; }
            .grid-item { break-inside: avoid; margin-bottom: 0.5rem;}
            .grid-item label { display: block; font-size: 0.8rem; font-weight: 600; color: #4b5563; margin-bottom: 0.25rem; }
            .grid-item p { margin: 0; font-size: 0.9rem; color: #111827; word-break: break-word; }
            .full-width { grid-column: 1 / -1; }
            .id-photo { max-width: 100%; height: auto; border-radius: 0.5rem; margin-top: 0.5rem; border: 1px solid #e5e7eb; }
            .list { padding-left: 1.25rem; margin: 0; list-style-type: disc; color: #111827; }
            .list li { margin-bottom: 0.25rem; font-size: 0.9rem;}
            a { color: #2563eb; text-decoration: underline; }

            @media print {
              html, body {
                background-color: #fff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                margin: 0;
                padding: 0;
              }
              .page { padding: 0.5rem; }
              .page-container { border: none; box-shadow: none; margin: 0; }
              .print-top-bar, .profile-header, .section { padding: 0.5rem 1.5rem; }
              .print-top-bar { border-bottom: 1px solid #eee; margin-bottom: 1rem; }
              .section-title { border-bottom-color: #a3a3a3; }
              .qr-code-print-container { border: 1px dashed #ddd; }
              
              @page {
                margin: 0.5in;
                @top-right {
                  content: "Page " counter(page);
                }
              }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="page-container">
              <div class="print-top-bar">
                <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68c956d6c6a36ced0b9be9eb/cbe09abb4_FMF_logo-02-01.png" alt="FMF Logo" />
                <h1>Attendee Profile</h1>
              </div>

              ${status === 'approved' ? `
                <div class="approval-section">
                  <div class="qr-code-print-container">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?data=${selectedAttendee.id.slice(-8).toUpperCase()}&size=150x150&qzone=1" alt="QR Code" />
                    <p class="qr-code-ref">${selectedAttendee.id.slice(-8).toUpperCase()}</p>
                  </div>
                  <div class="approval-status-container">
                    <span class="badge status-approved approval-status-badge">APPROVED</span>
                  </div>
                </div>
              ` : ''}

              <div class="profile-header">
                <img src="${face_photo_url || 'https://via.placeholder.com/120'}" alt="Attendee Photo" class="profile-photo" />
                <div class="profile-info">
                  <h2>${title || ''} ${first_name || ''} ${last_name || ''}</h2>
                  <div class="badge-container">
                    <span class="badge status-${status || 'pending'}">${status ? status.replace('_', ' ') : 'N/A'}</span>
                    <span class="badge type-${attendee_type ? attendee_type.toLowerCase().replace(/\s/g, '_') : 'delegate'}">${attendee_type || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div class="section">
                <h3 class="section-title">Contact & Registration</h3>
                <div class="grid">
                  <div class="grid-item"><label>Email</label><p>${email || 'N/A'}</p></div>
                  <div class="grid-item"><label>Mobile</label><p>${country_code ? `${country_code} ` : ''}${mobile_number || 'N/A'}</p></div>
                  <div class="grid-item"><label>Registered By</label><p>${getRegistererName(selectedAttendee) || 'N/A'}</p></div>
                  <div class="grid-item"><label>Registration Date</label><p>${created_at ? format(new Date(created_at), 'PPP p') : 'N/A'}</p></div>
                </div>
              </div>

              <div class="section">
                <h3 class="section-title">Personal Information</h3>
                <div class="grid">
                  <div class="grid-item"><label>Nationality</label><p>${nationality || 'N/A'}</p></div>
                  <div class="grid-item"><label>Country of Residence</label><p>${country_of_residence || 'N/A'}</p></div>
                  <div class="grid-item"><label>Date of Birth</label><p>${date_of_birth ? format(new Date(date_of_birth), 'PPP') : 'N/A'}</p></div>
                  <div class="grid-item"><label>Religion</label><p>${religion || 'N/A'}</p></div>
                </div>
              </div>

              <div class="section">
                <h3 class="section-title">Professional Information</h3>
                <div class="grid">
                  <div class="grid-item"><label>Organization</label><p>${organization || 'N/A'}</p></div>
                  <div class="grid-item"><label>Job Title</label><p>${job_title || 'N/A'}</p></div>
                  <div class="grid-item"><label>Level</label><p>${level || 'N/A'}</p></div>
                  <div class="grid-item full-width"><label>LinkedIn</label><p>${linkedin_account ? `<a href="${linkedin_account}" target="_blank">${linkedin_account}</a>` : 'N/A'}</p></div>
                  <div class="grid-item full-width"><label>Work Address</label><p>${work_address || ''}${work_city ? `, ${work_city}` : ''}${work_country ? `, ${work_country}` : ''}</p></div>
                </div>
              </div>

              <div class="section">
                <h3 class="section-title">ID & Document Information</h3>
                <div class="grid">
                  <div class="grid-item"><label>ID Type</label><p>${id_type || 'N/A'}</p></div>
                  <div class="grid-item"><label>ID Number</label><p>${id_number || 'N/A'}</p></div>
                  ${id_type === 'Passport' ? `
                  <div class="grid-item"><label>Expiry Date</label><p>${expiry_date ? format(new Date(expiry_date), 'PPP') : 'N/A'}</p></div>
                  <div class="grid-item"><label>Issue Place</label><p>${issue_place || 'N/A'}</p></div>
                  <div class="grid-item"><label>Needs Visa</label><p>${need_visa ? 'Yes' : 'No'}</p></div>
                  ` : ''}
                  <div class="grid-item full-width">
                    <label>ID Document</label>
                    ${id_photo_url ? (isIdPdf ? `<p><a href="${id_photo_url}" target="_blank">View PDF Document</a></p>` : `<img src="${id_photo_url}" alt="ID Document" class="id-photo" />`) : '<p>N/A</p>'}
                  </div>
                </div>
              </div>
              
              <div class="section">
                <h3 class="section-title">Business & Survey Information</h3>
                <div class="grid full-width">
                  <div class="grid-item"><label>Primary Nature of Business</label><p>${primary_nature_of_business || 'N/A'}</p></div>
                  <div class="grid-item">
                    <label>Areas of Interest</label>
                    ${(areas_of_interest && areas_of_interest.length > 0) ? `<ul class="list">${areas_of_interest.map(item => `<li>${item}</li>`).join('')}</ul>` : '<p>N/A</p>'}
                  </div>
                  <div class="grid-item">
                    <label>Previous Attendance</label>
                    <p>${previous_attendance ? `Yes (${(previous_years || []).join(', ')})` : 'No'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const totalPages = Math.ceil(filteredAttendees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAttendees = filteredAttendees.slice(startIndex, startIndex + itemsPerPage);

  // Get unique registerers for filter dropdown (only relevant if current user is full admin)
  const uniqueRegisterers = [...new Set(attendees.map(a => {
    if (a.registration_method === 'invitation') {
      return 'invitation';
    }
    return a.registered_by || a.created_by;
  }).filter(Boolean))]
    .map(userId => {
      if (userId === 'invitation') {
        return { id: 'invitation', name: 'Invitation' };
      }
      const user = allUsers.find(u => u.id === userId || u.email === userId);
      return {
        id: userId,
        name: user ? (user.preferred_name || user.full_name || user.email) : 'Unknown User'
      };
    });

  const canSeeAll = currentUser?.role === 'admin' || currentUser?.system_role === 'Admin' || currentUser?.system_role === 'Super User';
  const canSeeAllUsers = currentUser?.role === 'admin' || currentUser?.system_role === 'Admin';

  return (
    <ProtectedRoute pageName="Attendees">
      <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {canSeeAll ? 'All Attendees' : 'My Attendees'}
              </h1>
              <p className="text-gray-500 mt-1">
                {canSeeAll
                  ? 'Manage forum attendee registrations' 
                  : 'View and manage your registered attendees'
                }
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex items-center gap-2" onClick={handleExport}>
                <Download className="w-4 h-4" />
                Export
              </Button>
              {!canSeeAll && (
                <Link to={createPageUrl("Registration")} className="inline-block">
                  <Button className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Register Attendee
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search by name, email, organization, or reference #"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                      <SelectItem value="change_requested">Change Requested</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="VIP">VIP</SelectItem>
                      <SelectItem value="Partner">Partner</SelectItem>
                      <SelectItem value="Exhibitor">Exhibitor</SelectItem>
                      <SelectItem value="Media">Media</SelectItem>
                    </SelectContent>
                  </Select>

                  {canSeeAllUsers && allUsers.length > 0 && (
                    <Select value={registererFilter} onValueChange={setRegistererFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Registerer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Registerers</SelectItem>
                        {uniqueRegisterers.map((registerer) => (
                          <SelectItem key={registerer.id} value={registerer.id}>
                            {registerer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendee Details Dialog */}
          <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Attendee Details</DialogTitle>
              </DialogHeader>

              {selectedAttendee && (
                <div>
                  <div id="attendee-details-printable" className="space-y-6 p-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                      {/* Personal Information */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <UserIcon className="w-5 h-5" />
                            Personal Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center gap-4 mb-4">
                            <Avatar className="w-24 h-24 cursor-pointer" onClick={() => handleImageClick(selectedAttendee.face_photo_url)}>
                              <AvatarImage src={selectedAttendee.face_photo_url} />
                              <AvatarFallback className="bg-blue-100 text-blue-600 text-2xl font-semibold">
                                {selectedAttendee.first_name?.[0]}{selectedAttendee.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="text-2xl font-bold">
                                {selectedAttendee.title} {selectedAttendee.first_name} {selectedAttendee.last_name}
                              </h3>
                              <div className="flex gap-2 mt-2">
                                <Badge className={statusColors[selectedAttendee.status]}>
                                  {selectedAttendee.status}
                                </Badge>
                                <Badge className={typeColors[selectedAttendee.attendee_type] || "bg-gray-100 text-gray-800"}>
                                  {selectedAttendee.attendee_type}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-gray-500" />
                              <span className="text-sm text-gray-600">Email:</span>
                              <span className="font-medium">{selectedAttendee.email}</span>
                            </div>

                            {selectedAttendee.mobile_number && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-gray-500" />
                                <span className="text-sm text-gray-600">Mobile:</span>
                                <span className="font-medium">{selectedAttendee.country_code} {selectedAttendee.mobile_number}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-gray-500" />
                              <span className="text-sm text-gray-600">Nationality:</span>
                              <span className="font-medium">{selectedAttendee.nationality}</span>
                            </div>

                            {selectedAttendee.country_of_residence && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-500" />
                                <span className="text-sm text-gray-600">Residence:</span>
                                <span className="font-medium">{selectedAttendee.country_of_residence}</span>
                              </div>
                            )}

                            {selectedAttendee.date_of_birth && (
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-500" />
                                <span className="text-sm text-gray-600">Date of Birth:</span>
                                <span className="font-medium">{format(new Date(selectedAttendee.date_of_birth), 'PPP')}</span>
                              </div>
                            )}

                            {selectedAttendee.religion && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">Religion:</span>
                                <span className="font-medium">{selectedAttendee.religion}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Professional Information */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Building className="w-5 h-5" />
                            Professional Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {selectedAttendee.organization && (
                            <div>
                              <span className="text-sm text-gray-600">Organization:</span>
                              <p className="font-medium">{selectedAttendee.organization}</p>
                            </div>
                          )}

                          {selectedAttendee.job_title && (
                            <div>
                              <span className="text-sm text-gray-600">Job Title:</span>
                              <p className="font-medium">{selectedAttendee.job_title}</p>
                            </div>
                          )}

                          {selectedAttendee.level && (
                            <div>
                              <span className="text-sm text-gray-600">Level:</span>
                              <p className="font-medium">{selectedAttendee.level}</p>
                            </div>
                          )}

                          {selectedAttendee.linkedin_account && (
                            <div>
                              <span className="text-sm text-gray-600">LinkedIn:</span>
                              <a href={selectedAttendee.linkedin_account} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                                {selectedAttendee.linkedin_account}
                              </a>
                            </div>
                          )}

                          {selectedAttendee.work_address && (
                            <div>
                              <span className="text-sm text-gray-600">Work Address:</span>
                              <p className="font-medium">{selectedAttendee.work_address}</p>
                              {selectedAttendee.work_city && (
                                <p className="text-sm text-gray-500">{selectedAttendee.work_city}, {selectedAttendee.work_country}</p>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* ID Information */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <FileBadge className="w-5 h-5" />
                            ID Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {selectedAttendee.id_type && (
                            <div>
                              <span className="text-sm text-gray-600">ID Type:</span>
                              <p className="font-medium">{selectedAttendee.id_type}</p>
                            </div>
                          )}

                          {selectedAttendee.id_number && (
                            <div>
                              <span className="text-sm text-gray-600">{selectedAttendee.id_type} Number:</span>
                              <p className="font-medium">{selectedAttendee.id_number}</p>
                            </div>
                          )}


                          {selectedAttendee.id_type === 'Passport' && (
                            <>
                              {selectedAttendee.expiry_date && (
                                <div>
                                  <span className="text-sm text-gray-600">Expiry Date:</span>
                                  <p className="font-medium">{format(new Date(selectedAttendee.expiry_date), 'PPP')}</p>
                                </div>
                              )}
                              {selectedAttendee.issue_place && (
                                <div>
                                  <span className="text-sm text-gray-600">Issue Place:</span>
                                  <p className="font-medium">{selectedAttendee.issue_place}</p>
                                </div>
                              )}
                              <div>
                                <span className="text-sm text-gray-600">Needs Visa:</span>
                                <Badge variant="outline" className="ml-2">{selectedAttendee.need_visa ? 'Yes' : 'No'}</Badge>
                              </div>
                            </>
                          )}
                          
                          {selectedAttendee.id_photo_url && (
                            <div>
                              <span className="text-sm text-gray-600">ID Document:</span>
                              {isPdfFile(selectedAttendee.id_photo_url) ? (
                                <div className="mt-2 p-4 border rounded-lg bg-red-50">
                                  <div className="flex items-center gap-3">
                                    <FileText className="w-8 h-8 text-red-600" />
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900">PDF Document</p>
                                      <p className="text-sm text-gray-600">ID document uploaded as PDF</p>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => window.open(selectedAttendee.id_photo_url, '_blank')}
                                      className="flex items-center gap-2"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                      Review PDF
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <img 
                                  src={selectedAttendee.id_photo_url} 
                                  alt="ID" 
                                  className="w-full h-auto object-cover rounded border mt-2 cursor-pointer" 
                                  onClick={() => handleImageClick(selectedAttendee.id_photo_url)} 
                                />
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Survey and Business Information */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <FileQuestion className="w-5 h-5" />
                            Survey & Business Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {selectedAttendee.primary_nature_of_business && (
                            <div>
                              <span className="text-sm text-gray-600">Primary Nature of Business:</span>
                              <p className="font-medium">{selectedAttendee.primary_nature_of_business}</p>
                            </div>
                          )}

                          {selectedAttendee.areas_of_interest?.length > 0 && (
                            <div>
                              <span className="text-sm text-gray-600">Areas of Interest:</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {selectedAttendee.areas_of_interest.map(interest => (
                                  <Badge key={interest} variant="secondary">{interest}</Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <span className="text-sm text-gray-600">Previous Attendance:</span>
                            <Badge variant="outline" className="ml-2">
                              {selectedAttendee.previous_attendance ? `Yes (${selectedAttendee.previous_years?.join(', ') || ''})` : 'No'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Registration Information & QR Code */}
                      <div className="space-y-6">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Registration Information</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <span className="text-sm text-gray-600">Registration Method:</span>
                              <Badge variant="outline" className="ml-2">
                                {selectedAttendee.registration_method || 'Manual'}
                              </Badge>
                            </div>

                            <div>
                              <span className="text-sm text-gray-600">Registered By:</span>
                              <p className="font-medium">{getRegistererName(selectedAttendee)}</p>
                            </div>

                            <div>
                              <span className="text-sm text-gray-600">Registration Date:</span>
                              <p className="font-medium">{format(new Date(selectedAttendee.created_at), 'PPP p')}</p>
                            </div>
                          </CardContent>
                        </Card>
                        
                        {selectedAttendee.status === 'approved' && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Badge QR Code</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center justify-center space-y-4">
                              <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?data=${selectedAttendee.id.slice(-8).toUpperCase()}&size=150x150&qzone=1`}
                                alt="Attendee QR Code"
                                className="w-40 h-40 border p-1 rounded-lg bg-white"
                              />
                              <div className="text-center">
                                <p className="text-sm text-gray-500">Reference #:</p>
                                <p className="font-mono text-xl font-semibold tracking-widest text-gray-800">
                                  {selectedAttendee.id.slice(-8).toUpperCase()}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    {((currentUser?.role === 'admin' || currentUser?.system_role === 'Admin') || (currentUser?.system_role === 'Super User' && currentUser?.has_access)) && selectedAttendee.status === 'pending' && (
                      <div className="flex gap-3">
                        <Button 
                          onClick={() => updateAttendeeStatus(selectedAttendee.id, 'approved')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button 
                          onClick={() => updateAttendeeStatus(selectedAttendee.id, 'declined')}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    )}
                    {canEditAttendee(selectedAttendee) && (
                      <Link to={createPageUrl(`Registration?id=${selectedAttendee.id}`)}>
                        <Button
                          variant="outline"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit3 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      </Link>
                    )}
                    {canRequestModification(selectedAttendee) && (
                      <Button
                        variant="outline"
                        onClick={() => setShowModificationDialog(true)}
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Request Modification
                      </Button>
                    )}
                    <Button variant="outline" onClick={handlePrint}>
                      <Printer className="w-4 h-4 mr-2" />
                      Print
                    </Button>
                    <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Image Viewer Dialog */}
          <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
            <DialogContent className="max-w-4xl p-0 bg-transparent border-0 shadow-none">
              <img src={enlargedImageUrl} alt="Enlarged attendee" className="w-full h-auto rounded-lg" />
            </DialogContent>
          </Dialog>

          {/* Modification Request Dialog */}
          <Dialog open={showModificationDialog} onOpenChange={setShowModificationDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Request Registration Modification</DialogTitle>
                <p className="text-sm text-gray-600">
                  Send an email to {selectedAttendee?.email} requesting modifications to their registration.
                </p>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div>
                  <Label className="text-base font-semibold">Select sections that need modification:</Label>
                  <div className="mt-3 space-y-3">
                    {availableFields.map((field) => (
                      <div key={field.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={field.key}
                          checked={modificationFields.includes(field.key)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setModificationFields(prev => [...prev, field.key]);
                            } else {
                              setModificationFields(prev => prev.filter(f => f !== field.key));
                            }
                          }}
                        />
                        <Label htmlFor={field.key} className="text-sm font-medium">
                          {field.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="modification_note">Additional Instructions (Optional)</Label>
                  <Textarea
                    id="modification_note"
                    placeholder="Provide specific details about what needs to be corrected or updated..."
                    value={modificationNote}
                    onChange={(e) => setModificationNote(e.target.value)}
                    rows={4}
                  />
                </div>
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    The attendee will receive an email with their current registration details and a secure link to make the requested modifications.
                  </AlertDescription>
                </Alert>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => {
                  setShowModificationDialog(false);
                  setModificationFields([]);
                  setModificationNote("");
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleRequestModification}
                  disabled={isSendingModification || modificationFields.length === 0}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isSendingModification ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Sending...
                    </div>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Modification Request
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Attendees Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Attendee List</span>
                <span className="text-sm font-normal text-gray-500">
                  {filteredAttendees.length} attendees
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Avatar/Type</TableHead> {/* Changed from Access Level to Avatar/Type for better representation */}
                      <TableHead>Category</TableHead>
                      <TableHead>Ref</TableHead>
                      <TableHead>Info</TableHead>
                      {/* <TableHead>Status</TableHead> */}
                      <TableHead>Registered By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array(5).fill(0).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={6} className="h-16">
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      paginatedAttendees.map((attendee) => (
                        <TableRow key={attendee.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleRowClick(attendee)}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={attendee.face_photo_url} />
                                <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                                  {attendee.first_name?.[0]}{attendee.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              {/* Removed duplicate Badge here to keep it concise, Category column handles it */}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={typeColors[attendee.attendee_type] || "bg-gray-100 text-gray-800"}>
                              {attendee.attendee_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {attendee.id.slice(-8).toUpperCase()}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-semibold text-sm">
                                {attendee.title} {attendee.first_name} {attendee.last_name}
                              </p>
                              <p className="text-xs text-blue-600">{attendee.email}</p>
                              {attendee.organization && (
                                <p className="text-xs text-gray-500">{attendee.organization}</p>
                              )}
                            </div>
                          </TableCell>
                          {/* <TableCell>
                            <Badge className={statusColors[attendee.status]}>
                              {attendee.status}
                            </Badge>
                          </TableCell> */}
                          <TableCell>
                            <div className="text-sm">
                              <span className="font-medium text-gray-700">
                                {getRegistererName(attendee)}
                              </span>
                              <p className="text-xs text-gray-500">
                                {format(new Date(attendee.created_at), 'MMM d, yyyy')}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              {((currentUser?.role === 'admin' || currentUser?.system_role === 'Admin') || (currentUser?.system_role === 'Super User' && currentUser?.has_access)) && attendee.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateAttendeeStatus(attendee.id, 'approved')}
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateAttendeeStatus(attendee.id, 'declined')}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => handleRowClick(attendee)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <div className="text-sm text-gray-500">
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredAttendees.length)} of {filteredAttendees.length} results
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="px-3 py-1 text-sm">{currentPage} of {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}
