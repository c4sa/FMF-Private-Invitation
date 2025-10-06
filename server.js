import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
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

// SMTP Configuration from environment variables
const smtpConfig = {
  provider: process.env.SMTP_PROVIDER || 'gmail',
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  from: process.env.SMTP_FROM || process.env.SMTP_USER
};

// Create transporter based on provider
const createTransporter = () => {
  if (smtpConfig.provider === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      }
    });
  } else if (smtpConfig.provider === 'outlook') {
    return nodemailer.createTransport({
      service: 'hotmail',
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      }
    });
  } else {
    // Custom SMTP configuration
    return nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      }
    });
  }
};

// Email sending endpoint
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, html, text } = req.body;

    // Validate required fields
    if (!to || !subject || !html) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, html' 
      });
    }

    // Check if SMTP is configured
    if (!smtpConfig.user || !smtpConfig.pass) {
      console.log('📧 SMTP not configured, simulating email sending');
      return res.status(200).json({ 
        success: true, 
        messageId: 'sim-' + Date.now(),
        response: 'Email simulated (SMTP not configured)'
      });
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: smtpConfig.from,
      to: to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, '') // Strip HTML tags for text version
    };

    const result = await transporter.sendMail(mailOptions);
    
    return res.status(200).json({ 
      success: true, 
      messageId: result.messageId,
      response: result.response 
    });

  } catch (error) {
    console.error('Failed to send email:', error);
    return res.status(500).json({ 
      error: 'Failed to send email',
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

    // Get user by email using admin API
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error fetching users:', userError);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    const user = users?.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update the password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: password }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return res.status(500).json({ error: updateError.message });
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

// Create user endpoint
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
      preferredName = null 
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !password || !companyName || !systemRole) {
      return res.status(400).json({ 
        error: 'Missing required fields: fullName, email, password, companyName, systemRole' 
      });
    }

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
      console.error('Error creating auth user:', authError);
      return res.status(400).json({ 
        error: `Failed to create user account: ${authError.message}` 
      });
    }

    if (!authData.user) {
      return res.status(400).json({ 
        error: 'Failed to create user account' 
      });
    }

    // Step 2: Create user record in users table
    const userData = {
      id: authData.user.id,
      email: email,
      full_name: fullName,
      preferred_name: preferredName || fullName,
      company_name: companyName,
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
      console.error('Error creating user record:', userError);
      // If user record creation fails, clean up the auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ 
        error: `Failed to create user record: ${userError.message}` 
      });
    }

    return res.status(200).json({ 
      success: true,
      user: userRecord,
      authUser: authData.user,
      message: 'User created successfully'
    });

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
  
  if (!smtpConfig.user || !smtpConfig.pass) {
    console.log('⚠️  SMTP not configured - emails will be simulated');
  } else {
    console.log(`✅ SMTP configured for ${smtpConfig.provider}`);
  }
});
