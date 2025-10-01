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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Development server running on http://localhost:${PORT}`);
  console.log(`📧 Email API available at http://localhost:${PORT}/api/send-email`);
  console.log(`🔐 Password update API available at http://localhost:${PORT}/api/update-password`);
  
  if (!smtpConfig.user || !smtpConfig.pass) {
    console.log('⚠️  SMTP not configured - emails will be simulated');
  } else {
    console.log(`✅ SMTP configured for ${smtpConfig.provider}`);
  }
});
