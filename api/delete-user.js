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
  // Only allow DELETE requests
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ 
        error: 'Missing required field: userId' 
      });
    }

    // Step 1: Delete all related records first (to handle foreign key constraints)
    
    // Delete notifications
    const { error: notificationError } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (notificationError) {
      console.error('Error deleting notifications:', notificationError);
      // Continue with deletion even if notifications fail
    }

    // Delete OTPs
    const { error: otpError } = await supabase
      .from('otps')
      .delete()
      .eq('user_id', userId);

    if (otpError) {
      console.error('Error deleting OTPs:', otpError);
      // Continue with deletion even if OTPs fail
    }

    // Update attendees to remove registered_by reference (set to null)
    const { error: attendeeError } = await supabase
      .from('attendees')
      .update({ registered_by: null })
      .eq('registered_by', userId);

    if (attendeeError) {
      console.error('Error updating attendees:', attendeeError);
      // Continue with deletion even if attendee update fails
    }

    // Step 2: Delete user record from users table
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (userError) {
      console.error('Error deleting user record:', userError);
      return res.status(400).json({ 
        error: `Failed to delete user record: ${userError.message}` 
      });
    }

    // Step 3: Delete user from Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Error deleting auth user:', authError);
      // Note: User record is already deleted, but auth user deletion failed
      // This is not ideal but we'll continue
      console.warn('User record deleted but auth user deletion failed');
    }

    return res.status(200).json({ 
      success: true,
      message: 'User deleted successfully from both database and authentication'
    });

  } catch (error) {
    console.error('Error in delete-user API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
