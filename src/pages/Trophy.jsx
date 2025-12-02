import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/common/Toast";
import { Trophy as TrophyIcon, CheckCircle, Shield } from "lucide-react";
import Loader from "@/components/ui/loader";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Trophy() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState("");
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
      
      // Check if user has trophy access
      if (user.trophy_given !== true) {
        setHasTrophyAccess(false);
        setIsLoading(false);
        return;
      }
      
      setHasTrophyAccess(true);
      
      // Pre-fill company name if already submitted
      if (user.complete_company_name) {
        setCompanyName(user.complete_company_name);
        setIsSubmitted(true);
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

    if (!currentUser) return;

    setIsSubmitting(true);
    try {
      await User.update(currentUser.id, { complete_company_name: companyName.trim() });
      
      // Update local state
      setCurrentUser(prev => ({ ...prev, complete_company_name: companyName.trim() }));
      setIsSubmitted(true);
      
      toast({
        title: "Success",
        description: "Your complete company name has been saved successfully!",
        variant: "success"
      });
    } catch (error) {
      console.error("Error updating company name:", error);
      toast({
        title: "Error",
        description: "Failed to save company name. Please try again.",
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
      <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <TrophyIcon className="w-8 h-8 text-yellow-500" />
              Trophy Award
            </h1>
            <p className="text-gray-500 mt-2">Congratulations on receiving a trophy during the event!</p>
          </div>

          {/* Main Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrophyIcon className="w-5 h-5 text-yellow-500" />
                Complete Company Name
              </CardTitle>
              <CardDescription>
                You have received a trophy during the event. Please provide your complete and correct company name below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isSubmitted ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-900">Company Name Submitted</p>
                      <p className="text-sm text-green-700 mt-1">
                        Your complete company name has been recorded: <strong>{currentUser?.complete_company_name}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsSubmitted(false);
                        setCompanyName(currentUser?.complete_company_name || "");
                      }}
                    >
                      Update Company Name
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="company_name" className="text-base font-semibold">
                      Complete Company Name
                    </Label>
                    <p className="text-sm text-gray-500 mt-1 mb-3">
                      Please enter the complete and correct name of your company as it should appear in official records.
                    </p>
                    <Input
                      id="company_name"
                      type="text"
                      placeholder="Enter your complete company name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="text-base"
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="submit"
                      disabled={isSubmitting || !companyName.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
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

          {/* Information Card */}
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <TrophyIcon className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">About Your Trophy</h3>
                  <p className="text-sm text-gray-600">
                    You have been awarded a trophy for your participation during the event. This recognition is a testament to your valuable contribution. 
                    Please ensure that your complete company name is accurately recorded for our records.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

