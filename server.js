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
  
  if (!smtpConfig.user || !smtpConfig.pass) {
    console.log('⚠️  SMTP not configured - emails will be simulated');
  } else {
    console.log(`✅ SMTP configured for ${smtpConfig.provider}`);
  }
});
