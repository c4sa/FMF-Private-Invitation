import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import { User, TrophiesAndCertificates } from "@/api/entities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/common/Toast";
import { CheckCircle, Shield } from "lucide-react";
import Loader from "@/components/ui/loader";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Trophy() {
  const [currentUser, setCurrentUser] = useState(null);
  const [trophyAward, setTrophyAward] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [inquiryName, setInquiryName] = useState("");
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [inquiryMobile, setInquiryMobile] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hasTrophyAccess, setHasTrophyAccess] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);
      
      // Check if user has trophy access by querying trophies_and_certificates table
      const trophies = await TrophiesAndCertificates.getByUserIdAndType(user.id, 'trophy');
      
      if (!trophies || trophies.length === 0) {
        setHasTrophyAccess(false);
        setIsLoading(false);
        return;
      }
      
      // Get the latest trophy award
      const latestTrophy = trophies[0];
      setTrophyAward(latestTrophy);
      setHasTrophyAccess(true);
      
      // Pre-fill company name if already submitted
      if (latestTrophy.complete_company_name) {
        setCompanyName(latestTrophy.complete_company_name);
        setIsSubmitted(true);
      }
      
      // Pre-fill inquiry fields if already submitted
      if (latestTrophy.inquiry_details) {
        setInquiryName(latestTrophy.inquiry_details.name || "");
        setInquiryEmail(latestTrophy.inquiry_details.email || "");
        setInquiryMobile(latestTrophy.inquiry_details.mobile || "");
      }
      
      // Pre-fill notes if already submitted
      if (latestTrophy.notes) {
        setNotes(latestTrophy.notes || "");
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      toast({
        title: "Error",
        description: "Failed to load user data. Please try again.",
        variant: "destructive"
      });
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!companyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your complete company name.",
        variant: "destructive"
      });
      return;
    }

    if (!inquiryName.trim()) {
      toast({
        title: "Error",
        description: "Please enter the contact person's name.",
        variant: "destructive"
      });
      return;
    }

    if (!inquiryEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter the contact person's email.",
        variant: "destructive"
      });
      return;
    }

    if (!inquiryMobile.trim()) {
      toast({
        title: "Error",
        description: "Please enter the contact person's mobile number.",
        variant: "destructive"
      });
      return;
    }

    if (!trophyAward) return;

    setIsSubmitting(true);
    try {
      await TrophiesAndCertificates.update(trophyAward.id, {
        complete_company_name: companyName.trim(),
        inquiry_details: {
          name: inquiryName.trim(),
          email: inquiryEmail.trim(),
          mobile: inquiryMobile.trim()
        },
        notes: notes.trim()
      });
      
      // Update local state
      setTrophyAward(prev => ({
        ...prev,
        complete_company_name: companyName.trim(),
        inquiry_details: {
          name: inquiryName.trim(),
          email: inquiryEmail.trim(),
          mobile: inquiryMobile.trim()
        },
        notes: notes.trim()
      }));
      setIsSubmitted(true);
      
      toast({
        title: "Success",
        description: "Your company name and contact details have been saved successfully!",
        variant: "success"
      });
    } catch (error) {
      console.error("Error updating trophy information:", error);
      toast({
        title: "Error",
        description: "Failed to save information. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute pageName="Trophy">
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
          <div className="max-w-4xl mx-auto flex items-center justify-center min-h-96">
            <Loader size="default" />
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Check trophy access after loading
  if (!hasTrophyAccess) {
    return (
      <ProtectedRoute pageName="Trophy">
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col items-center justify-center min-h-96">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8 text-yellow-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Trophy Access Required</h1>
                <p className="text-gray-600 max-w-md">
                  You need to be awarded a trophy to access this page. Please contact an administrator if you believe this is an error.
                </p>
                <div className="pt-4">
                  <Button variant="outline" onClick={() => navigate(createPageUrl("Dashboard"))}>
                    Return to Dashboard
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute pageName="Trophy">
      <div className="bg-white min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-black">
              Recognition Award
            </h1>
            <p className="text-black mt-2 text-lg">Congratulations!</p>
          </div>

          {/* Main Card */}
          <Card className="bg-white shadow-lg rounded-lg border-0">
            <CardContent className="p-8">
              {isSubmitted ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-900">Information Submitted</p>
                      <p className="text-sm text-green-700 mt-1">
                        Your complete company name has been recorded: <strong>{trophyAward?.complete_company_name}</strong>
                      </p>
                      {trophyAward?.inquiry_details && (
                        <div className="mt-2 text-sm text-green-700">
                          <p>Contact details:</p>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            <li>Name: <strong>{trophyAward.inquiry_details.name}</strong></li>
                            <li>Email: <strong>{trophyAward.inquiry_details.email}</strong></li>
                            <li>Mobile: <strong>{trophyAward.inquiry_details.mobile}</strong></li>
                          </ul>
                        </div>
                      )}
                      {trophyAward?.notes && (
                        <div className="mt-2 text-sm text-green-700">
                          <p className="font-semibold">Notes:</p>
                          <p className="mt-1 whitespace-pre-wrap">{trophyAward.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsSubmitted(false);
                        setCompanyName(trophyAward?.complete_company_name || "");
                        setInquiryName(trophyAward?.inquiry_details?.name || "");
                        setInquiryEmail(trophyAward?.inquiry_details?.email || "");
                        setInquiryMobile(trophyAward?.inquiry_details?.mobile || "");
                        setNotes(trophyAward?.notes || "");
                      }}
                    >
                      Update Information
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Award Message */}
                  <div className="mb-6">
                    <p className="text-black text-base leading-relaxed">
                      We are pleased to present FMF 2026 Trophy to you in appreciation of your valuable support and contribution to the success of the 5th Future Minerals Forum.
                    </p>
                  </div>

                  {/* Company Name Section */}
                  <div className="space-y-3">
                    <Label htmlFor="company_name" className="text-base font-bold text-black">
                      Company Name
                    </Label>
                    <p className="text-sm text-black">
                      Please provide the exact company name as you would like it to appear on your award.
                    </p>
                    <Input
                      id="company_name"
                      type="text"
                      placeholder="Enter your complete company name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="text-base border-gray-300"
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Inquiry Fields Section */}
                  <div className="space-y-4 pt-6 border-t border-gray-200">
                    <p className="text-base font-bold text-black">
                      Kindly share the contact details (name, email and mobile) of the person we should reach out to for any inquiries.
                    </p>
                    
                    <div className="space-y-4">
                      {/* Name and Mobile on the same line */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="inquiry_name" className="text-sm font-bold text-black">
                            Name:
                          </Label>
                          <Input
                            id="inquiry_name"
                            type="text"
                            placeholder="Enter contact person's name"
                            value={inquiryName}
                            onChange={(e) => setInquiryName(e.target.value)}
                            className="text-base border-gray-300"
                            required
                            disabled={isSubmitting}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="inquiry_mobile" className="text-sm font-bold text-black">
                            Mobile:
                          </Label>
                          <Input
                            id="inquiry_mobile"
                            type="tel"
                            placeholder="Enter contact person's mobile number"
                            value={inquiryMobile}
                            onChange={(e) => setInquiryMobile(e.target.value)}
                            className="text-base border-gray-300"
                            required
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="inquiry_email" className="text-sm font-bold text-black">
                          Email:
                        </Label>
                        <Input
                          id="inquiry_email"
                          type="email"
                          placeholder="Enter contact person's email"
                          value={inquiryEmail}
                          onChange={(e) => setInquiryEmail(e.target.value)}
                          className="text-base border-gray-300"
                          required
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div className="space-y-3 pt-6 border-t border-gray-200">
                    <Label htmlFor="notes" className="text-base font-bold text-black">
                      Notes (Optional):
                    </Label>
                    <p className="text-sm text-black">
                      Add any additional notes or comments about this trophy.
                    </p>
                    <Textarea
                      id="notes"
                      placeholder="Enter any notes or comments..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="text-base border-gray-300 min-h-[100px]"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-4">
                    <Button
                      type="submit"
                      disabled={isSubmitting || !companyName.trim() || !inquiryName.trim() || !inquiryEmail.trim() || !inquiryMobile.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          Saving...
                        </div>
                      ) : (
                        "Submit Company Name"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

