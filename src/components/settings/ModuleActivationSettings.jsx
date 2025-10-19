
import React, { useState, useEffect, useCallback } from 'react';
import { SystemSetting } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/common/Toast";
import Loader from "@/components/ui/loader";
import {
  UserPlus,
  Users,
  Mail,
  Settings as SettingsIcon,
  BarChart,
  Handshake,
  Bell,
  FileText,
  LayoutDashboard, // Added
  ClipboardList // Added
} from "lucide-react";

const modules = [
    { 
        key: 'dashboard', 
        label: 'Dashboard', 
        description: 'The main landing page with stats',
        icon: LayoutDashboard,
        category: 'Core'
    },
    { 
        key: 'registration', 
        label: 'Registration', 
        description: 'Create and edit attendee registrations',
        icon: UserPlus,
        category: 'Core'
    },
    { 
        key: 'attendees', 
        label: 'Attendees', 
        description: 'View and manage all attendees',
        icon: Users,
        category: 'Core'
    },
    { 
        key: 'private_invitations', 
        label: 'VIP Invitations', 
        description: 'Generate invitation codes',
        icon: Mail,
        category: 'Core'
    },
    { 
        key: 'access_levels', 
        label: 'My Access', 
        description: 'Shows users their available slots',
        icon: ClipboardList,
        category: 'Core'
    },
    { 
        key: 'partnership_management', 
        label: 'Partnership Management', 
        description: 'Manage partner types and allocations',
        icon: Handshake,
        category: 'Management'
    },
    { 
        key: 'analytics', 
        label: 'Analytics & Reports', 
        description: 'View system reports and analytics',
        icon: BarChart,
        category: 'Reports'
    },
    { 
        key: 'system_users', 
        label: 'System Users', 
        description: 'Manage system users and permissions',
        icon: Users,
        category: 'Management'
    },
    { 
        key: 'requests', 
        label: 'Requests', 
        description: 'Handle modification and slot requests',
        icon: Bell,
        category: 'Management'
    },
    { 
        key: 'settings', 
        label: 'Settings', 
        description: 'System configuration and templates',
        icon: SettingsIcon,
        category: 'Management'
    }
];

const userTypes = [
    { key: 'admin', label: 'Admin', color: 'bg-red-500', description: 'Full system access' },
    { key: 'super_user', label: 'Super User', color: 'bg-yellow-500', description: 'Limited admin access' },
    { key: 'user', label: 'User', color: 'bg-blue-500', description: 'Standard user access' }
];

export default function ModuleActivationSettings() {
  const [moduleSettings, setModuleSettings] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingStates, setSavingStates] = useState({});
  const { toast } = useToast();

  const loadAllSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const systemSettings = await SystemSetting.list();
      const newSettings = {};
      
      // Load all settings for all combinations
      modules.forEach(mod => {
          userTypes.forEach(type => {
              const settingKey = `module_${mod.key}_enabled_for_${type.key}`;
              const dbSetting = systemSettings.find(s => s.key === settingKey);
              newSettings[settingKey] = {
                  isEnabled: dbSetting ? dbSetting.value === 'true' : false,
                  id: dbSetting ? dbSetting.id : null
              };
          });
      });
      
      setModuleSettings(newSettings);
    } catch (error) {
      console.error("Failed to load module settings:", error);
      toast({
        title: "Error",
        description: "Could not load module settings.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadAllSettings();
  }, [loadAllSettings]);

  const handleToggle = async (moduleKey, userType, checked) => {
    const settingKey = `module_${moduleKey}_enabled_for_${userType}`;
    const settingToUpdate = moduleSettings[settingKey];
    const previousState = settingToUpdate?.isEnabled;
    
    // Set saving state for this specific toggle
    setSavingStates(prev => ({ ...prev, [settingKey]: true }));
    
    // Optimistically update UI
    setModuleSettings(prev => ({
      ...prev,
      [settingKey]: { ...prev[settingKey], isEnabled: checked }
    }));

    const newValue = String(checked);

    try {
      if (settingToUpdate?.id) {
        await SystemSetting.update(settingToUpdate.id, { value: newValue });
      } else {
        const newSetting = await SystemSetting.create({ 
          key: settingKey, 
          value: newValue,
          description: `Controls access to ${moduleKey} for ${userType.replace('_', ' ')}`
        });
        setModuleSettings(prev => ({
          ...prev,
          [settingKey]: { ...prev[settingKey], id: newSetting.id }
        }));
      }
      
      toast({
        title: "Updated",
        description: `${moduleKey} access updated for ${userType.replace('_', ' ')}`,
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to save module setting:", error);
      toast({
        title: "Error",
        description: "Failed to save changes.",
        variant: "destructive",
      });
      
      // Revert the optimistic update
      setModuleSettings(prev => ({
        ...prev,
        [settingKey]: { ...prev[settingKey], isEnabled: previousState }
      }));
    } finally {
      setSavingStates(prev => ({ ...prev, [settingKey]: false }));
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Loader size="default" />
            <span className="ml-3 text-gray-600">Loading module permissions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group modules by category
  const groupedModules = modules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5" />
          Module Access Control
        </CardTitle>
        <CardDescription>
          Configure which modules each user type can access. Changes take effect immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        
        {/* User Type Legend */}
        <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
          {userTypes.map(userType => (
            <div key={userType.key} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${userType.color}`}></div>
              <div>
                <span className="font-medium text-sm">{userType.label}</span>
                <p className="text-xs text-gray-500">{userType.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Permissions Matrix */}
        <div className="space-y-6">
          {Object.entries(groupedModules).map(([category, categoryModules]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                {category} Modules
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Module</th>
                      {userTypes.map(userType => (
                        <th key={userType.key} className="text-center py-3 px-4 min-w-[120px]">
                          <div className="flex items-center justify-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${userType.color}`}></div>
                            <span className="font-medium text-sm">{userType.label}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categoryModules.map((module) => {
                      const Icon = module.icon;
                      return (
                        <tr key={module.key} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <Icon className="w-5 h-5 text-gray-600" />
                              <div>
                                <div className="font-medium text-gray-900">{module.label}</div>
                                <div className="text-sm text-gray-500">{module.description}</div>
                              </div>
                            </div>
                          </td>
                          {userTypes.map(userType => {
                            const settingKey = `module_${module.key}_enabled_for_${userType.key}`;
                            const currentSetting = moduleSettings[settingKey];
                            const isSaving = savingStates[settingKey];
                            
                            return (
                              <td key={userType.key} className="py-4 px-4 text-center">
                                <div className="flex items-center justify-center">
                                  {isSaving ? (
                                    <Loader size="small" />
                                  ) : (
                                    <Switch
                                      checked={currentSetting?.isEnabled || false}
                                      onCheckedChange={(checked) => handleToggle(module.key, userType.key, checked)}
                                      className="data-[state=checked]:bg-green-500"
                                    />
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Info */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
              <span className="text-white text-xs font-bold">i</span>
            </div>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How it works:</p>
              <ul className="space-y-1 text-xs">
                <li>• <strong>Green toggle = Enabled:</strong> Users of that type can access this module</li>
                <li>• <strong>Gray toggle = Disabled:</strong> Users of that type cannot see or access this module</li>
                <li>• <strong>Dashboard is always accessible</strong> for all user types</li>
                <li>• Changes take effect immediately - users will see navigation update in real-time</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
