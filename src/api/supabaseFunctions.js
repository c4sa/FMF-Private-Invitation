import { emailService } from '../lib/resend.js'
import { supabase } from '../lib/supabase.js'
import { supabaseHelpers } from '../lib/supabase.js'
import { User, Attendee, Invitation, EmailTemplate, Notification } from './supabaseClient.js'
import NotificationService from '../services/notificationService.js'

// Email functions
export const sendWelcomeEmail = async ({ attendeeData }) => {
  try {
    // Get welcome email template
    const templates = await EmailTemplate.filter({ name: 'welcome' })
    const template = templates?.[0]
    
    let subject = 'Welcome to Future Minerals Forum'
    let html = emailService.getWelcomeEmailTemplate(attendeeData)
    
    if (template) {
      subject = template.subject
      html = template.body
        .replace(/{{first_name}}/g, attendeeData.first_name || '')
        .replace(/{{last_name}}/g, attendeeData.last_name || '')
        .replace(/{{email}}/g, attendeeData.email || '')
    }
    
    return await emailService.sendWelcomeEmail({
      to: attendeeData.email,
      subject,
      html
    })
  } catch (error) {
    console.error('Error sending welcome email:', error)
    throw error
  }
}

export const sendInvitationEmail = async ({ to_email, invitation_code }) => {
  try {
    // Get invitation email template
    const templates = await EmailTemplate.filter({ name: 'invitation' })
    const template = templates?.[0]
    
    let subject = 'Invitation to Future Minerals Forum'
    let html = emailService.getInvitationEmailTemplate(invitation_code)
    
    if (template) {
      const invitationUrl = `${window.location.origin}/PublicRegistration?invitation_code=${invitation_code}`
      subject = template.subject
      html = template.body.replace(/{{invitation_url}}/g, invitationUrl)
    }
    
    return await emailService.sendInvitationEmail({
      to: to_email,
      subject,
      html,
      invitationCode: invitation_code
    })
  } catch (error) {
    console.error('Error sending invitation email:', error)
    throw error
  }
}

export const sendModificationRequestEmail = async ({ to, subject, body }) => {
  try {
    return await emailService.sendModificationRequestEmail({
      to,
      subject,
      html: body
    })
  } catch (error) {
    console.error('Error sending modification request email:', error)
    throw error
  }
}

export const sendPasswordResetInstructions = async ({ email, resetUrl }) => {
  try {
    return await emailService.sendPasswordResetEmail({
      to: email,
      resetUrl
    })
  } catch (error) {
    console.error('Error sending password reset email:', error)
    throw error
  }
}

export const sendNewUserRequestEmail = async ({ newUserFullName, newUserEmail, newUserPassword, newUserCompany, newUserType }) => {
  try {
    // Get admin users to send the request to
    const admins = await User.filter({ system_role: 'Admin' })
    
    if (admins.length === 0) {
      throw new Error('No admin users found to send request to')
    }
    
    const newUserData = {
      full_name: newUserFullName,
      email: newUserEmail,
      password: newUserPassword,
      company_name: newUserCompany,
      System_user_type: newUserType
    }
    
    // Send to all admins
    const adminPromises = admins.map(admin => 
      emailService.sendNewUserRequestEmail({
        to: admin.email,
        newUserData
      })
    )
    
    // Send notification to the new user
    const userPromise = emailService.sendNewUserNotificationEmail({
      to: newUserEmail,
      newUserData
    })
    
    // Execute both admin and user emails
    const allPromises = [...adminPromises, userPromise]
    return await Promise.all(allPromises)
  } catch (error) {
    console.error('Error sending new user request email:', error)
    throw error
  }
}

