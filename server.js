import express from 'express';
import cors from 'cors';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SERVICE_ROLE_KEY;

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// SendGrid Configuration from environment variables
const sendGridConfig = {
  apiKey: process.env.SENDGRID_API_KEY,
  from: process.env.SMTP_FROM || process.env.SENDGRID_FROM || 'noreply@example.com'
};

// Initialize SendGrid with API key
if (sendGridConfig.apiKey) {
  sgMail.setApiKey(sendGridConfig.apiKey);
}

// Email sending endpoint
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, html, text, bcc } = req.body;

    // Validate required fields
    if (!to || !subject || !html) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, html' 
      });
    }

    // Check if SendGrid API key is configured
    if (!sendGridConfig.apiKey) {
      console.log('📧 SendGrid API key not configured, simulating email sending');
      if (bcc) {
        console.log('BCC would be:', Array.isArray(bcc) ? bcc.join(', ') : bcc);
      }
      return res.status(200).json({ 
        success: true, 
        messageId: 'sim-' + Date.now(),
        response: 'Email simulated (SendGrid API key not configured)'
      });
    }

    // Prepare SendGrid message
    const msg = {
      to: to,
      from: sendGridConfig.from,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, '') // Strip HTML tags for text version
    };

    // Add BCC if provided (can be string or array)
    if (bcc) {
      // Handle comma-separated string or array
      msg.bcc = Array.isArray(bcc) ? bcc : bcc.split(',').map(email => email.trim()).filter(Boolean);
    }

    // Send email using SendGrid
    const [result] = await sgMail.send(msg);
    
    return res.status(200).json({ 
      success: true, 
      messageId: result.headers['x-message-id'] || `sg-${Date.now()}`,
      response: `SendGrid status: ${result.statusCode}`
    });

  } catch (error) {
    console.error('Failed to send email:', error);
    
    // Handle SendGrid specific errors
    if (error.response) {
      const { body, statusCode } = error.response;
      return res.status(statusCode || 500).json({ 
        error: 'Failed to send email',
        details: body?.errors?.[0]?.message || error.message,
        sendGridErrors: body?.errors
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to send email',
      details: error.message 
    });
  }
});

