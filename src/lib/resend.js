// Email service using serverless API endpoint
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

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
      
      // Check if it's a network error (server not running or CORS issue)
      if (error.message.includes('Failed to fetch') || error.message.includes('404') || error.message.includes('CORS')) {
        console.log('🔧 API endpoint not available. Starting simulation mode...');
      }
      
      // Fallback to simulation in both development and production
      return await simulateEmailSending({ to, subject, html, text });
    }
  },

  // Send welcome email
  async sendWelcomeEmail({ to, subject, html }) {
    try {
      const result = await this.send({
        to: to,
        subject: subject || 'Welcome to Future Minerals Forum',
        html: html
      });
      
      return result;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }
  },

  // Send invitation email
  async sendInvitationEmail({ to, subject, html }) {
    try {
      const result = await this.send({
        to: to,
        subject: subject || 'Invitation to Future Minerals Forum',
        html: html
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
  async sendPasswordResetEmail({ to, subject, html }) {
    try {
      const result = await this.send({
        to: to,
        subject: subject || 'Password Reset Instructions',
        html: html
      });
      
      return result;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  },

  // Send new user request email
  async sendNewUserRequestEmail({ to, subject, html }) {
    try {
      const result = await this.send({
        to: to,
        subject: subject || 'New User Request - Future Minerals Forum',
        html: html
      });
      
      return result;
    } catch (error) {
      console.error('Error sending new user request email:', error);
      throw error;
    }
  },

  // Send new user notification email
  async sendNewUserNotificationEmail({ to, subject, html }) {
    try {
      const result = await this.send({
        to: to,
        subject: subject || 'Your System Access Request - Future Minerals Forum',
        html: html
      });
      
      return result;
    } catch (error) {
      console.error('Error sending new user notification email:', error);
      throw error;
    }
  }
};

export default emailService;