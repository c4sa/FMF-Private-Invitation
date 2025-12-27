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
  UserPlus,
  Star
} from "lucide-react";

const attendeeTypeConfig = {
  "VIP": { 
    icon: Crown, 
    color: "bg-purple-500", 
    bgColor: "bg-white border-gray-200",
    bgLight: "bg-purple-50",
    borderColor: "border-purple-200",
    textColor: "text-purple-900",
    textLight: "text-purple-700",
    iconColor: "text-purple-600",
    borderButton: "border-purple-300",
    textButton: "text-purple-700",
    hoverButton: "hover:bg-purple-100"
  },
  "Premier": { 
    icon: Star, 
    color: "bg-indigo-500", 
    bgColor: "bg-white border-gray-200",
    bgLight: "bg-indigo-50",
    borderColor: "border-indigo-200",
    textColor: "text-indigo-900",
    textLight: "text-indigo-700",
    iconColor: "text-indigo-600",
    borderButton: "border-indigo-300",
    textButton: "text-indigo-700",
    hoverButton: "hover:bg-indigo-100"
  },
  "Partner": { 
    icon: Handshake, 
    color: "bg-pink-500", 
    bgColor: "bg-white border-gray-200",
    bgLight: "bg-pink-50",
    borderColor: "border-pink-200",
    textColor: "text-pink-900",
    textLight: "text-pink-700",
    iconColor: "text-pink-600",
    borderButton: "border-pink-300",
    textButton: "text-pink-700",
    hoverButton: "hover:bg-pink-100"
  },
  "Exhibitor": { 
    icon: Monitor, 
    color: "bg-cyan-500", 
    bgColor: "bg-white border-gray-200",
    bgLight: "bg-cyan-50",
    borderColor: "border-cyan-200",
    textColor: "text-cyan-900",
    textLight: "text-cyan-700",
    iconColor: "text-cyan-600",
    borderButton: "border-cyan-300",
    textButton: "text-cyan-700",
    hoverButton: "hover:bg-cyan-100"
  },
  "Media": { 
    icon: FileText, 
    color: "bg-yellow-500", 
    bgColor: "bg-white border-gray-200",
    bgLight: "bg-yellow-50",
    borderColor: "border-yellow-200",
    textColor: "text-yellow-900",
    textLight: "text-yellow-700",
    iconColor: "text-yellow-600",
    borderButton: "border-yellow-300",
    textButton: "text-yellow-700",
    hoverButton: "hover:bg-yellow-100"
  },
  "Other": { 
    icon: Users, 
    color: "bg-gray-500", 
    bgColor: "bg-white border-gray-200",
    bgLight: "bg-gray-50",
    borderColor: "border-gray-200",
    textColor: "text-gray-900",
    textLight: "text-gray-700",
    iconColor: "text-gray-600",
    borderButton: "border-gray-300",
    textButton: "text-gray-700",
    hoverButton: "hover:bg-gray-100"
  }
};

const attendeeTypes = ["VIP", "Premier", "Partner", "Exhibitor", "Media", "Other"];

