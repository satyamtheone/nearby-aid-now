
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Database } from '@/integrations/supabase/types';

type RequestMessage = Database['public']['Tables']['messages']['Row'] & {
  profiles: {
    username: string | null;
    full_name: string | null;
  };
};

export function useRequestMessages(helpRequestId: string | null) {
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchMessages = async () => {
    if (!helpRequestId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles (
            username,
            full_name
          )
        `)
        .eq('help_request_id', helpRequestId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.error('Error fetching request messages:', error);
        return;
      }

      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching request messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (message: string) => {
    if (!user || !helpRequestId) return { error: 'User not authenticated or no request selected' };

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          user_id: user.id,
          help_request_id: helpRequestId,
          message,
          location_name: null, // Not needed for request-specific messages
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        return { error: error.message };
      }

      return { data };
    } catch (error) {
      console.error('Error sending message:', error);
      return { error: 'Failed to send message' };
    }
  };

  useEffect(() => {
    if (helpRequestId && user) {
      fetchMessages();

      // Set up real-time subscription for this specific request
      const channel = supabase
        .channel(`request_messages_${helpRequestId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `help_request_id=eq.${helpRequestId}`
          },
          () => {
            fetchMessages();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [helpRequestId, user]);

  return {
    messages,
    loading,
    sendMessage,
    refetch: fetchMessages,
  };
}
