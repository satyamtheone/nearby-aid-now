
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Database } from '@/integrations/supabase/types';

type HelpRequest = Database['public']['Tables']['help_requests']['Row'] & {
  profiles: {
    username: string | null;
    full_name: string | null;
  };
};

export function useHelpRequests() {
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchHelpRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('help_requests')
        .select(`
          *,
          profiles (
            username,
            full_name
          )
        `)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching help requests:', error);
        return;
      }

      setHelpRequests(data || []);
    } catch (error) {
      console.error('Error fetching help requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const createHelpRequest = async (request: {
    category: Database['public']['Enums']['help_category'];
    message: string;
    is_urgent: boolean;
    location_name?: string;
  }) => {
    console.log('Creating help request with data:', request);
    console.log('Current user:', user);

    if (!user) {
      console.error('User not authenticated');
      return { error: 'User not authenticated' };
    }

    try {
      // First, let's check if the user has a profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Profile check error:', profileError);
        return { error: 'User profile not found. Please try signing out and back in.' };
      }

      console.log('User profile found:', profileData);

      const insertData = {
        user_id: user.id,
        category: request.category,
        message: request.message,
        is_urgent: request.is_urgent,
        location_name: request.location_name || null,
      };

      console.log('Inserting data:', insertData);

      const { data, error } = await supabase
        .from('help_requests')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating help request:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return { error: `Database error: ${error.message}` };
      }

      console.log('Help request created successfully:', data);

      // Refresh the list
      fetchHelpRequests();
      return { data };
    } catch (error) {
      console.error('Unexpected error creating help request:', error);
      return { error: 'Failed to create help request. Please try again.' };
    }
  };

  useEffect(() => {
    if (user) {
      fetchHelpRequests();

      // Set up real-time subscription
      const channel = supabase
        .channel('help_requests_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'help_requests'
          },
          () => {
            fetchHelpRequests();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  return {
    helpRequests,
    loading,
    createHelpRequest,
    refetch: fetchHelpRequests,
  };
}