export default function AccessLevels() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showSlotDetailsDialog, setShowSlotDetailsDialog] = useState(false);
  const [currentSlotType, setCurrentSlotType] = useState(null); // Track which slot type dialog is open
  const [requestData, setRequestData] = useState({
    slots: { VIP: 0, Premier: 0, Partner: 0, Exhibitor: 0, Media: 0, Other: 0 },
    reason: ''
  });
  // Unified slot details state: { "VIP-1": { name: "", email: "", position: "" }, "Partner-1": {...}, ... }
  const [slotDetails, setSlotDetails] = useState({});
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
    
    // Clean up slot details if count is reduced
    if (newCount === 0) {
      // Remove all details for this slot type
      setSlotDetails(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          if (key.startsWith(`${type}-`)) {
            delete updated[key];
          }
        });
        return updated;
      });
    } else {
      const oldCount = requestData.slots[type] || 0;
      if (newCount < oldCount) {
        // Remove details for slots beyond the new count
        setSlotDetails(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(key => {
            if (key.startsWith(`${type}-`)) {
              const slotNum = parseInt(key.split('-')[1]);
              if (slotNum > newCount) {
                delete updated[key];
              }
            }
          });
          return updated;
        });
      }
    }
  };

  const handleSlotDetailChange = (slotKey, field, value) => {
    setSlotDetails(prev => ({
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

    // Validate ALL slot types have details
    const slotTypes = ['VIP', 'Premier', 'Partner', 'Exhibitor', 'Media', 'Other'];
    for (const slotType of slotTypes) {
      const count = requestData.slots[slotType] || 0;
      if (count > 0) {
        const slotsWithDetails = Object.keys(slotDetails).filter(key => {
          if (!key.startsWith(`${slotType}-`)) return false;
          const detail = slotDetails[key];
          return detail?.name && detail?.email && detail?.position;
        });
        
        if (slotsWithDetails.length < count) {
          toast({ 
            title: "Error", 
            description: `Please fill in details (name, email, position) for all ${count} ${slotType} slot(s). Click "Add Details" to add ${slotType} slot information.`, 
            variant: "destructive" 
          });
          return;
        }
      }
    }

    try {
      // Build slots array with details for ALL slot types
      const allDetailedSlots = [];
      const slotTypes = ['VIP', 'Premier', 'Partner', 'Exhibitor', 'Media', 'Other'];
      
      for (const slotType of slotTypes) {
        const count = requestData.slots[slotType] || 0;
        if (count > 0) {
          for (let i = 1; i <= count; i++) {
            const slotKey = `${slotType}-${i}`;
            const detail = slotDetails[slotKey];
            if (detail) {
              allDetailedSlots.push({
                type: slotType,
                slotNumber: i,
                name: detail.name,
                email: detail.email,
                position: detail.position
              });
            }
          }
        }
      }

      // Format data: All slots with details
      const requestedSlotsData = {
        slots: allDetailedSlots,
        summary: requestData.slots
      };

      const slotRequest = await SlotRequest.create({
        user_id: currentUser.id,
        requested_slots: requestedSlotsData,
        reason: requestData.reason,
        other_reason: null, // No longer needed since all slots require details
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
      setRequestData({ slots: { VIP: 0, Premier: 0, Partner: 0, Exhibitor: 0, Media: 0, Other: 0 }, reason: '' });
      setSlotDetails({});
    } catch (error) {
      console.error("Failed to submit slot request:", error);
      toast({ title: "Submission Failed", description: "Could not send your request. Please try again.", variant: "destructive" });
    }
  };

  const handleDialogClose = (open) => {
    if (!open) {
      setShowRequestDialog(false);
      setRequestData({ slots: { VIP: 0, Premier: 0, Partner: 0, Exhibitor: 0, Media: 0, Other: 0 }, reason: '' });
      setSlotDetails({});
    }
  };

  const handleSlotDetailsDialogClose = (open) => {
    if (!open) {
      setShowSlotDetailsDialog(false);
      setCurrentSlotType(null);
    }
  };

  const openSlotDetailsDialog = (slotType) => {
    setCurrentSlotType(slotType);
    setShowSlotDetailsDialog(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <Loader size="default" />
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'admin' || currentUser?.system_role === 'Admin';
  
  // Filter attendee types based on user access - only show Premier if user has assign_premier
  const availableAttendeeTypes = attendeeTypes.filter(type => {
    if (type === 'Premier') {
      return currentUser?.assign_premier === true;
    }
    return true;
  });
  
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
              Select the number of slots you need for each attendee type. All slots require additional details (name, email, position).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {availableAttendeeTypes.map(type => (
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
            {/* Show details section for all slot types that have count > 0 */}
            {availableAttendeeTypes.map(slotType => {
              const count = requestData.slots[slotType] || 0;
              if (count === 0) return null;
              
              const config = attendeeTypeConfig[slotType];
              const Icon = config?.icon || Users;
              const slotsWithDetails = Object.keys(slotDetails).filter(key => {
                if (!key.startsWith(`${slotType}-`)) return false;
                const detail = slotDetails[key];
                return detail?.name && detail?.email && detail?.position;
              }).length;
              
              return (
                <div key={slotType} className={`flex items-center gap-2 p-3 ${config.bgLight} border ${config.borderColor} rounded-lg`}>
                  <Icon className={`w-5 h-5 ${config.iconColor}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${config.textColor}`}>
                      {count} {slotType} slot{count > 1 ? 's' : ''} requested
                    </p>
                    <p className={`text-xs ${config.textLight}`}>
                      {slotsWithDetails} of {count} slot{count > 1 ? 's' : ''} with details
                    </p>
                  </div>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm"
                    onClick={() => openSlotDetailsDialog(slotType)}
                    className={`${config.borderButton} ${config.textButton} ${config.hoverButton}`}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Details
                  </Button>
                </div>
              );
            })}
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

      {/* Unified Slot Details Dialog */}
      <Dialog open={showSlotDetailsDialog} onOpenChange={handleSlotDetailsDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add {currentSlotType} Slot Details</DialogTitle>
            <DialogDescription>
              Fill in the details for each {currentSlotType} slot. All fields are required.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {currentSlotType && Array.from({ length: requestData.slots[currentSlotType] || 0 }, (_, i) => {
              const slotNumber = i + 1;
              const slotKey = `${currentSlotType}-${slotNumber}`;
              const detail = slotDetails[slotKey] || { name: '', email: '', position: '' };
              const config = attendeeTypeConfig[currentSlotType];
              const Icon = config?.icon || Users;
              
              return (
                <div key={slotKey} className={`space-y-3 p-4 border rounded-lg ${config.bgLight}/50`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${config.iconColor}`} />
                    <span className="font-semibold text-sm text-gray-900">{currentSlotType} Slot {slotNumber}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`${slotKey}-name`}>Name *</Label>
                      <Input 
                        id={`${slotKey}-name`}
                        placeholder="Enter name"
                        value={detail.name}
                        onChange={(e) => handleSlotDetailChange(slotKey, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${slotKey}-email`}>Email *</Label>
                      <Input 
                        id={`${slotKey}-email`}
                        type="email"
                        placeholder="Enter email"
                        value={detail.email}
                        onChange={(e) => handleSlotDetailChange(slotKey, 'email', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${slotKey}-position`}>Position *</Label>
                      <Input 
                        id={`${slotKey}-position`}
                        placeholder="Enter position"
                        value={detail.position}
                        onChange={(e) => handleSlotDetailChange(slotKey, 'position', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleSlotDetailsDialogClose(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}