// Update user access endpoint
app.post('/api/update-user-access', async (req, res) => {
  try {
    const { userId, systemRole, hasAccess } = req.body;

    // Validate required fields
    if (!userId || !systemRole) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, systemRole' 
      });
    }

    // Determine has_access based on system role and checkbox
    let accessValue;
    if (systemRole === 'Admin') {
      accessValue = true; // Admins always have access
    } else if (systemRole === 'Super User') {
      accessValue = hasAccess === true; // Super Users depend on checkbox
    } else {
      accessValue = false; // Regular Users never have access
    }

    // Update the user's has_access field
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ 
        has_access: accessValue,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user access:', updateError);
      return res.status(400).json({ 
        error: `Failed to update user access: ${updateError.message}` 
      });
    }

    return res.status(200).json({ 
      success: true,
      user: updatedUser,
      message: 'User access updated successfully'
    });

  } catch (error) {
    console.error('Error in update-user-access API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Password update endpoint
app.post('/api/update-password', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // First, check if user exists in our users table
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('id, email, full_name, company_name')
      .eq('email', email)
      .single();

    if (dbError || !dbUser) {
      console.error('User not found in users table:', dbError);
      return res.status(404).json({ error: 'User not found in system' });
    }

    // Try to get user from Auth using the user ID from our database
    let authUser = null;
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.getUserById(dbUser.id);
      if (!authError && authData.user) {
        authUser = authData.user;
      }
    } catch (error) {
      console.log('Auth user not found by ID, trying to find by email...');
    }

    // If not found by ID, try to find by email in auth users
    if (!authUser) {
      try {
        const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
        if (!userError && users) {
          authUser = users.find(u => u.email === email);
        }
      } catch (error) {
        console.log('Could not list auth users, will try to create auth user...');
      }
    }

    // If user doesn't exist in Auth but exists in our database, create them in Auth
    if (!authUser) {
      console.log(`Creating auth user for existing database user: ${email}`);
      try {
        const { data: newAuthData, error: createError } = await supabase.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: dbUser.full_name || '',
            company_name: dbUser.company_name || ''
          }
        });

        if (createError) {
          console.error('Error creating auth user:', createError);
          return res.status(500).json({ error: `Failed to create auth user: ${createError.message}` });
        }

        authUser = newAuthData.user;

        // Update the database user record with the correct auth ID if different
        if (authUser.id !== dbUser.id) {
          const { error: updateIdError } = await supabase
            .from('users')
            .update({ id: authUser.id })
            .eq('email', email);

          if (updateIdError) {
            console.error('Error updating user ID:', updateIdError);
            // Don't fail the password reset if this fails
          }
        }
      } catch (error) {
        console.error('Failed to create auth user:', error);
        return res.status(500).json({ error: 'Failed to create authentication user' });
      }
    }
    
    if (!authUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update the password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      authUser.id,
      { password: password }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    // Update the is_reset field in the users table using user ID
    console.log('Attempting to update is_reset field for user ID:', authUser.id, 'email:', email);
    
    const { data: updateData, error: resetError } = await supabase
      .from('users')
      .update({ is_reset: true })
      .eq('id', authUser.id)
      .select();

    if (resetError) {
      console.error('Error updating is_reset field:', resetError);
      console.error('Error details:', JSON.stringify(resetError, null, 2));
      // Don't fail the password update if is_reset update fails
      console.warn('Password updated successfully but failed to update is_reset status');
    } else {
      console.log('Successfully updated is_reset field for user:', email);
      console.log('Updated data:', JSON.stringify(updateData, null, 2));
      
      if (!updateData || updateData.length === 0) {
        console.warn('No rows were updated - user might not exist in users table');
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Password updated successfully' 
    });

  } catch (error) {
    console.error('Password update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update is_reset field endpoint
app.post('/api/update-is-reset', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find the user in the users table by email
    const { data: userRecord, error: findUserError } = await supabase
      .from('users')
      .select('id, email, is_reset')
      .eq('email', email)
      .single();

    if (findUserError) {
      console.error('Error finding user in users table:', findUserError);
      return res.status(404).json({ error: 'User not found in users table' });
    }

    // Update the is_reset field
    const { data: updateData, error: userUpdateError } = await supabase
      .from('users')
      .update({ is_reset: true })
      .eq('id', userRecord.id)
      .select();

    if (userUpdateError) {
      console.error('Error updating is_reset field:', userUpdateError);
      return res.status(500).json({ error: 'Failed to update is_reset field' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'is_reset field updated successfully',
      data: updateData
    });

  } catch (error) {
    console.error('Update is_reset error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update email template status endpoint
app.post('/api/update-email-template-status', async (req, res) => {
  try {
    const { templateName, isActive } = req.body;

    if (!templateName || typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'Template name and isActive status are required' });
    }

    // Update the is_active field in the email_templates table
    console.log('Attempting to update email template status:', templateName, 'to', isActive);
    
    const { data: updateData, error: updateError } = await supabase
      .from('email_templates')
      .update({ is_active: isActive })
      .eq('name', templateName)
      .select();

    if (updateError) {
      console.error('Error updating email template status:', updateError);
      console.error('Error details:', JSON.stringify(updateError, null, 2));
      return res.status(500).json({ error: 'Failed to update email template status' });
    }

    console.log('Successfully updated email template status for:', templateName);
    console.log('Updated data:', JSON.stringify(updateData, null, 2));
    
    if (!updateData || updateData.length === 0) {
      console.warn('No email templates were updated - template might not exist');
      return res.status(404).json({ error: 'Email template not found' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Email template status updated successfully',
      data: updateData
    });

  } catch (error) {
    console.error('Email template status update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to create a single user
async function createSingleUser({
  fullName,
  email,
  password,
  companyName,
  systemRole,
  userType,
  registrationSlots,
  mobile = null,
  preferredName = null,
  hasAccess = false,
  partnershipType = null
}) {
  // Step 1: Create user in Supabase Auth using admin API
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      full_name: fullName,
      company_name: companyName
    }
  });

  if (authError) {
    throw new Error(`Failed to create user account: ${authError.message}`);
  }

  if (!authData.user) {
    throw new Error('Failed to create user account');
  }

  // Step 2: Create user record in users table
  const userData = {
    id: authData.user.id,
    email: email,
    full_name: fullName,
    preferred_name: preferredName || fullName,
    company_name: companyName, // Keep for backward compatibility (first company)
    mobile: mobile,
    system_role: systemRole,
    user_type: userType || 'N/A',
    registration_slots: registrationSlots || {
      VIP: 0,
      Partner: 0,
      Exhibitor: 0,
      Media: 0
    },
    used_slots: {
      VIP: 0,
      Partner: 0,
      Exhibitor: 0,
      Media: 0
    },
    has_access: systemRole === 'Admin' ? true : (systemRole === 'Super User' ? hasAccess : false),
    account_status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .insert([userData])
    .select()
    .single();

  if (userError) {
    // If user record creation fails, clean up the auth user
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error(`Failed to create user record: ${userError.message}`);
  }

  // Step 3: Create user_companies relationship
  const partnershipTypeValue = partnershipType || userType || 'N/A';
  const { error: companyError } = await supabase
    .from('user_companies')
    .insert([{
      user_id: userRecord.id,
      company_name: companyName,
      partnership_type: partnershipTypeValue,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }]);

  if (companyError) {
    console.error('Error creating user_companies record:', companyError);
    // Don't fail the entire operation if company relationship fails, but log it
  }

  return {
    user: userRecord,
    authUser: authData.user
  };
}

// Create user endpoint - supports both single user and multiple companies/users
app.post('/api/create-user', async (req, res) => {
  try {
    const { 
      fullName, 
      email, 
      password, 
      companyName, 
      systemRole, 
      userType, 
      registrationSlots,
      mobile = null,
      preferredName = null,
      hasAccess = false,
      // New format for multiple companies/users
      companies = null
    } = req.body;

    // Check if using new format (companies array) or old format (single user)
    if (companies && Array.isArray(companies) && companies.length > 0) {
      // New format: multiple companies with multiple users
      if (!systemRole) {
        return res.status(400).json({ 
          error: 'Missing required field: systemRole' 
        });
      }

      const createdUsers = [];
      const errors = [];

      // Process each company
      for (const company of companies) {
        if (!company.companyName || !company.users || !Array.isArray(company.users) || company.users.length === 0) {
          errors.push(`Invalid company data: companyName and users array required`);
          continue;
        }

        // Process each user in the company
        for (const userData of company.users) {
          if (!userData.fullName || !userData.email || !userData.password) {
            errors.push(`Invalid user data for company ${company.companyName}: fullName, email, and password required`);
            continue;
          }

          try {
            const result = await createSingleUser({
              fullName: userData.fullName,
              email: userData.email,
              password: userData.password,
              companyName: company.companyName,
              systemRole: systemRole,
              userType: userData.partnershipType || userType || 'N/A',
              registrationSlots: userData.registrationSlots || registrationSlots,
              mobile: userData.mobile || mobile,
              preferredName: userData.preferredName || userData.fullName,
              hasAccess: hasAccess,
              partnershipType: userData.partnershipType
            });
            createdUsers.push(result);
          } catch (error) {
            errors.push(`Failed to create user ${userData.email}: ${error.message}`);
            // Continue with other users even if one fails
          }
        }
      }

      if (createdUsers.length === 0) {
        return res.status(400).json({ 
          error: 'Failed to create any users',
          details: errors
        });
      }

      return res.status(200).json({ 
        success: true,
        users: createdUsers.map(r => r.user),
        message: `Successfully created ${createdUsers.length} user(s)`,
        errors: errors.length > 0 ? errors : undefined
      });

    } else {
      // Old format: single user (backward compatibility)
      if (!fullName || !email || !password || !companyName || !systemRole) {
        return res.status(400).json({ 
          error: 'Missing required fields: fullName, email, password, companyName, systemRole' 
        });
      }

      const result = await createSingleUser({
        fullName,
        email,
        password,
        companyName,
        systemRole,
        userType,
        registrationSlots,
        mobile,
        preferredName,
        hasAccess,
        partnershipType: userType
      });

      return res.status(200).json({ 
        success: true,
        user: result.user,
        authUser: result.authUser,
        message: 'User created successfully'
      });
    }

  } catch (error) {
    console.error('Error in create-user API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Delete user endpoint
app.delete('/api/delete-user', async (req, res) => {
  try {
    const { userId } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ 
        error: 'Missing required field: userId' 
      });
    }

    // Step 1: Delete all related records first (to handle foreign key constraints)
    
    // Delete notifications
    const { error: notificationError } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (notificationError) {
      console.error('Error deleting notifications:', notificationError);
      // Continue with deletion even if notifications fail
    }

    // Delete OTPs
    const { error: otpError } = await supabase
      .from('otps')
      .delete()
      .eq('user_id', userId);

    if (otpError) {
      console.error('Error deleting OTPs:', otpError);
      // Continue with deletion even if OTPs fail
    }

    // Delete slot requests where user is the requester
    const { error: slotRequestError } = await supabase
      .from('slot_requests')
      .delete()
      .eq('user_id', userId);

    if (slotRequestError) {
      console.error('Error deleting slot requests:', slotRequestError);
      // Continue with deletion even if slot requests fail
    }

    // Update slot requests where user is the reviewer (set reviewed_by to null)
    const { error: slotRequestReviewerError } = await supabase
      .from('slot_requests')
      .update({ reviewed_by: null })
      .eq('reviewed_by', userId);

    if (slotRequestReviewerError) {
      console.error('Error updating slot requests reviewed_by:', slotRequestReviewerError);
      // Continue with deletion even if update fails
    }

    // Update attendees to remove registered_by reference (set to null)
    const { error: attendeeError } = await supabase
      .from('attendees')
      .update({ registered_by: null })
      .eq('registered_by', userId);

    if (attendeeError) {
      console.error('Error updating attendees:', attendeeError);
      // Continue with deletion even if attendee update fails
    }

    // Step 2: Delete user record from users table
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (userError) {
      console.error('Error deleting user record:', userError);
      return res.status(400).json({ 
        error: `Failed to delete user record: ${userError.message}` 
      });
    }

    // Step 3: Delete user from Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Error deleting auth user:', authError);
      // Note: User record is already deleted, but auth user deletion failed
      // This is not ideal but we'll continue
      console.warn('User record deleted but auth user deletion failed');
    }

    return res.status(200).json({ 
      success: true,
      message: 'User deleted successfully from both database and authentication'
    });

  } catch (error) {
    console.error('Error in delete-user API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Verify Turnstile endpoint
app.post('/api/verify-turnstile', async (req, res) => {
  try {
    const { token, remoteip } = req.body;

    // Validate required fields
    if (!token) {
      return res.status(400).json({ 
        error: 'Missing required field: token' 
      });
    }

    const SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

    if (!SECRET_KEY) {
      console.error('TURNSTILE_SECRET_KEY not configured');
      return res.status(500).json({ 
        error: 'Turnstile not configured' 
      });
    }

    // In development mode, allow bypassing Turnstile verification
    if (process.env.NODE_ENV === 'development' && process.env.TURNSTILE_BYPASS === 'true') {
      console.log('🔧 Development mode: Bypassing Turnstile verification');
      return res.status(200).json({ 
        success: true,
        challenge_ts: new Date().toISOString(),
        hostname: 'localhost',
        action: 'development-bypass',
        cdata: 'development-mode'
      });
    }

    // Prepare form data for Siteverify API
    const formData = new FormData();
    formData.append('secret', SECRET_KEY);
    formData.append('response', token);
    
    if (remoteip) {
      formData.append('remoteip', remoteip);
    }

    // Retry logic for network issues
    let lastError;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempting Turnstile verification (attempt ${attempt}/${maxRetries})`);
        
        // Call Cloudflare's Siteverify API with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
          headers: {
            'User-Agent': 'FMF-Private-Invitation/1.0'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`Turnstile API error (attempt ${attempt}):`, response.status, response.statusText);
          if (attempt === maxRetries) {
            return res.status(500).json({ 
              error: 'Turnstile validation failed',
              details: `API returned ${response.status}: ${response.statusText}`
            });
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }

        const result = await response.json();

        if (result.success) {
          console.log('✅ Turnstile verification successful');
          return res.status(200).json({ 
            success: true,
            challenge_ts: result.challenge_ts,
            hostname: result.hostname,
            action: result.action,
            cdata: result.cdata
          });
        } else {
          console.error(`Turnstile validation failed (attempt ${attempt}):`, result['error-codes']);
          if (attempt === maxRetries) {
            return res.status(400).json({ 
              success: false,
              error: 'Turnstile validation failed',
              'error-codes': result['error-codes'] || ['unknown-error']
            });
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }

      } catch (fetchError) {
        lastError = fetchError;
        console.error(`Network error on attempt ${attempt}:`, fetchError.message);
        
        if (attempt === maxRetries) {
          // If all retries failed, provide a helpful error message
          if (fetchError.name === 'AbortError') {
            return res.status(500).json({ 
              error: 'Turnstile verification timeout',
              details: 'The request to Cloudflare took too long. This might be due to network issues or Cloudflare being temporarily unavailable.',
              suggestion: 'Try again in a few moments or check your internet connection.'
            });
          } else if (fetchError.code === 'ETIMEDOUT' || fetchError.message.includes('timeout')) {
            return res.status(500).json({ 
              error: 'Turnstile verification timeout',
              details: 'Unable to reach Cloudflare\'s verification service. This might be due to network connectivity issues.',
              suggestion: 'Check your internet connection and try again. If the problem persists, contact your network administrator.'
            });
          } else {
            return res.status(500).json({ 
              error: 'Turnstile verification failed',
              details: fetchError.message,
              suggestion: 'This might be a temporary network issue. Please try again.'
            });
          }
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }

    // This should never be reached, but just in case
    return res.status(500).json({ 
      error: 'Turnstile verification failed after all retries',
      details: lastError?.message || 'Unknown error'
    });

  } catch (error) {
    console.error('Error in verify-turnstile API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Development server running on http://localhost:${PORT}`);
  console.log(`📧 Email API available at http://localhost:${PORT}/api/send-email`);
  console.log(`🔐 Password update API available at http://localhost:${PORT}/api/update-password`);
  console.log(`👤 User creation API available at http://localhost:${PORT}/api/create-user`);
  console.log(`🗑️ User deletion API available at http://localhost:${PORT}/api/delete-user`);
  console.log(`🛡️ Turnstile verification API available at http://localhost:${PORT}/api/verify-turnstile`);
  console.log(`🔄 Update is_reset field API available at http://localhost:${PORT}/api/update-is-reset`);
  console.log(`🔑 Update user access API available at http://localhost:${PORT}/api/update-user-access`);
  console.log(`📝 Update email template status API available at http://localhost:${PORT}/api/update-email-template-status`);
  
  if (!sendGridConfig.apiKey) {
    console.log('⚠️  SendGrid API key not configured - emails will be simulated');
  } else {
    console.log(`✅ SendGrid configured with from address: ${sendGridConfig.from}`);
  }
});
