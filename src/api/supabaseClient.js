import { supabase, supabaseHelpers } from '../lib/supabase.js'
import NotificationService from '../services/notificationService.js'

// Base API client class
class SupabaseAPI {
  constructor(tableName) {
    this.tableName = tableName
  }

  // Generic CRUD operations
  async list(orderBy = null) {
    let query = supabase.from(this.tableName).select('*')
    
    if (orderBy) {
      const [column, ascending] = orderBy.startsWith('-') 
        ? [orderBy.slice(1), false] 
        : [orderBy, true]
      query = query.order(column, { ascending })
    }
    
    const { data, error } = await query
    if (error) throw error
    return data
  }

  async get(id) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  }

  async create(record) {
    // Process the record to handle empty date fields for attendees table
    const processedRecord = this.tableName === 'attendees' ? this.processDateFields(record) : record;
    
    const { data, error } = await supabase
      .from(this.tableName)
      .insert(processedRecord)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async update(id, updates) {
    // Process the updates to handle empty date fields for attendees table
    const processedUpdates = this.tableName === 'attendees' ? this.processDateFields(updates) : updates;
    
    const { data, error } = await supabase
      .from(this.tableName)
      .update(processedUpdates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async delete(id) {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)
    
    if (error) throw error
    return { success: true }
  }

  async filter(filters) {
    let query = supabase.from(this.tableName).select('*')
    
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value)
    })
    
    const { data, error } = await query
    if (error) throw error
    return data
  }

  // Helper method to process date fields for PostgreSQL compatibility
  processDateFields(record) {
    const processedRecord = { ...record };
    const dateFields = ['date_of_birth', 'issue_date', 'expiry_date'];
    
    dateFields.forEach(field => {
      if (processedRecord[field] === '') {
        processedRecord[field] = null;
      }
    });
    
    return processedRecord;
  }
}

// Specific API classes for each entity
export class UsersAPI extends SupabaseAPI {
  constructor() {
    super('users')
  }

  async create(record) {
    const result = await super.create(record);
    
    // Create notification for new user
    try {
      const currentUser = await supabaseHelpers.getCurrentUser();
      let createdBy = null;
      if (currentUser) {
        try {
          createdBy = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();
          createdBy = createdBy.data;
        } catch (err) {
          console.warn('Could not fetch current user details for notification');
        }
      }
      
      await NotificationService.notifyUserCreated(result, createdBy);
    } catch (notificationError) {
      console.error('Failed to create notification for user creation:', notificationError);
    }
    
    return result;
  }

  async update(id, updates) {
    // Get current record to compare role changes
    let currentRecord = null;
    try {
      currentRecord = await this.get(id);
    } catch (err) {
      console.warn('Could not fetch current record for comparison');
    }

    const result = await super.update(id, updates);
    
    // Create notifications for updates
    try {
      const currentUser = await supabaseHelpers.getCurrentUser();
      let updatedBy = null;
      if (currentUser) {
        try {
          updatedBy = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();
          updatedBy = updatedBy.data;
        } catch (err) {
          console.warn('Could not fetch current user details for notification');
        }
      }

      // Check if role changed
      if (currentRecord && currentRecord.system_role !== result.system_role) {
        await NotificationService.notifyUserRoleChanged(
          result, 
          currentRecord.system_role, 
          result.system_role, 
          updatedBy
        );
      } else if (Object.keys(updates).length > 0) {
        // General update notification
        await NotificationService.notifyUserUpdated(result, updatedBy);
      }
    } catch (notificationError) {
      console.error('Failed to create notification for user update:', notificationError);
    }
    
    return result;
  }

  async me() {
    const user = await supabaseHelpers.getCurrentUser()
    if (!user) throw new Error('Not authenticated')
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (error) throw error
    return data
  }

  async updateMyUserData(updates) {
    const user = await supabaseHelpers.getCurrentUser()
    if (!user) throw new Error('Not authenticated')
    
    return this.update(user.id, updates)
  }

  async loginWithRedirect(redirectUrl) {
    // Redirect to login page instead of OAuth
    window.location.href = '/login';
  }

  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    
    // Create notification for admin login
    try {
      if (data.user) {
        const userProfile = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        if (userProfile.data) {
          await NotificationService.notifyUserLogin(userProfile.data);
        }
      }
    } catch (notificationError) {
      console.error('Failed to create notification for user login:', notificationError);
    }
    
