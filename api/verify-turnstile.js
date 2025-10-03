export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.body;

    // Validate required fields
    if (!token) {
      return res.status(400).json({ 
        error: 'Missing required field: token' 
      });
    }

    const secretKey = process.env.TURNSTILE_SECRET_KEY;
    
    if (!secretKey) {
      console.error('TURNSTILE_SECRET_KEY not configured');
      return res.status(500).json({ 
        error: 'Turnstile verification not configured' 
      });
    }

    // Verify the token with Cloudflare Turnstile
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      console.error('Turnstile verification failed:', result);
      return res.status(400).json({ 
        error: 'Verification failed',
        details: result['error-codes'] || ['Unknown error']
      });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Verification successful'
    });

  } catch (error) {
    console.error('Error in verify-turnstile API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
