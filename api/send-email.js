import sgMail from '@sendgrid/mail';

// SendGrid Configuration from environment variables
const sendGridConfig = {
  apiKey: process.env.SENDGRID_API_KEY,
  from: process.env.SMTP_FROM || process.env.SENDGRID_FROM || 'noreply@example.com'
};

// Initialize SendGrid with API key
if (sendGridConfig.apiKey) {
  sgMail.setApiKey(sendGridConfig.apiKey);
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, html, text } = req.body;

    // Validate required fields
    if (!to || !subject || !html) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, html' 
      });
    }

    // Check if SendGrid API key is configured
    if (!sendGridConfig.apiKey) {
      console.log('📧 SendGrid API key not configured, simulating email sending');
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
}
