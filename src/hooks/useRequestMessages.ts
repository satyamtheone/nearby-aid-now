
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Database } from '@/integrations/supabase/types';
import { addReplyFallbackText } from '@/utils/chatMessageUtils';

type RequestMessage = Database['public']['Tables']['messages']['Row'] & {
  profiles: {
    username: string | null;
    full_name: string | null;
  };
};

type RequestMessageOptions = {
  content_type?: 'text' | 'location' | 'image' | 'video' | 'link';
  attachment_url?: string | null;
  attachment_name?: string | null;
  reply_to_message_id?: string | null;
  location_name?: string | null;
  location_point?: string | null;
};

const missingChatSchema = (error: { code?: string; message?: string }) =>
  error.code === 'PGRST204' || error.code === '42703' ||
  /could not find the .*column|column .* does not exist/i.test(error.message || '');

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
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching request messages:', error);
        return;
      }

      setMessages((data || []).reverse());
    } catch (error) {
      console.error('Error fetching request messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessageById = async (messageId: string) => {
    if (!helpRequestId) return { error: 'No request selected' };
    const { data, error } = await supabase.from('messages')
      .select('*, profiles(username, full_name)')
      .eq('id', messageId).eq('help_request_id', helpRequestId).maybeSingle();
    if (error) return { error: error.message };
    if (data) {
      setMessages((current) => current.some((item) => item.id === data.id)
        ? current
        : [...current, data].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()));
    }
    return { data };
  };

  const sendMessage = async (message: string, options: RequestMessageOptions = {}) => {
    if (!user || !helpRequestId) return { error: 'User not authenticated or no request selected' };

    try {
      const payload = {
        user_id: user.id,
        help_request_id: helpRequestId,
        message,
        content_type: options.content_type || 'text',
        attachment_url: options.attachment_url || null,
        attachment_name: options.attachment_name || null,
        ...(options.reply_to_message_id ? { reply_to_message_id: options.reply_to_message_id } : {}),
        location_name: options.location_name || null,
        location_point: options.location_point || null,
      };
      let { data, error } = await supabase
        .from('messages')
        .insert(payload)
        .select()
        .single();

      let warning: string | undefined;
      if (error && options.reply_to_message_id && /reply_to_message_id.*schema cache|column.*reply_to_message_id.*does not exist/i.test(error.message)) {
        const { reply_to_message_id: _replyToMessageId, ...withoutReply } = payload;
        const retry = await supabase.from('messages').insert({
          ...withoutReply,
          message: await addReplyFallbackText(message, options.reply_to_message_id, helpRequestId),
        }).select().single();
        data = retry.data;
        error = retry.error;
        if (!error) warning = 'Message sent with a quoted reference. Apply migration 20261024030000_message_replies.sql to save it as a linked reply.';
      }

      if (error && missingChatSchema(error) && !options.attachment_url && !options.attachment_name && (options.content_type || 'text') === 'text') {
        const fallback = await supabase.from('messages').insert({
          user_id: user.id,
          help_request_id: helpRequestId,
          message,
          location_name: options.location_name || null,
          location_point: options.location_point || null,
        }).select().single();
        if (fallback.error) return { error: fallback.error.message };
        return {
          data: fallback.data,
          warning: options.reply_to_message_id ? 'Message sent with a quoted reference. Apply migration 20261024030000_message_replies.sql to save it as a linked reply.' : warning,
        };
      }
      if (error) {
        console.error('Error sending message:', error);
        return { error: error.message };
      }

      return { data, warning };
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
    fetchMessageById,
    refetch: fetchMessages,
  };
}
