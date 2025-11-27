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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/common/Toast";
import NotificationService from "@/services/notificationService";
import { 
  Crown,
  Handshake,
  Monitor,
  FileText,
  Users,
  PlusCircle,
  ChevronLeft,
  ChevronRight
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
  const [formStep, setFormStep] = useState(1); // 1 = slot selection, 2 = slot details
  const [requestData, setRequestData] = useState({
    slots: { VIP: 0, Partner: 0, Exhibitor: 0, Media: 0 },
    reason: ''
  });
  const [slotDetails, setSlotDetails] = useState({}); // { "VIP-1": { name: "", email: "", position: "" }, ... }
  const [selectedSlotForDetails, setSelectedSlotForDetails] = useState({}); // { "VIP": "VIP-1", "Partner": "Partner-1", ... }
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
      setSlotDetails(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          if (key.startsWith(`${type}-`)) {
            delete updated[key];
          }
        });
        return updated;
      });
      setSelectedSlotForDetails(prev => {
        const updated = { ...prev };
        delete updated[type];
        return updated;
      });
    }
  };

  const handleNextStep = () => {
    if (Object.values(requestData.slots).every(v => v === 0)) {
      toast({ title: "Error", description: "Please request at least one slot.", variant: "destructive" });
      return;
    }
    if (!requestData.reason) {
      toast({ title: "Error", description: "A reason for the request is required.", variant: "destructive" });
      return;
    }
    setFormStep(2);
  };

  const handleBackStep = () => {
    setFormStep(1);
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

  const handleSelectedSlotChange = (type, slotKey) => {
    setSelectedSlotForDetails(prev => ({
      ...prev,
      [type]: slotKey
    }));
  };

  const handleSubmitRequest = async () => {
    if (!currentUser) return;
    
    // Validate that all slots have details filled
    const totalSlots = Object.values(requestData.slots).reduce((sum, count) => sum + count, 0);
    const slotsWithDetails = Object.keys(slotDetails).filter(key => {
      const detail = slotDetails[key];
      return detail?.name && detail?.email && detail?.position;
    });
    
    if (slotsWithDetails.length < totalSlots) {
      toast({ 
        title: "Error", 
        description: `Please fill in details (name, email, position) for all ${totalSlots} requested slot(s).`, 
        variant: "destructive" 
      });
      return;
    }

    try {
      // Build slots array
      const slotsArray = [];
      Object.entries(requestData.slots).forEach(([type, count]) => {
        for (let i = 1; i <= count; i++) {
          const slotKey = `${type}-${i}`;
          const detail = slotDetails[slotKey];
          if (detail) {
            slotsArray.push({
              type: type,
              slotNumber: i,
              name: detail.name,
              email: detail.email,
              position: detail.position
            });
          }
        }
      });

      // Format data in new structure
      const requestedSlotsData = {
        slots: slotsArray,
        summary: requestData.slots
      };

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
      setFormStep(1);
      setRequestData({ slots: { VIP: 0, Partner: 0, Exhibitor: 0, Media: 0 }, reason: '' });
      setSlotDetails({});
      setSelectedSlotForDetails({});
    } catch (error) {
      console.error("Failed to submit slot request:", error);
      toast({ title: "Submission Failed", description: "Could not send your request. Please try again.", variant: "destructive" });
    }
  };

  const handleDialogClose = (open) => {
    if (!open) {
      setShowRequestDialog(false);
      setFormStep(1);
      setRequestData({ slots: { VIP: 0, Partner: 0, Exhibitor: 0, Media: 0 }, reason: '' });
      setSlotDetails({});
      setSelectedSlotForDetails({});
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Additional Slots</DialogTitle>
            <DialogDescription>
              {formStep === 1 
                ? "Select the number of slots you need for each attendee type."
                : "Fill in the details for each requested slot."}
            </DialogDescription>
          </DialogHeader>
          
          {formStep === 1 ? (
            <>
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
                <Button onClick={handleNextStep}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="py-4 space-y-6">
                {attendeeTypes.map(type => {
                  const count = requestData.slots[type] || 0;
                  if (count === 0) return null;
                  
                  return (
                    <div key={type} className="space-y-4 border-b pb-4 last:border-b-0">
                      <h3 className="font-semibold text-lg">{type} Slots ({count})</h3>
                      {Array.from({ length: count }, (_, i) => {
                        const slotNumber = i + 1;
                        const slotKey = `${type}-${slotNumber}`;
                        const detail = slotDetails[slotKey] || { name: '', email: '', position: '' };
                        
                        return (
                          <div key={slotKey} className="space-y-3 pl-4 border-l-2 border-gray-200">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-sm text-gray-700">{type} Slot {slotNumber}</span>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor={`name-${slotKey}`}>Name *</Label>
                                <Input 
                                  id={`name-${slotKey}`}
                                  placeholder="Enter name"
                                  value={detail.name}
                                  onChange={(e) => handleSlotDetailChange(slotKey, 'name', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`email-${slotKey}`}>Email *</Label>
                                <Input 
                                  id={`email-${slotKey}`}
                                  type="email"
                                  placeholder="Enter email"
                                  value={detail.email}
                                  onChange={(e) => handleSlotDetailChange(slotKey, 'email', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`position-${slotKey}`}>Position *</Label>
                                <Input 
                                  id={`position-${slotKey}`}
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
                  );
                })}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleBackStep}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleSubmitRequest}>Submit Request</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}