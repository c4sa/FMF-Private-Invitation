// Email service using serverless API endpoint
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

// Development fallback - simulate email sending
const simulateEmailSending = async ({ to, subject, html, text, bcc }) => {
  console.log('📧 Simulating email sending (development mode):');
  console.log('To:', to);
  if (bcc) {
    console.log('BCC:', Array.isArray(bcc) ? bcc.join(', ') : bcc);
  }
  console.log('Subject:', subject);
  console.log('HTML Preview:', html.substring(0, 100) + '...');
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    success: true,
    messageId: 'dev-' + Date.now(),
    response: 'Email simulated in development mode'
  };
};

// Email service functions
export const emailService = {
  // Generic send function for all emails
  async send({ to, subject, html, text, bcc }) {
    try {
      // Try to use the API endpoint first
      const response = await fetch(`${API_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          subject,
          html,
          text,
          bcc
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.warn('API endpoint failed, falling back to simulation:', error.message);
      
      // Check if it's a network error (server not running or CORS issue)
      if (error.message.includes('Failed to fetch') || error.message.includes('404') || error.message.includes('CORS')) {
        console.log('🔧 API endpoint not available. Starting simulation mode...');
      }
      
      // Fallback to simulation in both development and production
      return await simulateEmailSending({ to, subject, html, text, bcc });
    }
  },

  // Send welcome email
  async sendWelcomeEmail({ to, subject, html, bcc }) {
    try {
      const result = await this.send({
        to: to,
        subject: subject || 'Welcome to Future Minerals Forum',
        html: html,
        bcc: bcc
      });
      
      return result;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }
  },

  // Send invitation email
  async sendInvitationEmail({ to, subject, html, bcc }) {
    try {
      const result = await this.send({
        to: to,
        subject: subject || 'Invitation to Future Minerals Forum',
        html: html,
        bcc: bcc
      });
      
      return result;
    } catch (error) {
      console.error('Error sending invitation email:', error);
      throw error;
    }
  },

  // Send modification request email
  async sendModificationRequestEmail({ to, subject, html, bcc }) {
    try {
      const result = await this.send({
        to: to,
        subject: subject || 'Action Required: Modify Your Future Minerals Forum Registration',
        html: html,
        bcc: bcc
      });
      
      return result;
    } catch (error) {
      console.error('Error sending modification request email:', error);
      throw error;
    }
  },

  // Send password reset email
  async sendPasswordResetEmail({ to, subject, html, bcc }) {
    try {
      const result = await this.send({
        to: to,
        subject: subject || 'Password Reset Instructions',
        html: html,
        bcc: bcc
      });
      
      return result;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  },

  // Send new user request email
  async sendNewUserRequestEmail({ to, newUserData, subject, html }) {
    try {
      let emailSubject = subject;
      let emailHtml = html;
      
      // If subject and html are not provided, get from template
      if (!subject || !html) {
        const { supabase } = await import('../lib/supabase.js');
        
        const { data: templates, error: templateError } = await supabase
          .from('email_templates')
          .select('*')
          .eq('name', 'new_user_request')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);
        
        const template = templates?.[0];
        
        if (templateError || !template) {
          console.error('Error fetching new_user_request template:', templateError);
          throw new Error('New user request email template not found');
        }
        
        emailSubject = template.subject;
        emailHtml = template.body;
        
        // Replace template variables
        const variables = {
          '{{full_name}}': newUserData.full_name || '',
          '{{email}}': newUserData.email || '',
          '{{password}}': newUserData.password || '',
          '{{company_name}}': newUserData.company_name || '',
          '{{system_role}}': newUserData.system_role || '',
          '{{user_type}}': (newUserData.system_role === 'User') ? (newUserData.user_type || '') : ''
        };
        
        Object.entries(variables).forEach(([key, value]) => {
          emailSubject = emailSubject.replace(new RegExp(key, 'g'), value);
          emailHtml = emailHtml.replace(new RegExp(key, 'g'), value);
        });
        
        // Handle registration slots if present and user is of type 'User'
        if (newUserData.registration_slots && newUserData.system_role === 'User') {
          const slotsHtml = Object.entries(newUserData.registration_slots)
            .filter(([, value]) => value > 0) // Only include slots with values greater than 0
            .map(([key, value]) => `<p style="margin: 5px 0;"><strong>${key}:</strong> ${value}</p>`)
            .join('');
          emailHtml = emailHtml.replace(/{{#if registration_slots}}[\s\S]*?{{\/if}}/g, 
            slotsHtml ? `<div style="margin-top: 15px;"><h4 style="margin: 0 0 10px 0; color: #1f2937;">Registration Slots:</h4>${slotsHtml}</div>` : '');
        } else {
          emailHtml = emailHtml.replace(/{{#if registration_slots}}[\s\S]*?{{\/if}}/g, '');
        }
        
        // Parse BCC recipients from template
        const templateBcc = template.bcc_recipients 
          ? template.bcc_recipients.split(',').map(email => email.trim()).filter(Boolean)
          : null;
        
        const result = await this.send({
          to: to,
          subject: emailSubject,
          html: emailHtml,
          bcc: templateBcc
        });
        
        return result;
      } else {
        // If subject/html provided directly, send without BCC (or could add bcc parameter)
        const result = await this.send({
          to: to,
          subject: emailSubject,
          html: emailHtml
        });
        
        return result;
      }
    } catch (error) {
      console.error('Error sending new user request email:', error);
      throw error;
    }
  },

  // Send new user notification email
  async sendNewUserNotificationEmail({ to, newUserData, subject, html }) {
    try {
      let emailSubject = subject;
      let emailHtml = html;
      
      // If subject and html are not provided, get from template
      if (!subject || !html) {
        const { supabase } = await import('../lib/supabase.js');
        
        const { data: templates, error: templateError } = await supabase
          .from('email_templates')
          .select('*')
          .eq('name', 'new_user_notification')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);
        
        const template = templates?.[0];
        
        if (templateError || !template) {
          console.error('Error fetching new_user_notification template:', templateError);
          throw new Error('New user notification email template not found');
        }
        
        emailSubject = template.subject;
        emailHtml = template.body;
        
        // Replace template variables
        const variables = {
          '{{full_name}}': newUserData.full_name || '',
          '{{email}}': newUserData.email || '',
          '{{password}}': newUserData.password || '',
          '{{company_name}}': newUserData.company_name || '',
          '{{system_role}}': newUserData.system_role || '',
          '{{user_type}}': (newUserData.system_role === 'User') ? (newUserData.user_type || '') : ''
        };
        
        Object.entries(variables).forEach(([key, value]) => {
          emailSubject = emailSubject.replace(new RegExp(key, 'g'), value);
          emailHtml = emailHtml.replace(new RegExp(key, 'g'), value);
        });
        
        // Handle registration slots if present and user is of type 'User'
        if (newUserData.registration_slots && newUserData.system_role === 'User') {
          const slotsHtml = Object.entries(newUserData.registration_slots)
            .filter(([, value]) => value > 0) // Only include slots with values greater than 0
            .map(([key, value]) => `<p style="margin: 5px 0;"><strong>${key}:</strong> ${value}</p>`)
            .join('');
          emailHtml = emailHtml.replace(/{{#if registration_slots}}[\s\S]*?{{\/if}}/g, 
            slotsHtml ? `<div style="margin-top: 15px;"><h4 style="margin: 0 0 10px 0; color: #1f2937;">Registration Slots:</h4>${slotsHtml}</div>` : '');
        } else {
          emailHtml = emailHtml.replace(/{{#if registration_slots}}[\s\S]*?{{\/if}}/g, '');
        }
        
        // Parse BCC recipients from template
        const templateBcc = template.bcc_recipients 
          ? template.bcc_recipients.split(',').map(email => email.trim()).filter(Boolean)
          : null;
        
        const result = await this.send({
          to: to,
          subject: emailSubject,
          html: emailHtml,
          bcc: templateBcc
        });
        
        return result;
      } else {
        // If subject/html provided directly, send without BCC (or could add bcc parameter)
        const result = await this.send({
          to: to,
          subject: emailSubject,
          html: emailHtml
        });
        
        return result;
      }
    } catch (error) {
      console.error('Error sending new user notification email:', error);
      throw error;
    }
  }
};

export default emailService;