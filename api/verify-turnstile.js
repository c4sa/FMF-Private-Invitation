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

    const SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

    if (!SECRET_KEY) {
      console.error('TURNSTILE_SECRET_KEY not configured');
      return res.status(500).json({ 
        error: 'Turnstile not configured' 
      });
    }

    // In development mode, allow bypassing Turnstile verification
    if (process.env.NODE_ENV === 'development' && process.env.TURNSTILE_BYPASS === 'true') {
      console.log('🔧 Development mode: Bypassing Turnstile verification');
      return res.status(200).json({ 
        success: true,
        challenge_ts: new Date().toISOString(),
        hostname: 'localhost',
        action: 'development-bypass',
        cdata: 'development-mode'
      });
    }

    // Prepare form data for Siteverify API
    const formData = new FormData();
    formData.append('secret', SECRET_KEY);
    formData.append('response', token);
    
    if (remoteip) {
      formData.append('remoteip', remoteip);
    }

    // Retry logic for network issues
    let lastError;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempting Turnstile verification (attempt ${attempt}/${maxRetries})`);
        
        // Call Cloudflare's Siteverify API with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
          headers: {
            'User-Agent': 'FMF-Private-Invitation/1.0'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`Turnstile API error (attempt ${attempt}):`, response.status, response.statusText);
          if (attempt === maxRetries) {
            return res.status(500).json({ 
              error: 'Turnstile validation failed',
              details: `API returned ${response.status}: ${response.statusText}`
            });
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }

        const result = await response.json();

        if (result.success) {
          console.log('✅ Turnstile verification successful');
          return res.status(200).json({ 
            success: true,
            challenge_ts: result.challenge_ts,
            hostname: result.hostname,
            action: result.action,
            cdata: result.cdata
          });
        } else {
          console.error(`Turnstile validation failed (attempt ${attempt}):`, result['error-codes']);
          if (attempt === maxRetries) {
            return res.status(400).json({ 
              success: false,
              error: 'Turnstile validation failed',
              'error-codes': result['error-codes'] || ['unknown-error']
            });
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }

      } catch (fetchError) {
        lastError = fetchError;
        console.error(`Network error on attempt ${attempt}:`, fetchError.message);
        
        if (attempt === maxRetries) {
          // If all retries failed, provide a helpful error message
          if (fetchError.name === 'AbortError') {
            return res.status(500).json({ 
              error: 'Turnstile verification timeout',
              details: 'The request to Cloudflare took too long. This might be due to network issues or Cloudflare being temporarily unavailable.',
              suggestion: 'Try again in a few moments or check your internet connection.'
            });
          } else if (fetchError.code === 'ETIMEDOUT' || fetchError.message.includes('timeout')) {
            return res.status(500).json({ 
              error: 'Turnstile verification timeout',
              details: 'Unable to reach Cloudflare\'s verification service. This might be due to network connectivity issues.',
              suggestion: 'Check your internet connection and try again. If the problem persists, contact your network administrator.'
            });
          } else {
            return res.status(500).json({ 
              error: 'Turnstile verification failed',
              details: fetchError.message,
              suggestion: 'This might be a temporary network issue. Please try again.'
            });
          }
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }

    // This should never be reached, but just in case
    return res.status(500).json({ 
      error: 'Turnstile verification failed after all retries',
      details: lastError?.message || 'Unknown error'
    });

  } catch (error) {
    console.error('Error in verify-turnstile API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
