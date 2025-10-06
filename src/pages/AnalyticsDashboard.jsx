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
  const [filteredAttendees, setFilteredAttendees] = useState([]);
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
      setFilteredAttendees(attendeesData);
    } catch (error) {
      console.error("Error loading analytics data:", error);
      toast({ title: "Error", description: "Failed to load analytics data.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter attendees based on date range
  const filterAttendeesByDateRange = useCallback((attendeesData, range) => {
    if (!attendeesData || attendeesData.length === 0) return [];
    
    const now = new Date();
    let startDate;
    
    switch (range) {
      case '1':
        startDate = new Date(now.getTime() - (1 * 60 * 60 * 1000)); // 1 hour ago
        break;
      case '24':
        startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24 hours ago
        break;
      case '7':
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago
        break;
      case '30':
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago
        break;
      case '90':
        startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)); // 90 days ago
        break;
      case '365':
        startDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000)); // 1 year ago
        break;
      case 'all':
        return attendeesData; // Return all data
      default:
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // Default to 30 days
    }
    
    return attendeesData.filter(attendee => {
      const attendeeDate = new Date(attendee.created_at);
      return attendeeDate >= startDate;
    });
  }, []);

  // Update filtered attendees when date range changes
  useEffect(() => {
    const filtered = filterAttendeesByDateRange(attendees, dateRange);
    setFilteredAttendees(filtered);
  }, [attendees, dateRange, filterAttendeesByDateRange]);

  // Helper function to get date range label
  const getDateRangeLabel = (range) => {
    switch (range) {
      case '1': return 'Last Hour';
      case '24': return 'Last 24 Hours';
      case '7': return 'Last 7 Days';
      case '30': return 'Last 30 Days';
      case '90': return 'Last 90 Days';
      case '365': return 'Last Year';
      case 'all': return 'All Time';
      default: return 'Last 30 Days';
    }
  };

  const exportToExcel = () => {
    const csvData = [
      ['FUTURE MINERALS FORUM - ANALYTICS REPORT'],
      ['Generated on:', format(new Date(), 'yyyy-MM-dd HH:mm:ss')],
      ['Filter Period:', getDateRangeLabel(dateRange)],
      [],
      ['ATTENDEE DETAILS'],
      ['Name', 'Email', 'Organization', 'Type', 'Status', 'Registration Date'],
      ...filteredAttendees.map(a => [
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

  // Calculate metrics based on filtered attendees
  const totalAttendees = filteredAttendees.length;
  const approvedAttendees = filteredAttendees.filter(a => a.status === 'approved').length;
  const pendingAttendees = filteredAttendees.filter(a => a.status === 'pending').length;
  const declinedAttendees = filteredAttendees.filter(a => a.status === 'declined').length;

  const statusChartData = [
    { name: 'Approved', value: approvedAttendees, color: '#10b981' },
    { name: 'Pending', value: pendingAttendees, color: '#f59e0b' },
    { name: 'Declined', value: declinedAttendees, color: '#ef4444' }
  ].filter(item => item.value > 0);

  const typeChartData = [
    { name: 'VIP', value: filteredAttendees.filter(a => a.attendee_type === 'VIP').length },
    { name: 'Partner', value: filteredAttendees.filter(a => a.attendee_type === 'Partner').length },
    { name: 'Exhibitor', value: filteredAttendees.filter(a => a.attendee_type === 'Exhibitor').length },
    { name: 'Media', value: filteredAttendees.filter(a => a.attendee_type === 'Media').length }
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
              <div className="mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Showing data for: {getDateRangeLabel(dateRange)}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last Hour</SelectItem>
                  <SelectItem value="24">Last 24 Hours</SelectItem>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                  <SelectItem value="365">Last Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
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