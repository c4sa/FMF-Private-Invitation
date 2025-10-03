
import React, { useState, useEffect, useCallback } from "react";
import { User, PartnershipType, Notification } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  UserPlus,
  Edit3,
  Trash2,
  Shield,
  Power,
  PowerOff,
  Clock
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import ProtectedRoute from "../components/common/ProtectedRoute";
import { sendNewUserRequestEmail, createUserDirectly, deleteUserCompletely } from "@/api/functions";
import { format } from "date-fns";
import { useToast } from "../components/common/Toast";


const attendeeTypes = ["VIP", "Partner", "Exhibitor", "Media"];

// userTypesForUsersOnly is replaced by dynamic partnerTypes and N/A
// const userTypesForUsersOnly = [
//     "Founding Partner", "Strategic Partner", "Platinum Sponsor", "Palladium Sponsor",
//     "Gold Sponsor", "Silver Sponsor", "Exhibitor", "In-kind Sponsor", "N/A"
// ];

export default function SystemUsers() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [partnerTypes, setPartnerTypes] = useState([]); // <-- State for dynamic partner types
  const [formData, setFormData] = useState({
    preferred_name: '',
    company_name: '',
    email: '',
    system_role: 'User',
    user_type: 'N/A',
    mobile: '',
    registration_slots: attendeeTypes.reduce((acc, type) => ({...acc, [type]: 0}), {}),
    account_status: 'active'
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [userToToggle, setUserToToggle] = useState(null);
  const [showAddUserRequestDialog, setShowAddUserRequestDialog] = useState(false);
  const [newUserRequestData, setNewUserRequestData] = useState({
    full_name: '',
    email: '',
    password: '',
    company_name: '',
    system_role: 'User',
    user_type: 'N/A',
    registration_slots: attendeeTypes.reduce((acc, type) => ({...acc, [type]: 0}), {})
  });
  const [isSendingUserRequest, setIsSendingUserRequest] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setHasPermissionError(false); // Reset permission error on new load
    try {
      const me = await User.me();
      setCurrentUser(me);

      // Check if user has permission to manage system users
      const canManageUsers = me.role === 'admin' || me.system_role === 'Admin' || me.system_role === 'Super User';
      
      if (!canManageUsers) {
        setHasPermissionError(true);
        setIsLoading(false);
        return;
      }

      try {
        const [userData, partnerTypeData] = await Promise.all([
          User.list("-created_at"),
          PartnershipType.list()
        ]);

        setPartnerTypes(partnerTypeData);

        if (me.system_role === 'Super User') {
          // Super Users see themselves and all 'User' type users
          setUsers(userData.filter(u => u.id === me.id || u.system_role === 'User'));
        } else {
          // Admins see everyone
          setUsers(userData);
        }
      } catch (dataError) {
        console.error("Error loading user data:", dataError);
        // Assuming "Permission denied" or similar message in the error object for API access issues
        if (dataError.message?.includes('Permission denied')) {
          setHasPermissionError(true);
        } else {
          toast({
            title: "Error",
            description: "Failed to load system data. Please try again.",
            variant: "destructive",
          });
        }
      }

    } catch (error) {
      console.error("Error loading current user:", error);
      toast({
        title: "Error",
        description: "Failed to verify user permissions. Please try again.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormData({
      preferred_name: '',
      company_name: '',
      email: '',
      system_role: 'User',
      user_type: 'N/A',
      mobile: '',
      registration_slots: attendeeTypes.reduce((acc, type) => ({...acc, [type]: 0}), {}),
      account_status: 'active'
    });
    setEditingUser(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newFormData = { ...prev, [field]: value };
      
      // Auto-fill registration slots when user_type changes
      if (field === 'user_type' && value && value !== 'N/A') {
        const selectedPartnerType = partnerTypes.find(p => p.name === value);
        if (selectedPartnerType) {
          newFormData.registration_slots = {
            VIP: selectedPartnerType.slots_vip || 0,
            Partner: selectedPartnerType.slots_partner || 0,
            Exhibitor: selectedPartnerType.slots_exhibitor || 0,
            Media: selectedPartnerType.slots_media || 0,
          };
        }
      } else if (field === 'user_type' && value === 'N/A') {
        // Reset slots to 0 when N/A is selected
        newFormData.registration_slots = {
          VIP: 0,
          Partner: 0,
          Exhibitor: 0,
          Media: 0,
        };
      }
      
      return newFormData;
    });
  };

  const handleNewUserRequestDataChange = (field, value) => {
    setNewUserRequestData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Auto-fill registration slots when user_type changes
      if (field === 'user_type' && value && value !== 'N/A') {
        const selectedPartnerType = partnerTypes.find(p => p.name === value);
        if (selectedPartnerType) {
          newData.registration_slots = {
            VIP: selectedPartnerType.slots_vip || 0,
            Partner: selectedPartnerType.slots_partner || 0,
            Exhibitor: selectedPartnerType.slots_exhibitor || 0,
            Media: selectedPartnerType.slots_media || 0,
          };
        }
      } else if (field === 'user_type' && value === 'N/A') {
        // Reset slots to 0 when N/A is selected
        newData.registration_slots = {
          VIP: 0,
          Partner: 0,
          Exhibitor: 0,
          Media: 0,
        };
      }
      
      return newData;
    });
  };

  const handleSlotChange = (attendeeType, value) => {
    setFormData(prev => ({
      ...prev,
      registration_slots: {
        ...prev.registration_slots,
        [attendeeType]: parseInt(value) || 0
      }
    }));
  };

  const handleNewUserSlotChange = (attendeeType, value) => {
    setNewUserRequestData(prev => ({
      ...prev,
      registration_slots: {
        ...prev.registration_slots,
        [attendeeType]: parseInt(value) || 0
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!editingUser) return;

    try {
      const userData = {
        preferred_name: formData.preferred_name,
        company_name: formData.company_name,
        system_role: formData.system_role,
        user_type: formData.user_type,
        mobile: formData.mobile,
        registration_slots: formData.registration_slots, // Start with current form data's slots
        account_status: formData.account_status || 'active'
      };

      // ** AUTO-POPULATE SLOTS FROM PARTNERSHIP TYPE **
      // Only apply if the user is a 'User' type and has a specific partnership type selected
      if (formData.system_role === 'User' && formData.user_type && formData.user_type !== 'N/A') {
        const selectedPartnerType = partnerTypes.find(p => p.name === formData.user_type);
        if (selectedPartnerType) {
          userData.registration_slots = {
            VIP: selectedPartnerType.slots_vip || 0,
            Partner: selectedPartnerType.slots_partner || 0,
            Exhibitor: selectedPartnerType.slots_exhibitor || 0,
            Media: selectedPartnerType.slots_media || 0,
          };
        }
      } else if (formData.system_role === 'Admin' || formData.system_role === 'Super User') {
          // Admins and Super Users have unlimited slots conceptually, store as empty object or special value
          userData.registration_slots = {};
      }


      await User.update(editingUser.id, userData);

      loadData();
      setShowEditDialog(false);
      resetForm();

      toast({
        title: "Success",
        description: "User permissions updated successfully!",
        variant: "success",
      });
    } catch (error) {
      console.error("Error saving user:", error);
      toast({
        title: "Error",
        description: "Failed to save user. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    const initialSlots = attendeeTypes.reduce((acc, type) => ({
      ...acc,
      [type]: user.registration_slots?.[type] || 0
    }), {});
    setFormData({
      preferred_name: user.preferred_name || '',
      company_name: user.company_name || '',
      email: user.email || '',
      system_role: user.system_role || 'User',
      user_type: user.user_type || 'N/A',
      mobile: user.mobile || '',
      registration_slots: initialSlots,
      account_status: user.account_status || 'active'
    });
    setShowEditDialog(true);
  };

  const confirmDelete = (user) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    setIsDeletingUser(true);
    try {
      // Use the new comprehensive delete function
      await deleteUserCompletely(userToDelete.id);
      
      loadData();
      setShowDeleteDialog(false);
      setUserToDelete(null);

      toast({
        title: "Success",
        description: "User deleted successfully from both database and authentication.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: `Failed to delete user: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const confirmToggleStatus = (user) => {
    setUserToToggle(user);
    setShowStatusDialog(true);
  };

  const handleToggleAccountStatus = async () => {
    if (!userToToggle) return;

    const newStatus = userToToggle.account_status === 'active' ? 'inactive' : 'active';

    try {
      await User.update(userToToggle.id, { account_status: newStatus });
      loadData();
      setShowStatusDialog(false);
      setUserToToggle(null);

      toast({
        title: "Success",
        description: `Account ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully.`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error updating account status:", error);
      toast({
        title: "Error",
        description: "Failed to update account status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSlotUpdate = async (userId, slotUpdates) => {
    try {
      const userToUpdate = users.find(u => u.id === userId);
      if (!userToUpdate) {
        toast({
          title: "Error",
          description: "User not found.",
          variant: "destructive",
        });
        return;
      }

      const currentSlots = userToUpdate.registration_slots || {};

      // Ensure all attendee types are present in the slots object
      const updatedSlots = {
        VIP: 0,
        Partner: 0,
        Exhibitor: 0,
        Media: 0,
        ...currentSlots,
        ...slotUpdates
      };

      await User.update(userId, { registration_slots: updatedSlots });
      await loadData();
      toast({
        title: "Success",
        description: "Registration slots updated successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to update user slots:", error);
      toast({
        title: "Error",
        description: "Failed to update registration slots.",
        variant: "destructive",
      });
    }
  };

  const handleRequestNewUser = async () => {
    if (!newUserRequestData.full_name || !newUserRequestData.email || !newUserRequestData.password || !newUserRequestData.company_name) {
      toast({ title: "Missing Information", description: "Please provide full name, email, password, and company name.", variant: "destructive" });
      return;
    }
    setIsSendingUserRequest(true);
    try {
      // Create user directly in Supabase Auth and users table
      const result = await createUserDirectly({
        fullName: newUserRequestData.full_name,
        email: newUserRequestData.email,
        password: newUserRequestData.password,
        companyName: newUserRequestData.company_name,
        systemRole: newUserRequestData.system_role,
        userType: newUserRequestData.user_type,
        registrationSlots: newUserRequestData.registration_slots,
        preferredName: newUserRequestData.full_name
      });
      
      if (result.success) {
        toast({ 
          title: "User Created Successfully", 
          description: `User ${newUserRequestData.full_name} has been created and can now log in.`, 
          variant: "success" 
        });
        setShowAddUserRequestDialog(false);
        setNewUserRequestData({ 
          full_name: '', 
          email: '', 
          password: '', 
          company_name: '', 
          system_role: 'User', 
          user_type: 'N/A', 
          registration_slots: attendeeTypes.reduce((acc, type) => ({...acc, [type]: 0}), {}) 
        });
        // Refresh the users list
        loadData();
      }
    } catch (error) {
      console.error("Failed to create user:", error);
      toast({ 
        title: "Error", 
        description: `Failed to create user: ${error.message}`, 
        variant: "destructive" 
      });
    }
    setIsSendingUserRequest(false);
  };

  const getTotalSlots = (slots) => {
    return Object.values(slots || {}).reduce((sum, count) => sum + (count || 0), 0);
  };

  const getTotalUsedSlots = (usedSlots) => {
    return Object.values(usedSlots || {}).reduce((sum, count) => sum + (count || 0), 0);
  };

  const getDisplayName = (user) => {
    return user.preferred_name || user.full_name || user.email || 'Unknown User';
  };

  const canPerformAction = (targetUser) => {
      if (!currentUser || !targetUser) return false;
      if (currentUser.role === 'admin' || currentUser.system_role === 'Admin') return true; // Admins can do anything
      // Super Users can manage Users unless the target user is themselves or of a higher type
      if (currentUser.system_role === 'Super User') {
          if (targetUser.system_role === 'User') return true;
          if (targetUser.id === currentUser.id && targetUser.system_role === 'Super User') return true; // Super User can edit themselves
      }
      return false;
  }

  const getSystemUserTypesForDropdown = () => {
      if (!currentUser) return [];
      if (currentUser.role === 'admin' || currentUser.system_role === 'Admin') return ["Admin", "Super User", "User"];
      if (currentUser.system_role === 'Super User') return ["User"]; // Super Users can only create/manage 'User' type
      return [];
  }

  if (hasPermissionError) {
    return (
      <ProtectedRoute>
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col items-center justify-center min-h-96">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Access Restricted</h1>
                <p className="text-gray-600 max-w-md">
                  You don't have permission to manage system users. Only administrators and super users can access this section.
                </p>
                <div className="pt-4">
                  <Link to={createPageUrl("Dashboard")}>
                    <Button variant="outline">
                      Return to Dashboard
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">System Users</h1>
              <p className="text-gray-500 mt-1">Manage user accounts and registration permissions</p>
            </div>
            {currentUser && (currentUser.role === 'admin' || currentUser.system_role === 'Admin' || currentUser.system_role === 'Super User') && (
              <div className="flex items-center gap-3">
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowAddUserRequestDialog(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add New User
                </Button>
              </div>
            )}
          </div>

          {/* New User Request Dialog */}
          <Dialog open={showAddUserRequestDialog} onOpenChange={setShowAddUserRequestDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New System User</DialogTitle>
                <DialogDescription>
                  Create a new user account with the specified details. The user will be able to log in immediately.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="new_user_full_name">Full Name</Label>
                  <Input
                    id="new_user_full_name"
                    placeholder="Enter the full name of the new user"
                    value={newUserRequestData.full_name}
                    onChange={(e) => setNewUserRequestData(prev => ({ ...prev, full_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="new_user_email">Email</Label>
                  <Input
                    id="new_user_email"
                    type="email"
                    placeholder="Enter the email for invitation"
                    value={newUserRequestData.email}
                    onChange={(e) => setNewUserRequestData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="new_user_password">Password</Label>
                  <Input
                    id="new_user_password"
                    type="password"
                    placeholder="Enter the password for the new user"
                    value={newUserRequestData.password}
                    onChange={(e) => setNewUserRequestData(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="new_user_company">Company Name</Label>
                  <Input
                    id="new_user_company"
                    placeholder="Enter the company name"
                    value={newUserRequestData.company_name}
                    onChange={(e) => setNewUserRequestData(prev => ({ ...prev, company_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="new_user_type">System User Type</Label>
                  <Select value={newUserRequestData.system_role} onValueChange={(value) => handleNewUserRequestDataChange('system_role', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user type" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSystemUserTypesForDropdown().map(type => (
                         <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newUserRequestData.system_role === 'User' && (
                  <div>
                    <Label htmlFor="new_user_sponsor_type">User Type (Sponsor/Partner)</Label>
                    <Select value={newUserRequestData.user_type} onValueChange={(value) => handleNewUserRequestDataChange('user_type', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user sponsor/partner type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="N/A">N/A</SelectItem>
                        {partnerTypes.map(type => (
                          <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {newUserRequestData.system_role === 'User' && (
                  <div>
                    <Label className="text-base font-semibold mb-4 block">Registration Slots</Label>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      {attendeeTypes.map((type) => (
                        <div key={type} className="flex items-center justify-between">
                          <Label className="text-sm">{type}</Label>
                          <Input
                            type="number"
                            min="0"
                            className="w-20"
                            value={newUserRequestData.registration_slots[type] || 0}
                            onChange={(e) => handleNewUserSlotChange(type, e.target.value)}
                            disabled={newUserRequestData.user_type !== 'N/A'}
                          />
                        </div>
                      ))}
                    </div>
                    {newUserRequestData.user_type !== 'N/A' && (
                      <p className="text-sm text-gray-500 mt-2">
                        Slots are automatically determined by the selected Partnership Type.
                      </p>
                    )}
                  </div>
                )}

                {(newUserRequestData.system_role === 'Admin' || newUserRequestData.system_role === 'Super User') && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      Admins and Super Users have unlimited registration slots.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowAddUserRequestDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRequestNewUser} disabled={isSendingUserRequest}>
                  {isSendingUserRequest ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Creating...
                    </div>
                  ) : (
                    "Create User"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm User Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete {userToDelete?.email}? This will permanently revoke their access to the system.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeletingUser}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeletingUser}>
                  {isDeletingUser ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Deleting...
                    </div>
                  ) : (
                    "Delete User"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Status Toggle Confirmation Dialog */}
          <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Account Status Change</DialogTitle>
                <DialogDescription>
                  Are you sure you want to {userToToggle?.account_status === 'active' ? 'deactivate' : 'activate'} {userToToggle?.email}?
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleToggleAccountStatus}>
                  {userToToggle?.account_status === 'active' ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Edit User Permissions for {editingUser?.email}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="preferred_name">Preferred Name</Label>
                    <Input
                      id="preferred_name"
                      value={formData.preferred_name}
                      onChange={(e) => handleInputChange('preferred_name', e.target.value)}
                      placeholder="Enter preferred display name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company_name">Company Name</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => handleInputChange('company_name', e.target.value)}
                      placeholder="Enter company name"
                    />
                  </div>
                </div>
                 <div>
                    <Label htmlFor="mobile">Mobile Number</Label>
                    <Input
                      id="mobile"
                      value={formData.mobile}
                      onChange={(e) => handleInputChange('mobile', e.target.value)}
                      placeholder="Enter mobile number"
                    />
                  </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="bg-gray-100"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="system_user_type">System User Type</Label>
                        <Select value={formData.system_role} onValueChange={(value) => handleInputChange('system_role', value)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {getSystemUserTypesForDropdown().map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                  <div>
                    <Label htmlFor="account_status">Account Status</Label>
                    <Select value={formData.account_status || 'active'} onValueChange={(value) => handleInputChange('account_status', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.system_role === 'User' && (
                     <div>
                        <Label htmlFor="user_type">User Type (Sponsor/Partner)</Label>
                        <Select value={formData.user_type} onValueChange={(value) => handleInputChange('user_type', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select user sponsor/partner type"/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="N/A">N/A</SelectItem>
                                {partnerTypes.map(type => (
                                    <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {(formData.system_role === 'User') && ( // Super Users and Admins have unlimited, so their slots aren't directly editable here
                  <div>
                    <Label className="text-base font-semibold mb-4 block">Registration Slots</Label>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      {attendeeTypes.map((type) => (
                        <div key={type} className="flex items-center justify-between">
                          <Label className="text-sm">{type}</Label>
                          <Input
                            type="number"
                            min="0"
                            className="w-20"
                            value={formData.registration_slots[type] || 0}
                            onChange={(e) => handleSlotChange(type, e.target.value)}
                            // Disable if a specific partnership type is selected for a 'User'
                            disabled={formData.system_role === 'User' && formData.user_type !== 'N/A'}
                          />
                        </div>
                      ))}
                    </div>
                    {formData.system_role === 'User' && formData.user_type !== 'N/A' && (
                        <p className="text-sm text-gray-500 mt-2">
                            Slots are automatically determined by the selected Partnership Type.
                        </p>
                    )}
                  </div>
                )}
                {(formData.system_role === 'Admin' || formData.system_role === 'Super User') && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                            Admins and Super Users have unlimited registration slots.
                        </p>
                    </div>
                )}


                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowEditDialog(false); resetForm(); }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    Update User
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                System Users ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>User</TableHead>
                      <TableHead>System Type</TableHead>
                      {users.some(user => user.system_role === 'User') && <TableHead>Sponsor/Partner Type</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Slots (Avail/Total)</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array(3).fill(0).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={users.some(user => user.system_role === 'User') ? 7 : 6} className="h-16">
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      users.map((user) => {
                        const totalSlots = getTotalSlots(user.registration_slots);
                        const usedSlots = getTotalUsedSlots(user.used_slots);
                        const availableSlots = totalSlots - usedSlots;
                        const displayName = getDisplayName(user);
                        const isActive = user.account_status === 'active' || !user.account_status;

                        return (
                          <TableRow key={user.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="w-10 h-10">
                                   <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                                    {displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold text-gray-900">{displayName}</p>
                                  <p className="text-sm text-gray-500">{user.email}</p>
                                  {user.company_name && <p className="text-xs text-gray-400">{user.company_name}</p>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={user.system_role === 'Admin' ? 'bg-red-100 text-red-800' : (user.system_role === 'Super User' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800')}>
                                <Shield className="w-3 h-3 mr-1" />{user.system_role}
                              </Badge>
                            </TableCell>
                            {users.some(u => u.system_role === 'User') && (
                              <TableCell>
                                {user.system_role === 'User' ? (
                                  user.user_type && user.user_type !== 'N/A' ? (
                                    <Badge variant="outline">{user.user_type}</Badge>
                                  ) : (
                                    <span className="text-gray-400">N/A</span>
                                  )
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              <Badge className={isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                {isActive ? (
                                  <><Power className="w-3 h-3 mr-1" />Active</>
                                ) : (
                                  <><PowerOff className="w-3 h-3 mr-1" />Inactive</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <Clock className="w-3 h-3" />
                                {user.last_login_date
                                  ? format(new Date(user.last_login_date), 'MMM d, yyyy')
                                  : 'Never'
                                }
                              </div>
                            </TableCell>
                            <TableCell>
                                {user.system_role === 'Admin' || user.system_role === 'Super User' ? (
                                    <span className="font-semibold text-lg">∞</span>
                                ) : (
                                    <span className={`font-semibold ${availableSlots > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {availableSlots}/{totalSlots}
                                    </span>
                                )}
                            </TableCell>
                            <TableCell>
                              {canPerformAction(user) ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEdit(user)}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </Button>
                                  {user.id !== currentUser.id && ( // Prevent deactivating/deleting self
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => confirmToggleStatus(user)}
                                      className={isActive
                                        ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                        : "text-green-600 hover:text-green-700 hover:bg-green-50"
                                      }
                                    >
                                      {isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                    </Button>
                                  )}
                                  {currentUser.system_role === 'Admin' && user.id !== currentUser.id && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => confirmDelete(user)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">No actions</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {users.length === 0 && !isLoading && !hasPermissionError && (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Users Found</h3>
                <p className="text-gray-500 mb-6">Add new users using the "Add New User" button.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

function UserSlotEditor({ user, onUpdate, onCancel }) {
  const [slots, setSlots] = useState({
    VIP: user.registration_slots?.VIP || 0,
    Partner: user.registration_slots?.Partner || 0,
    Exhibitor: user.registration_slots?.Exhibitor || 0,
    Media: user.registration_slots?.Media || 0
  });

  const attendeeTypes = ["VIP", "Partner", "Exhibitor", "Media"];

  const handleSlotChange = (type, value) => {
    setSlots(prev => ({
      ...prev,
      [type]: parseInt(value) || 0
    }));
  };

  const handleSave = () => {
    onUpdate(user.id, slots);
  };

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold mb-2 block">Edit Registration Slots for {user.preferred_name || user.email}</Label>
      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
        {attendeeTypes.map((type) => (
          <div key={type} className="flex items-center justify-between">
            <Label className="text-sm">{type}</Label>
            <Input
              type="number"
              min="0"
              className="w-20"
              value={slots[type] || 0}
              onChange={(e) => handleSlotChange(type, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save Slots
        </Button>
      </div>
    </div>
  );
}
