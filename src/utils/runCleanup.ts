
import { supabase } from '@/integrations/supabase/client';

// Execute data cleanup
const runDataCleanup = async () => {
  try {
    console.log('Cleaning all data...');
    
    // Delete all messages
    await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Delete all help requests  
    await supabase.from('help_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Delete all user locations
    await supabase.from('user_locations').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
    
    console.log('All data cleaned successfully');
  } catch (error) {
    console.error('Error cleaning data:', error);
  }
};

// Run immediately
runDataCleanup();
