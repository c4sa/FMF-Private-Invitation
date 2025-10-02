import nodemailer from 'nodemailer';

// Test SMTP connection
async function testSMTP() {
  console.log('Testing SMTP connection...');
  
  // Configuration from your .env
  const config = {
    host: 'mail.futuremineralsforum.com.sa',
    port: 465,
    secure: true, // SSL/TLS for port 465
    auth: {
      user: 'noreply@futuremineralsforum.com.sa',
      pass: 'Core@Code25'
    }
  };
  
  console.log('Config:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user
  });
  
  try {
    // Create transporter
    const transporter = nodemailer.createTransport(config);
    
    // Verify connection
    console.log('Verifying SMTP connection...');
    const verified = await transporter.verify();
    
    if (verified) {
      console.log('✅ SMTP connection successful!');
      
      // Test sending an email
      console.log('Testing email send...');
      const result = await transporter.sendMail({
        from: 'noreply@futuremineralsforum.com.sa',
        to: 'test@example.com',
        subject: 'SMTP Test',
        text: 'This is a test email from Future Minerals Forum SMTP'
      });
      
      console.log('✅ Email sent successfully!');
      console.log('Message ID:', result.messageId);
      
    } else {
      console.log('❌ SMTP verification failed');
    }
    
  } catch (error) {
    console.error('❌ SMTP Error:', error.message);
    console.error('Error code:', error.code);
    console.error('Error syscall:', error.syscall);
    
    // Try alternative configurations
    console.log('\nTrying alternative configurations...');
    
    // Try port 587 with STARTTLS
    try {
      console.log('Trying port 587 with STARTTLS...');
      const altConfig = {
        host: 'mail.futuremineralsforum.com.sa',
        port: 587,
        secure: false,
        auth: {
          user: 'noreply@futuremineralsforum.com.sa',
          pass: 'Core@Code25'
        }
      };
      
      const altTransporter = nodemailer.createTransport(altConfig);
      const altVerified = await altTransporter.verify();
      
      if (altVerified) {
        console.log('✅ Alternative SMTP connection successful on port 587!');
      }
      
    } catch (altError) {
      console.error('❌ Alternative SMTP also failed:', altError.message);
    }
  }
}

testSMTP();
