import { Notification, User } from '@/api/entities';

/**
 * Notification Service - Handles automatic notification creation for system activities
 */
export class NotificationService {
  
  /**
   * Create a notification for specific users or all admin users
   * @param {Object} params - Notification parameters
   * @param {string|string[]|null} params.userIds - Specific user IDs, null for all admins
   * @param {string} params.title - Notification title
   * @param {string} params.message - Notification message
   * @param {string} params.type - Notification type (info, success, warning, error)
   */
  static async createNotification({ userIds = null, title, message, type = 'info' }) {
    try {
      let targetUserIds = [];

      if (userIds === null) {
        // Send to all admin users
        const users = await User.list();
        targetUserIds = users
          .filter(user => user.system_role === 'Admin' || user.system_role === 'Super User')
          .map(user => user.id);
      } else if (Array.isArray(userIds)) {
        targetUserIds = userIds;
      } else {
        targetUserIds = [userIds];
      }

      // Create notifications for each target user
      const notifications = await Promise.all(
        targetUserIds.map(userId => 
          Notification.create({
            user_id: userId,
            title,
            message,
            type
          })
        )
      );

      return notifications;
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }

  // Attendee-related notifications
  static async notifyAttendeeRegistered(attendee, registeredBy = null) {
    const registererName = registeredBy ? `${registeredBy.full_name || registeredBy.email}` : 'System';
    
    return this.createNotification({
      userIds: null, // Send to all admins
      title: 'New Attendee Registration',
      message: `${attendee.first_name} ${attendee.last_name} (${attendee.email}) registered as ${attendee.attendee_type}. Registered by: ${registererName}`,
      type: 'info'
    });
  }

  static async notifyAttendeeStatusChanged(attendee, oldStatus, newStatus, changedBy = null) {
    const changerName = changedBy ? `${changedBy.full_name || changedBy.email}` : 'System';
    const statusColors = {
      'approved': 'success',
      'declined': 'error',
      'change_requested': 'warning',
      'pending': 'info'
    };

    return this.createNotification({
      userIds: null, // Send to all admins
      title: `Attendee Status Updated`,
      message: `${attendee.first_name} ${attendee.last_name}'s status changed from "${oldStatus}" to "${newStatus}" by ${changerName}`,
      type: statusColors[newStatus] || 'info'
    });
  }

  static async notifyAttendeeUpdated(attendee, updatedBy = null) {
    const updaterName = updatedBy ? `${updatedBy.full_name || updatedBy.email}` : 'System';
    
    return this.createNotification({
      userIds: null,
      title: 'Attendee Information Updated',
      message: `${attendee.first_name} ${attendee.last_name}'s information was updated by ${updaterName}`,
      type: 'info'
    });
  }

  static async notifyAttendeeModificationRequested(attendee, requestedBy = null) {
    const requesterName = requestedBy ? `${requestedBy.full_name || requestedBy.email}` : 'Unknown User';
    
    return this.createNotification({
      userIds: null,
      title: 'Attendee Modification Request',
      message: `${attendee.first_name} ${attendee.last_name} (${attendee.email}) has requested modifications to their registration information`,
      type: 'warning'
    });
  }

  // User-related notifications
  static async notifyUserCreated(user, createdBy = null) {
    const creatorName = createdBy ? `${createdBy.full_name || createdBy.email}` : 'System';
    
    return this.createNotification({
      userIds: null,
      title: 'New User Account Created',
      message: `User account created for ${user.full_name || user.email} (${user.user_type}) by ${creatorName}`,
      type: 'success'
    });
  }

  static async notifyUserUpdated(user, updatedBy = null) {
    const updaterName = updatedBy ? `${updatedBy.full_name || updatedBy.email}` : 'System';
    
    return this.createNotification({
      userIds: null,
      title: 'User Account Updated',
      message: `User ${user.full_name || user.email} was updated by ${updaterName}`,
      type: 'info'
    });
  }

  static async notifyUserRoleChanged(user, oldRole, newRole, changedBy = null) {
    const changerName = changedBy ? `${changedBy.full_name || changedBy.email}` : 'System';
    
    return this.createNotification({
      userIds: null,
      title: 'User Role Changed',
      message: `${user.full_name || user.email}'s role changed from "${oldRole}" to "${newRole}" by ${changerName}`,
      type: 'warning'
    });
  }

  // Invitation-related notifications
  static async notifyInvitationsGenerated(count, attendeeType, createdBy = null) {
    const creatorName = createdBy ? `${createdBy.full_name || createdBy.email}` : 'System';
    
    return this.createNotification({
      userIds: null,
      title: 'Invitations Generated',
      message: `${count} ${attendeeType} invitations were generated by ${creatorName}`,
      type: 'success'
    });
  }

  static async notifyInvitationUsed(invitation, attendee) {
    return this.createNotification({
      userIds: null,
      title: 'Invitation Used',
      message: `${attendee.first_name} ${attendee.last_name} used invitation code ${invitation.invitation_code} for ${invitation.attendee_type} registration`,
      type: 'info'
    });
  }

  static async notifyInvitationEmailSent(invitation, recipientEmail, sentBy = null) {
    const senderName = sentBy ? `${sentBy.full_name || sentBy.email}` : 'System';
    
    return this.createNotification({
      userIds: null,
      title: 'Invitation Email Sent',
      message: `${invitation.attendee_type} invitation sent to ${recipientEmail} by ${senderName}`,
      type: 'info'
    });
  }

  // Slot request notifications
  static async notifySlotRequestCreated(slotRequest, requestedBy = null) {
    const requesterName = requestedBy ? `${requestedBy.full_name || requestedBy.email}` : 'Unknown User';
    const slotsText = Object.entries(slotRequest.requested_slots)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');
    
    return this.createNotification({
      userIds: null,
      title: 'Slot Request Submitted',
      message: `${requesterName} requested additional slots: ${slotsText}`,
      type: 'info'
    });
  }

  static async notifySlotRequestStatusChanged(slotRequest, oldStatus, newStatus, changedBy = null) {
    const changerName = changedBy ? `${changedBy.full_name || changedBy.email}` : 'System';
    const statusColors = {
      'approved': 'success',
      'declined': 'error',
      'pending': 'info'
    };
    
    return this.createNotification({
      userIds: null,
      title: 'Slot Request Status Updated',
      message: `Slot request status changed from "${oldStatus}" to "${newStatus}" by ${changerName}`,
      type: statusColors[newStatus] || 'info'
    });
  }

  // System notifications
  static async notifySystemSettingChanged(settingName, oldValue, newValue, changedBy = null) {
    const changerName = changedBy ? `${changedBy.full_name || changedBy.email}` : 'System';
    
    return this.createNotification({
      userIds: null,
      title: 'System Setting Updated',
      message: `System setting "${settingName}" changed by ${changerName}`,
      type: 'warning'
    });
  }

  static async notifyBulkOperation(operationType, count, entityType, performedBy = null) {
    const performerName = performedBy ? `${performedBy.full_name || performedBy.email}` : 'System';
    
    return this.createNotification({
      userIds: null,
      title: `Bulk ${operationType}`,
      message: `${count} ${entityType} records were ${operationType.toLowerCase()} by ${performerName}`,
      type: 'info'
    });
  }

  // Email notifications
  static async notifyEmailSent(emailType, recipient, sentBy = null) {
    const senderName = sentBy ? `${sentBy.full_name || sentBy.email}` : 'System';
    
    return this.createNotification({
      userIds: null,
      title: 'Email Sent',
      message: `${emailType} email sent to ${recipient} by ${senderName}`,
      type: 'info'
    });
  }

  // Authentication notifications
  static async notifyUserLogin(user) {
    // Only notify for admin logins
    if (user.system_role === 'Admin' || user.system_role === 'Super User') {
      return this.createNotification({
        userIds: null,
        title: 'Admin User Login',
        message: `${user.full_name || user.email} logged in`,
        type: 'info'
      });
    }
    return null;
  }

  static async notifyUserRegistration(user) {
    return this.createNotification({
      userIds: null,
      title: 'New User Registration',
      message: `${user.full_name || user.email} completed registration`,
      type: 'success'
    });
  }

  // Error notifications
  static async notifySystemError(errorMessage, context = null, affectedUser = null) {
    const contextInfo = context ? ` (Context: ${context})` : '';
    const userInfo = affectedUser ? ` - User: ${affectedUser.full_name || affectedUser.email}` : '';
    
    return this.createNotification({
      userIds: null,
      title: 'System Error Occurred',
      message: `Error: ${errorMessage}${contextInfo}${userInfo}`,
      type: 'error'
    });
  }
}

export default NotificationService;
