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

// Helper function to create a single user
async function createSingleUser({
  fullName,
  email,
  password,
  companyName,
  systemRole,
  userType,
  registrationSlots,
  mobile = null,
  preferredName = null,
  hasAccess = false,
  partnershipType = null
}) {
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
    throw new Error(`Failed to create user account: ${authError.message}`);
  }

  if (!authData.user) {
    throw new Error('Failed to create user account');
  }

  // Step 2: Create user record in users table
  const userData = {
    id: authData.user.id,
    email: email,
    full_name: fullName,
    preferred_name: preferredName || fullName,
    company_name: companyName, // Keep for backward compatibility (first company)
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
    // If user record creation fails, clean up the auth user
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error(`Failed to create user record: ${userError.message}`);
  }

  // Step 3: Create user_companies relationship
  const partnershipTypeValue = partnershipType || userType || 'N/A';
  const { error: companyError } = await supabase
    .from('user_companies')
    .insert([{
      user_id: userRecord.id,
      company_name: companyName,
      partnership_type: partnershipTypeValue,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }]);

  if (companyError) {
    console.error('Error creating user_companies record:', companyError);
    // Don't fail the entire operation if company relationship fails, but log it
  }

  return {
    user: userRecord,
    authUser: authData.user
  };
}

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
      hasAccess = false,
      // New format for multiple companies/users
      companies = null
    } = req.body;

    // Check if using new format (companies array) or old format (single user)
    if (companies && Array.isArray(companies) && companies.length > 0) {
      // New format: multiple companies with multiple users
      if (!systemRole) {
        return res.status(400).json({ 
          error: 'Missing required field: systemRole' 
        });
      }

      const createdUsers = [];
      const errors = [];

      // Process each company
      for (const company of companies) {
        if (!company.companyName || !company.users || !Array.isArray(company.users) || company.users.length === 0) {
          errors.push(`Invalid company data: companyName and users array required`);
          continue;
        }

        // Process each user in the company
        for (const userData of company.users) {
          if (!userData.fullName || !userData.email || !userData.password) {
            errors.push(`Invalid user data for company ${company.companyName}: fullName, email, and password required`);
            continue;
          }

          try {
            const result = await createSingleUser({
              fullName: userData.fullName,
              email: userData.email,
              password: userData.password,
              companyName: company.companyName,
              systemRole: systemRole,
              userType: userData.partnershipType || userType || 'N/A',
              registrationSlots: userData.registrationSlots || registrationSlots,
              mobile: userData.mobile || mobile,
              preferredName: userData.preferredName || userData.fullName,
              hasAccess: hasAccess,
              partnershipType: userData.partnershipType
            });
            createdUsers.push(result);
          } catch (error) {
            errors.push(`Failed to create user ${userData.email}: ${error.message}`);
            // Continue with other users even if one fails
          }
        }
      }

      if (createdUsers.length === 0) {
        return res.status(400).json({ 
          error: 'Failed to create any users',
          details: errors
        });
      }

      return res.status(200).json({ 
        success: true,
        users: createdUsers.map(r => r.user),
        message: `Successfully created ${createdUsers.length} user(s)`,
        errors: errors.length > 0 ? errors : undefined
      });

    } else {
      // Old format: single user (backward compatibility)
      if (!fullName || !email || !password || !companyName || !systemRole) {
        return res.status(400).json({ 
          error: 'Missing required fields: fullName, email, password, companyName, systemRole' 
        });
      }

      const result = await createSingleUser({
        fullName,
        email,
        password,
        companyName,
        systemRole,
        userType,
        registrationSlots,
        mobile,
        preferredName,
        hasAccess,
        partnershipType: userType
      });

      return res.status(200).json({ 
        success: true,
        user: result.user,
        authUser: result.authUser,
        message: 'User created successfully'
      });
    }

  } catch (error) {
    console.error('Error in create-user API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