// Registration functions
export const registerWithInvitation = async ({ invitationCode, attendeeData }) => {
  try {
    // Validate invitation
    const invitation = await Invitation.getByCode(invitationCode)
    if (!invitation) {
      throw new Error('Invalid invitation code')
    }
    
    if (invitation.is_used) {
      throw new Error('Invitation code has already been used')
    }
    
    // Create attendee record
    const attendee = await Attendee.create({
      ...attendeeData,
      attendee_type: invitation.attendee_type,
      registration_method: 'invitation',
      status: 'pending'
    })
    
    // Mark invitation as used
    await Invitation.markAsUsed(invitationCode, attendeeData.email)
    
    return { success: true, attendee }
  } catch (error) {
    console.error('Error registering with invitation:', error)
    
    // Handle duplicate email errors specifically
    if (error.code === '23505' && error.message?.includes('email')) {
      throw new Error('Attendee with this email already exists.')
    }
    
    throw error
  }
}

export const validateInvitation = async (invitationCode) => {
  try {
    const invitation = await Invitation.getByCode(invitationCode)
    if (!invitation) {
      throw new Error('Invalid invitation code')
    }
    
    if (invitation.is_used) {
      throw new Error('Invitation code has already been used')
    }
    
    return invitation
  } catch (error) {
    console.error('Error validating invitation:', error)
    
    // Handle the specific case where no invitation is found
    if (error.code === 'PGRST116' || error.message?.includes('Cannot coerce the result to a single JSON object')) {
      throw new Error('Invalid invitation code')
    }
    
    // Handle other specific cases
    if (error.message?.includes('already been used')) {
      throw new Error('Invitation code has already been used')
    }
    
    throw error
  }
}

export const getAttendeeForModification = async (attendeeId) => {
  try {
    return await Attendee.get(attendeeId)
  } catch (error) {
    console.error('Error getting attendee for modification:', error)
    throw error
  }
}

export const updateAttendeeRegistration = async (attendeeId, updates) => {
  try {
    return await Attendee.update(attendeeId, updates)
  } catch (error) {
    console.error('Error updating attendee registration:', error)
    throw error
  }
}

// System functions
export const createNotification = async ({ userId, title, message, type = 'info' }) => {
  try {
    return await Notification.create({
      user_id: userId,
      title,
      message,
      type
    })
  } catch (error) {
    console.error('Error creating notification:', error)
    throw error
  }
}

export const generateInvitations = async ({ count, attendee_type }) => {
  try {
    const currentUser = await User.me()
    const invitations = []
    
    for (let i = 0; i < count; i++) {
      const invitationCode = generateInvitationCode()
      const invitation = await Invitation.create({
        invitation_code: invitationCode,
        attendee_type,
        created_by: currentUser.id
      })
      invitations.push(invitation)
    }
    
    // Create notification for invitations generated
    try {
      await NotificationService.notifyInvitationsGenerated(count, attendee_type, currentUser);
    } catch (notificationError) {
      console.error('Failed to create notification for invitations generation:', notificationError);
    }
    
    return invitations
  } catch (error) {
    console.error('Error generating invitations:', error)
    throw error
  }
}

export const createSlotRequestsWithUsers = async ({ userId, requestedSlots, reason }) => {
  try {
    return await SlotRequest.create({
      user_id: userId,
      requested_slots: requestedSlots,
      reason,
      status: 'pending'
    })
  } catch (error) {
    console.error('Error creating slot request:', error)
    throw error
  }
}

// Helper functions
function generateInvitationCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// File upload functions
export const uploadFile = async (file, bucket = 'attendee-photos') => {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `uploads/${fileName}`
    
    // Upload file with options that work for both authenticated and anonymous users
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        // Remove any authentication requirements for public buckets
        contentType: file.type
      })
    
    if (error) {
      console.error('Storage upload error details:', error)
      throw new Error(`Upload failed: ${error.message}`)
    }
    
    // Get public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)
    
    return publicUrl
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

export const deleteFile = async (url, bucket = 'attendee-photos') => {
  try {
    // Extract file path from URL
    const urlParts = url.split('/')
    const filePath = urlParts.slice(urlParts.indexOf(bucket) + 1).join('/')
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath])
    
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error deleting file:', error)
    throw error
  }
}

