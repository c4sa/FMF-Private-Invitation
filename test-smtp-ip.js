import nodemailer from 'nodemailer';

// Test SMTP with IP address (if you have it)
async function testSMTPWithIP() {
  console.log('Testing SMTP with IP address...');
  
  // You need to provide the actual IP address of your mail server
  // Common mail server IPs to try (replace with actual IP):
  const possibleIPs = [
    // '192.168.1.100',  // Replace with actual mail server IP
    // '10.0.0.100',     // Replace with actual mail server IP
    // Add your actual mail server IP here
  ];
  
  for (const ip of possibleIPs) {
    console.log(`\nTrying IP: ${ip}`);
    
    const config = {
      host: ip,
      port: 465,
      secure: true,
      auth: {
        user: 'noreply@futuremineralsforum.com.sa',
        pass: 'Core@Code25'
      }
    };
    
    try {
      const transporter = nodemailer.createTransport(config);
      const verified = await transporter.verify();
      
      if (verified) {
        console.log(`✅ SMTP connection successful with IP: ${ip}`);
        return ip;
      }
    } catch (error) {
      console.log(`❌ Failed with IP ${ip}:`, error.message);
    }
  }
  
  console.log('❌ No working IP found');
  return null;
}

testSMTPWithIP();
