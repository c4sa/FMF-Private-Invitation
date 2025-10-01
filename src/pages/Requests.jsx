import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Attendee, SlotRequest, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/common/Toast';
import { format } from 'date-fns';
import { Check, X, Eye, Inbox, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import NotificationService from '@/services/notificationService';

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
            return {
              ...req,
              user_name: user.preferred_name || user.full_name || 'Unknown User',
              user_email: user.email || 'No email'
            };
          } catch (error) {
            console.error(`Failed to fetch user for slot request ${req.id}:`, error);
            return {
              ...req,
              user_name: 'Unknown User',
              user_email: 'No email'
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
  
  const handleSlotRequest = async (request, newStatus) => {
    try {
      const oldStatus = request.status;
      
      if (newStatus === 'approved') {
          const user = await User.get(request.user_id);
          const currentSlots = user.registration_slots || {};
          const newSlots = { ...currentSlots };
          
          Object.entries(request.requested_slots).forEach(([type, count]) => {
              newSlots[type] = (newSlots[type] || 0) + count;
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
      
      toast({ title: "Success", description: `Slot request has been ${newStatus}.`, variant: "success" });
      loadRequests();
    } catch(error) {
      console.error("Failed to handle slot request:", error);
      toast({ title: "Error", description: "Could not process the slot request.", variant: "destructive" });
    }
  };

  return (
    <ProtectedRoute adminOnly>
      <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Requests</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  Additional Slot Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? <p>Loading...</p> : slotRequests.length > 0 ? slotRequests.map(req => (
                  <div key={req.id} className="p-4 border rounded-lg flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{req.user_name} <span className="text-sm text-gray-500">({req.user_email})</span></p>
                      <p className="text-sm text-gray-600 mt-1">{req.reason}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(req.requested_slots).map(([type, count]) => (
                          <Badge key={type} variant="secondary">{count} x {type}</Badge>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Requested on {safeFormatDate(req.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-4">
                      <Button size="icon" className="bg-green-500 hover:bg-green-600 h-8 w-8" onClick={() => handleSlotRequest(req, 'approved')}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="icon" className="bg-red-500 hover:bg-red-600 h-8 w-8" onClick={() => handleSlotRequest(req, 'rejected')}>
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
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-orange-600" />
                  Attendee Modification Requests
                </CardTitle>
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
    </ProtectedRoute>
  );
}