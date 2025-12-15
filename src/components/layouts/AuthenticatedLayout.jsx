
import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User, SystemSetting, TrophiesAndCertificates } from "@/api/entities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Loader from "@/components/ui/loader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Settings as SettingsIcon,
  Ticket,
  GanttChartSquare,
  BarChart,
  ClipboardList,
  Mail,
  LogOut,
  Briefcase,
  Bell,
  User as UserIcon,
  Trophy,
  Award,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar";
import NotificationCenter from "../common/NotificationCenter";
import ProfileSettings from "../user/ProfileSettings";

const adminNavigationItems = [
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard, module: "dashboard" },
  { title: "VIP Invitations", url: createPageUrl("PrivateInvitations"), icon: Ticket, module: "private_invitations" },
  { title: "Attendees", url: createPageUrl("Attendees"), icon: Users, module: "attendees" },
  { title: "Registration", url: createPageUrl("Registration"), icon: UserPlus, module: "registration" },
  { title: "Partnership Management", url: createPageUrl("PartnershipManagement"), icon: Briefcase, module: "partnership_management" },
  { title: "Analytics/Reports", url: createPageUrl("AnalyticsDashboard"), icon: BarChart, module: "analytics" },
  { title: "PartnershipUsers", url: createPageUrl("SystemUsers"), icon: GanttChartSquare, module: "system_users" },
  { title: "Requests", url: createPageUrl("Requests"), icon: Bell, module: "requests" },
  { title: "Settings", url: createPageUrl("Settings"), icon: SettingsIcon, module: "settings" },
];

  const superUserNavigationItems = [
      {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
    module: "dashboard"
  },
  {
    title: "Attendees",
    url: createPageUrl("Attendees"),
    icon: Users,
    module: "attendees"
  },
  {
    title: "Registration",
    url: createPageUrl("Registration"),
    icon: UserPlus,
    module: "registration"
  },
    {
    title: "System Users",
    url: createPageUrl("SystemUsers"),
    icon: GanttChartSquare,
    module: "system_users"
  },
];

const userNavigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
    module: "dashboard"
  },
  {
    title: "My Attendees",
    url: createPageUrl("Attendees"),
    icon: Users,
    module: "attendees"
  },
  {
    title: "Registration",
    url: createPageUrl("Registration"),
    icon: UserPlus,
    module: "registration"
  },
  {
    title: "My Access",
    url: createPageUrl("AccessLevels"),
    icon: ClipboardList,
    module: "access_levels"
  }
];


