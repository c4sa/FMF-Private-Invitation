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

  async getUserCompanies(userId) {
    const { data, error } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data
  }

  async getCompanyUsers(companyName) {
    const { data, error } = await supabase
      .from('user_companies')
      .select(`
        *,
        users (
          id,
          email,
          full_name,
          preferred_name,
          system_role,
          user_type,
          account_status
        )
      `)
      .eq('company_name', companyName)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data
  }

  async addUserCompany(userId, companyName, partnershipType = 'N/A') {
    const { data, error } = await supabase
      .from('user_companies')
      .insert([{
        user_id: userId,
        company_name: companyName,
        partnership_type: partnershipType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()
    
    if (error) throw error
    
    // Update user's company_name field with first company for backward compatibility
    const userCompanies = await this.getUserCompanies(userId)
    if (userCompanies && userCompanies.length > 0) {
      const firstCompany = userCompanies[0].company_name
      await this.update(userId, { company_name: firstCompany })
    }
    
    return data
  }

  async removeUserCompany(userId, companyName) {
    const { error } = await supabase
      .from('user_companies')
      .delete()
      .eq('user_id', userId)
      .eq('company_name', companyName)
    
    if (error) throw error
    
    // Update user's company_name field with first remaining company for backward compatibility
    const userCompanies = await this.getUserCompanies(userId)
    if (userCompanies && userCompanies.length > 0) {
      const firstCompany = userCompanies[0].company_name
      await this.update(userId, { company_name: firstCompany })
    } else {
      // No companies left, set to null
      await this.update(userId, { company_name: null })
    }
    
    return { success: true }
  }

  async updateUserCompanies(userId, companies) {
    // Remove all existing company relationships
    const { error: deleteError } = await supabase
      .from('user_companies')
      .delete()
      .eq('user_id', userId)
    
    if (deleteError) throw deleteError
    
    // Add new company relationships
    if (companies && companies.length > 0) {
      const companyRecords = companies.map(company => ({
        user_id: userId,
        company_name: company.companyName,
        partnership_type: company.partnershipType || 'N/A',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))
      
      const { data, error: insertError } = await supabase
        .from('user_companies')
        .insert(companyRecords)
        .select()
      
      if (insertError) throw insertError
      
      // Update user's company_name field with first company for backward compatibility
      await this.update(userId, { company_name: companies[0].companyName })
      
      return data
    } else {
      // No companies, set to null
      await this.update(userId, { company_name: null })
      return []
    }
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
        used_at: new Date().toISOString(),
        status: 'used'
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

  async update(id, updates) {
    // First update the partnership type
    const updatedType = await super.update(id, updates);
    
    // Then update all users with this user_type to sync their registration_slots
    if (updates.slots_vip !== undefined || updates.slots_premier !== undefined || updates.slots_partner !== undefined || 
        updates.slots_exhibitor !== undefined || updates.slots_media !== undefined || updates.slots_other !== undefined) {
      
      const newSlots = {
        VIP: updates.slots_vip !== undefined ? updates.slots_vip : updatedType.slots_vip,
        Premier: updates.slots_premier !== undefined ? updates.slots_premier : updatedType.slots_premier,
        Partner: updates.slots_partner !== undefined ? updates.slots_partner : updatedType.slots_partner,
        Exhibitor: updates.slots_exhibitor !== undefined ? updates.slots_exhibitor : updatedType.slots_exhibitor,
        Media: updates.slots_media !== undefined ? updates.slots_media : updatedType.slots_media,
        Other: updates.slots_other !== undefined ? updates.slots_other : updatedType.slots_other
      };

      // Update all users with this user_type
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ 
          registration_slots: newSlots,
          updated_at: new Date().toISOString()
        })
        .eq('user_type', updatedType.name);

      if (userUpdateError) {
        console.error('Failed to update user slots:', userUpdateError);
        // Don't throw error here as the partnership type was already updated successfully
      }
    }
    
    return updatedType;
  }

  async delete(id) {
    // First get the partnership type to know which users to update
    const partnershipType = await this.get(id);
    
    // Delete the partnership type
    const result = await super.delete(id);
    
    // Update all users with this user_type to reset their slots to default
    if (partnershipType) {
      const defaultSlots = {
        VIP: 0,
        Premier: 0,
        Partner: 0,
        Exhibitor: 0,
        Media: 0,
        Other: 0
      };

      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ 
          registration_slots: defaultSlots,
          user_type: 'N/A',
          updated_at: new Date().toISOString()
        })
        .eq('user_type', partnershipType.name);

      if (userUpdateError) {
        console.error('Failed to reset user slots after partnership type deletion:', userUpdateError);
        // Don't throw error here as the partnership type was already deleted successfully
      }
    }
    
    return result;
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

export class TrophiesAndCertificatesAPI extends SupabaseAPI {
  constructor() {
    super('trophies_and_certificates')
  }

  async getByUserId(userId) {
    const { data, error } = await supabase
      .from('trophies_and_certificates')
      .select('*')
      .eq('user_id', userId)
      .order('awarded_at', { ascending: false })
    
    if (error) throw error
    return data
  }

  async getByUserIdAndType(userId, awardType) {
    const { data, error } = await supabase
      .from('trophies_and_certificates')
      .select('*')
      .eq('user_id', userId)
      .eq('award_type', awardType)
      .order('awarded_at', { ascending: false })
    
    if (error) throw error
    return data
  }

  async getLatestByUserIdAndType(userId, awardType) {
    const { data, error } = await supabase
      .from('trophies_and_certificates')
      .select('*')
      .eq('user_id', userId)
      .eq('award_type', awardType)
      .order('awarded_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
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
export const TrophiesAndCertificates = new TrophiesAndCertificatesAPI()

// Export the base client for custom queries
export { supabase, supabaseHelpers }
