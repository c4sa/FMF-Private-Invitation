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
    const { userId, systemRole, hasAccess } = req.body;

    if (!userId || !systemRole) {
      return res.status(400).json({ error: 'Missing required fields: userId, systemRole' });
    }

    // Determine has_access based on system role and checkbox
    let accessValue;
    if (systemRole === 'Admin') {
      accessValue = true; // Admins always have access
    } else if (systemRole === 'Super User') {
      accessValue = hasAccess === true; // Super Users depend on checkbox
    } else {
      accessValue = false; // Regular Users never have access
    }

    // Update the user's has_access field
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ 
        has_access: accessValue,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user access:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({ 
      success: true,
      user: updatedUser,
      message: 'User access updated successfully'
    });

  } catch (error) {
    console.error('Update user access error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