export default function AuthenticatedLayout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [moduleSettings, setModuleSettings] = useState({});
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [hasTrophy, setHasTrophy] = useState(false);
  const [hasCertificate, setHasCertificate] = useState(false);

  const loadCurrentUserAndSettings = useCallback(async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);

      // Load module activation settings
      const settingsData = await SystemSetting.list();
      const newModuleSettings = {};
      settingsData.filter(s => s.key.startsWith('module_')).forEach(s => {
          newModuleSettings[s.key] = s.value === 'true';
      });
      setModuleSettings(newModuleSettings);

      // Check for trophy and certificate awards
      try {
        const [trophies, certificates] = await Promise.all([
          TrophiesAndCertificates.getByUserIdAndType(user.id, 'trophy'),
          TrophiesAndCertificates.getByUserIdAndType(user.id, 'certificate')
        ]);
        setHasTrophy(trophies && trophies.length > 0);
        setHasCertificate(certificates && certificates.length > 0);
      } catch (awardError) {
        console.error('Error loading awards:', awardError);
        // Fallback to old trophy_given field if it still exists during migration
        setHasTrophy(user.trophy_given === true);
        setHasCertificate(false);
      }

    } catch (error) {
      // Not logged in, redirect
      if (currentPageName !== 'PublicRegistration' && currentPageName !== 'ProfileSetup') {
          User.loginWithRedirect(window.location.href);
      }
    }
    setIsLoading(false);
  }, [currentPageName]);

  const handleSignOut = async () => {
    try {
      await User.logout();
      // Navigate to login screen after successful logout
      navigate('/login');
    } catch (error) {
      console.error("Error during sign out:", error);
      // Even if logout fails, navigate to login screen
      navigate('/login');
    }
  };

  const handleUserUpdate = async (updatedUser) => {
    // Update the current user state with the new data
    setCurrentUser(updatedUser);
    
    // Also refresh user data from the database to ensure we have the latest info
    try {
      const freshUser = await User.me();
      setCurrentUser(freshUser);
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      // If refresh fails, keep the updated user data we received
    }
  };

  useEffect(() => {
    loadCurrentUserAndSettings();
  }, [loadCurrentUserAndSettings]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader size="default" />
      </div>
    );
  }

  const systemUserType = currentUser?.system_role || 'User';
  
  // Create a comprehensive list of all possible navigation items
  const allNavigationItems = [
    { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard, module: "dashboard" },
    { title: "VIP Invitations", url: createPageUrl("PrivateInvitations"), icon: Ticket, module: "private_invitations" },
    { title: "Attendees", url: createPageUrl("Attendees"), icon: Users, module: "attendees" },
    { title: "Registration", url: createPageUrl("Registration"), icon: UserPlus, module: "registration" },
    { title: "Partnership Management", url: createPageUrl("PartnershipManagement"), icon: Briefcase, module: "partnership_management" },
    { title: "Analytics/Reports", url: createPageUrl("AnalyticsDashboard"), icon: BarChart, module: "analytics" },
    { title: "System Users", url: createPageUrl("SystemUsers"), icon: GanttChartSquare, module: "system_users" },
    { title: "Requests", url: createPageUrl("Requests"), icon: Bell, module: "requests" },
    { title: "Settings", url: createPageUrl("Settings"), icon: SettingsIcon, module: "settings" },
    { title: "My Access", url: createPageUrl("AccessLevels"), icon: ClipboardList, module: "access_levels" },
    { title: "Sponsor Trophy", url: createPageUrl("Trophy"), icon: Trophy, module: "trophy", requiresTrophy: true },
    { title: "Certificate", url: createPageUrl("Certificate"), icon: Award, module: "certificate", requiresCertificate: true }
  ];

  // Get default navigation items for this user type
  let defaultNavigationItems = userNavigationItems;
  if (systemUserType === 'Admin') {
    defaultNavigationItems = adminNavigationItems;
  } else if (systemUserType === 'Super User') {
    defaultNavigationItems = superUserNavigationItems;
  }
  
  const userDisplayName = currentUser?.preferred_name || currentUser?.full_name || currentUser?.email || 'User';
  const userRole = currentUser?.system_role || 'User';

  // Check if a module is enabled for the current user type
  const isModuleEnabled = (moduleName, userType) => {
    if (!moduleName) return true; // Always show items without a module key
    const settingKey = `module_${moduleName}_enabled_for_${userType.toLowerCase().replace(' ', '_')}`;
    
    // If setting exists, use its value
    if (settingKey in moduleSettings) {
      return moduleSettings[settingKey] === true;
    }
    
    // If no setting exists, check if this module is in the default navigation for this user type
    const defaultModules = defaultNavigationItems.map(item => item.module);
    return defaultModules.includes(moduleName);
  };

  // Filter navigation items based on module settings and trophy/certificate requirement
  const navigationItems = allNavigationItems.filter(item => {
    // Check if item requires trophy and user has trophy
    if (item.requiresTrophy) {
      return hasTrophy;
    }
    // Check if item requires certificate and user has certificate
    if (item.requiresCertificate) {
      return hasCertificate;
    }
    // Otherwise, check module settings
    return isModuleEnabled(item.module, systemUserType);
  });

  return (
    <SidebarProvider>
      <style>{`
        :root {
          --primary-blue: #1e40af;
          --primary-blue-light: #3b82f6;
          --primary-blue-lighter: #dbeafe;
          --text-primary: #1f2937;
          --text-secondary: #6b7280;
          --border-color: #e5e7eb;
          --background-primary: #ffffff;
          --background-secondary: #f8fafc;
        }
      `}</style>
      <div className="min-h-screen flex w-full bg-slate-50">
        <Sidebar className="border-r border-gray-200 bg-white">
          <SidebarHeader className="border-b border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
                <img
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68c956d6c6a36ced0b9be9eb/cbe09abb4_FMF_logo-02-01.png"
                  alt="Future Minerals Forum Logo"
                  className="w-full h-full object-contain rounded-md" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg">FMF Partner</h2>
                <p className="text-xs text-gray-500">Registration System</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-3">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-xl mb-0.5 ${
                          (item.url === '/' && location.pathname === '/') || (item.url !== '/' && location.pathname.startsWith(item.url)) ?
                            'bg-blue-50 text-blue-700 font-semibold' :
                            'text-gray-600 hover:text-gray-900'
                        }`
                        }>
  
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          {item.icon && <item.icon className="w-5 h-5" />}
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* User slots display for User type */}
            {systemUserType === 'User' && currentUser?.registration_slots &&
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-3">
                  Available Slots
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <div className="px-3 py-2 space-y-2">
                    {Object.entries(currentUser.registration_slots)
                      .filter(([type, available]) => {
                        const used = currentUser.used_slots?.[type] || 0;
                        const remaining = available - used;
                        return remaining > 0;
                      })
                      .map(([type, available]) => {
                        const used = currentUser.used_slots?.[type] || 0;
                        const remaining = available - used;

                        return (
                          <div key={type} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 text-xs">{type}</span>
                            <span className={`font-semibold ${remaining > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {remaining}/{available}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            }

            {/* Show unlimited slots for Super Users */}
            {systemUserType === 'Super User' &&
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-3">
                  Available Slots
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <div className="px-3 py-2">
                    <div className="flex items-center justify-center">
                      <span className="text-lg font-bold text-green-600">∞</span>
                    </div>
                    <p className="text-xs text-gray-500 text-center mt-1">Unlimited</p>
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            }
          </SidebarContent>

          <SidebarFooter className="border-t border-gray-200 p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={currentUser?.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-gray-400 to-gray-500 text-white font-semibold text-sm">
                      {userDisplayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{userDisplayName}</p>
                    {currentUser?.company_name && <p className="text-xs text-gray-500 truncate">{currentUser.company_name}</p>}
                    <p className="text-xs text-gray-500 truncate">{userRole}</p>
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                  onClick={() => setShowProfileSettings(true)}
                  className="cursor-pointer"
                >
                  <UserIcon className="w-4 h-4 mr-2" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col bg-slate-50">
          {/* Hide header for Trophy and Certificate pages */}
          {currentPageName !== 'Trophy' && currentPageName !== 'Certificate' && (
            <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <SidebarTrigger className="hover:bg-gray-100 p-2 rounded-lg transition-colors duration-200 md:hidden" />
                  <h1 className="text-xl font-semibold text-gray-900 hidden md:block">Forum Admin</h1>
                </div>
                
                {/* Notification Center */}
                <NotificationCenter currentUser={currentUser} />
              </div>
            </header>
          )}

          {/* Mobile sidebar trigger for Trophy and Certificate pages */}
          {(currentPageName === 'Trophy' || currentPageName === 'Certificate') && (
            <div className="fixed top-4 left-4 z-50 md:hidden">
              <SidebarTrigger className="hover:bg-gray-100 p-2 rounded-lg transition-colors duration-200 bg-white shadow-md" />
            </div>
          )}

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>

        {/* Profile Settings Dialog */}
        <ProfileSettings 
          isOpen={showProfileSettings}
          onClose={() => setShowProfileSettings(false)}
          currentUser={currentUser}
          onUserUpdate={handleUserUpdate}
        />
      </div>
    </SidebarProvider>
  );
}