    return data;
  }

  async register(email, password, userData = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });
    if (error) throw error;
    return data;
  }

  async logout() {
    return supabaseHelpers.signOut()
  }
}

export class AttendeesAPI extends SupabaseAPI {
  constructor() {
    super('attendees')
  }

  async create(record) {
    const result = await super.create(record);
    
    // Create notification for new attendee registration
    try {
      const currentUser = await supabaseHelpers.getCurrentUser();
      let registeredBy = null;
      if (currentUser) {
        try {
          registeredBy = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();
          registeredBy = registeredBy.data;
        } catch (err) {
          console.warn('Could not fetch current user details for notification');
        }
      }
      
      await NotificationService.notifyAttendeeRegistered(result, registeredBy);
    } catch (notificationError) {
      console.error('Failed to create notification for attendee registration:', notificationError);
    }
    
    return result;
  }

  async update(id, updates) {
    // Get the current record to compare status changes
    let currentRecord = null;
    try {
      currentRecord = await this.get(id);
    } catch (err) {
      console.warn('Could not fetch current record for comparison');
    }

    const result = await super.update(id, updates);
    
    // Create notifications for status changes
    try {
      const currentUser = await supabaseHelpers.getCurrentUser();
      let updatedBy = null;
      if (currentUser) {
        try {
          updatedBy = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();
          updatedBy = updatedBy.data;
        } catch (err) {
          console.warn('Could not fetch current user details for notification');
        }
      }

      // Check if status changed
      if (currentRecord && currentRecord.status !== result.status) {
        await NotificationService.notifyAttendeeStatusChanged(
          result, 
          currentRecord.status, 
          result.status, 
          updatedBy
        );
      } else if (Object.keys(updates).length > 0) {
        // General update notification
        await NotificationService.notifyAttendeeUpdated(result, updatedBy);
      }
    } catch (notificationError) {
      console.error('Failed to create notification for attendee update:', notificationError);
    }
    
    return result;
  }

  async getByEmail(email) {
    const { data, error } = await supabase
      .from('attendees')
      .select('*')
      .eq('email', email)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async getByModificationToken(token) {
    const { data, error } = await supabase
      .from('attendees')
      .select('*')
      .eq('modification_token', token)
      .single()
    
    if (error) throw error
    return data
  }

  async getByRegisteredBy(userId) {
    const { data, error } = await supabase
      .from('attendees')
      .select('*')
      .eq('registered_by', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  }
}

export class InvitationsAPI extends SupabaseAPI {
  constructor() {
    super('invitations')
  }

  async getByCode(code) {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('invitation_code', code)
      .maybeSingle()
    
    if (error) throw error
    return data
  }

  async markAsUsed(code, email) {
    const { data, error } = await supabase
      .from('invitations')
      .update({
        is_used: true,
        used_by_email: email,
        used_at: new Date().toISOString()
      })
      .eq('invitation_code', code)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}

export class EmailTemplatesAPI extends SupabaseAPI {
  constructor() {
    super('email_templates')
  }
}

export class SystemSettingsAPI extends SupabaseAPI {
  constructor() {
    super('system_settings')
  }
}

export class PartnershipTypesAPI extends SupabaseAPI {
  constructor() {
    super('partnership_types')
  }
}

export class SlotRequestsAPI extends SupabaseAPI {
  constructor() {
    super('slot_requests')
  }
}

export class NotificationsAPI extends SupabaseAPI {
  constructor() {
    super('notifications')
  }

  async getByUserId(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  }

  async getUnreadByUserId(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  }

  async markAsRead(id) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}

export class StagedUsersAPI extends SupabaseAPI {
  constructor() {
    super('staged_users')
  }

  async bulkCreate(users) {
    const { data, error } = await supabase
      .from('staged_users')
      .insert(users)
      .select()
    
    if (error) throw error
    return data
  }
}

// Create instances
export const User = new UsersAPI()
export const Attendee = new AttendeesAPI()
export const Invitation = new InvitationsAPI()
export const EmailTemplate = new EmailTemplatesAPI()
export const SystemSetting = new SystemSettingsAPI()
export const PartnershipType = new PartnershipTypesAPI()
export const SlotRequest = new SlotRequestsAPI()
export const Notification = new NotificationsAPI()
export const StagedUser = new StagedUsersAPI()

// Export the base client for custom queries
export { supabase, supabaseHelpers }
