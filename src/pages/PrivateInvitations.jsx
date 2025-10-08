import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { Invitation, Attendee, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/common/Toast';
import { Mail, Copy, Trash2, PlusCircle, CheckCircle, Clock, ExternalLink, Link as LinkIcon, Users, Eye, UserIcon, Building, MapPin, Phone, Calendar, FileBadge, FileQuestion, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { generateInvitations } from '@/api/functions';
import { sendInvitationEmail } from '@/api/functions';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Private invitations are only for VIP attendees
const attendeeType = "VIP";

const statusColors = {
  pending: "bg-orange-100 text-orange-800 border-orange-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  declined: "bg-red-100 text-red-800 border-red-200",
  change_requested: "bg-yellow-100 text-yellow-800 border-yellow-200"
};

const typeColors = {
  "VIP": "bg-purple-100 text-purple-800",
  "Partner": "bg-pink-100 text-pink-800",
  "Exhibitor": "bg-cyan-100 text-cyan-800",
  "Media": "bg-yellow-100 text-yellow-800"
};

export default function PrivateInvitations() {
  const [invitations, setInvitations] = useState([]);
  const [attendees, setAttendees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showAttendeeDialog, setShowAttendeeDialog] = useState(false);
  
  const [invitationToSend, setInvitationToSend] = useState(null);
  const [sendToEmail, setSendToEmail] = useState('');

  const [bulkCount, setBulkCount] = useState(10);
  
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState('');

  const { toast } = useToast();

  const isPdfFile = (url) => {
    if (!url) return false;
    return url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf');
  };

  const handleImageClick = (url) => {
    if (!url) return;
    setEnlargedImageUrl(url);
    setShowImageDialog(true);
  };

  const getRegistererName = (attendee) => {
    // Check if registration was via invitation
    if (attendee.registration_method === 'invitation') {
      return 'Invitation';
    }

    // Note: attendee.created_by might store email, attendee.registered_by stores user ID
    // If created_by is an email that matches a user, or registered_by is a user ID
    const registeredByUser = allUsers.find(u => u.id === attendee.registered_by);
    if (registeredByUser) {
        return registeredByUser.preferred_name || registeredByUser.full_name || registeredByUser.email;
    }
    const createdByUserEmail = allUsers.find(u => u.email === attendee.created_by);
    if (createdByUserEmail) {
        return createdByUserEmail.preferred_name || createdByUserEmail.full_name || createdByUserEmail.email;
    }
    return attendee.created_by || 'System'; // Fallback to email string or 'System'
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get current user to check permissions
      const currentUser = await User.me();
      
      // Load users for registerer name resolution
      try {
        const usersData = await User.list();
        setAllUsers(usersData);
      } catch (userError) {
        console.warn("Could not load users for registerer names:", userError);
        // Continue without user data
      }
      
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

  const handleGenerate = async (count) => {
    try {
      await generateInvitations({ count, attendee_type: attendeeType });
      toast({ title: "Success", description: `${count} VIP invitation(s) generated successfully.`, variant: "success" });
      loadData();
      return true;
    } catch (error) {
      console.error("Error generating invitations:", error);
      toast({ title: "Error", description: "Failed to generate invitations.", variant: "destructive" });
      return false;
    }
  };

  const handleCopyLink = async (invitation) => {
    const link = `${window.location.origin}/PublicRegistration?invitation_code=${invitation.invitation_code}`;
    navigator.clipboard.writeText(link);
    
    // Update status to 'copied' if not already used
    if (!invitation.is_used) {
      try {
        await Invitation.update(invitation.id, { status: 'copied' });
        toast({ title: "Copied", description: "Invitation link copied to clipboard.", variant: "success" });
        loadData(); // Refresh the data to show updated status
      } catch (error) {
        console.error("Error updating invitation status:", error);
        toast({ title: "Copied", description: "Link copied but failed to update status.", variant: "warning" });
      }
    } else {
      toast({ title: "Copied", description: "Invitation link copied to clipboard.", variant: "success" });
    }
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
      
      // Update status to 'emailed' if not already used
      if (!invitationToSend.is_used) {
        try {
          await Invitation.update(invitationToSend.id, { status: 'emailed' });
        } catch (updateError) {
          console.error("Error updating invitation status:", updateError);
        }
      }
      
      toast({ title: "Email Sent", description: `Invitation sent to ${sendToEmail}.`, variant: "success" });
      setShowSendDialog(false);
      setInvitationToSend(null);
      setSendToEmail('');
      loadData(); // Refresh the data to show updated status
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
                <CardTitle>Generate Single VIP Invitation</CardTitle>
                <CardDescription>Create one VIP invitation link.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-end gap-4">
                <div className="flex-grow">
                  <Label>Attendee Type</Label>
                  <div className="mt-2 p-2 border border-gray-300 rounded-md bg-gray-50 text-sm text-gray-700">VIP</div>
                </div>
                <Button onClick={() => handleGenerate(1)}><PlusCircle className="w-4 h-4 mr-2" />Generate</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Generate Bulk VIP Invitations</CardTitle>
                <CardDescription>Create multiple VIP invitations.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-end gap-4">
                <div className="flex-grow">
                  <Label>Attendee Type</Label>
                  <div className="mt-2 p-2 border border-gray-300 rounded-md bg-gray-50 text-sm text-gray-700">VIP</div>
                </div>
                <div className="w-24">
                  <Label htmlFor="bulk-count">Quantity</Label>
                  <Input id="bulk-count" type="number" min="1" value={bulkCount} onChange={e => setBulkCount(Number(e.target.value))} />
                </div>
                <Button onClick={() => handleGenerate(bulkCount)}><Users className="w-4 h-4 mr-2" />Generate</Button>
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
                          ) : inv.status === 'copied' ? (
                            <Badge className="bg-blue-100 text-blue-800"><Copy className="w-3 h-3 mr-1" />Copied</Badge>
                          ) : inv.status === 'emailed' ? (
                            <Badge className="bg-purple-100 text-purple-800"><Mail className="w-3 h-3 mr-1" />Emailed</Badge>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Attendee Details</DialogTitle>
          </DialogHeader>

          {selectedAttendee && (
            <div>
              <div className="space-y-6 p-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                  {/* Personal Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <UserIcon className="w-5 h-5" />
                        Personal Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-4 mb-4">
                        <Avatar className="w-24 h-24 cursor-pointer" onClick={() => handleImageClick(selectedAttendee.face_photo_url)}>
                          <AvatarImage src={selectedAttendee.face_photo_url} />
                          <AvatarFallback className="bg-blue-100 text-blue-600 text-2xl font-semibold">
                            {selectedAttendee.first_name?.[0]}{selectedAttendee.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="text-2xl font-bold">
                            {selectedAttendee.title} {selectedAttendee.first_name} {selectedAttendee.last_name}
                          </h3>
                          <div className="flex gap-2 mt-2">
                            <Badge className={statusColors[selectedAttendee.status]}>
                              {selectedAttendee.status}
                            </Badge>
                            <Badge className={typeColors[selectedAttendee.attendee_type] || "bg-gray-100 text-gray-800"}>
                              {selectedAttendee.attendee_type}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">Email:</span>
                          <span className="font-medium">{selectedAttendee.email}</span>
                        </div>

                        {selectedAttendee.mobile_number && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">Mobile:</span>
                            <span className="font-medium">{selectedAttendee.country_code} {selectedAttendee.mobile_number}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">Nationality:</span>
                          <span className="font-medium">{selectedAttendee.nationality}</span>
                        </div>

                        {selectedAttendee.country_of_residence && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">Residence:</span>
                            <span className="font-medium">{selectedAttendee.country_of_residence}</span>
                          </div>
                        )}

                        {selectedAttendee.date_of_birth && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">Date of Birth:</span>
                            <span className="font-medium">{format(new Date(selectedAttendee.date_of_birth), 'PPP')}</span>
                          </div>
                        )}

                        {selectedAttendee.religion && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Religion:</span>
                            <span className="font-medium">{selectedAttendee.religion}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Professional Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building className="w-5 h-5" />
                        Professional Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedAttendee.organization && (
                        <div>
                          <span className="text-sm text-gray-600">Organization:</span>
                          <p className="font-medium">{selectedAttendee.organization}</p>
                        </div>
                      )}

                      {selectedAttendee.job_title && (
                        <div>
                          <span className="text-sm text-gray-600">Job Title:</span>
                          <p className="font-medium">{selectedAttendee.job_title}</p>
                        </div>
                      )}

                      {selectedAttendee.level && (
                        <div>
                          <span className="text-sm text-gray-600">Level:</span>
                          <p className="font-medium">{selectedAttendee.level}</p>
                        </div>
                      )}

                      {selectedAttendee.linkedin_account && (
                        <div>
                          <span className="text-sm text-gray-600">LinkedIn:</span>
                          <a href={selectedAttendee.linkedin_account} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                            {selectedAttendee.linkedin_account}
                          </a>
                        </div>
                      )}

                      {selectedAttendee.work_address && (
                        <div>
                          <span className="text-sm text-gray-600">Work Address:</span>
                          <p className="font-medium">{selectedAttendee.work_address}</p>
                          {selectedAttendee.work_city && (
                            <p className="text-sm text-gray-500">{selectedAttendee.work_city}, {selectedAttendee.work_country}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* ID Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileBadge className="w-5 h-5" />
                        ID Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedAttendee.id_type && (
                        <div>
                          <span className="text-sm text-gray-600">ID Type:</span>
                          <p className="font-medium">{selectedAttendee.id_type}</p>
                        </div>
                      )}

                      {selectedAttendee.id_number && (
                        <div>
                          <span className="text-sm text-gray-600">{selectedAttendee.id_type} Number:</span>
                          <p className="font-medium">{selectedAttendee.id_number}</p>
                        </div>
                      )}

                      {selectedAttendee.issue_date && (
                        <div>
                          <span className="text-sm text-gray-600">Issue Date:</span>
                          <p className="font-medium">{format(new Date(selectedAttendee.issue_date), 'PPP')}</p>
                        </div>
                      )}

                      {selectedAttendee.id_type === 'Passport' && (
                        <>
                          {selectedAttendee.expiry_date && (
                            <div>
                              <span className="text-sm text-gray-600">Expiry Date:</span>
                              <p className="font-medium">{format(new Date(selectedAttendee.expiry_date), 'PPP')}</p>
                            </div>
                          )}
                          {selectedAttendee.issue_place && (
                            <div>
                              <span className="text-sm text-gray-600">Issue Place:</span>
                              <p className="font-medium">{selectedAttendee.issue_place}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-sm text-gray-600">Needs Visa:</span>
                            <Badge variant="outline" className="ml-2">{selectedAttendee.need_visa ? 'Yes' : 'No'}</Badge>
                          </div>
                        </>
                      )}
                      
                      {selectedAttendee.id_photo_url && (
                        <div>
                          <span className="text-sm text-gray-600">ID Document:</span>
                          {isPdfFile(selectedAttendee.id_photo_url) ? (
                            <div className="mt-2 p-4 border rounded-lg bg-red-50">
                              <div className="flex items-center gap-3">
                                <FileText className="w-8 h-8 text-red-600" />
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">PDF Document</p>
                                  <p className="text-sm text-gray-600">ID document uploaded as PDF</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(selectedAttendee.id_photo_url, '_blank')}
                                  className="flex items-center gap-2"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  Review PDF
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <img 
                              src={selectedAttendee.id_photo_url} 
                              alt="ID" 
                              className="w-full h-auto object-cover rounded border mt-2 cursor-pointer" 
                              onClick={() => handleImageClick(selectedAttendee.id_photo_url)} 
                            />
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Survey and Business Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileQuestion className="w-5 h-5" />
                        Survey & Business Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedAttendee.primary_nature_of_business && (
                        <div>
                          <span className="text-sm text-gray-600">Primary Nature of Business:</span>
                          <p className="font-medium">{selectedAttendee.primary_nature_of_business}</p>
                        </div>
                      )}

                      {selectedAttendee.areas_of_interest?.length > 0 && (
                        <div>
                          <span className="text-sm text-gray-600">Areas of Interest:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {selectedAttendee.areas_of_interest.map(interest => (
                              <Badge key={interest} variant="secondary">{interest}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <span className="text-sm text-gray-600">Previous Attendance:</span>
                        <Badge variant="outline" className="ml-2">
                          {selectedAttendee.previous_attendance ? `Yes (${selectedAttendee.previous_years?.join(', ') || ''})` : 'No'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Registration Information & QR Code */}
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Registration Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <span className="text-sm text-gray-600">Registration Method:</span>
                          <Badge variant="outline" className="ml-2">
                            {selectedAttendee.registration_method || 'Manual'}
                          </Badge>
                        </div>

                        <div>
                          <span className="text-sm text-gray-600">Registered By:</span>
                          <p className="font-medium">{getRegistererName(selectedAttendee)}</p>
                        </div>

                        <div>
                          <span className="text-sm text-gray-600">Registration Date:</span>
                          <p className="font-medium">{format(new Date(selectedAttendee.created_at), 'PPP p')}</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {selectedAttendee.status === 'approved' && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Badge QR Code</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center justify-center space-y-4">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?data=${selectedAttendee.id.slice(-8).toUpperCase()}&size=150x150&qzone=1`}
                            alt="Attendee QR Code"
                            className="w-40 h-40 border p-1 rounded-lg bg-white"
                          />
                          <div className="text-center">
                            <p className="text-sm text-gray-500">Reference #:</p>
                            <p className="font-mono text-xl font-semibold tracking-widest text-gray-800">
                              {selectedAttendee.id.slice(-8).toUpperCase()}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
            </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowAttendeeDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-0 shadow-none">
          <img src={enlargedImageUrl} alt="Enlarged attendee" className="w-full h-auto rounded-lg" />
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}