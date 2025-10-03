export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, remoteip } = req.body;

    // Validate required fields
    if (!token) {
      return res.status(400).json({ 
        error: 'Missing required field: token' 
      });
    }

    const SECRET_KEY = process.env.VITE_SECRET_KEY;

    if (!SECRET_KEY) {
      console.error('VITE_SECRET_KEY not configured');
      return res.status(500).json({ 
        error: 'Turnstile not configured' 
      });
    }

    // Prepare form data for Siteverify API
    const formData = new FormData();
    formData.append('secret', SECRET_KEY);
    formData.append('response', token);
    
    if (remoteip) {
      formData.append('remoteip', remoteip);
    }

    // Call Cloudflare's Siteverify API
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      console.error('Turnstile API error:', response.status, response.statusText);
      return res.status(500).json({ 
        error: 'Turnstile validation failed' 
      });
    }

    const result = await response.json();

    if (result.success) {
      return res.status(200).json({ 
        success: true,
        challenge_ts: result.challenge_ts,
        hostname: result.hostname,
        action: result.action,
        cdata: result.cdata
      });
    } else {
      return res.status(400).json({ 
        success: false,
        error: 'Turnstile validation failed',
        'error-codes': result['error-codes'] || ['unknown-error']
      });
    }

  } catch (error) {
    console.error('Error in verify-turnstile API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
