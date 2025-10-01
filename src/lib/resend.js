// Email service using serverless API endpoint
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Development fallback - simulate email sending
const simulateEmailSending = async ({ to, subject, html, text }) => {
  console.log('📧 Simulating email sending (development mode):');
  console.log('To:', to);
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
  async send({ to, subject, html, text }) {
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
          text
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.warn('API endpoint failed, falling back to simulation:', error.message);
      
      // Check if it's a network error (server not running)
      if (error.message.includes('Failed to fetch') || error.message.includes('404')) {
        console.log('🔧 Development server not running. Starting simulation mode...');
      }
      
      // Fallback to simulation in development
      if (import.meta.env.DEV) {
        return await simulateEmailSending({ to, subject, html, text });
      }
      
      // In production, re-throw the error
      throw new Error(`Failed to send email: ${error.message}`);
    }
  },

  // Send welcome email
  async sendWelcomeEmail({ to, subject, html, attendeeData }) {
    try {
      const result = await this.send({
        to: to,
        subject: subject || 'Welcome to Future Minerals Forum',
        html: html || this.getWelcomeEmailTemplate(attendeeData)
      });
      
      return result;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }
  },

  // Send invitation email
  async sendInvitationEmail({ to, subject, html, invitationCode }) {
    try {
      const result = await this.send({
        to: to,
        subject: subject || 'Invitation to Future Minerals Forum',
        html: html || this.getInvitationEmailTemplate(invitationCode)
      });
      
      return result;
    } catch (error) {
      console.error('Error sending invitation email:', error);
      throw error;
    }
  },

  // Send modification request email
  async sendModificationRequestEmail({ to, subject, html }) {
    try {
      const result = await this.send({
        to: to,
        subject: subject || 'Action Required: Modify Your Future Minerals Forum Registration',
        html: html
      });
      
      return result;
    } catch (error) {
      console.error('Error sending modification request email:', error);
      throw error;
    }
  },

  // Send password reset email
  async sendPasswordResetEmail({ to, resetUrl }) {
    try {
      const result = await this.send({
        to: to,
        subject: 'Password Reset Instructions',
        html: this.getPasswordResetTemplate(resetUrl)
      });
      
      return result;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  },

  // Send new user request email
  async sendNewUserRequestEmail({ to, newUserData }) {
    try {
      const result = await this.send({
        to: to,
        subject: 'New User Request - Future Minerals Forum',
        html: this.getNewUserRequestTemplate(newUserData)
      });
      
      return result;
    } catch (error) {
      console.error('Error sending new user request email:', error);
      throw error;
    }
  },

  // Get welcome email template
  getWelcomeEmailTemplate(attendeeData) {
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: #ffffff; padding: 20px; border-bottom: 1px solid #e5e7eb;">
          <img src="https://your-domain.com/logo.png" alt="Future Minerals Forum" style="height: 60px; width: auto;" />
        </div>
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Registration Approved!</h1>
          <p style="color: #d1fae5; margin: 10px 0 0 0; font-size: 16px;">Welcome to the Future Minerals Forum</p>
        </div>
        <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 18px; margin-bottom: 20px;">Dear ${attendeeData?.first_name || ''} ${attendeeData?.last_name || ''},</p>
          <p style="margin-bottom: 20px;">Congratulations! Your registration for the Future Minerals Forum has been approved.</p>
          <p style="margin-bottom: 20px;">We are excited to have you join us for this prestigious event.</p>
          <p style="margin-bottom: 0;">Best regards,<br><strong>Future Minerals Forum Team</strong></p>
        </div>
      </div>
    `;
  },

  // Get invitation email template
  getInvitationEmailTemplate(invitationCode) {
    const invitationUrl = `${window.location.origin}/PublicRegistration?invitation_code=${invitationCode}`;
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: #ffffff; padding: 20px; border-bottom: 1px solid #e5e7eb;">
          <img src="https://your-domain.com/logo.png" alt="Future Minerals Forum" style="height: 60px; width: auto;" />
        </div>
        <div style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">You're Invited!</h1>
          <p style="color: #dbeafe; margin: 10px 0 0 0; font-size: 16px;">Join us at the Future Minerals Forum</p>
        </div>
        <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 18px; margin-bottom: 20px;">Dear Friend,</p>
          <p style="margin-bottom: 20px;">You have been invited to register for the Future Minerals Forum.</p>
          <div style="text-align: center; margin: 40px 0;">
            <a href="${invitationUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Register Now
            </a>
          </div>
          <p style="margin-bottom: 0;">Best regards,<br><strong>Future Minerals Forum Team</strong></p>
        </div>
      </div>
    `;
  },

  // Get password reset template
  getPasswordResetTemplate(resetUrl) {
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: #ffffff; padding: 20px; border-bottom: 1px solid #e5e7eb;">
          <img src="https://your-domain.com/logo.png" alt="Future Minerals Forum" style="height: 60px; width: auto;" />
        </div>
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Password Reset</h1>
          <p style="color: #e9d5ff; margin: 10px 0 0 0; font-size: 16px;">Reset your Future Minerals Forum password</p>
        </div>
        <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 18px; margin-bottom: 20px;">Dear User,</p>
          <p style="margin-bottom: 20px;">You have requested to reset your password for the Future Minerals Forum system.</p>
          <div style="text-align: center; margin: 40px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Reset Password
            </a>
          </div>
          <p style="margin-bottom: 20px;">If you did not request this password reset, please ignore this email.</p>
          <p style="margin-bottom: 0;">Best regards,<br><strong>Future Minerals Forum Team</strong></p>
        </div>
      </div>
    `;
  },

  // Get new user request template
  getNewUserRequestTemplate(newUserData) {
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: #ffffff; padding: 20px; border-bottom: 1px solid #e5e7eb;">
          <img src="https://your-domain.com/logo.png" alt="Future Minerals Forum" style="height: 60px; width: auto;" />
        </div>
        <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">New User Request</h1>
          <p style="color: #fecaca; margin: 10px 0 0 0; font-size: 16px;">A new user has been requested for the system</p>
        </div>
        <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 18px; margin-bottom: 20px;">Dear Administrator,</p>
          <p style="margin-bottom: 20px;">A new user has been requested for the Future Minerals Forum system.</p>
          
          <div style="background: #f8fafc; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <h3 style="margin: 0 0 15px 0; color: #1f2937;">User Details:</h3>
            <p><strong>Full Name:</strong> ${newUserData.full_name}</p>
            <p><strong>Email:</strong> ${newUserData.email}</p>
            <p><strong>Company:</strong> ${newUserData.company_name}</p>
            <p><strong>User Type:</strong> ${newUserData.System_user_type}</p>
          </div>
          
          <p style="margin-bottom: 20px;">Please review and approve this user request in the system.</p>
          <p style="margin-bottom: 0;">Best regards,<br><strong>Future Minerals Forum System</strong></p>
        </div>
      </div>
    `;
  }
};

export default emailService;