
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
    if (!user) return { error: 'User not authenticated' };

    try {
      const { data, error } = await supabase
        .from('help_requests')
        .insert({
          user_id: user.id,
          ...request,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating help request:', error);
        return { error: error.message };
      }

      // Refresh the list
      fetchHelpRequests();
      return { data };
    } catch (error) {
      console.error('Error creating help request:', error);
      return { error: 'Failed to create help request' };
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
