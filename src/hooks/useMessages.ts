import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";
import { addReplyFallbackText } from "@/utils/chatMessageUtils";

type Message = Database["public"]["Tables"]["messages"]["Row"] & {
  profiles: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
};

type MessageOptions = {
  content_type?: "text" | "location" | "image" | "video" | "link";
  attachment_url?: string | null;
  attachment_name?: string | null;
  location_name?: string | null;
  location_point?: string | null;
  reply_to_message_id?: string | null;
};

const missingChatSchema = (error: { code?: string; message?: string }) =>
  error.code === "PGRST204" || error.code === "42703" ||
  /could not find the .*column|column .* does not exist/i.test(error.message || "");

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userLocation } = useAuth();

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(
          `
          *,
          profiles (
            username,
            full_name,
            avatar_url
          )
        `
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      setMessages((data || []).reverse());
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessageById = async (messageId: string) => {
    const { data, error } = await supabase.from("messages")
      .select("*, profiles(username, full_name, avatar_url)")
      .eq("id", messageId).maybeSingle();
    if (error) return { error: error.message };
    if (data) {
      setMessages((current) => current.some((item) => item.id === data.id)
        ? current
        : [...current, data].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()));
    }
    return { data };
  };

  const sendMessage = async (message: string, options: MessageOptions = {}) => {
    if (!user) return { error: "User not authenticated" };

    try {
      const payload = {
        user_id: user.id,
        message,
        content_type: options.content_type || "text",
        attachment_url: options.attachment_url || null,
        attachment_name: options.attachment_name || null,
        ...(options.reply_to_message_id ? { reply_to_message_id: options.reply_to_message_id } : {}),
        location_name: options.location_name ?? userLocation?.name ?? null,
        location_point: options.location_point ?? (userLocation
          ? `POINT(${userLocation.lng} ${userLocation.lat})`
          : null),
      };
      let { data, error } = await supabase
        .from("messages")
        .insert(payload)
        .select()
        .single();

      let warning: string | undefined;
      if (error && options.reply_to_message_id && /reply_to_message_id.*schema cache|column.*reply_to_message_id.*does not exist/i.test(error.message)) {
        const { reply_to_message_id: _replyToMessageId, ...withoutReply } = payload;
        const retry = await supabase.from("messages").insert({
          ...withoutReply,
          message: await addReplyFallbackText(message, options.reply_to_message_id),
        }).select().single();
        data = retry.data;
        error = retry.error;
        if (!error) warning = "Message sent with a quoted reference. Apply migration 20261024030000_message_replies.sql to save it as a linked reply.";
      }

      if (error && missingChatSchema(error) && !options.attachment_url && !options.attachment_name && (options.content_type || "text") === "text") {
        // Keep plain text usable until the chat migrations have been applied.
        const fallback = await supabase.from("messages").insert({
          user_id: user.id,
          message,
          location_name: options.location_name ?? userLocation?.name ?? null,
          location_point: options.location_point ?? (userLocation ? `POINT(${userLocation.lng} ${userLocation.lat})` : null),
        }).select().single();
        if (fallback.error) return { error: fallback.error.message };
        return {
          data: fallback.data,
          warning: options.reply_to_message_id ? "Message sent with a quoted reference. Apply migration 20261024030000_message_replies.sql to save it as a linked reply." : warning,
        };
      }
      if (error) {
        console.error("Error sending message:", error);
        return { error: error.message };
      }

      return { data, warning };
    } catch (error) {
      console.error("Error sending message:", error);
      return { error: "Failed to send message" };
    }
  };

  useEffect(() => {
    if (user) {
      fetchMessages();

      // Set up real-time subscription
      const channel = supabase
        .channel("messages_changes")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
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
    fetchMessageById,
    refetch: fetchMessages,
  };
}
