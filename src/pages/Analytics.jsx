
import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Attendee, User, PartnershipType } from '@/api/entities';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  Users,
  UserCheck,
  Clock,
  XCircle,
  TrendingUp,
  Download,
  Printer,
  Calendar,
  Building,
  Globe,
  Award
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useToast } from '@/components/common/Toast';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

const statusColors = {
  pending: '#f59e0b',
  approved: '#10b981',
  declined: '#ef4444',
  change_requested: '#8b5cf6'
};

const typeColors = {
  VIP: '#8b5cf6',
  Partner: '#ec4899',
  Exhibitor: '#06b6d4',
  Media: '#f59e0b'
};

export default function AnalyticsPage() {
  const [attendees, setAttendees] = useState([]);
  const [users, setUsers] = useState([]);
  const [partnerTypes, setPartnerTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30'); // days
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    declined: 0,
    change_requested: 0,
    thisMonth: 0,
    lastMonth: 0,
    growth: 0
  });
  const [chartData, setChartData] = useState({
    statusChart: [],
    typeChart: [],
    dailyRegistrations: [],
    partnerBreakdown: [],
    nationalityChart: [],
    organizationChart: []
  });
  const { toast } = useToast();

  const prepareChartData = useCallback((attendeesData, usersData, partnerTypesData) => {
    // Status breakdown
    const statusChart = [
      { name: 'Approved', value: attendeesData.filter(a => a.status === 'approved').length, color: statusColors.approved },
      { name: 'Pending', value: attendeesData.filter(a => a.status === 'pending').length, color: statusColors.pending },
      { name: 'Declined', value: attendeesData.filter(a => a.status === 'declined').length, color: statusColors.declined },
      { name: 'Change Requested', value: attendeesData.filter(a => a.status === 'change_requested').length, color: statusColors.change_requested }
    ].filter(item => item.value > 0);

    // Attendee type breakdown
    const typeChart = [
      { name: 'VIP', value: attendeesData.filter(a => a.attendee_type === 'VIP').length, color: typeColors.VIP },
      { name: 'Partner', value: attendeesData.filter(a => a.attendee_type === 'Partner').length, color: typeColors.Partner },
      { name: 'Exhibitor', value: attendeesData.filter(a => a.attendee_type === 'Exhibitor').length, color: typeColors.Exhibitor },
      { name: 'Media', value: attendeesData.filter(a => a.attendee_type === 'Media').length, color: typeColors.Media }
    ];

    // Daily registrations for the selected period
    const days = parseInt(dateRange);
    const dailyRegistrations = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'MMM dd');
      const count = attendeesData.filter(a => 
        format(new Date(a.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      ).length;
      dailyRegistrations.push({ date: dateStr, registrations: count });
    }

    // Partner type breakdown from system users
    const partnerBreakdown = partnerTypesData.map(pt => {
      const count = usersData.filter(u => u.user_type === pt.name).length;
      return {
        name: pt.name,
        users: count,
        totalSlots: (pt.slots_vip || 0) + (pt.slots_partner || 0) + (pt.slots_exhibitor || 0) + (pt.slots_media || 0),
        vipSlots: pt.slots_vip || 0,
        partnerSlots: pt.slots_partner || 0,
        exhibitorSlots: pt.slots_exhibitor || 0,
        mediaSlots: pt.slots_media || 0
      };
    });

    // Top nationalities
    const nationalityCount = {};
    attendeesData.forEach(a => {
      if (a.nationality) {
        nationalityCount[a.nationality] = (nationalityCount[a.nationality] || 0) + 1;
      }
    });
    const nationalityChart = Object.entries(nationalityCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Top organizations
    const orgCount = {};
    attendeesData.forEach(a => {
      if (a.organization) {
        orgCount[a.organization] = (orgCount[a.organization] || 0) + 1;
      }
    });
    const organizationChart = Object.entries(orgCount)
      .map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 20) + '...' : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    setChartData({
      statusChart,
      typeChart,
      dailyRegistrations,
      partnerBreakdown,
      nationalityChart,
      organizationChart
    });
  }, [dateRange]);

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

      // Calculate basic stats
      const total = attendeesData.length;
      const approved = attendeesData.filter(a => a.status === 'approved').length;
      const pending = attendeesData.filter(a => a.status === 'pending').length;
      const declined = attendeesData.filter(a => a.status === 'declined').length;
      const change_requested = attendeesData.filter(a => a.status === 'change_requested').length;

      // Calculate monthly growth
      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subDays(now, 30));
      const lastMonthEnd = endOfMonth(subDays(now, 30));

      const thisMonth = attendeesData.filter(a => 
        isWithinInterval(new Date(a.created_at), { start: thisMonthStart, end: thisMonthEnd })
      ).length;

      const lastMonth = attendeesData.filter(a => 
        isWithinInterval(new Date(a.created_at), { start: lastMonthStart, end: lastMonthEnd })
      ).length;

      const growth = lastMonth === 0 ? (thisMonth > 0 ? 100 : 0) : ((thisMonth - lastMonth) / lastMonth) * 100;

      setStats({
        total,
        approved,
        pending,
        declined,
        change_requested,
        thisMonth,
        lastMonth,
        growth: Math.round(growth)
      });

      // Prepare chart data
      prepareChartData(attendeesData, usersData, partnerTypesData);

    } catch (error) {
      console.error("Error loading analytics data:", error);
      toast({ title: "Error", description: "Failed to load analytics data.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast, prepareChartData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (attendees.length > 0) {
      prepareChartData(attendees, users, partnerTypes);
    }
  }, [dateRange, attendees, users, partnerTypes, prepareChartData]);

  const handleExport = () => {
    const exportData = {
      summary: stats,
      attendees: attendees.map(a => ({
        id: a.id.slice(-8).toUpperCase(),
        name: `${a.first_name} ${a.last_name}`,
        email: a.email,
        organization: a.organization,
        type: a.attendee_type,
        status: a.status,
        nationality: a.nationality,
        registration_date: format(new Date(a.created_at), 'yyyy-MM-dd'),
        registration_method: a.registration_method || 'manual'
      })),
      partner_breakdown: chartData.partnerBreakdown,
      generated_at: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-report-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: "Export Complete", description: "Analytics data exported successfully.", variant: "success" });
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <ProtectedRoute adminOnly>
        <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute adminOnly>
      <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
          
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            body * { 
              visibility: hidden; 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
            }
            .print-container, .print-container * { 
              visibility: visible; 
            }
            .print-container { 
              position: absolute; 
              left: 0; 
              top: 0; 
              width: 100%; 
              background: white;
            }
            .no-print { 
              display: none !important; 
            }
            .page-break { 
              page-break-before: always;
              margin-top: 0;
            }

            /* Enhanced Header Design */
            .print-header { 
              background: linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%);
              color: white;
              padding: 40px 50px;
              margin: -30px -30px 40px -30px;
              border-radius: 0;
              position: relative;
              overflow: hidden;
            }
            .print-header::before {
              content: '';
              position: absolute;
              top: 0;
              right: 0;
              width: 200px;
              height: 200px;
              background: rgba(255,255,255,0.1);
              border-radius: 50%;
              transform: translate(50px, -50px);
            }
            .print-header::after {
              content: '';
              position: absolute;
              bottom: 0;
              left: 0;
              width: 150px;
              height: 150px;
              background: rgba(255,255,255,0.05);
              border-radius: 50%;
              transform: translate(-50px, 50px);
            }
            .header-content {
              position: relative;
              z-index: 2;
              display: flex;
              align-items: center;
              justify-content: space-between;
            }
            .logo-section {
              display: flex;
              align-items: center;
              gap: 30px;
            }
            .logo-section img {
              height: 80px;
              width: auto;
              filter: brightness(0) invert(1);
            }
            .header-text h1 {
              font-size: 42px;
              font-weight: 800;
              margin: 0 0 8px 0;
              letter-spacing: -0.02em;
            }
            .header-text p {
              font-size: 18px;
              opacity: 0.9;
              margin: 0 0 5px 0;
              font-weight: 500;
            }
            .header-text .date {
              font-size: 14px;
              opacity: 0.8;
              margin: 0;
              font-weight: 400;
            }
            .header-stats {
              text-align: right;
              background: rgba(255,255,255,0.15);
              padding: 20px 25px;
              border-radius: 15px;
              backdrop-filter: blur(10px);
            }
            .header-stats .big-stat {
              font-size: 48px;
              font-weight: 800;
              margin: 0;
              line-height: 1;
            }
            .header-stats .stat-label {
              font-size: 14px;
              opacity: 0.9;
              margin: 5px 0 0 0;
              font-weight: 500;
            }

            /* Enhanced Metric Cards */
            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 30px;
              margin: 40px 0;
            }
            .metric-card {
              background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
              border: 2px solid #e2e8f0;
              border-radius: 20px;
              padding: 35px 30px;
              text-align: center;
              box-shadow: 0 10px 25px rgba(0,0,0,0.08);
              position: relative;
              overflow: hidden;
            }
            .metric-card::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 6px;
              background: var(--card-accent);
              border-radius: 20px 20px 0 0;
            }
            .metric-card.blue { --card-accent: #3b82f6; }
            .metric-card.green { --card-accent: #10b981; }
            .metric-card.purple { --card-accent: #8b5cf6; }
            .metric-card.orange { --card-accent: #f59e0b; }
            
            .metric-icon {
              width: 60px;
              height: 60px;
              margin: 0 auto 20px;
              border-radius: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: var(--card-accent);
              color: white;
            }
            .metric-value {
              font-size: 54px;
              font-weight: 800;
              color: #1f2937;
              margin: 0 0 8px 0;
              line-height: 1;
              letter-spacing: -0.02em;
            }
            .metric-label {
              font-size: 16px;
              font-weight: 600;
              color: #4b5563;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 0 0 10px 0;
            }
            .metric-subtitle {
              font-size: 14px;
              color: #6b7280;
              margin: 0;
              font-weight: 500;
            }

            /* Enhanced Chart Containers */
            .charts-row {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin: 50px 0;
            }
            .chart-container {
              background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
              border: 2px solid #e2e8f0;
              border-radius: 25px;
              padding: 40px 35px;
              box-shadow: 0 15px 35px rgba(0,0,0,0.08);
              position: relative;
            }
            .chart-container.full-width {
              grid-column: 1 / -1;
              margin: 30px 0;
            }
            .chart-title {
              font-size: 24px;
              font-weight: 700;
              color: #1f2937;
              margin: 0 0 30px 0;
              padding-bottom: 15px;
              border-bottom: 3px solid #e5e7eb;
              position: relative;
            }
            .chart-title::before {
              content: '';
              position: absolute;
              bottom: -3px;
              left: 0;
              width: 60px;
              height: 3px;
              background: #dc2626;
              border-radius: 2px;
            }

            /* Partnership Analysis Table */
            .partnership-table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              border-radius: 15px;
              overflow: hidden;
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }
            .partnership-table thead tr {
              background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
              color: white;
            }
            .partnership-table th {
              padding: 20px 15px;
              font-weight: 700;
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border: none;
            }
            .partnership-table tbody tr {
              background: white;
              transition: background-color 0.2s;
            }
            .partnership-table tbody tr:nth-child(even) {
              background: #f8fafc;
            }
            .partnership-table td {
              padding: 18px 15px;
              border: none;
              font-weight: 500;
            }
            .partner-name {
              display: flex;
              align-items: center;
              gap: 15px;
            }
            .partner-dot {
              width: 12px;
              height: 12px;
              border-radius: 50%;
              flex-shrink: 0;
            }
            .partner-name-text {
              font-weight: 700;
              color: #1f2937;
              font-size: 16px;
            }
            .slot-badge {
              background: #f3f4f6;
              color: #1f2937;
              padding: 8px 16px;
              border-radius: 25px;
              font-weight: 700;
              font-size: 14px;
              display: inline-block;
              min-width: 40px;
              text-align: center;
            }
            .total-badge {
              background: #374151;
              color: white;
              padding: 10px 20px;
              border-radius: 25px;
              font-weight: 700;
              font-size: 16px;
            }

            /* Demographics Section */
            .demographics-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin: 40px 0;
            }

            /* Enhanced Footer */
            .report-footer {
              margin-top: 60px;
              padding: 40px 50px;
              background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
              border-radius: 25px;
              border: 2px solid #e2e8f0;
              position: relative;
              box-shadow: 0 10px 25px rgba(0,0,0,0.08);
            }
            .report-footer::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 6px;
              background: linear-gradient(90deg, #dc2626, #3b82f6, #10b981);
              border-radius: 25px 25px 0 0;
            }
            .footer-content {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .footer-left h3 {
              font-size: 18px;
              font-weight: 700;
              color: #1f2937;
              margin: 0 0 5px 0;
            }
            .footer-left p {
              font-size: 14px;
              color: #6b7280;
              margin: 0;
              font-weight: 500;
            }
            .footer-right {
              text-align: right;
            }
            .footer-right p {
              font-size: 14px;
              color: #6b7280;
              margin: 2px 0;
              font-weight: 500;
            }
            .page-number {
              font-weight: 700;
              color: #dc2626;
            }

            /* Page Setup */
            @page {
              margin: 30mm 20mm 20mm 20mm;
              size: A4 portrait;
            }
            
            /* Ensure proper page breaks */
            .page-1 {
              min-height: calc(100vh - 100px); /* Adjust as needed for content */
            }
            .page-2 {
              min-height: calc(100vh - 100px); /* Adjust as needed for content */
            }
          }
        `}</style>
        
        <div className="max-w-7xl mx-auto print-container">
          {/* Screen Header - No Print */}
          <div className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68c956d6c6a36ced0b9be9eb/cbe09abb4_FMF_logo-02-01.png"
                alt="Future Minerals Forum Logo"
                className="h-16 w-auto"
              />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
                <p className="text-gray-500 mt-1">Registration insights and reporting</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print Report
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>

          {/* PRINT ONLY - Enhanced Header */}
          <div className="print-header" style={{ display: 'none' }}>
            <div className="header-content">
              <div className="logo-section">
                <img
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68c956d6c6a36ced0b9be9eb/cbe09abb4_FMF_logo-02-01.png"
                  alt="Future Minerals Forum Logo"
                />
                <div className="header-text">
                  <h1>Future Minerals Forum</h1>
                  <p>Registration Analytics Report</p>
                  <p className="date">Generated on {format(new Date(), 'MMMM do, yyyy')}</p>
                </div>
              </div>
              <div className="header-stats">
                <div className="big-stat">{stats.total}</div>
                <div className="stat-label">Total Registrations</div>
              </div>
            </div>
          </div>

          {/* PAGE 1: Executive Dashboard */}
          <div className="page-1">
            {/* Key Metrics Cards */}
            <div className="metrics-grid">
              <div className="metric-card blue">
                <div className="metric-icon">
                  <Users className="w-8 h-8" />
                </div>
                <div className="metric-value">{stats.total}</div>
                <div className="metric-label">Total Attendees</div>
                <div className="metric-subtitle">All-time registrations</div>
              </div>

              <div className="metric-card green">
                <div className="metric-icon">
                  <UserCheck className="w-8 h-8" />
                </div>
                <div className="metric-value">{stats.approved}</div>
                <div className="metric-label">Approved</div>
                <div className="metric-subtitle">{stats.total > 0 ? ((stats.approved / stats.total) * 100).toFixed(1) : 0}% approval rate</div>
              </div>

              <div className="metric-card purple">
                <div className="metric-icon">
                  <Calendar className="w-8 h-8" />
                </div>
                <div className="metric-value">{stats.thisMonth}</div>
                <div className="metric-label">This Month</div>
                <div className="metric-subtitle">
                  <span style={{ color: stats.growth >= 0 ? '#10b981' : '#ef4444' }}>
                    {stats.growth >= 0 ? '↗' : '↘'} {Math.abs(stats.growth)}% vs last month
                  </span>
                </div>
              </div>

              <div className="metric-card orange">
                <div className="metric-icon">
                  <Clock className="w-8 h-8" />
                </div>
                <div className="metric-value">{stats.pending}</div>
                <div className="metric-label">Pending</div>
                <div className="metric-subtitle">Awaiting approval</div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="charts-row">
              <div className="chart-container">
                <h3 className="chart-title">Registration Status</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.statusChart}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}\n${(percent * 100).toFixed(0)}%`}
                        outerRadius={110}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.statusChart.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chart-container">
                <h3 className="chart-title">Attendee Categories</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.typeChart} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {chartData.typeChart.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Registration Trends */}
            <div className="chart-container full-width">
              <h3 className="chart-title">Registration Trends - Last {dateRange} Days</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.dailyRegistrations} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="registrations" 
                      stroke="#dc2626" 
                      strokeWidth={4}
                      dot={{ fill: '#dc2626', strokeWidth: 2, r: 6 }}
                      activeDot={{ r: 8, fill: '#dc2626' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* PAGE 2: Detailed Analysis */}
          <div className="page-break page-2">
            {/* Partnership Analysis */}
            <div className="chart-container full-width">
              <h3 className="chart-title">Partnership Analysis</h3>
              <table className="partnership-table">
                <thead>
                  <tr>
                    <th>Partnership Type</th>
                    <th style={{textAlign: 'center'}}>Active Users</th>
                    <th style={{textAlign: 'center'}}>VIP Slots</th>
                    <th style={{textAlign: 'center'}}>Partner Slots</th>
                    <th style={{textAlign: 'center'}}>Exhibitor Slots</th>
                    <th style={{textAlign: 'center'}}>Media Slots</th>
                    <th style={{textAlign: 'center'}}>Total Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.partnerBreakdown.map((partner, index) => (
                    <tr key={index}>
                      <td>
                        <div className="partner-name">
                          <div 
                            className="partner-dot" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          ></div>
                          <span className="partner-name-text">{partner.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="slot-badge" style={{ background: '#dbeafe', color: '#1e40af' }}>
                          {partner.users}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="slot-badge" style={{ background: '#f3e8ff', color: '#7c3aed' }}>
                          {partner.vipSlots}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="slot-badge" style={{ background: '#fce7f3', color: '#be185d' }}>
                          {partner.partnerSlots}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="slot-badge" style={{ background: '#cffafe', color: '#0891b2' }}>
                          {partner.exhibitorSlots}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="slot-badge" style={{ background: '#fef3c7', color: '#d97706' }}>
                          {partner.mediaSlots}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="total-badge">
                          {partner.totalSlots}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Demographics */}
            <div className="demographics-grid">
              <div className="chart-container">
                <h3 className="chart-title">Top 10 Nationalities</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.nationalityChart} layout="vertical" margin={{ top: 20, right: 30, left: 60, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={50} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#10b981" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chart-container">
                <h3 className="chart-title">Top Organizations</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.organizationChart} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#f59e0b" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Enhanced Report Footer */}
            <div className="report-footer">
              <div className="footer-content">
                <div className="footer-left">
                  <h3>Future Minerals Forum Registration System</h3>
                  <p>Confidential Analytics Report • Executive Summary</p>
                </div>
                <div className="footer-right">
                  <p>Generated: {format(new Date(), 'MMMM do, yyyy • h:mm a')}</p>
                  <p className="page-number">Page 2 of 2</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
