
import { supabase } from '@/integrations/supabase/client';

export const cleanAllData = async () => {
  try {
    console.log('Starting data cleanup...');
    
    // Delete all messages
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (messagesError) {
      console.error('Error deleting messages:', messagesError);
    }
    
    // Delete all help requests
    const { error: helpError } = await supabase
      .from('help_requests')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (helpError) {
      console.error('Error deleting help requests:', helpError);
    }
    
    // Delete all user locations
    const { error: locationsError } = await supabase
      .from('user_locations')
      .delete()
      .neq('user_id', '00000000-0000-0000-0000-000000000000');
    
    if (locationsError) {
      console.error('Error deleting user locations:', locationsError);
    }
    
    console.log('Data cleanup completed successfully');
    return true;
  } catch (error) {
    console.error('Error during data cleanup:', error);
    return false;
  }
};

// Run cleanup automatically on import (one-time)
if (typeof window !== 'undefined') {
  cleanAllData();
}
