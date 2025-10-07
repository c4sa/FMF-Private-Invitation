import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SERVICE_ROLE_KEY;

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
      preferredName = null,
      hasAccess = false
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !password || !companyName || !systemRole) {
      return res.status(400).json({ 
        error: 'Missing required fields: fullName, email, password, companyName, systemRole' 
      });
    }

    // Step 1: Create user in Supabase Auth using admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
        company_name: companyName
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return res.status(400).json({ 
        error: `Failed to create user account: ${authError.message}` 
      });
    }

    if (!authData.user) {
      return res.status(400).json({ 
        error: 'Failed to create user account' 
      });
    }

    // Step 2: Create user record in users table
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
      has_access: systemRole === 'Admin' ? true : (systemRole === 'Super User' ? hasAccess : false),
      is_reset: false,
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
