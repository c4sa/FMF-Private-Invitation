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
    const { templateName, isActive } = req.body;

    if (!templateName || typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'Template name and isActive status are required' });
    }

    // Update the is_active field in the email_templates table
    console.log('Attempting to update email template status:', templateName, 'to', isActive);
    
    const { data: updateData, error: updateError } = await supabase
      .from('email_templates')
      .update({ is_active: isActive })
      .eq('name', templateName)
      .select();

    if (updateError) {
      console.error('Error updating email template status:', updateError);
      console.error('Error details:', JSON.stringify(updateError, null, 2));
      return res.status(500).json({ error: 'Failed to update email template status' });
    }

    console.log('Successfully updated email template status for:', templateName);
    console.log('Updated data:', JSON.stringify(updateData, null, 2));
    
    if (!updateData || updateData.length === 0) {
      console.warn('No email templates were updated - template might not exist');
      return res.status(404).json({ error: 'Email template not found' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Email template status updated successfully',
      data: updateData
    });

  } catch (error) {
    console.error('Email template status update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
