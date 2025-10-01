import React, { useState, useEffect, useCallback } from 'react';
import { User, Notification } from "@/api/entities";
import {
  Bell,
  CheckCheck,
  X,
  UserPlus,
  FileText,
  Wrench,
  Activity,
  Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

const notificationIcons = {
  info: <Info className="w-5 h-5 text-blue-500" />,
  success: <CheckCheck className="w-5 h-5 text-green-500" />,
  warning: <Info className="w-5 h-5 text-yellow-500" />,
  error: <X className="w-5 h-5 text-red-500" />,
  new_registration: <UserPlus className="w-5 h-5 text-purple-500" />,
  slot_request: <FileText className="w-5 h-5 text-orange-500" />,
  system_update: <Wrench className="w-5 h-5 text-gray-500" />,
  user_activity: <Activity className="w-5 h-5 text-indigo-500" />,
};


export default function NotificationCenter({ currentUser }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!currentUser) {
      return; // Don't fetch if no user is provided
    }

    try {
      // Get only unread notifications for the current user
      const unreadNotifications = await Notification.getUnreadByUserId(currentUser.id);
      
      const newNotifications = unreadNotifications.map(n => ({
        ...n,
        is_read: n.is_read || false
      }));

      setNotifications(newNotifications);
      setUnreadCount(newNotifications.length);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  }, [currentUser]);

  useEffect(() => {
    loadNotifications(); // Initial load
    
    // Set up polling only if a user is present
    if (currentUser) {
      const interval = setInterval(loadNotifications, 60000); // Poll every 60 seconds
      return () => clearInterval(interval);
    }
  }, [loadNotifications, currentUser]);

  const handleMarkAsRead = async (notificationId) => {
    if (!currentUser) return;
    
    try {
      // Update the notification's is_read field in the database
      await Notification.markAsRead(notificationId);
      
      // Remove the notification from the list since we only show unread ones
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      // Reload notifications on failure
      loadNotifications(); 
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser || notifications.length === 0) return;

    try {
      // Mark all unread notifications as read in the database
      await Promise.all(notifications.map(n => Notification.markAsRead(n.id)));
      
      // Clear the notifications list since we only show unread ones
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      loadNotifications();
    }
  };
  
  if (!currentUser) {
    return null; // Don't render anything if there's no user
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <Card className="border-0">
          <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
            <CardTitle className="text-base font-semibold">Notifications</CardTitle>
            {unreadCount > 0 && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={handleMarkAllAsRead}>
                Mark all as read
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-2 max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex gap-3 p-3 rounded-lg transition-colors bg-blue-50"
                >
                  <div className="flex-shrink-0 mt-1">
                    {notificationIcons[notification.type] || notificationIcons.info}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{notification.title}</p>
                    <p className="text-sm text-gray-600">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleMarkAsRead(notification.id)}
                    title="Mark as read"
                  >
                    <CheckCheck className="w-4 h-4 text-gray-500" />
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-sm text-gray-500">You're all caught up!</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="p-2 border-t">
             <Button variant="ghost" className="w-full" asChild>
                <Link to="#">View all notifications</Link>
             </Button>
          </CardFooter>
        </Card>
      </PopoverContent>
    </Popover>
  );
}