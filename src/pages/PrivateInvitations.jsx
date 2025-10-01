import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { Invitation, Attendee, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/common/Toast';
import { Mail, Copy, Trash2, PlusCircle, CheckCircle, Clock, ExternalLink, Link as LinkIcon, Users, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { generateInvitations } from '@/api/functions';
import { sendInvitationEmail } from '@/api/functions';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const attendeeTypes = ["VIP", "Partner", "Exhibitor", "Media"];

export default function PrivateInvitations() {
  const [invitations, setInvitations] = useState([]);
  const [attendees, setAttendees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showAttendeeDialog, setShowAttendeeDialog] = useState(false);
  
  const [invitationToSend, setInvitationToSend] = useState(null);
  const [sendToEmail, setSendToEmail] = useState('');

  const [singleType, setSingleType] = useState('Partner');
  const [bulkType, setBulkType] = useState('Partner');
  const [bulkCount, setBulkCount] = useState(10);
  
  const [selectedAttendee, setSelectedAttendee] = useState(null);

  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get current user to check permissions
      const currentUser = await User.me();
      
      // Check if user can see all attendees or only their own
      const canSeeAllAttendees = currentUser?.role === 'admin' || 
                                 currentUser?.system_role === 'Admin' || 
                                 currentUser?.system_role === 'Super User';
      
      let attendeesData = [];
      if (canSeeAllAttendees) {
        // Admin/Super User: Get all attendees
        attendeesData = await Attendee.list();
      } else {
        // Regular User: Only get attendees they registered
        attendeesData = await Attendee.getByRegisteredBy(currentUser.id);
      }
      
      const invitationsData = await Invitation.list('-created_at');
      
      setInvitations(invitationsData);
      setAttendees(attendeesData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({ title: "Error", description: "Failed to load invitation data.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async (type, count) => {
    try {
      await generateInvitations({ count, attendee_type: type });
      toast({ title: "Success", description: `${count} invitation(s) generated successfully.`, variant: "success" });
      loadData();
      return true;
    } catch (error) {
      console.error("Error generating invitations:", error);
      toast({ title: "Error", description: "Failed to generate invitations.", variant: "destructive" });
      return false;
    }
  };

  const handleCopyLink = (invitation) => {
    const link = `${window.location.origin}/PublicRegistration?invitation_code=${invitation.invitation_code}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Copied", description: "Invitation link copied to clipboard.", variant: "success" });
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this invitation? This cannot be undone.")) {
      try {
        await Invitation.delete(id);
        toast({ title: "Deleted", description: "Invitation deleted successfully.", variant: "success" });
        loadData();
      } catch (error) {
        toast({ title: "Error", description: "Failed to delete invitation.", variant: "destructive" });
      }
    }
  };

  const openSendDialog = (invitation) => {
    setInvitationToSend(invitation);
    setSendToEmail(invitation.used_by_email || '');
    setShowSendDialog(true);
  };
  
  const handleSendEmail = async () => {
    if (!invitationToSend || !sendToEmail) return;
    try {
      await sendInvitationEmail({
        to_email: sendToEmail,
        invitation_code: invitationToSend.invitation_code
      });
      toast({ title: "Email Sent", description: `Invitation sent to ${sendToEmail}.`, variant: "success" });
      setShowSendDialog(false);
      setInvitationToSend(null);
      setSendToEmail('');
    } catch(error) {
      toast({ title: "Error", description: "Failed to send email.", variant: "destructive" });
    }
  };

  const viewUsedAttendee = (invitation) => {
    const attendee = attendees.find(a => a.email && invitation.used_by_email && a.email.toLowerCase() === invitation.used_by_email.toLowerCase());
    if (attendee) {
      setSelectedAttendee(attendee);
      setShowAttendeeDialog(true);
    } else {
      toast({ title: "Not Found", description: `Could not find an attendee record for ${invitation.used_by_email}.`, variant: "warning" });
    }
  };

  return (
    <ProtectedRoute adminOnly pageName="PrivateInvitations">
      <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Private Invitations</h1>
              <p className="text-gray-500 mt-1">Generate and manage single-use invitation links.</p>
            </div>
          </div>
          
          {/* Generation Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Generate Single Invitation</CardTitle>
                <CardDescription>Create one invitation link for a specific attendee type.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-end gap-4">
                <div className="flex-grow">
                  <Label htmlFor="single-type">Attendee Type</Label>
                  <Select value={singleType} onValueChange={setSingleType}>
                    <SelectTrigger id="single-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {attendeeTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => handleGenerate(singleType, 1)}><PlusCircle className="w-4 h-4 mr-2" />Generate</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Generate Bulk Invitations</CardTitle>
                <CardDescription>Create multiple invitations for an attendee type.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-end gap-4">
                <div className="flex-grow">
                  <Label htmlFor="bulk-type">Attendee Type</Label>
                  <Select value={bulkType} onValueChange={setBulkType}>
                    <SelectTrigger id="bulk-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {attendeeTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label htmlFor="bulk-count">Quantity</Label>
                  <Input id="bulk-count" type="number" min="1" value={bulkCount} onChange={e => setBulkCount(Number(e.target.value))} />
                </div>
                <Button onClick={() => handleGenerate(bulkType, bulkCount)}><Users className="w-4 h-4 mr-2" />Generate</Button>
              </CardContent>
            </Card>
          </div>

          {/* Invitations Table */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Invitations</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invitation Code</TableHead>
                    <TableHead>Attendee Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Used By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
                  ) : invitations.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center">No invitations generated yet.</TableCell></TableRow>
                  ) : (
                    invitations.map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.invitation_code}</TableCell>
                        <TableCell><Badge variant="outline">{inv.attendee_type}</Badge></TableCell>
                        <TableCell>
                          {inv.is_used ? (
                            <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Used</Badge>
                          ) : (
                            <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Available</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{inv.used_by_email || 'N/A'}</TableCell>
                        <TableCell className="text-sm">{format(new Date(inv.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {inv.is_used ? (
                              <Button variant="outline" size="sm" onClick={() => viewUsedAttendee(inv)}><Eye className="w-4 h-4 mr-1"/>View Attendee</Button>
                            ) : (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleCopyLink(inv)} title="Copy Link"><LinkIcon className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => openSendDialog(inv)} title="Send Email"><Mail className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(inv.id)} title="Delete"><Trash2 className="w-4 h-4" /></Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Send Email Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Invitation Email</DialogTitle>
            <DialogDescription>
              Enter the recipient's email address to send the invitation link.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="send-email">Email Address</Label>
            <Input id="send-email" type="email" placeholder="recipient@example.com" value={sendToEmail} onChange={e => setSendToEmail(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>Cancel</Button>
            <Button onClick={handleSendEmail}><Mail className="w-4 h-4 mr-2" />Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Attendee Details Dialog */}
      <Dialog open={showAttendeeDialog} onOpenChange={setShowAttendeeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Attendee Details</DialogTitle></DialogHeader>
          {selectedAttendee ? (
            <div className="py-4 space-y-3">
               <p><strong>Name:</strong> {selectedAttendee.first_name} {selectedAttendee.last_name}</p>
               <p><strong>Email:</strong> {selectedAttendee.email}</p>
               <p><strong>Organization:</strong> {selectedAttendee.organization}</p>
               <p><strong>Status:</strong> <Badge variant={selectedAttendee.status === 'approved' ? 'default' : 'secondary'}>{selectedAttendee.status}</Badge></p>
            </div>
          ) : <p>Loading attendee details...</p>}
          <DialogFooter>
             <Link to={createPageUrl("Attendees")}>
              <Button variant="outline"><ExternalLink className="w-4 h-4 mr-2" />View Full Profile</Button>
             </Link>
             <Button onClick={() => setShowAttendeeDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}