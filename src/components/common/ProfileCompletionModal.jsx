import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from '@/api/entities';
import { useToast } from '@/components/common/Toast';
import { Save, X, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ProfilePhotoUpload from '../user/ProfilePhotoUpload';

export default function ProfileCompletionModal({ isOpen, currentUser, onUserUpdate, onClose }) {
  const [formData, setFormData] = useState({
    preferred_name: '',
    company_name: '',
    mobile: '',
    avatar_url: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [toastShown, setToastShown] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      setFormData({
        preferred_name: currentUser.preferred_name || '',
        company_name: currentUser.company_name || '',
        mobile: currentUser.mobile || '',
        avatar_url: currentUser.avatar_url || ''
      });
    }
  }, [currentUser]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpdate = (avatarUrl) => {
    setFormData(prev => ({ ...prev, avatar_url: avatarUrl }));
  };

  const isProfileComplete = () => {
    return formData.preferred_name.trim() !== '' && 
           formData.company_name.trim() !== '' && 
           formData.mobile.trim() !== '' &&
           currentUser?.is_reset === true;
  };

  const handleSave = async () => {
    if (!formData.preferred_name.trim()) {
      toast({
        title: "Error",
        description: "Preferred name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.company_name.trim()) {
      toast({
        title: "Error",
        description: "Company name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.mobile.trim()) {
      toast({
        title: "Error",
        description: "Mobile number is required.",
        variant: "destructive",
      });
      return;
    }


    setIsSaving(true);
    try {
      await User.updateMyUserData(formData);
      
      // Update the current user state
      const updatedUser = { ...currentUser, ...formData };
      onUserUpdate(updatedUser);
      
      toast({
        title: "Success",
        description: "Profile completed successfully!",
        variant: "success",
      });
      onClose();
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
    setIsSaving(false);
  };

  const handleCloseAttempt = (event) => {
    if (!isProfileComplete()) {
      // Prevent the default close behavior
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      
      // Only show toast if one hasn't been shown recently
      if (!toastShown) {
        setToastShown(true);
        toast({
          title: "Profile Incomplete",
          description: "Please complete your profile before continuing. Preferred name, company name, mobile number, and password reset are required.",
          variant: "destructive",
        });
        
        // Reset the flag after a short delay
        setTimeout(() => {
          setToastShown(false);
        }, 2000);
      }
      return false;
    }
  };

  const handleResetPassword = () => {
    navigate('/reset-password');
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open && !isProfileComplete()) {
          handleCloseAttempt();
        }
      }}
    >
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:hidden" 
        onPointerDownOutside={(e) => {
          e.preventDefault();
          handleCloseAttempt(e);
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          handleCloseAttempt(e);
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Complete Your Profile</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCloseAttempt}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="font-medium">Profile Completion Required</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              Please complete your profile information to continue using the system. Preferred name, company name, mobile number, and password reset are required for your account.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      value={currentUser?.email || ''}
                      disabled
                      className="bg-gray-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <Label htmlFor="preferred_name">Preferred Name *</Label>
                    <Input
                      id="preferred_name"
                      value={formData.preferred_name}
                      onChange={(e) => handleInputChange('preferred_name', e.target.value)}
                      placeholder="Enter your preferred display name"
                      className={!formData.preferred_name.trim() ? 'border-red-300' : ''}
                    />
                    {!formData.preferred_name.trim() && (
                      <p className="text-xs text-red-500 mt-1">This field is required</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="company_name">Company Name *</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => handleInputChange('company_name', e.target.value)}
                      placeholder="Enter your company name"
                      className={!formData.company_name.trim() ? 'border-red-300' : ''}
                    />
                    {!formData.company_name.trim() && (
                      <p className="text-xs text-red-500 mt-1">This field is required</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="mobile">Mobile Number *</Label>
                    <Input
                      id="mobile"
                      value={formData.mobile}
                      onChange={(e) => handleInputChange('mobile', e.target.value)}
                      placeholder="Enter your mobile number"
                      className={!formData.mobile.trim() ? 'border-red-300' : ''}
                    />
                    {!formData.mobile.trim() && (
                      <p className="text-xs text-red-500 mt-1">This field is required</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <ProfilePhotoUpload 
              currentUser={currentUser} 
              onPhotoUpdate={handlePhotoUpdate}
            />
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className={`border rounded-lg p-4 ${currentUser?.is_reset ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className={`flex items-center gap-2 ${currentUser?.is_reset ? 'text-green-800' : 'text-red-800'}`}>
                <div className={`w-2 h-2 rounded-full ${currentUser?.is_reset ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="font-medium">
                  {currentUser?.is_reset ? 'Password Reset Completed' : 'Password Reset Required'}
                </span>
              </div>
              <p className={`text-sm mt-1 ${currentUser?.is_reset ? 'text-green-700' : 'text-red-700'}`}>
                {currentUser?.is_reset 
                  ? 'Your password has been reset successfully. You can now complete your profile.'
                  : 'For security reasons, you must reset your password before completing your profile.'
                }
              </p>
            </div>
            
            <div className="flex justify-center">
              <Button 
                onClick={handleResetPassword}
                className={`flex items-center gap-2 ${currentUser?.is_reset 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                {currentUser?.is_reset ? 'Password Already Reset' : 'Reset Password (Required)'}
              </Button>
            </div>
            
            <div className="flex justify-center">
              <Button 
                onClick={handleSave} 
                disabled={isSaving || !isProfileComplete()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Saving...
                  </div>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Complete Profile
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
