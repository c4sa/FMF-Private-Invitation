import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Attendee, User, PartnershipType } from '@/api/entities';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Users, UserCheck, Clock, XCircle, Download, Printer, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/common/Toast';
import StatsCard from '../components/dashboard/StatsCard';

export default function AnalyticsDashboard() {
  const [attendees, setAttendees] = useState([]);
  const [users, setUsers] = useState([]);
  const [partnerTypes, setPartnerTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
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
      let usersData = [];
      
      if (canSeeAllAttendees) {
        // Admin/Super User: Get all data
        [attendeesData, usersData] = await Promise.all([
          Attendee.list('-created_at'),
          User.list('-created_at')
        ]);
      } else {
        // Regular User: Only get their own attendees and no user data
        attendeesData = await Attendee.getByRegisteredBy(currentUser.id);
        usersData = [];
      }
      
      const partnerTypesData = await PartnershipType.list();
      
      setAttendees(attendeesData);
      setUsers(usersData);
      setPartnerTypes(partnerTypesData);
    } catch (error) {
      console.error("Error loading analytics data:", error);
      toast({ title: "Error", description: "Failed to load analytics data.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const exportToExcel = () => {
    const csvData = [
      ['FUTURE MINERALS FORUM - ANALYTICS REPORT'],
      ['Generated on:', format(new Date(), 'yyyy-MM-dd HH:mm:ss')],
      [],
      ['ATTENDEE DETAILS'],
      ['Name', 'Email', 'Organization', 'Type', 'Status', 'Registration Date'],
      ...attendees.map(a => [
        `${a.first_name} ${a.last_name}`,
        a.email,
        a.organization || '',
        a.attendee_type,
        a.status,
        format(new Date(a.created_at), 'yyyy-MM-dd')
      ])
    ];

    const csvString = csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FMF-Analytics-Report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Export Complete", description: "Analytics report exported to Excel format.", variant: "success" });
  };

  if (isLoading) {
    return (
      <ProtectedRoute adminOnly pageName="AnalyticsDashboard">
        <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </ProtectedRoute>
    );
  }

  // Calculate metrics
  const totalAttendees = attendees.length;
  const approvedAttendees = attendees.filter(a => a.status === 'approved').length;
  const pendingAttendees = attendees.filter(a => a.status === 'pending').length;
  const declinedAttendees = attendees.filter(a => a.status === 'declined').length;

  const statusChartData = [
    { name: 'Approved', value: approvedAttendees, color: '#10b981' },
    { name: 'Pending', value: pendingAttendees, color: '#f59e0b' },
    { name: 'Declined', value: declinedAttendees, color: '#ef4444' }
  ].filter(item => item.value > 0);

  const typeChartData = [
    { name: 'VIP', value: attendees.filter(a => a.attendee_type === 'VIP').length },
    { name: 'Partner', value: attendees.filter(a => a.attendee_type === 'Partner').length },
    { name: 'Exhibitor', value: attendees.filter(a => a.attendee_type === 'Exhibitor').length },
    { name: 'Media', value: attendees.filter(a => a.attendee_type === 'Media').length }
  ];

  const partnerBreakdown = partnerTypes.map(pt => ({
    name: pt.name,
    activeUsers: users.filter(u => u.user_type === pt.name).length
  }));

  return (
    <ProtectedRoute adminOnly pageName="AnalyticsDashboard">
      <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="text-gray-500 mt-1">Registration insights and partner analytics</p>
            </div>
            <div className="flex gap-3">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />Print</Button>
              <Button onClick={exportToExcel}><FileSpreadsheet className="w-4 h-4 mr-2" />Export Excel</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard title="Total Attendees" value={totalAttendees} icon={Users} color="blue" subtitle="All-time" />
            <StatsCard title="Approved" value={approvedAttendees} icon={UserCheck} color="green" subtitle={`${totalAttendees > 0 ? ((approvedAttendees / totalAttendees) * 100).toFixed(0) : 0}% approval rate`} />
            <StatsCard title="Pending" value={pendingAttendees} icon={Clock} color="orange" subtitle="Awaiting approval" />
            <StatsCard title="Declined" value={declinedAttendees} icon={XCircle} color="red" subtitle="Rejected" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
            <div className="lg:col-span-3">
              <Card>
                <CardHeader><CardTitle>Registration Status</CardTitle></CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {statusChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card>
                <CardHeader><CardTitle>Attendee Types</CardTitle></CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={typeChartData} layout="vertical" margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
          
          <Card className="mt-6">
            <CardHeader><CardTitle>Partner Engagement</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-semibold text-gray-600">Partnership Type</th>
                      <th className="text-center p-3 font-semibold text-gray-600">Active Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partnerBreakdown.map((partner, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-3 font-medium">{partner.name}</td>
                        <td className="text-center p-3 font-semibold text-lg">{partner.activeUsers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}