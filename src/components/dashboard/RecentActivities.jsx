import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { 
  UserPlus, 
  UserCheck, 
  UserX, 
  Mail, 
  Settings, 
  Ticket,
  FileText,
  Users,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle
} from "lucide-react";
import { Notification, User } from '@/api/entities';

// Map notification types to icons and colors
const notificationTypeConfig = {
  info: {
    icon: Info,
    color: "bg-blue-100 text-blue-800"
  },
  success: {
    icon: CheckCircle,
    color: "bg-green-100 text-green-800"
  },
  warning: {
    icon: AlertTriangle,
    color: "bg-yellow-100 text-yellow-800"
  },
  error: {
    icon: AlertCircle,
    color: "bg-red-100 text-red-800"
  }
};

// Map notification titles to specific icons for better visual representation
const titleIconMap = {
  'New Attendee Registration': UserPlus,
  'Attendee Status Updated': UserCheck,
  'Attendee Information Updated': UserX,
  'New User Account Created': Users,
  'User Account Updated': Users,
  'User Role Changed': Settings,
  'Invitations Generated': Ticket,
  'Invitation Used': Ticket,
  'Invitation Email Sent': Mail,
  'Slot Request Submitted': FileText,
  'Slot Request Status Updated': FileText,
  'System Setting Updated': Settings,
  'Email Sent': Mail,
  'Admin User Login': Users,
  'New User Registration': UserPlus,
  'System Error Occurred': AlertCircle
};

export default function RecentActivities() {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      
      // Get current user to check permissions
      const currentUser = await User.me();
      
      let recentNotifications = [];
      
      // Check if user is admin or super user - they can see all activities
      const canSeeAllActivities = currentUser?.role === 'admin' || 
                                  currentUser?.system_role === 'Admin' || 
                                  currentUser?.system_role === 'Super User';
      
      if (canSeeAllActivities) {
        // Admin/Super User: Get all notifications (admin view)
        recentNotifications = await Notification.list('-created_at');
      } else {
        // Regular User: Only get their own notifications
        recentNotifications = await Notification.getByUserId(currentUser.id);
      }
      
      // Take only the most recent 10 notifications
      setNotifications(recentNotifications.slice(0, 10));
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getIconAndColor = (notification) => {
    // First check if there's a specific icon for this title
    const titleIcon = titleIconMap[notification.title];
    if (titleIcon) {
      return {
        icon: titleIcon,
        color: notificationTypeConfig[notification.type]?.color || notificationTypeConfig.info.color
      };
    }

    // Fallback to type-based icon and color
    const config = notificationTypeConfig[notification.type] || notificationTypeConfig.info;
    return {
      icon: config.icon,
      color: config.color
    };
  };

  const extractUserFromMessage = (message) => {
    // Try to extract user information from the notification message
    // This is a simple approach - in a real system, you might store this separately
    const patterns = [
      /by (.+?)(?:\s|$)/,  // "by John Doe"
      /^(.+?)\s(?:registered|requested|updated|created)/,  // "John Doe registered"
      /for (.+?)(?:\s|$)/,  // "for John Doe"
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1] !== 'System') {
        return match[1].trim();
      }
    }

    return 'System';
  };

  const getStatusFromMessage = (message, type) => {
    // Extract status information from message
    if (message.includes('approved')) return 'approved';
    if (message.includes('declined')) return 'declined';
    if (message.includes('pending')) return 'pending';
    if (message.includes('generated')) return 'generated';
    if (message.includes('sent')) return 'sent';
    if (message.includes('created')) return 'created';
    if (message.includes('updated')) return 'updated';
    
    return type;
  };

  if (isLoading) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900">Recent Activities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8">
            <p className="text-gray-500">Loading recent activities...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-900">Recent Activities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notifications.length > 0 ? notifications.map((notification) => {
          const { icon: IconComponent, color } = getIconAndColor(notification);
          const user = extractUserFromMessage(notification.message);
          const status = getStatusFromMessage(notification.message, notification.type);
          
          return (
            <div key={notification.id} className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${color}`}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-semibold">
                    {user.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{notification.title}</p>
                <p className="text-sm text-gray-600 truncate">{notification.message}</p>
                <p className="text-xs text-gray-400 truncate">System Activity</p>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <Badge variant="outline" className={color}>
                  {status}
                </Badge>
                <div className="text-right">
                  <p className="text-xs text-gray-400">
                    {format(new Date(notification.created_at), "MMM d, HH:mm")}
                  </p>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No recent activities found.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}