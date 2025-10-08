import React, { useState, useEffect, useCallback } from 'react';
import { SystemSetting } from '@/api/entities';
import { updateEmailTemplateStatus } from '@/api/functions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/common/Toast";

const initialSettings = {
  welcome: { 
    isEnabled: true, isLoading: true, id: null, key: 'send_welcome_email', 
    label: 'Send Approval Welcome Email',
    description: 'Sent to attendees when their registration is approved by an admin.'
  },
  invitation: { 
    isEnabled: true, isLoading: true, id: null, key: 'send_invitation_email',
    label: 'Send Invitation Email for New Links',
    description: 'Sent from the Invitations page to a specific email address.'
  },
  modification_request: {
    isEnabled: true, isLoading: true, id: null, key: 'send_modification_request_email',
    label: 'Send Registration Modification Requests',
    description: 'Sent to attendees when admins request changes to their registration details.'
  },
  user_role_changed: {
    isEnabled: true, isLoading: true, id: null, key: 'send_user_role_changed_email',
    label: 'User Role Changed Notifications',
    description: 'Sent to administrators when a user\'s role is changed in the system.'
  },
  user_login: {
    isEnabled: true, isLoading: true, id: null, key: 'send_user_login_email',
    label: 'User Login Notifications',
    description: 'Sent to administrators when a user logs into the system.'
  },
  new_user_request: {
    isEnabled: true, isLoading: true, id: null, key: 'send_new_user_request_email',
    label: 'New User Request Notifications',
    description: 'Sent to administrators when a new user is requested for the system.'
  },
  user_updated: {
    isEnabled: true, isLoading: true, id: null, key: 'send_user_updated_email',
    label: 'User Updated Notifications',
    description: 'Sent to administrators when a system user is updated.'
  },
  registration_confirmation: {
    isEnabled: true, isLoading: true, id: null, key: 'send_registration_confirmation_email',
    label: 'Registration Confirmation Emails',
    description: 'Sent to attendees when their registration is confirmed.'
  },
  attendee_status_change: {
    isEnabled: true, isLoading: true, id: null, key: 'send_attendee_status_change_email',
    label: 'Attendee Status Change Notifications',
    description: 'Sent to attendees when their registration status changes.'
  },
  password_reset: {
    isEnabled: true, isLoading: true, id: null, key: 'send_password_reset_email',
    label: 'Password Reset Emails',
    description: 'Sent to users when they request a password reset.'
  },
  send_otp: {
    isEnabled: true, isLoading: true, id: null, key: 'send_otp_email',
    label: 'OTP Verification Emails',
    description: 'Sent to users with verification codes for various processes.'
  },
  user_created: {
    isEnabled: true, isLoading: true, id: null, key: 'send_user_created_email',
    label: 'New User Created Notifications',
    description: 'Sent to administrators when a new system user is created.'
  },
  new_user_notification: {
    isEnabled: true, isLoading: true, id: null, key: 'send_new_user_notification_email',
    label: 'New User Access Request Notifications',
    description: 'Sent to users when a system access request is submitted on their behalf.'
  },
  registration_rejection: {
    isEnabled: true, isLoading: true, id: null, key: 'send_registration_rejection_email',
    label: 'Registration Rejection Emails',
    description: 'Sent to attendees when their registration is rejected.'
  },
};

export default function EmailActivationSettings() {
  const [settings, setSettings] = useState(initialSettings);
  const { toast } = useToast();

  const loadSettings = useCallback(async () => {
    try {
      const systemSettings = await SystemSetting.list();
      setSettings(prev => {
        const newSettings = JSON.parse(JSON.stringify(prev)); // Deep copy
        Object.keys(newSettings).forEach(key => {
          const settingInfo = newSettings[key];
          const dbSetting = systemSettings.find(s => s.key === settingInfo.key);
          if (dbSetting) {
            settingInfo.isEnabled = dbSetting.value === 'true';
            settingInfo.id = dbSetting.id;
          } else {
            settingInfo.isEnabled = true; // Default to true if not in DB
            settingInfo.id = null;
          }
          settingInfo.isLoading = false;
        });
        return newSettings;
      });
    } catch (error) {
      console.error("Failed to load email settings:", error);
      toast({
        title: "Error",
        description: "Could not load email activation settings.",
        variant: "destructive",
      });
      setSettings(prev => {
        const newSettings = JSON.parse(JSON.stringify(prev));
        Object.keys(newSettings).forEach(key => { newSettings[key].isLoading = false; });
        return newSettings;
      });
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleToggle = async (settingKey, checked) => {
    const settingToUpdate = settings[settingKey];
    const previousState = settingToUpdate.isEnabled;
    
    setSettings(prev => ({
      ...prev,
      [settingKey]: { ...prev[settingKey], isEnabled: checked }
    }));

    const newValue = String(checked);

    try {
      // Update system settings (original functionality)
      if (settingToUpdate.id) {
        await SystemSetting.update(settingToUpdate.id, { value: newValue });
      } else {
        const newSetting = await SystemSetting.create({
          key: settingToUpdate.key,
          value: newValue,
          description: `Controls whether the ${settingKey} email is sent.`
        });
        setSettings(prev => ({
          ...prev,
          [settingKey]: { ...prev[settingKey], id: newSetting.id }
        }));
      }

      // Update email template status in email_templates table
      try {
        await updateEmailTemplateStatus(settingKey, checked);
        console.log(`Successfully updated email template ${settingKey} status to ${checked}`);
      } catch (templateError) {
        console.warn(`Failed to update email template ${settingKey} status:`, templateError);
        // Don't fail the entire operation if template update fails
      }

      toast({
        title: "Setting Saved",
        description: `${settingToUpdate.label} ${checked ? 'enabled' : 'disabled'}.`,
        variant: "success",
      });
    } catch (error) {
      console.error(`Failed to save ${settingKey} setting:`, error);
      toast({
        title: "Error",
        description: "Failed to save your changes. Please try again.",
        variant: "destructive",
      });
      setSettings(prev => ({
        ...prev,
        [settingKey]: { ...prev[settingKey], isEnabled: previousState }
      }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Activation Settings</CardTitle>
        <CardDescription>
          Enable or disable various email notifications and communications sent by the system.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(settings).map(([key, setting]) => (
          <div key={key}>
            {setting.isLoading ? (
              <div className="h-10 flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="flex items-start space-x-3">
                <Checkbox
                  id={`enable-${key}-email`}
                  checked={setting.isEnabled}
                  onCheckedChange={(checked) => handleToggle(key, checked)}
                  className="mt-1"
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor={`enable-${key}-email`} className="font-medium text-base">
                    {setting.label}
                  </Label>
                  <p className="text-sm text-gray-500">{setting.description}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}