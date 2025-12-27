import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Attendee, SlotRequest, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/common/Toast';
import { format } from 'date-fns';
import { Check, X, Eye, Inbox, UserPlus, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import NotificationService from '@/services/notificationService';
import * as XLSX from 'xlsx';

// Helper function to safely format dates
const safeFormatDate = (dateValue, formatStr = 'PPP') => {
  if (!dateValue) return 'Unknown date';
  
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Invalid date';
    return format(date, formatStr);
  } catch (error) {
    console.warn('Date formatting error:', error);
    return 'Invalid date';
  }
};

export default function RequestsPage() {
  const [modificationRequests, setModificationRequests] = useState([]);
  const [slotRequests, setSlotRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedSlotRequest, setSelectedSlotRequest] = useState(null);
  const [showSlotDetailsDialog, setShowSlotDetailsDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAmounts, setApprovalAmounts] = useState({});
  const [requestToApprove, setRequestToApprove] = useState(null);
  const { toast } = useToast();

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const modReqs = await Attendee.filter({ status: 'change_requested' });
      setModificationRequests(modReqs);

      const slotReqs = await SlotRequest.filter({ status: 'pending' });
      
      // Fetch user information for each slot request
      const slotRequestsWithUsers = await Promise.all(
        slotReqs.map(async (req) => {
          try {
            const user = await User.get(req.user_id);
            
            // Calculate total and used slots
            const getTotalSlots = (slots) => {
              return Object.values(slots || {}).reduce((sum, count) => sum + (count || 0), 0);
            };
            
            const getTotalUsedSlots = (usedSlots) => {
              return Object.values(usedSlots || {}).reduce((sum, count) => sum + (count || 0), 0);
            };
            
            return {
              ...req,
              user_name: user.preferred_name || user.full_name || 'Unknown User',
              user_email: user.email || 'No email',
              user_company_name: user.company_name || '',
              user_type: user.user_type || 'N/A',
              user_total_slots: getTotalSlots(user.registration_slots),
              user_used_slots: getTotalUsedSlots(user.used_slots),
              user_registration_slots: user.registration_slots || {},
              user_used_slots_detail: user.used_slots || {}
            };
          } catch (error) {
            console.error(`Failed to fetch user for slot request ${req.id}:`, error);
            return {
              ...req,
              user_name: 'Unknown User',
              user_email: 'No email',
              user_company_name: '',
              user_type: 'N/A',
              user_total_slots: 0,
              user_used_slots: 0,
              user_registration_slots: {},
              user_used_slots_detail: {}
            };
          }
        })
      );
      
      setSlotRequests(slotRequestsWithUsers);
    } catch (error) {
      console.error("Failed to load requests:", error);
      toast({ title: "Error", description: "Could not load requests.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleReviewClick = (attendee) => {
    setSelectedAttendee(attendee);
    setShowReviewDialog(true);
  };

  const handleReviewDecision = async (decision) => {
    if (!selectedAttendee) return;

    try {
      const newStatus = decision === 'approve' ? 'approved' : 'declined';
      await Attendee.update(selectedAttendee.id, { status: newStatus });
      
      // Remove from modification requests
      setModificationRequests(prev => 
        prev.filter(req => req.id !== selectedAttendee.id)
      );
      
      toast({
        title: "Success",
        description: `Attendee ${decision === 'approve' ? 'approved' : 'declined'} successfully.`,
        variant: "default"
      });
      
      setShowReviewDialog(false);
      setSelectedAttendee(null);
    } catch (error) {
      console.error("Failed to update attendee status:", error);
      toast({
        title: "Error",
        description: "Failed to update attendee status. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Helper function to check if request uses new format
  const isNewFormat = (requestedSlots) => {
    return requestedSlots && typeof requestedSlots === 'object' && requestedSlots.slots && Array.isArray(requestedSlots.slots);
  };

  // Helper function to get slot summary (works with both formats)
  const getSlotSummary = (requestedSlots) => {
    if (isNewFormat(requestedSlots)) {
      return requestedSlots.summary || {};
    }
    // Old format - just return the object as-is
    return requestedSlots || {};
  };

  const handleShowSlotDetails = (request) => {
    setSelectedSlotRequest(request);
    setShowSlotDetailsDialog(true);
  };

  const handleOpenApprovalDialog = (request) => {
    setRequestToApprove(request);
    const summary = getSlotSummary(request.requested_slots);
    // Initialize approval amounts with requested amounts (admin can reduce)
    const initialAmounts = {};
    Object.entries(summary).forEach(([type, count]) => {
      initialAmounts[type] = count || 0;
    });
    setApprovalAmounts(initialAmounts);
    setShowApprovalDialog(true);
  };

  const handleSlotRequest = async (request, newStatus, approvedAmounts = null) => {
    try {
      const oldStatus = request.status;
      
      if (newStatus === 'approved') {
          const user = await User.get(request.user_id);
          const currentSlots = user.registration_slots || {};
          const newSlots = { ...currentSlots };
          
          // Use approved amounts if provided, otherwise approve all requested slots
          const amountsToApprove = approvedAmounts || getSlotSummary(request.requested_slots);
          
          Object.entries(amountsToApprove).forEach(([type, count]) => {
              const approvedCount = parseInt(count) || 0;
              if (approvedCount > 0) {
                  newSlots[type] = (newSlots[type] || 0) + approvedCount;
              }
          });
          
          await User.update(request.user_id, { registration_slots: newSlots });
      }

      await SlotRequest.update(request.id, { status: newStatus });
      
      // Create notification for slot request status change
      try {
        const currentUser = await User.me();
        await NotificationService.notifySlotRequestStatusChanged(request, oldStatus, newStatus, currentUser);
      } catch (notificationError) {
        console.error('Failed to create notification for slot request status change:', notificationError);
        // Don't fail the request if notification fails
      }
      
      const approvedMessage = approvedAmounts 
        ? `Slot request has been ${newStatus} with partial approval.`
        : `Slot request has been ${newStatus}.`;
      
      toast({ title: "Success", description: approvedMessage, variant: "success" });
      loadRequests();
    } catch(error) {
      console.error("Failed to handle slot request:", error);
      toast({ title: "Error", description: "Could not process the slot request.", variant: "destructive" });
    }
  };

  const handleConfirmApproval = async () => {
    if (!requestToApprove) return;

    // Validate that at least one slot type has a positive approval amount
    const hasApproval = Object.values(approvalAmounts).some(count => parseInt(count) > 0);
    if (!hasApproval) {
      toast({
        title: "Validation Error",
        description: "Please approve at least one slot.",
        variant: "destructive"
      });
      return;
    }

    // Validate that approval amounts don't exceed requested amounts
    const summary = getSlotSummary(requestToApprove.requested_slots);
    const hasExceeded = Object.entries(approvalAmounts).some(([type, count]) => {
      const requestedCount = summary[type] || 0;
      return parseInt(count) > requestedCount;
    });

    if (hasExceeded) {
      toast({
        title: "Validation Error",
        description: "Approval amounts cannot exceed requested amounts.",
        variant: "destructive"
      });
      return;
    }

    await handleSlotRequest(requestToApprove, 'approved', approvalAmounts);
    setShowApprovalDialog(false);
    setRequestToApprove(null);
    setApprovalAmounts({});
  };

  const handleExportSlotRequests = () => {
    try {
      if (!slotRequests || slotRequests.length === 0) {
        toast({
          title: "No Data",
          description: "There are no slot requests to export.",
          variant: "destructive"
        });
        return;
      }

      // Helper function to check if request uses new format
      const isNewFormat = (requestedSlots) => {
        return requestedSlots && typeof requestedSlots === 'object' && requestedSlots.slots && Array.isArray(requestedSlots.slots);
      };

      // Helper function to get slot summary
      const getSlotSummary = (requestedSlots) => {
        if (isNewFormat(requestedSlots)) {
          return requestedSlots.summary || {};
        }
        return requestedSlots || {};
      };

      // Prepare data for export - one row per VIP slot with details, plus summary row for all slots
      const exportData = [];
      
      slotRequests.forEach(req => {
        const summary = getSlotSummary(req.requested_slots);
        const totalRequested = Object.values(summary).reduce((sum, count) => sum + (count || 0), 0);
        
        if (isNewFormat(req.requested_slots) && req.requested_slots.slots && req.requested_slots.slots.length > 0) {
          // New format: All slots have details, show one row per slot
          req.requested_slots.slots.forEach((slot, index) => {
            exportData.push({
              'Request ID': req.id || '',
              'User Name': req.user_name || 'Unknown',
              'User Email': req.user_email || '',
              'Company Name': req.user_company_name || '',
              'Reason': req.reason || '',
              'Status': req.status || 'pending',
              'Requested Date': req.created_at ? format(new Date(req.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
              'Slot Type': slot.type || '',
              'Slot Number': slot.slotNumber || index + 1,
              'Slot Name': slot.name || '',
              'Slot Email': slot.email || '',
              'Slot Position': slot.position || '',
              'VIP Slots': summary.VIP || 0,
              'Premier Slots': summary.Premier || 0,
              'Partner Slots': summary.Partner || 0,
              'Exhibitor Slots': summary.Exhibitor || 0,
              'Media Slots': summary.Media || 0,
              'Other Slots': summary.Other || 0,
              'Total Requested': totalRequested
            });
          });
        } else {
          // Old format: one row per request
          exportData.push({
            'Request ID': req.id || '',
            'User Name': req.user_name || 'Unknown',
            'User Email': req.user_email || '',
            'Company Name': req.user_company_name || '',
            'Reason': req.reason || '',
            'Status': req.status || 'pending',
            'Requested Date': req.created_at ? format(new Date(req.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
            'Slot Type': 'N/A',
            'Slot Number': 'N/A',
            'Slot Name': 'N/A',
            'Slot Email': 'N/A',
            'Slot Position': 'N/A',
            'VIP Slots': summary.VIP || 0,
            'Premier Slots': summary.Premier || 0,
            'Partner Slots': summary.Partner || 0,
            'Exhibitor Slots': summary.Exhibitor || 0,
            'Media Slots': summary.Media || 0,
            'Other Slots': summary.Other || 0,
            'Total Requested': totalRequested
          });
        }
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for better readability
      const colWidths = [
        { wch: 40 }, // Request ID
        { wch: 25 }, // User Name
        { wch: 30 }, // User Email
        { wch: 30 }, // Company Name
        { wch: 40 }, // Reason
        { wch: 12 }, // Status
        { wch: 20 }, // Requested Date
        { wch: 15 }, // Slot Type
        { wch: 12 }, // Slot Number
        { wch: 25 }, // Slot Name
        { wch: 30 }, // Slot Email
        { wch: 20 }, // Slot Position
        { wch: 12 }, // VIP Slots
        { wch: 15 }, // Partner Slots
        { wch: 18 }, // Exhibitor Slots
        { wch: 15 }, // Media Slots
        { wch: 15 }, // Other Slots
        { wch: 30 }, // Other Reason
        { wch: 15 }  // Total Requested
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Slot Requests');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `FMF_Slot_Requests_${currentDate}.xlsx`;

      // Write and download the file
      XLSX.writeFile(wb, filename);

      toast({
        title: "Export Successful",
        description: `Slot requests exported to "${filename}" successfully.`,
        variant: "success"
      });
    } catch (error) {
      console.error('Error exporting slot requests:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export slot requests. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleExportModificationRequests = () => {
    try {
      if (!modificationRequests || modificationRequests.length === 0) {
        toast({
          title: "No Data",
          description: "There are no modification requests to export.",
          variant: "destructive"
        });
        return;
      }

      // Prepare data for export
      const exportData = modificationRequests.map(attendee => ({
        'First Name': attendee.first_name || '',
        'Last Name': attendee.last_name || '',
        'Email': attendee.email || '',
        'Organization': attendee.organization || '',
        'Job Title': attendee.job_title || '',
        'Attendee Type': attendee.attendee_type || '',
        'Status': attendee.status || 'change_requested',
        'Status Changed Date': attendee.updated_at ? format(new Date(attendee.updated_at), 'yyyy-MM-dd HH:mm:ss') : '',
        'Registration Date': attendee.created_at ? format(new Date(attendee.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
        'Reference ID': attendee.id ? attendee.id.slice(-8).toUpperCase() : '',
        'Modification Token': attendee.modification_token || ''
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for better readability
      const colWidths = [
        { wch: 20 }, // First Name
        { wch: 20 }, // Last Name
        { wch: 30 }, // Email
        { wch: 30 }, // Organization
        { wch: 25 }, // Job Title
        { wch: 15 }, // Attendee Type
        { wch: 15 }, // Status
        { wch: 20 }, // Status Changed Date
        { wch: 20 }, // Registration Date
        { wch: 15 }, // Reference ID
        { wch: 40 }  // Modification Token
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Modification Requests');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `FMF_Modification_Requests_${currentDate}.xlsx`;

      // Write and download the file
      XLSX.writeFile(wb, filename);

      toast({
        title: "Export Successful",
        description: `Modification requests exported to "${filename}" successfully.`,
        variant: "success"
      });
    } catch (error) {
      console.error('Error exporting modification requests:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export modification requests. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <ProtectedRoute adminOnly pageName="Requests">
      <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Requests</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-blue-600" />
                    Additional Slot Requests
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={handleExportSlotRequests}
                    disabled={isLoading || slotRequests.length === 0}
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? <p>Loading...</p> : slotRequests.length > 0 ? slotRequests.map(req => (
                  <div key={req.id} className="p-4 border rounded-lg flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold">{req.user_name} <span className="text-sm text-gray-500">({req.user_email})</span></p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-500">Partnership Type:</p>
                        <Badge variant="outline" className="text-xs">{req.user_type || 'N/A'}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{req.reason}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(getSlotSummary(req.requested_slots)).map(([type, count]) => (
                          count > 0 && (
                            <Badge key={type} variant="secondary">{count} x {type}</Badge>
                          )
                        ))}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Total Slots: <strong className="text-gray-700">{req.user_total_slots || 0}</strong></span>
                        <span>Used: <strong className="text-gray-700">{req.user_used_slots || 0}</strong></span>
                        <span>Available: <strong className="text-gray-700">{(req.user_total_slots || 0) - (req.user_used_slots || 0)}</strong></span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Requested on {safeFormatDate(req.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleShowSlotDetails(req)}
                        className="text-xs"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                      <Button size="icon" className="bg-green-500 hover:bg-green-600 h-8 w-8" onClick={() => handleOpenApprovalDialog(req)}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="icon" className="bg-red-500 hover:bg-red-600 h-8 w-8" onClick={() => handleSlotRequest(req, 'declined')}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No pending slot requests.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-orange-600" />
                    Attendee Modification Requests
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={handleExportModificationRequests}
                    disabled={isLoading || modificationRequests.length === 0}
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? <p>Loading...</p> : modificationRequests.length > 0 ? modificationRequests.map(attendee => (
                  <div key={attendee.id} className="p-4 border rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{attendee.first_name} {attendee.last_name}</p>
                      <p className="text-sm text-gray-500">{attendee.email}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        Status changed on {safeFormatDate(attendee.updated_at)}
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => handleReviewClick(attendee)}>
                      Review
                    </Button>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No pending modification requests.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      {/* Slot Details Dialog */}
      <Dialog open={showSlotDetailsDialog} onOpenChange={setShowSlotDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Slot Request Details</DialogTitle>
          </DialogHeader>
          
          {selectedSlotRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Requested By</label>
                  <p className="text-sm font-semibold">{selectedSlotRequest.user_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-sm">{selectedSlotRequest.user_email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Company</label>
                  <p className="text-sm">{selectedSlotRequest.user_company_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Partnership Type</label>
                  <p className="text-sm">{selectedSlotRequest.user_type || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <Badge variant="outline" className="mt-1">
                    {selectedSlotRequest.status}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Requested Date</label>
                  <p className="text-sm">{safeFormatDate(selectedSlotRequest.created_at)}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">Reason / Justification</label>
                  <p className="text-sm text-gray-700 mt-1">{selectedSlotRequest.reason || 'No reason provided'}</p>
                </div>
                {selectedSlotRequest.other_reason && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500">Reason for "Other" Slots</label>
                    <p className="text-sm text-gray-700 mt-1 bg-gray-50 p-3 rounded border border-gray-200">
                      {selectedSlotRequest.other_reason}
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-4">User Slot Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <label className="text-xs font-medium text-gray-500">Total Slots</label>
                    <p className="text-2xl font-bold text-blue-700 mt-1">{selectedSlotRequest.user_total_slots || 0}</p>
                    <div className="mt-2 space-y-1">
                      {Object.entries(selectedSlotRequest.user_registration_slots || {}).map(([type, count]) => (
                        count > 0 && (
                          <p key={type} className="text-xs text-gray-600">
                            {type}: {count}
                          </p>
                        )
                      ))}
                    </div>
                  </div>
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <label className="text-xs font-medium text-gray-500">Used Slots</label>
                    <p className="text-2xl font-bold text-orange-700 mt-1">{selectedSlotRequest.user_used_slots || 0}</p>
                    <div className="mt-2 space-y-1">
                      {Object.entries(selectedSlotRequest.user_used_slots_detail || {}).map(([type, count]) => (
                        count > 0 && (
                          <p key={type} className="text-xs text-gray-600">
                            {type}: {count}
                          </p>
                        )
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded">
                  <p className="text-xs text-gray-600">
                    <strong>Available Slots:</strong> {(selectedSlotRequest.user_total_slots || 0) - (selectedSlotRequest.user_used_slots || 0)}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-4">Slot Details</h3>
                {isNewFormat(selectedSlotRequest.requested_slots) ? (
                  <div className="space-y-4">
                    {selectedSlotRequest.requested_slots.slots && selectedSlotRequest.requested_slots.slots.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600 mb-3">
                          All slots with detailed information:
                        </p>
                        {selectedSlotRequest.requested_slots.slots.map((slot, index) => {
                          // Get color scheme based on slot type
                          const getSlotColors = (type) => {
                            switch(type) {
                              case 'VIP': return { bg: 'bg-purple-50/50', badge: 'bg-purple-100 text-purple-800' };
                              case 'Premier': return { bg: 'bg-indigo-50/50', badge: 'bg-indigo-100 text-indigo-800' };
                              case 'Partner': return { bg: 'bg-pink-50/50', badge: 'bg-pink-100 text-pink-800' };
                              case 'Exhibitor': return { bg: 'bg-cyan-50/50', badge: 'bg-cyan-100 text-cyan-800' };
                              case 'Media': return { bg: 'bg-yellow-50/50', badge: 'bg-yellow-100 text-yellow-800' };
                              case 'Other': return { bg: 'bg-gray-50/50', badge: 'bg-gray-100 text-gray-800' };
                              default: return { bg: 'bg-gray-50/50', badge: 'bg-gray-100 text-gray-800' };
                            }
                          };
                          const colors = getSlotColors(slot.type);
                          
                          return (
                          <div key={index} className={`p-4 border rounded-lg ${colors.bg}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="secondary" className={colors.badge}>{slot.type}</Badge>
                              <span className="text-sm text-gray-600">Slot {slot.slotNumber}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <label className="text-xs font-medium text-gray-500">Name</label>
                                <p className="text-sm font-medium">{slot.name || 'N/A'}</p>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500">Email</label>
                                <p className="text-sm">{slot.email || 'N/A'}</p>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500">Position</label>
                                <p className="text-sm">{slot.position || 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                          );
                        })}
                        {selectedSlotRequest.requested_slots.summary && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-sm text-gray-600 mb-2">All requested slots summary:</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(selectedSlotRequest.requested_slots.summary).map(([type, count]) => (
                                count > 0 && (
                                  <Badge key={type} variant="secondary">
                                    {count} x {type}
                                  </Badge>
                                )
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No slot details available.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 mb-2">Requested slots summary:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(getSlotSummary(selectedSlotRequest.requested_slots)).map(([type, count]) => (
                        count > 0 && (
                          <Badge key={type} variant="secondary">{count} x {type}</Badge>
                        )
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">This request does not include detailed slot information.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSlotDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Modification Request</DialogTitle>
          </DialogHeader>
          
          {selectedAttendee && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Name</label>
                  <p className="text-sm">{selectedAttendee.first_name} {selectedAttendee.last_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-sm">{selectedAttendee.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Organization</label>
                  <p className="text-sm">{selectedAttendee.organization || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Job Title</label>
                  <p className="text-sm">{selectedAttendee.job_title || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Attendee Type</label>
                  <p className="text-sm">{selectedAttendee.attendee_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Current Status</label>
                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                    {selectedAttendee.status}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Request Details</label>
                <p className="text-sm text-gray-700 mt-1">
                  This attendee has requested modifications to their registration information. 
                  Please review the details above and decide whether to approve or decline the changes.
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowReviewDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleReviewDecision('decline')}
            >
              <X className="w-4 h-4 mr-2" />
              Decline
            </Button>
            <Button 
              onClick={() => handleReviewDecision('approve')}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slot Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Approve Slot Request</DialogTitle>
          </DialogHeader>
          
          {requestToApprove && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Requested By</label>
                  <p className="text-sm font-semibold">{requestToApprove.user_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-sm">{requestToApprove.user_email}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">Reason</label>
                  <p className="text-sm text-gray-700 mt-1">{requestToApprove.reason || 'No reason provided'}</p>
                </div>
                {requestToApprove.other_reason && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500">Reason for "Other" Slots</label>
                    <p className="text-sm text-gray-700 mt-1 bg-gray-50 p-3 rounded border border-gray-200">
                      {requestToApprove.other_reason}
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-4">Select Number of Slots to Approve</h3>
                <p className="text-sm text-gray-600 mb-4">
                  You can approve fewer slots than requested. Enter the number of slots you want to approve for each type.
                </p>
                
                <div className="space-y-4">
                  {Object.entries(getSlotSummary(requestToApprove.requested_slots)).map(([type, requestedCount]) => {
                    if (requestedCount <= 0) return null;
                    
                    return (
                      <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <Label htmlFor={`approve-${type}`} className="text-sm font-medium">
                            {type} Slots
                          </Label>
                          <p className="text-xs text-gray-500 mt-1">
                            Requested: {requestedCount}
                          </p>
                        </div>
                        <div className="w-32">
                          <Input
                            id={`approve-${type}`}
                            type="number"
                            min="0"
                            max={requestedCount}
                            value={approvalAmounts[type] || 0}
                            onChange={(e) => {
                              const value = Math.max(0, Math.min(requestedCount, parseInt(e.target.value) || 0));
                              setApprovalAmounts(prev => ({
                                ...prev,
                                [type]: value
                              }));
                            }}
                            className="text-center"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Total to Approve:</strong>{' '}
                    {Object.values(approvalAmounts).reduce((sum, count) => sum + (parseInt(count) || 0), 0)} slots
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowApprovalDialog(false);
                setRequestToApprove(null);
                setApprovalAmounts({});
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmApproval}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Approve Selected Slots
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}