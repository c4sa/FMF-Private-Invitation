
import React, { useState, useEffect } from "react";
import { Attendee, User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Users,
  UserCheck,
  Clock,
  XCircle,
  Download,
  UserPlus,
  Ticket
} from "lucide-react";

import StatsCard from "../components/dashboard/StatsCard";
import RecentActivities from "../components/dashboard/RecentActivities";
import ProtectedRoute from "../components/common/ProtectedRoute";
import ProfileCompletionModal from "../components/common/ProfileCompletionModal";
import { format } from "date-fns";

const exportToCsv = (filename, rows) => {
  if (!rows || !rows.length) {
    return;
  }
  const separator = ',';
  const keys = Object.keys(rows[0]);

  const csvContent = [
    keys.map(key => `"${key.replace(/"/g, '""')}"`).join(separator),
    ...rows.map(row => keys.map(k => {
      let cell = row[k] === null || row[k] === undefined ? '' : row[k];
      if (cell instanceof Date) {
        cell = cell.toISOString();
      } else if (Array.isArray(cell)) {
        cell = cell.join('; ');
      } else {
        cell = String(cell);
      }
      
      if (cell.includes('"') || cell.includes(separator) || cell.includes('\n') || cell.includes('\r')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(separator))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function Dashboard() {
  const [attendees, setAttendees] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    declined: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Get current user to check permissions
      const user = await User.me();
      setCurrentUser(user);
      
      // Check if profile is complete - all essential fields must be filled
      const isProfileComplete = user.preferred_name && user.company_name && user.mobile && user.is_reset;
      if (!isProfileComplete) {
        setShowProfileModal(true);
      }
      
      let attendeesData = [];
      
      // Check if user is admin or super user - they can see all attendees
      const canSeeAllAttendees = user?.role === 'admin' || 
                                 user?.system_role === 'Admin' || 
                                 user?.system_role === 'Super User';
      
      if (canSeeAllAttendees) {
        // Admin/Super User: Get all attendees
        attendeesData = await Attendee.list("-created_at");
      } else {
        // Regular User: Only get attendees they registered
        attendeesData = await Attendee.getByRegisteredBy(user.id);
      }
      
      setAttendees(attendeesData);

      // Only load users if current user is admin or super user
      let usersData = [];
      const canSeeAllUsers = user?.role === 'admin' || user?.system_role === 'Admin' || user?.system_role === 'Super User';
      
      if (canSeeAllUsers) {
        try {
          usersData = await User.list("-last_login_date");
        } catch (userError) {
          console.warn("Could not load users:", userError);
          // Continue without user data
        }
      }
      setUsers(usersData);

      // Calculate stats from attendees
      const total = attendeesData.length;
      const approved = attendeesData.filter(a => a.status === 'approved').length;
      const pending = attendeesData.filter(a => a.status === 'pending').length;
      const declined = attendeesData.filter(a => a.status === 'declined').length;

      setStats({
        total,
        approved,
        pending,
        declined,
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
    setIsLoading(false);
  };

  const handleExport = () => {
    const dataToExport = attendees.map(a => ({
      'CATEGORY TITLE': a.attendee_type,
      'ACCESS LEVEL': a.level || '',
      'FIRST NAME': a.first_name,
      'LAST NAME': a.last_name,
      'EMAIL': a.email,
      'REFERENCE': a.id.slice(-8).toUpperCase(),
      'DATE CREATED': format(new Date(a.created_at), 'yyyy-MM-dd HH:mm'),
      'STATUS': a.status,
      'What are the areas you are most interested in?': a.areas_of_interest?.join('; ') || '',
      'Have you attended previous FMF Edition?': a.previous_attendance ? 'Yes' : 'No',
      'Which year(S)?:': a.previous_years || '',
      'Organization Type': a.organization_type || '',
      'What is your primary Nature of Business?': a.primary_nature_of_business || '',
      'What type of Association / Organisation? (Select all that apply)': a.association_organization_type?.join('; ') || '',
      'I am a member of:': a.member_of || '',
      'What type of Education and Research? (Select all that apply)': a.education_research_type?.join('; ') || '',
      'What type of Energy Company? (Select all that apply)': a.energy_company_type?.join('; ') || '',
      'What type of Energy Services? (Select all that apply)': a.energy_services_type?.join('; ') || '',
      'Please provide your primary area of specialty (Select all that apply)': a.primary_specialty_area?.join('; ') || '',
      'Please Indicate Your Department': a.department || '',
      'Please Indicate Your Department Focus': a.department_focus || '',
      'What stage are your mining projects? (Select all that apply)': a.mining_project_stage?.join('; ') || '',
      'What are your primary commodities? (Select all that apply)': a.primary_commodities?.join('; ') || '',
      'What type of Mining Services/Supplier? (Select all that apply)': a.mining_services_type?.join('; ') || '',
      'Registration Type': a.registration_type || '',
      'Modification Token': a.modification_token || ''
    }));
    exportToCsv('attendees.csv', dataToExport);
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
    
    setShowProfileModal(false);
  };

  const handleProfileModalClose = () => {
    // Check if profile is complete before allowing close
    const isProfileComplete = currentUser?.preferred_name && currentUser?.company_name && currentUser?.mobile && currentUser?.is_reset;
    if (!isProfileComplete) {
      // Don't close the modal, just show the toast
      return;
    }
    setShowProfileModal(false);
  };

  return (
    // Removed adminOnly prop to allow Super Users access as well.
    // ProtectedRoute without adminOnly will check for 'admin' or 'Super User' by default.
    <ProtectedRoute pageName="Dashboard"> 
      <div className="flex flex-col p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button onClick={handleExport} disabled={isLoading || attendees.length === 0} variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export Attendees
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading data...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatsCard
                title="Total Attendees"
                value={stats.total}
                icon={Users}
                color="blue"
                description="Total number of registrations"
              />
              <StatsCard
                title="Approved Attendees"
                value={stats.approved}
                icon={UserCheck}
                color="green"
                description="Registrations approved"
              />
              <StatsCard
                title="Pending Attendees"
                value={stats.pending}
                icon={Clock}
                color="orange"
                description="Registrations awaiting approval"
              />
              <StatsCard
                title="Declined Attendees"
                value={stats.declined}
                icon={XCircle}
                color="red"
                description="Registrations declined"
              />
            </div>

            <div className="mb-8">
              <RecentActivities />
            </div>

            <div className="flex justify-end mt-8 gap-4">
              <Button asChild>
                <Link to={createPageUrl("Registration")}>
                  <UserPlus className="mr-2 h-4 w-4" /> Register New Attendee
                </Link>
              </Button>
              <Button asChild>
                <Link to={createPageUrl("Attendees")}>
                  <Ticket className="mr-2 h-4 w-4" /> View All Attendees
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Profile Completion Modal */}
      <ProfileCompletionModal
        isOpen={showProfileModal}
        currentUser={currentUser}
        onUserUpdate={handleUserUpdate}
        onClose={handleProfileModalClose}
      />
    </ProtectedRoute>
  );
}
