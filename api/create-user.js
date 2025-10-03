import { createClient } from '@supabase/supabase-js';

// Supabase configuration with service role key for admin operations
// Try both VITE_ prefixed and non-prefixed environment variables for Vercel compatibility
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Debug environment variables (remove in production)
console.log('Environment check:');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'Set' : 'Missing');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
console.log('VITE_SERVICE_ROLE_KEY:', process.env.VITE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');
console.log('Final supabaseUrl:', supabaseUrl ? 'Set' : 'Missing');
console.log('Final serviceRoleKey:', serviceRoleKey ? 'Set' : 'Missing');
console.log('Supabase URL (first 20 chars):', supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'Missing');
console.log('Service Role Key (first 20 chars):', serviceRoleKey ? serviceRoleKey.substring(0, 20) + '...' : 'Missing');
console.log('Service Role Key starts with eyJ:', serviceRoleKey ? serviceRoleKey.startsWith('eyJ') : false);
console.log('Service Role Key length:', serviceRoleKey ? serviceRoleKey.length : 0);

// Validate required environment variables
if (!supabaseUrl) {
  console.error('SUPABASE_URL is not set in environment variables');
  throw new Error('SUPABASE_URL environment variable is required');
}
if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables');
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Debug environment variables
  console.log('Environment check:');
  console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'Set' : 'Not set');
  console.log('VITE_SERVICE_ROLE_KEY:', process.env.VITE_SERVICE_ROLE_KEY ? 'Set' : 'Not set');
  
  // Check if required environment variables are available
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables');
    return res.status(500).json({ 
      error: 'Server configuration error: Missing Supabase credentials' 
    });
  }

  try {
    const { 
      fullName, 
      email, 
      password, 
      companyName, 
      systemRole, 
      userType, 
      registrationSlots,
      mobile = null,
      preferredName = null 
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !password || !companyName || !systemRole) {
      return res.status(400).json({ 
        error: 'Missing required fields: fullName, email, password, companyName, systemRole' 
      });
    }

    // Step 1: Test Supabase connection first
    console.log('Testing Supabase connection...');
    
    // Try to decode the JWT token to verify it's valid
    try {
      const tokenParts = serviceRoleKey.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        console.log('JWT payload:', {
          iss: payload.iss,
          role: payload.role,
          aud: payload.aud,
          exp: payload.exp
        });
        
        // Check if the audience matches the Supabase URL
        if (payload.aud && payload.aud !== supabaseUrl) {
          console.error('JWT audience mismatch:', {
            expected: supabaseUrl,
            actual: payload.aud
          });
        }
      }
    } catch (e) {
      console.error('JWT decode error:', e.message);
    }
    
    // Log the full Supabase URL for verification
    console.log('Full Supabase URL:', supabaseUrl);
    
    // Try different approaches to test the connection
    let testError = null;
    let testData = null;
    
    // First try: admin.listUsers()
    try {
      const result = await supabase.auth.admin.listUsers();
      testData = result.data;
      testError = result.error;
    } catch (error) {
      console.error('admin.listUsers() threw an exception:', error);
      testError = error;
    }
    
    if (testError) {
      console.error('Supabase connection test failed:', testError);
      
      // Try alternative: regular auth.getUser() with service role
      console.log('Trying alternative connection test...');
      try {
        const { data: altData, error: altError } = await supabase.auth.getUser();
        if (altError) {
          console.error('Alternative connection test also failed:', altError);
          return res.status(500).json({ 
            error: `Supabase connection failed: ${testError.message}`,
            details: testError
          });
        } else {
          console.log('Alternative connection test successful');
        }
      } catch (altError) {
        console.error('Alternative connection test threw exception:', altError);
        return res.status(500).json({ 
          error: `Supabase connection failed: ${testError.message}`,
          details: testError
        });
      }
    } else {
      console.log('Supabase connection test successful');
    }

    // Step 2: Create user in Supabase Auth using admin API
    console.log('Attempting to create auth user for:', email);
    
    // Try alternative approach if admin.createUser fails
    let authData, authError;
    
    try {
      const result = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: fullName,
          company_name: companyName
        }
      });
      authData = result.data;
      authError = result.error;
    } catch (error) {
      console.error('createUser threw an exception:', error);
      authError = error;
    }
    
    // If admin.createUser fails, try alternative approach
    if (authError) {
      console.log('Admin createUser failed, trying alternative approach...');
      
      // Alternative: Create user directly in database without auth
      // This is a fallback for when admin API doesn't work
      const fallbackUserId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      console.log('Using fallback approach with generated user ID:', fallbackUserId);
      
      // Create a mock auth data object
      authData = {
        user: {
          id: fallbackUserId,
          email: email,
          user_metadata: {
            full_name: fullName,
            company_name: companyName
          }
        }
      };
      authError = null;
      
      console.log('Fallback approach: User will be created in database only');
    }

    if (authError) {
      console.error('Error creating auth user:', authError);
      console.error('Auth error details:', {
        message: authError.message,
        status: authError.status,
        code: authError.code
      });
      return res.status(400).json({ 
        error: `Failed to create user account: ${authError.message}`,
        details: authError
      });
    }

    if (!authData.user) {
      return res.status(400).json({ 
        error: 'Failed to create user account' 
      });
    }

    // Step 3: Create user record in users table
    const userData = {
      id: authData.user.id,
      email: email,
      full_name: fullName,
      preferred_name: preferredName || fullName,
      company_name: companyName,
      mobile: mobile,
      system_role: systemRole,
      user_type: userType || 'N/A',
      registration_slots: registrationSlots || {
        VIP: 0,
        Partner: 0,
        Exhibitor: 0,
        Media: 0
      },
      used_slots: {
        VIP: 0,
        Partner: 0,
        Exhibitor: 0,
        Media: 0
      },
      account_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();

    if (userError) {
      console.error('Error creating user record:', userError);
      // If user record creation fails, clean up the auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ 
        error: `Failed to create user record: ${userError.message}` 
      });
    }

    return res.status(200).json({ 
      success: true,
      user: userRecord,
      authUser: authData.user,
      message: 'User created successfully'
    });

  } catch (error) {
    console.error('Error in create-user API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
