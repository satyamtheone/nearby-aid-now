
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Database } from '@/integrations/supabase/types';

type Message = Database['public']['Tables']['messages']['Row'] & {
  profiles: Database['public']['Tables']['profiles']['Row'];
};

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchMessages = async () => {
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
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (message: string) => {
    if (!user) return { error: 'User not authenticated' };

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          user_id: user.id,
          message,
          location_name: 'Noida Sector 135', // This would come from user's location in a real app
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
    if (user) {
      fetchMessages();

      // Set up real-time subscription
      const channel = supabase
        .channel('messages_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
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
  }, [user]);

  return {
    messages,
    loading,
    sendMessage,
    refetch: fetchMessages,
  };
}