// Test email function
export const sendTestEmail = async ({ to, subject, body }) => {
  try {
    return await emailService.sendWelcomeEmail({
      to,
      subject: subject || 'Test Email',
      html: body || '<p>This is a test email from Future Minerals Forum system.</p>'
    })
  } catch (error) {
    console.error('Error sending test email:', error)
    throw error
  }
}

// OTP Functions
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const createOTP = async (email, otpType = 'email_verification', userId = null) => {
  try {
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    
    const { data, error } = await supabase
      .from('otps')
      .insert({
        user_id: userId, // This can be null for new signups
        email: email,
        otp_code: otpCode,
        otp_type: otpType,
        expires_at: expiresAt.toISOString(),
        created_by_ip: null // You can get this from request if needed
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to create OTP:', error);
    throw error;
  }
};

export const verifyOTP = async (email, otpCode, otpType = 'email_verification') => {
  try {
    const { data, error } = await supabase
      .from('otps')
      .select('*')
      .eq('email', email)
      .eq('otp_code', otpCode)
      .eq('otp_type', otpType)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) throw error;
    
    if (!data) {
      throw new Error('Invalid or expired OTP code');
    }
    
    // Check attempts
    if (data.attempts >= data.max_attempts) {
      throw new Error('Maximum attempts exceeded. Please request a new OTP.');
    }
    
    // Mark OTP as used
    const { error: updateError } = await supabase
      .from('otps')
      .update({ 
        is_used: true,
        verified_at: new Date().toISOString(),
        verified_by_ip: null
      })
      .eq('id', data.id);
    
    if (updateError) throw updateError;
    
    return { success: true, otp: data };
  } catch (error) {
    console.error('Failed to verify OTP:', error);
    throw error;
  }
};

export const sendOTPEmail = async (email, otpCode, otpType = 'email_verification', userName = 'User') => {
  try {
    // Get email template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('name', 'send_otp')
      .eq('is_active', true)
      .single();
    
    if (templateError) throw templateError;
    
    if (!template) {
      throw new Error('OTP email template not found');
    }
    
    // Replace template variables
    let subject = template.subject;
    let body = template.body;
    
    // Replace variables
    const variables = {
      '{{user_name}}': userName,
      '{{otp_code}}': otpCode,
      '{{otp_type}}': otpType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      '{{expiry_minutes}}': '10'
    };
    
    Object.entries(variables).forEach(([key, value]) => {
      subject = subject.replace(new RegExp(key, 'g'), value);
      body = body.replace(new RegExp(key, 'g'), value);
    });
    
    // Send email using Resend
    const { emailService } = await import('../lib/resend.js');
    
    const result = await emailService.send({
      to: email,
      subject: subject,
      html: body
    });
    
    return result;
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    throw error;
  }
};

export const sendOTP = async (email, otpType = 'email_verification', userId = null, userName = 'User') => {
  try {
    // Create OTP
    const otpData = await createOTP(email, otpType, userId);
    
    // Send OTP email
    await sendOTPEmail(email, otpData.otp_code, otpType, userName);
    
    return { success: true, otpId: otpData.id };
  } catch (error) {
    console.error('Failed to send OTP:', error);
    throw error;
  }
};

// Create user in public.users table
export const createUserProfile = async (userId, userData) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: userData.email,
        full_name: userData.full_name,
        preferred_name: userData.preferred_name,
        company_name: userData.company_name,
        user_type: userData.user_type || 'attendee',
        system_role: userData.system_role || 'User',
        account_status: userData.account_status || 'active',
        registration_slots: userData.registration_slots || { "VIP": 0, "Media": 0, "Partner": 0, "Exhibitor": 0 },
        used_slots: userData.used_slots || { "VIP": 0, "Media": 0, "Partner": 0, "Exhibitor": 0 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    
    // Create notification for new user registration
    try {
      await NotificationService.notifyUserRegistration(data);
    } catch (notificationError) {
      console.error('Failed to create notification for user registration:', notificationError);
    }
    
    return data;
  } catch (error) {
    console.error('Failed to create user profile:', error);
    throw error;
  }
};
