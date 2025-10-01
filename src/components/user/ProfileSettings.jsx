import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from '@/api/entities';
import { useToast } from '@/components/common/Toast';
import { Save } from 'lucide-react';
import ProfilePhotoUpload from './ProfilePhotoUpload';

export default function ProfileSettings({ isOpen, onClose, currentUser, onUserUpdate }) {
  const [formData, setFormData] = useState({
    preferred_name: '',
    company_name: '',
    mobile: '',
    avatar_url: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

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

  const handleSave = async () => {
    if (!formData.preferred_name.trim()) {
      toast({
        title: "Error",
        description: "Preferred name is required.",
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
        description: "Profile updated successfully!",
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Profile Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
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
                    />
                  </div>

                  <div>
                    <Label htmlFor="company_name">Company Name</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => handleInputChange('company_name', e.target.value)}
                      placeholder="Enter your company name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="mobile">Mobile Number</Label>
                    <Input
                      id="mobile"
                      value={formData.mobile}
                      onChange={(e) => handleInputChange('mobile', e.target.value)}
                      placeholder="Enter your mobile number"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <ProfilePhotoUpload 
              currentUser={currentUser} 
              onPhotoUpdate={handlePhotoUpdate}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Saving...
                </div>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}