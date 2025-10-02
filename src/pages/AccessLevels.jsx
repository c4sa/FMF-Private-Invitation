import React, { useState, useEffect } from "react";
import { User, SlotRequest } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/common/Toast";
import NotificationService from "@/services/notificationService";
import { 
  Crown,
  Handshake,
  Monitor,
  FileText,
  Users,
  PlusCircle
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
  const [requestData, setRequestData] = useState({
    slots: { VIP: 0, Partner: 0, Exhibitor: 0, Media: 0 },
    reason: ''
  });
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
    setRequestData(prev => ({
      ...prev,
      slots: { ...prev.slots, [type]: parseInt(value) || 0 }
    }));
  };

  const handleSubmitRequest = async () => {
    if (!currentUser) return;
    if (Object.values(requestData.slots).every(v => v === 0)) {
      toast({ title: "Error", description: "Please request at least one slot.", variant: "destructive" });
      return;
    }
    if (!requestData.reason) {
      toast({ title: "Error", description: "A reason for the request is required.", variant: "destructive" });
      return;
    }

    try {
      const slotRequest = await SlotRequest.create({
        user_id: currentUser.id,
        requested_slots: requestData.slots,
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
    } catch (error) {
      console.error("Failed to submit slot request:", error);
      toast({ title: "Submission Failed", description: "Could not send your request. Please try again.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
              
              if (totalSlots === 0 && usedSlots === 0) return null;

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
                      <span className="text-xl font-bold text-green-600">{remainingSlots}</span>
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

      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Additional Slots</DialogTitle>
            <DialogDescription>Your request will be sent to an administrator for approval.</DialogDescription>
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
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitRequest}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}