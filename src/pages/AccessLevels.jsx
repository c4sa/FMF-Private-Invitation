import React, { useState, useEffect } from "react";
import { User, SlotRequest } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Loader from "@/components/ui/loader";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/common/Toast";
import NotificationService from "@/services/notificationService";
import { 
  Crown,
  Handshake,
  Monitor,
  FileText,
  Users,
  PlusCircle,
  UserPlus
} from "lucide-react";

const attendeeTypeConfig = {
  "VIP": { icon: Crown, color: "bg-purple-500", bgColor: "bg-white border-gray-200" },
  "Partner": { icon: Handshake, color: "bg-pink-500", bgColor: "bg-white border-gray-200" },
  "Exhibitor": { icon: Monitor, color: "bg-cyan-500", bgColor: "bg-white border-gray-200" },
  "Media": { icon: FileText, color: "bg-yellow-500", bgColor: "bg-white border-gray-200" }
};

const attendeeTypes = ["VIP", "Partner", "Exhibitor", "Media"];

export default function AccessLevels() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showVipDetailsDialog, setShowVipDetailsDialog] = useState(false);
  const [requestData, setRequestData] = useState({
    slots: { VIP: 0, Partner: 0, Exhibitor: 0, Media: 0 },
    reason: ''
  });
  const [vipSlotDetails, setVipSlotDetails] = useState({}); // { "VIP-1": { name: "", email: "", position: "" }, ... }
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);
    } catch (error) {
      console.error("Error loading user data:", error);
    }
    setIsLoading(false);
  };

  const handleSlotRequestChange = (type, value) => {
    const newCount = parseInt(value) || 0;
    setRequestData(prev => ({
      ...prev,
      slots: { ...prev.slots, [type]: newCount }
    }));
    
    // Clean up VIP slot details if VIP count is reduced
    if (type === 'VIP' && newCount === 0) {
      setVipSlotDetails({});
    } else if (type === 'VIP' && newCount < (requestData.slots.VIP || 0)) {
      // Remove details for slots beyond the new count
      setVipSlotDetails(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          const slotNum = parseInt(key.split('-')[1]);
          if (slotNum > newCount) {
            delete updated[key];
          }
        });
        return updated;
      });
    }
  };

  const handleVipSlotDetailChange = (slotKey, field, value) => {
    setVipSlotDetails(prev => ({
      ...prev,
      [slotKey]: {
        ...prev[slotKey],
        [field]: value
      }
    }));
  };

  const handleSubmitRequest = async () => {
    if (!currentUser) return;
    
    // Validate basic requirements
    if (Object.values(requestData.slots).every(v => v === 0)) {
      toast({ title: "Error", description: "Please request at least one slot.", variant: "destructive" });
      return;
    }
    
    if (!requestData.reason) {
      toast({ title: "Error", description: "A reason for the request is required.", variant: "destructive" });
      return;
    }

    // Validate VIP slots have details if VIP slots are requested
    const vipCount = requestData.slots.VIP || 0;
    if (vipCount > 0) {
      const vipSlotsWithDetails = Object.keys(vipSlotDetails).filter(key => {
        const detail = vipSlotDetails[key];
        return detail?.name && detail?.email && detail?.position;
      });
      
      if (vipSlotsWithDetails.length < vipCount) {
        toast({ 
          title: "Error", 
          description: `Please fill in details (name, email, position) for all ${vipCount} VIP slot(s). Click "Add Details" to add VIP slot information.`, 
          variant: "destructive" 
        });
        return;
      }
    }

    try {
      // Build VIP slots array with details
      const vipSlotsArray = [];
      if (vipCount > 0) {
        for (let i = 1; i <= vipCount; i++) {
          const slotKey = `VIP-${i}`;
          const detail = vipSlotDetails[slotKey];
          if (detail) {
            vipSlotsArray.push({
              type: 'VIP',
              slotNumber: i,
              name: detail.name,
              email: detail.email,
              position: detail.position
            });
          }
        }
      }

      // Format data: VIP slots with details, others as simple counts
      const requestedSlotsData = vipCount > 0 && vipSlotsArray.length > 0
        ? {
            slots: vipSlotsArray,
            summary: requestData.slots
          }
        : requestData.slots; // Old format for non-VIP requests

      const slotRequest = await SlotRequest.create({
        user_id: currentUser.id,
        requested_slots: requestedSlotsData,
        reason: requestData.reason,
        status: 'pending'
      });
      
      // Create notification for admins about the slot request
      try {
        await NotificationService.notifySlotRequestCreated(slotRequest, currentUser);
      } catch (notificationError) {
        console.error('Failed to create notification for slot request:', notificationError);
        // Don't fail the request if notification fails
      }
      
      toast({ title: "Request Sent", description: "Your request for additional slots has been sent for approval.", variant: "success" });
      setShowRequestDialog(false);
      setRequestData({ slots: { VIP: 0, Partner: 0, Exhibitor: 0, Media: 0 }, reason: '' });
      setVipSlotDetails({});
    } catch (error) {
      console.error("Failed to submit slot request:", error);
      toast({ title: "Submission Failed", description: "Could not send your request. Please try again.", variant: "destructive" });
    }
  };

  const handleDialogClose = (open) => {
    if (!open) {
      setShowRequestDialog(false);
      setRequestData({ slots: { VIP: 0, Partner: 0, Exhibitor: 0, Media: 0 }, reason: '' });
      setVipSlotDetails({});
    }
  };

  const handleVipDetailsDialogClose = (open) => {
    if (!open) {
      setShowVipDetailsDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <Loader size="default" />
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'admin' || currentUser?.system_role === 'Admin';
  
  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isAdmin ? 'Access Levels Overview' : 'My Available Slots'}
            </h1>
            <p className="text-gray-500 mt-1">
              {isAdmin 
                ? 'View attendee categories and allocations'
                : 'View and request additional registration slots'
              }
            </p>
          </div>
          {!isAdmin && (
            <Button onClick={() => setShowRequestDialog(true)}>
              <PlusCircle className="w-4 h-4 mr-2" />
              Request More Slots
            </Button>
          )}
        </div>

        {/* User's slots view */}
        {!isAdmin && currentUser?.registration_slots && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {Object.entries(currentUser.registration_slots).map(([type, totalSlots]) => {
              const usedSlots = currentUser.used_slots?.[type] || 0;
              const remainingSlots = totalSlots - usedSlots;

              const config = attendeeTypeConfig[type];
              const Icon = config?.icon || Users;
              const progressPercentage = totalSlots > 0 ? (usedSlots / totalSlots) * 100 : 0;

              return (
                <Card key={type} className={`border ${config?.bgColor || 'bg-gray-50 border-gray-200'}`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${config?.color || 'bg-gray-500'} text-white`}><Icon className="w-6 h-6" /></div>
                      <CardTitle className="text-lg font-bold text-gray-900">{type}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Progress value={progressPercentage} className="h-2" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Used: {usedSlots}/{totalSlots}</span>
                      <span className={`text-xl font-bold ${remainingSlots > 0 ? 'text-green-600' : 'text-red-600'}`}>{remainingSlots}</span>
                    </div>
                    <p className={`text-right text-sm font-semibold ${remainingSlots > 0 ? 'text-gray-600' : 'text-red-600'}`}>
                      {remainingSlots > 0 ? 'Available' : 'Unavailable'}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showRequestDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request Additional Slots</DialogTitle>
            <DialogDescription>
              Select the number of slots you need for each attendee type. VIP slots require additional details.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {attendeeTypes.map(type => (
                <div key={type} className="space-y-2">
                  <Label htmlFor={`slots-${type}`}>{type}</Label>
                  <Input 
                    id={`slots-${type}`}
                    type="number"
                    min="0"
                    value={requestData.slots[type]}
                    onChange={(e) => handleSlotRequestChange(type, e.target.value)}
                  />
                </div>
              ))}
            </div>
            {requestData.slots.VIP > 0 && (
              <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <Crown className="w-5 h-5 text-purple-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-purple-900">
                    {requestData.slots.VIP} VIP slot{requestData.slots.VIP > 1 ? 's' : ''} requested
                  </p>
                  <p className="text-xs text-purple-700">
                    {Object.keys(vipSlotDetails).filter(key => {
                      const detail = vipSlotDetails[key];
                      return detail?.name && detail?.email && detail?.position;
                    }).length} of {requestData.slots.VIP} slot{requestData.slots.VIP > 1 ? 's' : ''} with details
                  </p>
                </div>
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowVipDetailsDialog(true)}
                  className="border-purple-300 text-purple-700 hover:bg-purple-100"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Details
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reason">Justification / Note for Request</Label>
              <Textarea 
                id="reason"
                placeholder="Please provide a clear justification for this slot request..."
                value={requestData.reason}
                onChange={(e) => setRequestData(prev => ({...prev, reason: e.target.value}))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false)}>Cancel</Button>
            <Button onClick={handleSubmitRequest}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VIP Details Dialog */}
      <Dialog open={showVipDetailsDialog} onOpenChange={handleVipDetailsDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add VIP Slot Details</DialogTitle>
            <DialogDescription>
              Fill in the details for each VIP slot. All fields are required.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {Array.from({ length: requestData.slots.VIP || 0 }, (_, i) => {
              const slotNumber = i + 1;
              const slotKey = `VIP-${slotNumber}`;
              const detail = vipSlotDetails[slotKey] || { name: '', email: '', position: '' };
              
              return (
                <div key={slotKey} className="space-y-3 p-4 border rounded-lg bg-purple-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-4 h-4 text-purple-600" />
                    <span className="font-semibold text-sm text-gray-900">VIP Slot {slotNumber}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`vip-name-${slotKey}`}>Name *</Label>
                      <Input 
                        id={`vip-name-${slotKey}`}
                        placeholder="Enter name"
                        value={detail.name}
                        onChange={(e) => handleVipSlotDetailChange(slotKey, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`vip-email-${slotKey}`}>Email *</Label>
                      <Input 
                        id={`vip-email-${slotKey}`}
                        type="email"
                        placeholder="Enter email"
                        value={detail.email}
                        onChange={(e) => handleVipSlotDetailChange(slotKey, 'email', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`vip-position-${slotKey}`}>Position *</Label>
                      <Input 
                        id={`vip-position-${slotKey}`}
                        placeholder="Enter position"
                        value={detail.position}
                        onChange={(e) => handleVipSlotDetailChange(slotKey, 'position', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVipDetailsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}