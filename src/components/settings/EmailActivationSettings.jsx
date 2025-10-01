import React, { useState, useEffect, useCallback } from 'react';
import { SystemSetting } from '@/api/entities';
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
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Manage various system settings, including email automation.
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