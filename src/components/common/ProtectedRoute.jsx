
import React, { useState, useEffect, useCallback } from 'react';
import { User, SystemSetting } from "@/api/entities";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import Loader from '@/components/ui/loader';

// Map page names to their corresponding module keys
const pageModuleMap = {
  'Dashboard': 'dashboard',
  'Registration': 'registration',
  'Attendees': 'attendees',
  'PrivateInvitations': 'private_invitations',
  'PartnershipManagement': 'partnership_management',
  'Analytics': 'analytics',
  'AnalyticsDashboard': 'analytics',
  'SystemUsers': 'system_users',
  'Requests': 'requests',
  'Settings': 'settings',
  'AccessLevels': 'access_levels'
};

export default function ProtectedRoute({ children, adminOnly = false, pageName }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const navigate = useNavigate();

  const checkAccess = useCallback(async () => {
    try {
      const user = await User.me();
      
      // Force profile setup for first-time users
      if (!user.preferred_name) {
        navigate(createPageUrl("ProfileSetup"));
        return;
      }
      
      // Check module-level permissions if pageName is provided
      if (pageName && pageModuleMap[pageName]) {
        const moduleKey = pageModuleMap[pageName];
        const userType = (user.system_role || 'User').toLowerCase().replace(' ', '_');
        const settingKey = `module_${moduleKey}_enabled_for_${userType}`;

        console.log(`Checking access for page: ${pageName}, module: ${moduleKey}, userType: ${userType}, settingKey: ${settingKey}`);

        // Load module settings
        const settingsData = await SystemSetting.list();
        const moduleSetting = settingsData.find(s => s.key === settingKey);
        
        console.log(`Module setting found:`, moduleSetting);
        
        // Define default modules for each user type
        const defaultModules = {
          'admin': ['dashboard', 'private_invitations', 'attendees', 'registration', 'partnership_management', 'analytics', 'system_users', 'requests', 'settings'],
          'super_user': ['dashboard', 'attendees', 'registration', 'system_users'],
          'user': ['dashboard', 'attendees', 'registration', 'access_levels']
        };
        
        const userDefaultModules = defaultModules[userType] || [];
        const isDefaultModule = userDefaultModules.includes(moduleKey);
        
        // If setting exists, use its value
        if (moduleSetting) {
          if (moduleSetting.value === 'true') {
            // Setting exists and is enabled, allow access
            console.log(`Module ${moduleKey} is explicitly enabled for ${userType}`);
          } else {
            // Setting exists but is disabled, deny access
            console.log(`Module ${moduleKey} is explicitly disabled for ${userType}`);
            navigate(createPageUrl("Dashboard"));
            return;
          }
        } else {
          // If no setting exists, only allow if it's a default module for this user type
          if (isDefaultModule) {
            console.log(`Module ${moduleKey} is a default module for ${userType}, allowing access`);
          } else {
            console.log(`Module ${moduleKey} is not a default module for ${userType} and no setting exists, denying access`);
            navigate(createPageUrl("Dashboard"));
            return;
          }
        }
      } else {
        // If no pageName is provided, fall back to admin-only check
        if (adminOnly) {
          const isAdmin = user.role === 'admin' || user.system_role === 'Admin';
          if (!isAdmin) {
            // If not an admin, redirect them to a safe page.
            navigate(createPageUrl("Dashboard"));
            return;
          }
        }
      }

      setHasAccess(true);
    } catch (error) {
      console.error("Access check failed, redirecting to login:", error);
      // If any error occurs (e.g., not logged in), trigger the main login flow,
      // and redirect back to the current page after successful login.
      User.loginWithRedirect(window.location.href);
    }
    setIsLoading(false);
  }, [adminOnly, pageName, navigate]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  if (isLoading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <Loader size="default" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
}
