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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // First, check if user exists in our users table
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('id, email, full_name, company_name')
      .eq('email', email)
      .single();

    if (dbError || !dbUser) {
      console.error('User not found in users table:', dbError);
      return res.status(404).json({ error: 'User not found in system' });
    }

    // Try to get user from Auth using the user ID from our database
    let authUser = null;
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.getUserById(dbUser.id);
      if (!authError && authData.user) {
        authUser = authData.user;
      }
    } catch (error) {
      console.log('Auth user not found by ID, trying to find by email...');
    }

    // If not found by ID, try to find by email in auth users
    if (!authUser) {
      try {
        const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
        if (!userError && users) {
          authUser = users.find(u => u.email === email);
        }
      } catch (error) {
        console.log('Could not list auth users, will try to create auth user...');
      }
    }

    // If user doesn't exist in Auth but exists in our database, create them in Auth
    if (!authUser) {
      console.log(`Creating auth user for existing database user: ${email}`);
      try {
        const { data: newAuthData, error: createError } = await supabase.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: dbUser.full_name || '',
            company_name: dbUser.company_name || ''
          }
        });

        if (createError) {
          console.error('Error creating auth user:', createError);
          return res.status(500).json({ error: `Failed to create auth user: ${createError.message}` });
        }

        authUser = newAuthData.user;

        // Update the database user record with the correct auth ID if different
        if (authUser.id !== dbUser.id) {
          const { error: updateIdError } = await supabase
            .from('users')
            .update({ id: authUser.id })
            .eq('email', email);

          if (updateIdError) {
            console.error('Error updating user ID:', updateIdError);
            // Don't fail the password reset if this fails
          }
        }
      } catch (error) {
        console.error('Failed to create auth user:', error);
        return res.status(500).json({ error: 'Failed to create authentication user' });
      }
    }
    
    if (!authUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update the password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      authUser.id,
      { password: password }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    // Update the is_reset field in the users table using user ID
    console.log('Attempting to update is_reset field for user ID:', authUser.id, 'email:', email);
    
    const { data: updateData, error: resetError } = await supabase
      .from('users')
      .update({ is_reset: true })
      .eq('id', authUser.id)
      .select();

    if (resetError) {
      console.error('Error updating is_reset field:', resetError);
      console.error('Error details:', JSON.stringify(resetError, null, 2));
      // Don't fail the password update if is_reset update fails
      console.warn('Password updated successfully but failed to update is_reset status');
    } else {
      console.log('Successfully updated is_reset field for user:', email);
      console.log('Updated data:', JSON.stringify(updateData, null, 2));
      
      if (!updateData || updateData.length === 0) {
        console.warn('No rows were updated - user might not exist in users table');
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Password updated successfully' 
    });

  } catch (error) {
    console.error('Password update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
