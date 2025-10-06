
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Save, AlertCircle, CheckCircle } from "lucide-react";
import { registerWithInvitation } from "@/api/functions";
import { validateInvitation } from "@/api/functions";
import { getAttendeeForModification } from "@/api/functions";
import { updateAttendeeRegistration } from "@/api/functions";
import PhotoUpload from "../components/registration/PhotoUpload";
import { countryCodes } from "../components/registration/countryCodes";
import { countries } from "../components/registration/countries"; // New import for comprehensive country list
import { useToast } from "../components/common/Toast";
import { handleDuplicateEmailError, getGenericErrorMessage } from "../utils/errorHandling";
import { emailService } from "../lib/resend";
import { supabase } from "../lib/supabase";

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

export default function PublicRegistrationPage() {
  const [validatedInvitation, setValidatedInvitation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({}); // New state for inline field errors
  const [isModificationMode, setIsModificationMode] = useState(false);
  const [originalAttendeeId, setOriginalAttendeeId] = useState(null);
  const [step, setStep] = useState(1);
  const [invitationInputCode, setInvitationInputCode] = useState("");
  const [invitationInputError, setInvitationInputError] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    first_name: '',
    last_name: '',
    email: '',
    confirm_email: '',
    mobile_number: '',
    country_code: '+966', // Default value updated
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
    previous_attendance: null, // Default value updated
    previous_years: [],
    attendee_type: ''
  });

  const validateEnglishOnly = (value, fieldName) => {
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
    // Always update formData first
    setFormData(prev => ({ ...prev, [field]: value }));

    const englishOnlyFields = ['first_name', 'last_name', 'organization', 'job_title', 'work_address', 'work_city'];
    
    // Perform validation and set/clear field error
    if (englishOnlyFields.includes(field)) {
      const error = validateEnglishOnly(value, field.replace(/_/g, ' '));
      if (error) {
        setFieldError(field, error);
      } else {
        clearFieldError(field);
      }
    }

    if (field === 'email' || field === 'confirm_email') {
      setEmailError(""); // Clear general email error
      clearFieldError('email'); // Clear specific email field error
      clearFieldError('confirm_email'); // Clear specific confirm_email field error
    } else {
      // Clear field-specific error when any other input changes
      clearFieldError(field);
    }
    
    // Clear general submission errors if they exist, as user is making changes
    if (submissionError) {
      setSubmissionError("");
    }
  };

  const handleArrayInputChange = (field, value, checked) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked
        ? [...(prev[field] || []), value]
        : (prev[field] || []).filter(item => item !== value)
    }));
    clearFieldError(field); // Clear error for array type inputs
    if (submissionError) {
      setSubmissionError("");
    }
  };

  const validateAndProcessInvitation = useCallback(async (code, errorSetter) => {
    setIsLoading(true);
    errorSetter("");
    try {
      const invitation = await validateInvitation(code);
      if (!invitation) {
        const errMsg = "Invalid invitation code";
        errorSetter(errMsg);
        toast({ title: "Validation Failed", description: errMsg, variant: "destructive" });
        setValidatedInvitation(null);
        setStep(1);
      } else {
        toast({ title: "Invitation Validated", description: "Please proceed with registration.", variant: "success" });
        setValidatedInvitation(invitation);
        setFormData(prev => ({ ...prev, attendee_type: invitation.attendee_type }));
        setStep(2);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || "Failed to validate invitation. Please try again.";
      errorSetter(errorMessage);
      toast({ title: "Validation Error", description: errorMessage, variant: "destructive" });
      setValidatedInvitation(null);
      setStep(1);
    } finally {
      setIsLoading(false);
    }
  }, [toast, setValidatedInvitation, setStep, setFormData, setIsLoading]);

  const loadAttendeeForModification = useCallback(async (attendeeId) => {
    setIsLoading(true);
    try {
      const { data } = await getAttendeeForModification({ attendeeId });
      if (data.success) {
        // Ensure arrays are initialized if null/undefined in fetched data
        const loadedData = {
          ...data.attendee,
          areas_of_interest: data.attendee.areas_of_interest || [],
          previous_years: data.attendee.previous_years || [],
          confirm_email: data.attendee.email // Pre-fill confirm_email for modification
        };
        setFormData(loadedData);
        setValidatedInvitation({
          attendee_type: data.attendee.attendee_type,
          invitation_code: 'MODIFICATION'
        });
        setStep(2);
        toast({ title: "Registration Loaded", description: "Please update your details.", variant: "success" });
      } else {
        const errMsg = data.error || "Invalid modification link or attendee not found.";
        setPageError(errMsg);
        toast({ title: "Loading Failed", description: errMsg, variant: "destructive" });
        setStep(1);
      }
    } catch (error) {
      console.error("Error loading attendee for modification:", error);
      const errMsg = "Failed to load registration for modification. Please try again.";
      setPageError(errMsg);
      toast({ title: "Loading Error", description: errMsg, variant: "destructive" });
      setStep(1);
    } finally {
      setIsLoading(false);
    }
  }, [toast, setFormData, setValidatedInvitation, setStep, setPageError, setIsLoading]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const modifyId = urlParams.get('modify');
    const invitationCodeParam = urlParams.get('invitation');

    if (modifyId) {
      setIsModificationMode(true);
      setOriginalAttendeeId(modifyId);
      loadAttendeeForModification(modifyId);
    } else if (invitationCodeParam) {
      setInvitationInputCode(invitationCodeParam);
      validateAndProcessInvitation(invitationCodeParam, setPageError);
    } else {
      setStep(1);
      setIsLoading(false);
    }
  }, [loadAttendeeForModification, validateAndProcessInvitation, setPageError, setIsLoading, setInvitationInputCode, setIsModificationMode, setOriginalAttendeeId]);

  useEffect(() => {
    if (submissionSuccess) {
      const timer = setTimeout(() => {
        window.location.href = 'https://app.futuremineralsforum.com.sa';
      }, 3000); // Redirect after 3 seconds
      return () => clearTimeout(timer); // Cleanup timer on unmount or if submissionSuccess changes
    }
  }, [submissionSuccess]);

  const handleInvitationSubmit = async (e) => {
    e.preventDefault();
    if (!invitationInputCode) {
      setInvitationInputError("Please enter an invitation code.");
      toast({ title: "Validation Required", description: "Please enter an invitation code.", variant: "destructive" });
      return;
    }
    await validateAndProcessInvitation(invitationInputCode, setInvitationInputError);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmissionError("");
    setEmailError("");
    setFieldErrors({}); // Clear all previous inline field errors
    let hasErrors = false;
    let firstErrorField = ''; // To scroll to the first error

    const setAndTrackError = (field, message) => {
      setFieldError(field, message);
      if (!firstErrorField) firstErrorField = field;
      hasErrors = true;
    };

    // Validation checks
    if (!formData.title) setAndTrackError('title', 'Title is required.');
    if (!formData.first_name) setAndTrackError('first_name', 'First Name is required.');
    if (!formData.last_name) setAndTrackError('last_name', 'Last Name is required.');
    if (!formData.email) setAndTrackError('email', 'Email is required.');
    if (!formData.confirm_email) setAndTrackError('confirm_email', 'Confirm Email is required.');
    if (!formData.mobile_number) setAndTrackError('mobile_number', 'Mobile Number is required.');
    if (!formData.nationality) setAndTrackError('nationality', 'Nationality is required.');
    if (!formData.country_of_residence) setAndTrackError('country_of_residence', 'Country of Residence is required.');
    if (!formData.organization) setAndTrackError('organization', 'Organization is required.');
    if (!formData.job_title) setAndTrackError('job_title', 'Job Title is required.');
    if (!formData.level) setAndTrackError('level', 'Level is required.');
    if (!formData.work_address) setAndTrackError('work_address', 'Work Address is required.');
    if (!formData.work_city) setAndTrackError('work_city', 'Work City is required.');
    if (!formData.work_country) setAndTrackError('work_country', 'Work Country is required.');
    if (!formData.id_type) setAndTrackError('id_type', 'ID Type is required.');
    if (!formData.id_number) setAndTrackError('id_number', 'ID/Iqama/Passport Number is required.');
    if (!formData.issue_date) setAndTrackError('issue_date', 'Issue Date is required.');
    if (!formData.date_of_birth) setAndTrackError('date_of_birth', 'Date of Birth is required.');

    if (formData.email && formData.confirm_email && formData.email !== formData.confirm_email) {
      setEmailError("Email addresses do not match");
      setAndTrackError('confirm_email', 'Email addresses do not match');
      setAndTrackError('email', 'Email addresses do not match'); // Also mark email field
    }

    // Validate English-only fields
    const fieldsToValidateEnglish = [
      { field: 'first_name', label: 'First Name' },
      { field: 'last_name', label: 'Last Name' },
      { field: 'organization', label: 'Organization' },
      { field: 'job_title', label: 'Job Title' },
      { field: 'work_address', label: 'Work Address' },
      { field: 'work_city', label: 'Work City' }
    ];

    for (const {field, label} of fieldsToValidateEnglish) {
      const error = validateEnglishOnly(formData[field], label);
      if (error) {
        setAndTrackError(field, error);
      }
    }

    if (!formData.face_photo_url) {
      setAndTrackError("face_photo_url", "Please upload a clear face photo.");
    }

    if (!formData.id_photo_url) {
      setAndTrackError("id_photo_url", "Please upload your ID photo.");
    }

    if (!formData.areas_of_interest || formData.areas_of_interest.length === 0) {
      setAndTrackError("areas_of_interest", "Please select at least one area of interest.");
    }

    if (!formData.primary_nature_of_business) {
      setAndTrackError("primary_nature_of_business", "Please select your primary nature of business.");
    }

    if (formData.level === 'Other' && !formData.level_specify) {
      setAndTrackError("level_specify", "Please specify your level.");
    }

    if (formData.id_type === 'Passport' && formData.need_visa) {
      if (!formData.expiry_date) setAndTrackError("expiry_date", "Passport Expiry Date is required when visa is needed.");
      if (!formData.issue_place) setAndTrackError("issue_place", "Passport Issue Place is required when visa is needed.");
    }

    if (formData.previous_attendance === null) {
      setAndTrackError("previous_attendance", "Please specify if you have attended a previous FMF Edition.");
    } else if (formData.previous_attendance && (!formData.previous_years || formData.previous_years.length === 0)) {
      setAndTrackError("previous_years", "Please select which years you attended FMF previously.");
    }

    if (hasErrors) {
      const errorMsg = "Please correct the highlighted errors before submitting.";
      setSubmissionError(errorMsg);
      toast({ title: "Validation Failed", description: errorMsg, variant: "destructive" });
      setIsSubmitting(false);
      // Optional: Scroll to the first error field
      if (firstErrorField) {
        document.getElementById(firstErrorField)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    try {
      // Convert empty string date fields to null for PostgreSQL compatibility
      const processedFormData = { ...formData };
      delete processedFormData.confirm_email; // Remove confirm_email as it's only for validation
      const dateFields = ['date_of_birth', 'issue_date', 'expiry_date'];
      dateFields.forEach(field => {
        if (processedFormData[field] === '') {
          processedFormData[field] = null;
        }
      });

      let result;
      if (isModificationMode && originalAttendeeId) {
        result = await updateAttendeeRegistration({
          attendeeId: originalAttendeeId,
          attendeeData: processedFormData
        });
        if (result.success) {
          setSubmissionSuccess(true);
          toast({ title: "Update Successful", description: "Your registration has been updated and is pending review.", variant: "success" });
          
          // Send update confirmation email
          try {
            // Get registration confirmation email template
            const { data: template, error: templateError } = await supabase
              .from('email_templates')
              .select('*')
              .eq('name', 'registration_confirmation')
              .eq('is_active', true)
              .single();
            
            if (templateError) {
              console.warn('Registration confirmation email template not found:', templateError);
              return; // Skip email if template not found
            }
            
            let subject = template.subject;
            let html = template.body
              .replace(/{{title}}/g, formData.title || '')
              .replace(/{{first_name}}/g, formData.first_name || '')
              .replace(/{{last_name}}/g, formData.last_name || '')
              .replace(/{{email}}/g, formData.email || '')
              .replace(/{{organization}}/g, formData.organization || '')
              .replace(/{{job_title}}/g, formData.job_title || '')
              .replace(/{{attendee_type}}/g, formData.attendee_type || '')
              .replace(/{{is_approved}}/g, 'false');
            
            await emailService.send({
              to: formData.email,
              subject: subject,
              html: html
            });
            
            console.log('Update confirmation email sent successfully');
          } catch (emailError) {
            console.error('Failed to send update confirmation email:', emailError);
            // Don't show error to user as update was successful
          }
        } else {
          const errMsg = result.error || "Failed to update registration. Please try again.";
          setSubmissionError(errMsg);
          toast({ title: "Update Failed", description: errMsg, variant: "destructive" });
        }
      } else {
        if (!validatedInvitation?.invitation_code) {
          const errMsg = "Invitation code is missing. Please re-validate your invitation.";
          setSubmissionError(errMsg);
          toast({ title: "Registration Error", description: errMsg, variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
        result = await registerWithInvitation({
          invitationCode: validatedInvitation.invitation_code,
          attendeeData: processedFormData
        });
        if (result.success) {
          setSubmissionSuccess(true);
          toast({ title: "Registration Submitted", description: "Your registration has been submitted and is pending review.", variant: "success" });
          
          // Send confirmation email
          try {
            // Get registration confirmation email template
            const { data: template, error: templateError } = await supabase
              .from('email_templates')
              .select('*')
              .eq('name', 'registration_confirmation')
              .eq('is_active', true)
              .single();
            
            if (templateError) {
              console.warn('Registration confirmation email template not found:', templateError);
              return; // Skip email if template not found
            }
            
            let subject = template.subject;
            let html = template.body
              .replace(/{{title}}/g, formData.title || '')
              .replace(/{{first_name}}/g, formData.first_name || '')
              .replace(/{{last_name}}/g, formData.last_name || '')
              .replace(/{{email}}/g, formData.email || '')
              .replace(/{{organization}}/g, formData.organization || '')
              .replace(/{{job_title}}/g, formData.job_title || '')
              .replace(/{{attendee_type}}/g, formData.attendee_type || '')
              .replace(/{{is_approved}}/g, 'false');
            
            await emailService.send({
              to: formData.email,
              subject: subject,
              html: html
            });
            
            console.log('Confirmation email sent successfully');
          } catch (emailError) {
            console.error('Failed to send confirmation email:', emailError);
            // Don't show error to user as registration was successful
          }
        } else {
          const errMsg = result.error || "An unexpected error occurred. Please try again.";
          if (errMsg.includes("already registered")) {
            setEmailError(errMsg);
            setFieldError('email', errMsg);
            setSubmissionError(errMsg); // Also set general submission error
            toast({ title: "Registration Failed", description: errMsg, variant: "destructive" });
          } else {
            setSubmissionError(errMsg);
            toast({ title: "Registration Failed", description: errMsg, variant: "destructive" });
          }
        }
      }
    } catch (err) {
      console.error("Registration error:", err);
      
      // Handle duplicate email errors
      if (handleDuplicateEmailError(err, {
        setSubmissionError,
        setFieldError,
        setEmailError
      }, 'attendee')) {
        toast({ 
          title: "Registration Failed", 
          description: "Attendee with this email already exists.", 
          variant: "destructive" 
        });
      } else {
        // Handle other errors
        const errorMessage = err.response?.data?.error || getGenericErrorMessage(err, 'registration');
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (submissionSuccess) {
    return (
       <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <Card className="max-w-2xl mx-auto text-center animate-in fade-in-50">
            <CardHeader>
               <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68c956d6c6a36ced0b9be9eb/38539828a_image.png"
                alt="Future Minerals Forum"
                className="h-16 w-auto object-contain mx-auto mb-4"
              />
            </CardHeader>
            <CardContent className="p-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {isModificationMode ? 'Registration Updated Successfully!' : 'Registration Submitted!'}
              </h2>
              <p className="text-gray-600 mb-6">
                {isModificationMode 
                  ? 'Your registration has been updated and is now pending review by our team.'
                  : 'Registration submitted successfully! You will be redirected to the application in a few moments.'
                }
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>What happens next?</strong><br />
                  You will be automatically redirected to the application portal. Our team will review your registration within 2-3 business days. You will receive an email notification with the approval status.
                </p>
              </div>
            </CardContent>
          </Card>
      </div>
    );
  }

  if (pageError && !submissionSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600">{pageError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68c956d6c6a36ced0b9be9eb/38539828a_image.png"
              alt="Future Minerals Forum"
              className="h-16 w-auto object-contain"
              style={{ maxWidth: '300px', display: 'block' }}
              onError={(e) => {
                console.error('Image failed to load:', e.target.src);
                e.target.style.display = 'none';
              }}
            />
          </div>
        </div>
      </div>

      <div className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {pageError && step === 1 && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{pageError}</AlertDescription>
            </Alert>
          )}

          {step === 1 && !submissionSuccess && (
            <Card className="max-w-md mx-auto">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold text-gray-900">
                  {isModificationMode ? 'Modify Registration' : 'Forum Registration'}
                </CardTitle>
                <CardDescription className="text-gray-600">
                  {isModificationMode
                    ? 'Update your registration details as requested'
                    : 'Enter your invitation code to begin registration'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInvitationSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="invitation_code">Invitation Code *</Label>
                    <Input
                      id="invitation_code"
                      value={invitationInputCode}
                      onChange={(e) => {
                        setInvitationInputCode(e.target.value);
                        setInvitationInputError('');
                      }}
                      required
                      className={invitationInputError ? 'border-red-500' : ''}
                    />
                    {invitationInputError && (
                      <p className="text-red-500 text-sm mt-1">{invitationInputError}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                        Validating...
                      </div>
                    ) : "Proceed"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {step === 2 && !submissionSuccess && validatedInvitation && (
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900">
                  {isModificationMode ? 'Modify Your Registration' : 'Future Minerals Forum Registration'}
                </h1>
                <p className="text-gray-600 mt-2">
                  {isModificationMode
                    ? 'Please update the requested information and resubmit your registration'
                    : `Complete your registration as a ${validatedInvitation.attendee_type} attendee`
                  }
                </p>
                {isModificationMode && (
                  <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-orange-800 font-medium">
                      You are modifying an existing registration. Please review and update the information as requested.
                    </p>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                 {submissionError && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{submissionError}</AlertDescription>
                  </Alert>
                )}

                {/* Personal Information */}
                <Card>
                  <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <Label htmlFor="title">Title *</Label>
                        <Select
                          value={formData.title}
                          onValueChange={(value) => handleInputChange('title', value)}
                          required
                          id="title"
                        >
                          <SelectTrigger className={fieldErrors.title ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select title" />
                          </SelectTrigger>
                          <SelectContent>{titles.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
                        </Select>
                        {fieldErrors.title && (<p className="text-red-500 text-sm mt-1">{fieldErrors.title}</p>)}
                      </div>
                      <div>
                        <Label htmlFor="first_name">First Name *</Label>
                        <Input
                          id="first_name"
                          value={formData.first_name}
                          onChange={(e) => handleInputChange('first_name', e.target.value)}
                          required
                          className={fieldErrors.first_name ? 'border-red-500' : ''}
                          title="Only English characters, numbers, spaces, and allowed symbols (& . - , ( ) /) are allowed."
                        />
                        {fieldErrors.first_name && (<p className="text-red-500 text-sm mt-1">{fieldErrors.first_name}</p>)}
                      </div>
                      <div>
                        <Label htmlFor="last_name">Last Name *</Label>
                        <Input
                          id="last_name"
                          value={formData.last_name}
                          onChange={(e) => handleInputChange('last_name', e.target.value)}
                          required
                          className={fieldErrors.last_name ? 'border-red-500' : ''}
                          title="Only English characters, numbers, spaces, and allowed symbols (& . - , ( ) /) are allowed."
                        />
                        {fieldErrors.last_name && (<p className="text-red-500 text-sm mt-1">{fieldErrors.last_name}</p>)}
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
                        {(emailError || fieldErrors.email) && (<p className="text-red-500 text-sm mt-1">{emailError || fieldErrors.email}</p>)}
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
                        {(emailError || fieldErrors.confirm_email) && (<p className="text-red-500 text-sm mt-1">{emailError || fieldErrors.confirm_email}</p>)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                      <div className="col-span-1">
                        <Label htmlFor="country_code">Country Code *</Label>
                        <Select
                          value={formData.country_code}
                          onValueChange={(value) => handleInputChange('country_code', value)}
                          required
                          id="country_code"
                        >
                          <SelectTrigger className={fieldErrors.country_code ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Code" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {countryCodes.map((c) => (<SelectItem key={c.code} value={c.dial_code}>{c.name} ({c.dial_code})</SelectItem>))}
                          </SelectContent>
                        </Select>
                        {fieldErrors.country_code && (<p className="text-red-500 text-sm mt-1">{fieldErrors.country_code}</p>)}
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="mobile_number">Mobile Number *</Label>
                        <Input
                          id="mobile_number"
                          type="tel"
                          value={formData.mobile_number}
                          onChange={(e) => handleInputChange('mobile_number', e.target.value)}
                          required
                          className={fieldErrors.mobile_number ? 'border-red-500' : ''}
                        />
                        {fieldErrors.mobile_number && (<p className="text-red-500 text-sm mt-1">{fieldErrors.mobile_number}</p>)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="nationality">Nationality *</Label>
                        <Select
                          value={formData.nationality}
                          onValueChange={(value) => handleInputChange('nationality', value)}
                          required
                          id="nationality"
                        >
                          <SelectTrigger className={fieldErrors.nationality ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select nationality" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">{countries.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                        </Select>
                        {fieldErrors.nationality && (<p className="text-red-500 text-sm mt-1">{fieldErrors.nationality}</p>)}
                      </div>
                      <div>
                        <Label htmlFor="country_of_residence">Country of Residence *</Label>
                        <Select
                          value={formData.country_of_residence}
                          onValueChange={(value) => handleInputChange('country_of_residence', value)}
                          required
                          id="country_of_residence"
                        >
                          <SelectTrigger className={fieldErrors.country_of_residence ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">{countries.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                        </Select>
                        {fieldErrors.country_of_residence && (<p className="text-red-500 text-sm mt-1">{fieldErrors.country_of_residence}</p>)}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="linkedin_account">LinkedIn Account</Label>
                      <Input
                        id="linkedin_account"
                        value={formData.linkedin_account}
                        onChange={(e) => handleInputChange('linkedin_account', e.target.value)}
                        placeholder="For quick registration verification (optional)"
                        className={fieldErrors.linkedin_account ? 'border-red-500' : ''}
                      />
                      {fieldErrors.linkedin_account && (<p className="text-red-500 text-sm mt-1">{fieldErrors.linkedin_account}</p>)}
                    </div>

                    <div>
                      <Label htmlFor="date_of_birth">Date of Birth (Minimum age 18) *</Label>
                      <Input
                        id="date_of_birth"
                        type="date"
                        value={formData.date_of_birth}
                        onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                        required
                        max={new Date(Date.now() - 18*365*24*60*60*1000).toISOString().split('T')[0]}
                        className={fieldErrors.date_of_birth ? 'border-red-500' : ''}
                      />
                      {fieldErrors.date_of_birth && (<p className="text-red-500 text-sm mt-1">{fieldErrors.date_of_birth}</p>)}
                    </div>

                    <div>
                      <Label htmlFor="religion">Religion</Label>
                      <Select
                        value={formData.religion}
                        onValueChange={(value) => handleInputChange('religion', value)}
                        id="religion"
                      >
                        <SelectTrigger className={fieldErrors.religion ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select religion (optional)" />
                        </SelectTrigger>
                        <SelectContent>{religions.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}</SelectContent>
                      </Select>
                      {fieldErrors.religion && (<p className="text-red-500 text-sm mt-1">{fieldErrors.religion}</p>)}
                    </div>
                  </CardContent>
                </Card>

                {/* Professional Information */}
                <Card>
                  <CardHeader><CardTitle>Professional Information</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="organization">Organization *</Label>
                        <Input
                          id="organization"
                          value={formData.organization}
                          onChange={(e) => handleInputChange('organization', e.target.value)}
                          required
                          className={fieldErrors.organization ? 'border-red-500' : ''}
                          title="Only English characters, numbers, spaces, and allowed symbols (& . - , ( ) /) are allowed."
                        />
                        {fieldErrors.organization && (<p className="text-red-500 text-sm mt-1">{fieldErrors.organization}</p>)}
                      </div>
                      <div>
                        <Label htmlFor="job_title">Job Title *</Label>
                        <Input
                          id="job_title"
                          value={formData.job_title}
                          onChange={(e) => handleInputChange('job_title', e.target.value)}
                          required
                          className={fieldErrors.job_title ? 'border-red-500' : ''}
                          title="Only English characters, numbers, spaces, and allowed symbols (& . - , ( ) /) are allowed."
                        />
                        {fieldErrors.job_title && (<p className="text-red-500 text-sm mt-1">{fieldErrors.job_title}</p>)}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="level">Which of the following best describes your current level? *</Label>
                      <Select
                        value={formData.level}
                        onValueChange={(value) => handleInputChange('level', value)}
                        required
                        id="level"
                      >
                        <SelectTrigger className={fieldErrors.level ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select your level" />
                        </SelectTrigger>
                        <SelectContent>{levels.map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}</SelectContent>
                      </Select>
                      {fieldErrors.level && (<p className="text-red-500 text-sm mt-1">{fieldErrors.level}</p>)}
                    </div>

                    {formData.level === 'Other' && (
                      <div>
                        <Label htmlFor="level_specify">Please specify *</Label>
                        <Input
                          id="level_specify"
                          value={formData.level_specify}
                          onChange={(e) => handleInputChange('level_specify', e.target.value)}
                          required
                          className={fieldErrors.level_specify ? 'border-red-500' : ''}
                        />
                        {fieldErrors.level_specify && (<p className="text-red-500 text-sm mt-1">{fieldErrors.level_specify}</p>)}
                      </div>
                    )}

                    <div>
                      <Label htmlFor="work_address">Work Address *</Label>
                      <Textarea
                        id="work_address"
                        value={formData.work_address}
                        onChange={(e) => handleInputChange('work_address', e.target.value)}
                        required
                        className={fieldErrors.work_address ? 'border-red-500' : ''}
                        title="Only English characters, numbers, spaces, and allowed symbols (& . - , ( ) /) are allowed."
                      />
                      {fieldErrors.work_address && (<p className="text-red-500 text-sm mt-1">{fieldErrors.work_address}</p>)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="work_city">Work City *</Label>
                        <Input
                          id="work_city"
                          value={formData.work_city}
                          onChange={(e) => handleInputChange('work_city', e.target.value)}
                          required
                          className={fieldErrors.work_city ? 'border-red-500' : ''}
                          title="Only English characters, numbers, spaces, and allowed symbols (& . - , ( ) /) are allowed."
                        />
                        {fieldErrors.work_city && (<p className="text-red-500 text-sm mt-1">{fieldErrors.work_city}</p>)}
                      </div>
                      <div>
                        <Label htmlFor="work_country">Work Country *</Label>
                        <Select
                          value={formData.work_country}
                          onValueChange={(value) => handleInputChange('work_country', value)}
                          required
                          id="work_country"
                        >
                          <SelectTrigger className={fieldErrors.work_country ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select work country" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">{countries.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                        </Select>
                        {fieldErrors.work_country && (<p className="text-red-500 text-sm mt-1">{fieldErrors.work_country}</p>)}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ID Information */}
                <Card>
                  <CardHeader><CardTitle>ID Information</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="id_type">ID Type *</Label>
                        <Select
                          value={formData.id_type}
                          onValueChange={(value) => handleInputChange('id_type', value)}
                          required
                          id="id_type"
                        >
                          <SelectTrigger className={fieldErrors.id_type ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select ID type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="National ID">National ID – for Saudi nationals</SelectItem>
                            <SelectItem value="Iqama">Iqama – for KSA residents</SelectItem>
                            <SelectItem value="Passport">Passport – for international visitors</SelectItem>
                          </SelectContent>
                        </Select>
                        {fieldErrors.id_type && (<p className="text-red-500 text-sm mt-1">{fieldErrors.id_type}</p>)}
                      </div>
                      <div>
                        <Label htmlFor="id_number">ID/Iqama/Passport Number *</Label>
                        <Input
                          id="id_number"
                          value={formData.id_number}
                          onChange={(e) => handleInputChange('id_number', e.target.value)}
                          required
                          className={fieldErrors.id_number ? 'border-red-500' : ''}
                        />
                        {fieldErrors.id_number && (<p className="text-red-500 text-sm mt-1">{fieldErrors.id_number}</p>)}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="issue_date">Issue Date *</Label>
                      <Input
                        id="issue_date"
                        type="date"
                        value={formData.issue_date}
                        onChange={(e) => handleInputChange('issue_date', e.target.value)}
                        required
                        className={fieldErrors.issue_date ? 'border-red-500' : ''}
                      />
                      {fieldErrors.issue_date && (<p className="text-red-500 text-sm mt-1">{fieldErrors.issue_date}</p>)}
                    </div>

                    {formData.id_type === 'Passport' && (
                      <div>
                        <Label htmlFor="need_visa">Do you need a Visa? *</Label>
                        <Select
                          value={formData.need_visa ? 'Yes' : 'No'}
                          onValueChange={(value) => handleInputChange('need_visa', value === 'Yes')}
                          required
                          id="need_visa"
                        >
                          <SelectTrigger className={fieldErrors.need_visa ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                        {fieldErrors.need_visa && (<p className="text-red-500 text-sm mt-1">{fieldErrors.need_visa}</p>)}
                      </div>
                    )}

                    {formData.id_type === 'Passport' && formData.need_visa && (
                      <>
                        <div>
                          <Label htmlFor="expiry_date">Expiry Date *</Label>
                          <Input
                            id="expiry_date"
                            type="date"
                            value={formData.expiry_date}
                            onChange={(e) => handleInputChange('expiry_date', e.target.value)}
                            required
                            className={fieldErrors.expiry_date ? 'border-red-500' : ''}
                          />
                          {fieldErrors.expiry_date && (<p className="text-red-500 text-sm mt-1">{fieldErrors.expiry_date}</p>)}
                        </div>
                        <div>
                          <Label htmlFor="issue_place">Passport Issue Place *</Label>
                          <Input
                            id="issue_place"
                            value={formData.issue_place}
                            onChange={(e) => handleInputChange('issue_place', e.target.value)}
                            required
                            className={fieldErrors.issue_place ? 'border-red-500' : ''}
                          />
                          {fieldErrors.issue_place && (<p className="text-red-500 text-sm mt-1">{fieldErrors.issue_place}</p>)}
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-sm text-blue-800">
                            <strong>Apply for your business visa:</strong> <a href="https://ksavisa.sa/explore-visa-options/3ed97ead-9329-4e0f-9c7c-422aa18f17df" target="_blank" rel="noopener noreferrer" className="underline">https://ksavisa.sa/explore-visa-options/3ed97ead-9329-4e0f-9c7c-422aa18f17df</a>
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Photo Uploads */}
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
                      {fieldErrors.face_photo_url && (<p className="text-red-500 text-sm mt-1">{fieldErrors.face_photo_url}</p>)}
                    </div>
                    <div>
                      <PhotoUpload
                        label="Upload your national ID, Iqama, or passport (JPG/PNG/PDF) *"
                        onUpload={(url) => handleInputChange('id_photo_url', url)}
                        value={formData.id_photo_url}
                        acceptPdf={true}
                        required
                      />
                      {fieldErrors.id_photo_url && (<p className="text-red-500 text-sm mt-1">{fieldErrors.id_photo_url}</p>)}
                    </div>
                  </CardContent>
                </Card>

                {/* Areas of Interest */}
                <Card>
                  <CardHeader><CardTitle>What are the areas you are most interested in? *</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="areas_of_interest">
                      {areasOfInterest.map((area) => (
                        <div key={area} className="flex items-center space-x-2">
                          <Checkbox
                            id={area}
                            checked={formData.areas_of_interest?.includes(area) || false}
                            onCheckedChange={(checked) => handleArrayInputChange('areas_of_interest', area, checked)}
                          />
                          <Label htmlFor={area} className="text-sm font-medium">{area}</Label>
                        </div>
                      ))}
                    </div>
                    {fieldErrors.areas_of_interest && (<p className="text-red-500 text-sm mt-1">{fieldErrors.areas_of_interest}</p>)}
                  </CardContent>
                </Card>

                {/* Business Information */}
                <Card>
                  <CardHeader><CardTitle>Business Information</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label htmlFor="primary_nature_of_business">What is your primary Nature of Business? *</Label>
                      <Select
                        value={formData.primary_nature_of_business}
                        onValueChange={(value) => handleInputChange('primary_nature_of_business', value)}
                        required
                        id="primary_nature_of_business"
                      >
                        <SelectTrigger className={fieldErrors.primary_nature_of_business ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select nature of business" />
                        </SelectTrigger>
                        <SelectContent>{businessNatures.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}</SelectContent>
                      </Select>
                      {fieldErrors.primary_nature_of_business && (<p className="text-red-500 text-sm mt-1">{fieldErrors.primary_nature_of_business}</p>)}
                    </div>
                  </CardContent>
                </Card>

                {/* Previous Attendance */}
                <Card>
                  <CardContent className="pt-6 space-y-6">
                    <div>
                      <Label htmlFor="previous_attendance">Have you attended previous FMF Edition? *</Label>
                      <Select
                        value={formData.previous_attendance === null ? "" : (formData.previous_attendance ? 'Yes' : 'No')}
                        onValueChange={(value) => handleInputChange('previous_attendance', value === 'Yes')}
                        required
                        id="previous_attendance"
                      >
                        <SelectTrigger className={fieldErrors.previous_attendance ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                          <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                      {fieldErrors.previous_attendance && (<p className="text-red-500 text-sm mt-1">{fieldErrors.previous_attendance}</p>)}
                    </div>

                    {formData.previous_attendance && (
                      <div>
                        <Label>Which year(s)? *</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2" id="previous_years">
                          {['2022', '2023', '2024', '2025'].map((year) => (
                            <div key={year} className="flex items-center space-x-2">
                              <Checkbox
                                id={year}
                                checked={formData.previous_years?.includes(year) || false}
                                onCheckedChange={(checked) => handleArrayInputChange('previous_years', year, checked)}
                              />
                              <Label htmlFor={year} className="text-sm font-medium">{year}</Label>
                            </div>
                          ))}
                        </div>
                        {fieldErrors.previous_years && (<p className="text-red-500 text-sm mt-1">{fieldErrors.previous_years}</p>)}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-end pt-6">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 px-12 py-3 text-lg"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                        {isModificationMode ? 'Updating...' : 'Submitting...'}
                      </div>
                    ) : (
                      <>
                        <Save className="w-5 h-5 mr-2" />
                        {isModificationMode ? 'Update Registration' : 'Submit Registration'}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
