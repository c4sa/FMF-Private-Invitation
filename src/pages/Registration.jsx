
import React, { useState, useEffect, useCallback } from "react";
import { Attendee, User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, AlertCircle, Edit3, CheckCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { sendWelcomeEmail } from "@/api/functions";
import PhotoUpload from "../components/registration/PhotoUpload";
import { countryCodes } from "../components/registration/countryCodes";
import { countries } from "../components/registration/countries";
import ProtectedRoute from "../components/common/ProtectedRoute";
import { useToast } from "../components/common/Toast";
import { handleDuplicateEmailError, getGenericErrorMessage } from "../utils/errorHandling";
import { emailService } from "../lib/resend";

const attendeeTypes = [
  "VIP", "Partner", "Exhibitor", "Media"
];

const titles = ["Mr.", "Ms.", "Miss.", "Mrs.", "Dr.", "H.E.", "Hon.", "H.R.H.", "H.H.", "Prof.", "Eng."];

const levels = [
  "C-suite Executive (CEO, CCO, CFO, CIO)",
  "Board Member / Chairperson", 
  "Government Official / Policy Leader",
  "President / Executive Director",
  "Institutional Investor / Fund Manager / Sovereign Wealth Representative",
  "Founder / Business Owner / Entrepreneur",
  "International Organization or Multilateral Representative (e.g., World Bank, UN, OECD)",
  "Manager / Associate / Director",
  "Employee / Technician",
  "Student / Trainee / Intern",
  "Other"
];

const idTypes = ["National ID", "Iqama", "Passport"];
const religions = ["Muslim", "Christian", "Other"];

const areasOfInterest = [
  "Analytical products",
  "Decarbonization", 
  "Digitalizations / AI / Technology",
  "Downstream and Processing",
  "Environmental / Social / Governance (ESG)",
  "Finance and Investment",
  "Hydrogen",
  "Green Metals",
  "Supply Chains",
  "Geopolitics / Policy / Global Economy",
  "Mineral and Metal",
  "Infrastructure",
  "Start-up"
];

const businessNatures = [
  "Association / NGO / Organization",
  "Education / Research",
  "Energy Company", 
  "Energy Services",
  "Finance / Investment",
  "Government",
  "Infrastructure / Logistic / Transport",
  "Machinery & Equipment",
  "Mining Company",
  "Mining Services / Supplier", 
  "Professional Services",
  "Student",
  "Technology",
  "Other"
];

export default function RegistrationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [editingId, setEditingId] = useState(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableSlots, setAvailableSlots] = useState({});
  const [emailError, setEmailError] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    title: '',
    first_name: '',
    last_name: '',
    email: '',
    confirm_email: '',
    mobile_number: '',
    country_code: '+966',
    nationality: '',
    country_of_residence: '',
    linkedin_account: '',
    organization: '',
    job_title: '',
    level: '',
    level_specify: '',
    work_address: '',
    work_city: '',
    work_country: '',
    id_type: '',
    id_number: '',
    issue_date: '',
    need_visa: false,
    expiry_date: '',
    issue_place: '',
    date_of_birth: '',
    religion: '',
    face_photo_url: '',
    id_photo_url: '',
    areas_of_interest: [],
    primary_nature_of_business: '',
    previous_attendance: null,
    previous_years: [],
    attendee_type: '',
    status: 'pending'
  });

  const loadCurrentUser = useCallback(async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  }, []);

  useEffect(() => {
    const attendeeId = searchParams.get('id');
    if (attendeeId) {
      setEditingId(attendeeId);
      const loadAttendee = async () => {
        try {
          const attendeeData = await Attendee.get(attendeeId);
          setFormData({
            ...attendeeData,
            confirm_email: attendeeData.email
          });
          setShowForm(true);
        } catch (error) {
          console.error("Failed to load attendee for editing:", error);
          navigate(createPageUrl("Attendees"));
        }
      };
      loadAttendee();
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    if (currentUser && !editingId) {
      const isAdminUser = currentUser.role === 'admin' || currentUser.system_role === 'Admin' || currentUser.system_role === 'Super User';
      
      if (isAdminUser) {
        setShowForm(true);
        setFormData(prev => ({ ...prev, attendee_type: prev.attendee_type || 'Partner' }));
        const adminSlots = attendeeTypes.reduce((acc, type) => ({ ...acc, [type]: Infinity }), {});
        setAvailableSlots(adminSlots);
      } else {
        const slots = {};
        const userSlots = currentUser.registration_slots || {};
        const usedSlots = currentUser.used_slots || {};

        Object.entries(userSlots).forEach(([type, total]) => {
          const used = usedSlots[type] || 0;
          slots[type] = total - used;
        });

        setAvailableSlots(slots);
        setShowForm(false);
        setFormData(prev => ({ ...prev, attendee_type: '' }));
      }
    }
  }, [currentUser, editingId]);

  const validateEnglishOnly = (value, fieldName) => {
    // Allows English letters, numbers, spaces, and common symbols like & . - , ( ) /
    const englishOnlyRegex = /^[A-Za-z0-9\s&.\-,()\/]*$/;
    if (value && !englishOnlyRegex.test(value)) {
      return `${fieldName} must contain only English characters.`;
    }
    return null;
  };

  const setFieldError = (field, error) => {
    setFieldErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };

  const clearFieldError = (field) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const handleInputChange = (field, value) => {
    // Validate English-only for specific fields
    const englishOnlyFields = ['first_name', 'last_name', 'organization', 'job_title', 'work_address', 'work_city'];
    
    if (englishOnlyFields.includes(field)) {
      const error = validateEnglishOnly(value, field.replace(/_/g, ' '));
      if (error) {
        setFieldError(field, error);
        // Do not prevent formData update, let the user see what they typed.
      } else {
        clearFieldError(field);
      }
    }

    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'email' || field === 'confirm_email') {
      setEmailError("");
      clearFieldError('email');
      clearFieldError('confirm_email');
    } else {
      // Clear field-specific error when user starts typing on other fields
      clearFieldError(field);
    }
    
    // Clear the general submission error as user interacts with the form
    setSubmissionError("");
  };

  const handleArrayInputChange = (field, value, checked) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked 
        ? [...(prev[field] || []), value]
        : (prev[field] || []).filter(item => item !== value)
    }));
    // Clear field error for array inputs
    clearFieldError(field);
    setSubmissionError("");
  };

  const handleAttendeeTypeChange = (value) => {
    setFormData(prev => ({ ...prev, attendee_type: value }));
    const isAdminUser = currentUser?.role === 'admin' || currentUser?.system_role === 'Admin' || currentUser?.system_role === 'Super User';
    if (!isAdminUser || editingId) {
      setShowForm(true);
    }
    clearFieldError('attendee_type');
    setSubmissionError("");
  };

  const getAvailableAttendeeTypes = () => {
    const isAdminUser = currentUser?.role === 'admin' || currentUser?.system_role === 'Admin' || currentUser?.system_role === 'Super User';
    if (isAdminUser || editingId) return attendeeTypes;
    return attendeeTypes.filter(type => availableSlots[type] > 0);
  };

  const getRemainingSlots = (type) => {
    const isAdminUser = currentUser?.role === 'admin' || currentUser?.system_role === 'Admin' || currentUser?.system_role === 'Super User';
    if (isAdminUser || editingId) return '∞';
    return availableSlots[type] !== undefined ? availableSlots[type] : 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setEmailError("");
    setSubmissionError("");
    setFieldErrors({}); // Clear all previous field errors

    let hasErrors = false;
    const newFieldErrors = {};

    // Mandatory field validations (can be extended based on need)
    if (!formData.title) { newFieldErrors.title = "Title is required."; hasErrors = true; }
    if (!formData.first_name) { newFieldErrors.first_name = "First Name is required."; hasErrors = true; }
    if (!formData.last_name) { newFieldErrors.last_name = "Last Name is required."; hasErrors = true; }
    if (!formData.email) { newFieldErrors.email = "Email is required."; hasErrors = true; }
    if (!formData.confirm_email) { newFieldErrors.confirm_email = "Confirm Email is required."; hasErrors = true; }
    if (!formData.mobile_number) { newFieldErrors.mobile_number = "Mobile Number is required."; hasErrors = true; }
    if (!formData.country_code) { newFieldErrors.country_code = "Country code is required."; hasErrors = true; }
    if (!formData.nationality) { newFieldErrors.nationality = "Nationality is required."; hasErrors = true; }
    if (!formData.country_of_residence) { newFieldErrors.country_of_residence = "Country of residence is required."; hasErrors = true; }
    if (!formData.organization) { newFieldErrors.organization = "Organization is required."; hasErrors = true; }
    if (!formData.job_title) { newFieldErrors.job_title = "Job Title is required."; hasErrors = true; }
    if (!formData.level) { newFieldErrors.level = "Level is required."; hasErrors = true; }
    if (!formData.work_address) { newFieldErrors.work_address = "Work Address is required."; hasErrors = true; }
    if (!formData.work_city) { newFieldErrors.work_city = "Work City is required."; hasErrors = true; }
    if (!formData.work_country) { newFieldErrors.work_country = "Work Country is required."; hasErrors = true; }
    if (!formData.id_type) { newFieldErrors.id_type = "ID Type is required."; hasErrors = true; }
    if (!formData.issue_date) { newFieldErrors.issue_date = "Issue Date is required."; hasErrors = true; }
    if (!formData.date_of_birth) { newFieldErrors.date_of_birth = "Date of Birth is required."; hasErrors = true; }
    
    // Age validation
    if (formData.date_of_birth) {
      const dob = new Date(formData.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
          age--;
      }
      if (age < 18) {
        newFieldErrors.date_of_birth = "You must be at least 18 years old.";
        hasErrors = true;
      }
    }

    if (formData.email !== formData.confirm_email) {
      newFieldErrors.confirm_email = "Email addresses do not match";
      setEmailError("Email addresses do not match");
      hasErrors = true;
    }

    // Validate English-only fields
    const fieldsToValidate = [
      { field: 'first_name', label: 'First Name' },
      { field: 'last_name', label: 'Last Name' },
      { field: 'organization', label: 'Organization' },
      { field: 'job_title', label: 'Job Title' },
      { field: 'work_address', label: 'Work Address' },
      { field: 'work_city', label: 'Work City' }
    ];

    fieldsToValidate.forEach(({field, label}) => {
      const error = validateEnglishOnly(formData[field], label);
      if (error) {
        newFieldErrors[field] = error;
        hasErrors = true;
      }
    });

    if (!formData.face_photo_url) {
        newFieldErrors.face_photo_url = "Please upload a clear face photo.";
        hasErrors = true;
    }

    if (!formData.id_photo_url) {
        newFieldErrors.id_photo_url = "Please upload your ID photo.";
        hasErrors = true;
    }

    if (!formData.id_number) {
      newFieldErrors.id_number = "ID/Iqama/Passport number is required.";
      hasErrors = true;
    }

    if (formData.areas_of_interest.length === 0) {
      newFieldErrors.areas_of_interest = "Please select at least one area of interest.";
      hasErrors = true;
    }

    if (!formData.primary_nature_of_business) {
      newFieldErrors.primary_nature_of_business = "Please select your primary nature of business.";
      hasErrors = true;
    }

    if (formData.level === 'Other' && !formData.level_specify) {
      newFieldErrors.level_specify = "Please specify your level if you selected 'Other'.";
      hasErrors = true;
    }

    if (formData.previous_attendance === null) {
      newFieldErrors.previous_attendance = "Please specify if you have attended a previous FMF Edition.";
      hasErrors = true;
    }

    if (formData.previous_attendance && formData.previous_years.length === 0) {
      newFieldErrors.previous_years = "Please select which years you attended previously.";
      hasErrors = true;
    }

    if (formData.id_type === 'Passport' && formData.need_visa) {
      if (!formData.expiry_date) {
        newFieldErrors.expiry_date = "Passport expiry date is required for visa application.";
        hasErrors = true;
      }
      if (!formData.issue_place) {
        newFieldErrors.issue_place = "Passport issue place is required for visa application.";
        hasErrors = true;
      }
    }


    if (hasErrors) {
      setFieldErrors(newFieldErrors);
      // Set a generic submission error if there are any field-specific errors
      setSubmissionError("Please correct the errors in the form.");
      setIsSubmitting(false);
      return;
    }

    const isAdminUser = currentUser?.role === 'admin' || currentUser?.system_role === 'Admin' || currentUser?.system_role === 'Super User';
    if (!editingId && !isAdminUser && (availableSlots[formData.attendee_type] === undefined || availableSlots[formData.attendee_type] <= 0)) {
      setSubmissionError(`No more slots available for ${formData.attendee_type} attendees.`);
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = { ...formData };
      delete payload.confirm_email;

      // Convert empty string date fields to null for PostgreSQL compatibility
      const dateFields = ['date_of_birth', 'issue_date', 'expiry_date'];
      dateFields.forEach(field => {
        if (payload[field] === '') {
          payload[field] = null;
        }
      });

      if (editingId) {
        await Attendee.update(editingId, payload);
        setSubmissionSuccess(true);
        
        // Send update confirmation email
        try {
          const emailSubject = "Registration Update Confirmation - Future Minerals Forum";
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1e40af; margin-bottom: 20px;">Registration Update Confirmation</h2>
              <p>Dear ${formData.title} ${formData.first_name} ${formData.last_name},</p>
              <p>Your registration for the Future Minerals Forum has been successfully updated and is currently pending review.</p>
              <p><strong>Updated Registration Details:</strong></p>
              <ul style="list-style: none; padding: 0;">
                <li><strong>Name:</strong> ${formData.title} ${formData.first_name} ${formData.last_name}</li>
                <li><strong>Email:</strong> ${formData.email}</li>
                <li><strong>Organization:</strong> ${formData.organization}</li>
                <li><strong>Job Title:</strong> ${formData.job_title}</li>
                <li><strong>Attendee Type:</strong> ${formData.attendee_type}</li>
              </ul>
              <p>We will review your updated registration and contact you with further details. If you have any questions, please don't hesitate to reach out to us.</p>
              <p>Best regards,<br>Future Minerals Forum Team</p>
            </div>
          `;
          
          await emailService.send({
            to: formData.email,
            subject: emailSubject,
            html: emailHtml
          });
          
          console.log('Update confirmation email sent successfully');
        } catch (emailError) {
          console.error('Failed to send update confirmation email:', emailError);
          // Don't show error to user as update was successful
        }
      } else {
        await Attendee.create({
          ...payload,
          status: 'pending',
          registration_method: 'manual',
          registered_by: currentUser?.id,
        });

        // The welcome email will now be sent when the admin approves the registration
        
        if (!isAdminUser && currentUser) {
          const newUsedSlots = {
            ...currentUser.used_slots,
            [formData.attendee_type]: (currentUser.used_slots?.[formData.attendee_type] || 0) + 1
          };
          await User.updateMyUserData({ used_slots: newUsedSlots });
          await loadCurrentUser();
        }
        setSubmissionSuccess(true);
        
        // Send registration confirmation email
        try {
          const emailSubject = "Registration Confirmation - Future Minerals Forum";
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1e40af; margin-bottom: 20px;">Registration Confirmation</h2>
              <p>Dear ${formData.title} ${formData.first_name} ${formData.last_name},</p>
              <p>Thank you for registering for the Future Minerals Forum. Your registration has been successfully submitted and is currently pending review.</p>
              <p><strong>Registration Details:</strong></p>
              <ul style="list-style: none; padding: 0;">
                <li><strong>Name:</strong> ${formData.title} ${formData.first_name} ${formData.last_name}</li>
                <li><strong>Email:</strong> ${formData.email}</li>
                <li><strong>Organization:</strong> ${formData.organization}</li>
                <li><strong>Job Title:</strong> ${formData.job_title}</li>
                <li><strong>Attendee Type:</strong> ${formData.attendee_type}</li>
              </ul>
              <p>We will review your registration and contact you with further details. If you have any questions, please don't hesitate to reach out to us.</p>
              <p>Best regards,<br>Future Minerals Forum Team</p>
            </div>
          `;
          
          await emailService.send({
            to: formData.email,
            subject: emailSubject,
            html: emailHtml
          });
          
          console.log('Registration confirmation email sent successfully');
        } catch (emailError) {
          console.error('Failed to send registration confirmation email:', emailError);
          // Don't show error to user as registration was successful
        }
      }
      
    } catch (error) {
      console.error("Operation failed:", error);
      
      // Handle duplicate email errors
      if (handleDuplicateEmailError(error, {
        setSubmissionError,
        setFieldError,
        setEmailError
      }, 'attendee')) {
        // Also set confirm_email field error for consistency
        setFieldError('confirm_email', "This email address is already registered.");
        toast({ 
          title: "Registration Failed", 
          description: "Attendee with this email already exists.", 
          variant: "destructive" 
        });
      } else {
        // Handle other errors
        const errorMessage = getGenericErrorMessage(error, editingId ? 'update' : 'registration');
        setSubmissionError(errorMessage);
        toast({ 
          title: "Error", 
          description: errorMessage, 
          variant: "destructive" 
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.system_role === 'Admin' || currentUser?.system_role === 'Super User';
  const availableTypes = getAvailableAttendeeTypes();

  if (!currentUser) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute pageName="Registration">
      <div className="p-6 bg-slate-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          
          {submissionSuccess ? (
            <Card className="max-w-2xl mx-auto text-center animate-in fade-in-50">
              <CardContent className="p-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {editingId ? 'Attendee Updated Successfully!' : 'Registration Submitted!'}
                </h2>
                <p className="text-gray-600 mb-6">
                  {editingId 
                    ? 'The attendee details have been successfully updated.'
                    : 'Registration submitted successfully! A welcome email will be sent to the attendee once the application is approved.'
                  }
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
                  <p className="text-sm text-blue-800">
                    <strong>What's next?</strong><br/>
                    The registration will now appear in the attendees list with a "pending" status for review.
                  </p>
                </div>
                <Button onClick={() => navigate(createPageUrl("Attendees"))}>
                  Back to Attendees List
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-6">
                {(isAdmin || editingId) && (
                  <Button variant="outline" size="icon" onClick={() => navigate(createPageUrl("Attendees"))}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {editingId ? 'Edit Attendee' : 'Create Single Attendee'}
                  </h1>
                  <p className="text-gray-500 mt-1">
                    {editingId ? 'Update the details for this attendee.' : 'Register a new forum attendee.'}
                  </p>
                </div>
              </div>

              {!isAdmin && !editingId && availableTypes.length === 0 && (
                <Card className="mb-6 bg-orange-50 border-orange-200">
                  <CardContent className="p-8 text-center">
                    <AlertCircle className="h-12 w-12 text-orange-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-orange-900 mb-2">No Remaining Seats for Registration</h3>
                    <p className="text-orange-800">You have used all your available registration slots.</p>
                  </CardContent>
                </Card>
              )}

              {!isAdmin && !editingId && availableTypes.length > 0 && !showForm && (
                <Card className="mb-6 bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-blue-900">Select Attendee Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(availableSlots).filter(([, remaining]) => remaining > 0).map(([type, remaining]) => (
                        <Button
                          key={type}
                          variant={formData.attendee_type === type ? "default" : "outline"}
                          className="p-6 h-auto flex-col gap-2"
                          onClick={() => handleAttendeeTypeChange(type)}
                        >
                          <span className="font-semibold text-lg">{type}</span>
                          <Badge variant="secondary">{remaining} Available</Badge>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {(isAdmin || showForm || editingId) && (
                <form onSubmit={handleSubmit} className="space-y-8">
                  <Card>
                    <CardHeader><CardTitle>Registration Control</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <Label htmlFor="attendee_type">Attendee Type *</Label>
                        <Select
                          value={formData.attendee_type}
                          onValueChange={handleAttendeeTypeChange}
                          required
                          disabled={!isAdmin && !editingId}
                        >
                          <SelectTrigger className={fieldErrors.attendee_type ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select an attendee type" />
                          </SelectTrigger>
                          <SelectContent>{attendeeTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                        </Select>
                        {fieldErrors.attendee_type && <p className="text-red-500 text-sm mt-1">{fieldErrors.attendee_type}</p>}
                      </div>
                      {isAdmin && editingId && (
                        <div>
                          <Label htmlFor="status">Registration Status</Label>
                          <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                            <SelectTrigger className="bg-yellow-50"><SelectValue placeholder="Set status" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="declined">Declined</SelectItem>
                              <SelectItem value="change_requested">Change Requested</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {!isAdmin && !editingId && formData.attendee_type && (
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-6 flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-green-900">Selected: {formData.attendee_type}</h3>
                        </div>
                        <Badge className="bg-green-100 text-green-800">{getRemainingSlots(formData.attendee_type)} Remaining</Badge>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <Label htmlFor="title">Title *</Label>
                          <Select value={formData.title} onValueChange={(value) => handleInputChange('title', value)} required>
                            <SelectTrigger className={fieldErrors.title ? 'border-red-500' : ''}>
                              <SelectValue placeholder="Select title" />
                            </SelectTrigger>
                            <SelectContent>{titles.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                          {fieldErrors.title && <p className="text-red-500 text-sm mt-1">{fieldErrors.title}</p>}
                        </div>
                        <div>
                          <Label htmlFor="first_name">First Name *</Label>
                          <Input 
                            id="first_name" 
                            value={formData.first_name} 
                            onChange={(e) => handleInputChange('first_name', e.target.value)} 
                            required 
                            className={fieldErrors.first_name ? 'border-red-500' : ''}
                          />
                          {fieldErrors.first_name && <p className="text-red-500 text-sm mt-1">{fieldErrors.first_name}</p>}
                        </div>
                        <div>
                          <Label htmlFor="last_name">Last Name *</Label>
                          <Input 
                            id="last_name" 
                            value={formData.last_name} 
                            onChange={(e) => handleInputChange('last_name', e.target.value)} 
                            required 
                            className={fieldErrors.last_name ? 'border-red-500' : ''}
                          />
                          {fieldErrors.last_name && <p className="text-red-500 text-sm mt-1">{fieldErrors.last_name}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor="email">Email *</Label>
                          <Input 
                            id="email" 
                            type="email" 
                            value={formData.email} 
                            onChange={(e) => handleInputChange('email', e.target.value)} 
                            required 
                            className={emailError || fieldErrors.email ? 'border-red-500' : ''} 
                          />
                          {fieldErrors.email && <p className="text-red-500 text-sm mt-1">{fieldErrors.email}</p>}
                          {emailError && <p className="text-red-500 text-sm mt-1">{emailError}</p>}
                        </div>
                        <div>
                          <Label htmlFor="confirm_email">Confirm Email *</Label>
                          <Input 
                            id="confirm_email" 
                            type="email" 
                            value={formData.confirm_email} 
                            onChange={(e) => handleInputChange('confirm_email', e.target.value)} 
                            required 
                            className={emailError || fieldErrors.confirm_email ? 'border-red-500' : ''} 
                          />
                          {fieldErrors.confirm_email && <p className="text-red-500 text-sm mt-1">{fieldErrors.confirm_email}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                        <div className="col-span-1">
                          <Label htmlFor="country_code">Country Code *</Label>
                          <Select value={formData.country_code} onValueChange={(value) => handleInputChange('country_code', value)} required>
                            <SelectTrigger className={fieldErrors.country_code ? 'border-red-500' : ''}>
                              <SelectValue placeholder="Code" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">{countryCodes.map((c) => <SelectItem key={c.code} value={c.dial_code}>{c.name} ({c.dial_code})</SelectItem>)}</SelectContent>
                          </Select>
                          {fieldErrors.country_code && <p className="text-red-500 text-sm mt-1">{fieldErrors.country_code}</p>}
                        </div>
                        <div className="col-span-2">
                          <Label htmlFor="mobile_number">Mobile Number *</Label>
                          <Input id="mobile_number" type="tel" value={formData.mobile_number} onChange={(e) => handleInputChange('mobile_number', e.target.value)} required className={fieldErrors.mobile_number ? 'border-red-500' : ''}/>
                          {fieldErrors.mobile_number && <p className="text-red-500 text-sm mt-1">{fieldErrors.mobile_number}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor="nationality">Nationality *</Label>
                          <Select value={formData.nationality} onValueChange={(value) => handleInputChange('nationality', value)} required>
                            <SelectTrigger className={fieldErrors.nationality ? 'border-red-500' : ''}>
                              <SelectValue placeholder="Select nationality" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">{countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                          {fieldErrors.nationality && <p className="text-red-500 text-sm mt-1">{fieldErrors.nationality}</p>}
                        </div>
                        <div>
                          <Label htmlFor="country_of_residence">Country of Residence *</Label>
                          <Select value={formData.country_of_residence} onValueChange={(value) => handleInputChange('country_of_residence', value)} required>
                            <SelectTrigger className={fieldErrors.country_of_residence ? 'border-red-500' : ''}>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">{countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                          {fieldErrors.country_of_residence && <p className="text-red-500 text-sm mt-1">{fieldErrors.country_of_residence}</p>}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="linkedin_account">LinkedIn Account</Label>
                        <Input id="linkedin_account" value={formData.linkedin_account} onChange={(e) => handleInputChange('linkedin_account', e.target.value)} placeholder="For quick registration verification (optional)" />
                      </div>
                      <div>
                        <Label htmlFor="date_of_birth">Date of Birth (Minimum age 18) *</Label>
                        <Input 
                          id="date_of_birth" 
                          type="date" 
                          value={formData.date_of_birth} 
                          onChange={(e) => handleInputChange('date_of_birth', e.target.value)} 
                          required 
                          max={new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} 
                          className={fieldErrors.date_of_birth ? 'border-red-500' : ''}
                        />
                        {fieldErrors.date_of_birth && <p className="text-red-500 text-sm mt-1">{fieldErrors.date_of_birth}</p>}
                      </div>
                      <div>
                        <Label htmlFor="religion">Religion</Label>
                        <Select value={formData.religion} onValueChange={(value) => handleInputChange('religion', value)}>
                          <SelectTrigger className={fieldErrors.religion ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select religion (optional)" />
                          </SelectTrigger>
                          <SelectContent>{religions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                        </Select>
                        {fieldErrors.religion && <p className="text-red-500 text-sm mt-1">{fieldErrors.religion}</p>}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Professional Information</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor="organization">Organization *</Label>
                          <Input id="organization" value={formData.organization} onChange={(e) => handleInputChange('organization', e.target.value)} required className={fieldErrors.organization ? 'border-red-500' : ''} />
                          {fieldErrors.organization && <p className="text-red-500 text-sm mt-1">{fieldErrors.organization}</p>}
                        </div>
                        <div>
                          <Label htmlFor="job_title">Job Title *</Label>
                          <Input id="job_title" value={formData.job_title} onChange={(e) => handleInputChange('job_title', e.target.value)} required className={fieldErrors.job_title ? 'border-red-500' : ''} />
                          {fieldErrors.job_title && <p className="text-red-500 text-sm mt-1">{fieldErrors.job_title}</p>}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="level">Which of the following best describes your current level? *</Label>
                        <Select value={formData.level} onValueChange={(value) => handleInputChange('level', value)} required>
                          <SelectTrigger className={fieldErrors.level ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select your level" />
                          </SelectTrigger>
                          <SelectContent>{levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                        </Select>
                        {fieldErrors.level && <p className="text-red-500 text-sm mt-1">{fieldErrors.level}</p>}
                      </div>
                      {formData.level === 'Other' && (
                        <div>
                          <Label htmlFor="level_specify">Please specify *</Label>
                          <Input id="level_specify" value={formData.level_specify} onChange={(e) => handleInputChange('level_specify', e.target.value)} required className={fieldErrors.level_specify ? 'border-red-500' : ''} />
                          {fieldErrors.level_specify && <p className="text-red-500 text-sm mt-1">{fieldErrors.level_specify}</p>}
                        </div>
                      )}
                      <div>
                        <Label htmlFor="work_address">Work Address *</Label>
                        <Textarea id="work_address" value={formData.work_address} onChange={(e) => handleInputChange('work_address', e.target.value)} required className={fieldErrors.work_address ? 'border-red-500' : ''} />
                        {fieldErrors.work_address && <p className="text-red-500 text-sm mt-1">{fieldErrors.work_address}</p>}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor="work_city">Work City *</Label>
                          <Input id="work_city" value={formData.work_city} onChange={(e) => handleInputChange('work_city', e.target.value)} required className={fieldErrors.work_city ? 'border-red-500' : ''} />
                          {fieldErrors.work_city && <p className="text-red-500 text-sm mt-1">{fieldErrors.work_city}</p>}
                        </div>
                        <div>
                          <Label htmlFor="work_country">Work Country *</Label>
                          <Select value={formData.work_country} onValueChange={(value) => handleInputChange('work_country', value)} required>
                            <SelectTrigger className={fieldErrors.work_country ? 'border-red-500' : ''}>
                              <SelectValue placeholder="Select work country" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">{countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                          {fieldErrors.work_country && <p className="text-red-500 text-sm mt-1">{fieldErrors.work_country}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>ID Information</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor="id_type">ID Type *</Label>
                          <Select value={formData.id_type} onValueChange={(value) => handleInputChange('id_type', value)} required>
                            <SelectTrigger className={fieldErrors.id_type ? 'border-red-500' : ''}>
                              <SelectValue placeholder="Select ID type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="National ID">National ID – for Saudi nationals</SelectItem>
                              <SelectItem value="Iqama">Iqama – for KSA residents</SelectItem>
                              <SelectItem value="Passport">Passport – for international visitors</SelectItem>
                            </SelectContent>
                          </Select>
                          {fieldErrors.id_type && <p className="text-red-500 text-sm mt-1">{fieldErrors.id_type}</p>}
                        </div>
                        <div>
                          <Label htmlFor="id_number">ID/Iqama/Passport Number *</Label>
                          <Input id="id_number" value={formData.id_number} onChange={(e) => handleInputChange('id_number', e.target.value)} required className={fieldErrors.id_number ? 'border-red-500' : ''} />
                          {fieldErrors.id_number && <p className="text-red-500 text-sm mt-1">{fieldErrors.id_number}</p>}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="issue_date">Issue Date *</Label>
                        <Input id="issue_date" type="date" value={formData.issue_date} onChange={(e) => handleInputChange('issue_date', e.target.value)} required className={fieldErrors.issue_date ? 'border-red-500' : ''} />
                        {fieldErrors.issue_date && <p className="text-red-500 text-sm mt-1">{fieldErrors.issue_date}</p>}
                      </div>
                      {formData.id_type === 'Passport' && (
                        <div>
                          <Label htmlFor="need_visa">Do you need a Visa? *</Label>
                          <Select value={formData.need_visa ? 'Yes' : 'No'} onValueChange={(value) => handleInputChange('need_visa', value === 'Yes')} required>
                            <SelectTrigger className={fieldErrors.need_visa ? 'border-red-500' : ''}>
                              <SelectValue placeholder="Select option" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Yes">Yes</SelectItem>
                              <SelectItem value="No">No</SelectItem>
                            </SelectContent>
                          </Select>
                          {fieldErrors.need_visa && <p className="text-red-500 text-sm mt-1">{fieldErrors.need_visa}</p>}
                        </div>
                      )}
                      {formData.id_type === 'Passport' && formData.need_visa && (
                        <>
                          <div>
                            <Label htmlFor="expiry_date">Expiry Date *</Label>
                            <Input id="expiry_date" type="date" value={formData.expiry_date} onChange={(e) => handleInputChange('expiry_date', e.target.value)} required className={fieldErrors.expiry_date ? 'border-red-500' : ''} />
                            {fieldErrors.expiry_date && <p className="text-red-500 text-sm mt-1">{fieldErrors.expiry_date}</p>}
                          </div>
                          <div>
                            <Label htmlFor="issue_place">Passport Issue Place *</Label>
                            <Input id="issue_place" value={formData.issue_place} onChange={(e) => handleInputChange('issue_place', e.target.value)} required className={fieldErrors.issue_place ? 'border-red-500' : ''} />
                            {fieldErrors.issue_place && <p className="text-red-500 text-sm mt-1">{fieldErrors.issue_place}</p>}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Personal ID & Photo</CardTitle></CardHeader>
                    <CardContent className="space-y-8">
                      <div>
                        <PhotoUpload
                          label="Upload a clear face photo in JPG/JPEG/PNG format (max 2 MB) *"
                          onUpload={(url) => handleInputChange('face_photo_url', url)}
                          value={formData.face_photo_url}
                          required
                        />
                        {fieldErrors.face_photo_url && <p className="text-red-500 text-sm mt-1">{fieldErrors.face_photo_url}</p>}
                      </div>
                      <div>
                        <PhotoUpload
                          label="Upload your national ID, Iqama, or passport (JPG/PNG/PDF) *"
                          onUpload={(url) => handleInputChange('id_photo_url', url)}
                          value={formData.id_photo_url}
                          acceptPdf={true}
                          required
                        />
                        {fieldErrors.id_photo_url && <p className="text-red-500 text-sm mt-1">{fieldErrors.id_photo_url}</p>}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>What are the areas you are most interested in? *</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {areasOfInterest.map((area) => (
                          <div key={area} className="flex items-center space-x-2">
                            <Checkbox
                              id={`reg_${area}`}
                              checked={formData.areas_of_interest?.includes(area) || false}
                              onCheckedChange={(checked) => handleArrayInputChange('areas_of_interest', area, checked)}
                            />
                            <Label htmlFor={`reg_${area}`} className="text-sm font-medium">{area}</Label>
                          </div>
                        ))}
                      </div>
                      {fieldErrors.areas_of_interest && <p className="text-red-500 text-sm mt-1">{fieldErrors.areas_of_interest}</p>}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Business Information</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <Label htmlFor="primary_nature_of_business">What is your primary Nature of Business? *</Label>
                        <Select value={formData.primary_nature_of_business} onValueChange={(value) => handleInputChange('primary_nature_of_business', value)} required>
                          <SelectTrigger className={fieldErrors.primary_nature_of_business ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select nature of business" />
                          </SelectTrigger>
                          <SelectContent>{businessNatures.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                        </Select>
                        {fieldErrors.primary_nature_of_business && <p className="text-red-500 text-sm mt-1">{fieldErrors.primary_nature_of_business}</p>}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6 space-y-6">
                      <div>
                        <Label htmlFor="previous_attendance">Have you attended previous FMF Edition? *</Label>
                        <Select value={formData.previous_attendance === null ? "" : (formData.previous_attendance ? 'Yes' : 'No')} onValueChange={(value) => handleInputChange('previous_attendance', value === 'Yes')} required>
                          <SelectTrigger className={fieldErrors.previous_attendance ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                        {fieldErrors.previous_attendance && <p className="text-red-500 text-sm mt-1">{fieldErrors.previous_attendance}</p>}
                      </div>
                      {formData.previous_attendance && (
                        <div>
                          <Label>Which year(s)? *</Label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                            {['2022', '2023', '2024', '2025'].map((year) => (
                              <div key={year} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`reg_year_${year}`}
                                  checked={formData.previous_years?.includes(year) || false}
                                  onCheckedChange={(checked) => handleArrayInputChange('previous_years', year, checked)}
                                />
                                <Label htmlFor={`reg_year_${year}`} className="text-sm font-medium">{year}</Label>
                              </div>
                            ))}
                          </div>
                          {fieldErrors.previous_years && <p className="text-red-500 text-sm mt-1">{fieldErrors.previous_years}</p>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  {submissionError && (
                    <Alert variant="destructive" className="mb-6">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{submissionError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-end gap-4 pt-6">
                    <Button type="button" variant="outline" onClick={() => navigate(createPageUrl("Attendees"))}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 px-8">
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          {editingId ? 'Updating...' : 'Registering...'}
                        </div>
                      ) : (
                        <>
                          {editingId ? <Edit3 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                          {editingId ? 'Update Attendee' : 'Submit'}
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
