import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, full_name, company_name } = req.body;

    if (!email || !password || !full_name || !company_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create user in Supabase Auth using admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: full_name,
        company_name: company_name
      }
    });

    if (authError) {
      console.error('Auth creation error:', authError);
      return res.status(400).json({ error: authError.message });
    }

    if (!authData.user) {
      return res.status(400).json({ error: 'Failed to create user account' });
    }

    // Return user data for profile creation
    res.status(200).json({
      user: authData.user,
      success: true
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
