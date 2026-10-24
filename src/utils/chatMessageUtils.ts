import { supabase } from "@/integrations/supabase/client";

export async function addReplyFallbackText(
  message: string,
  replyToMessageId: string,
  helpRequestId?: string,
) {
  let query = supabase.from("messages")
    .select("message, content_type, location_name, profiles(full_name, username)")
    .eq("id", replyToMessageId);
  if (helpRequestId) query = query.eq("help_request_id", helpRequestId) as typeof query;

  const { data } = await query.maybeSingle();
  const target = data as any;
  const author = target?.profiles?.full_name || target?.profiles?.username || "Earlier message";
  const preview = target?.content_type === "image" ? "📷 Photo"
    : target?.content_type === "video" ? "🎥 Video"
    : target?.content_type === "location" ? `📍 ${target.location_name || "Location"}`
    : target?.content_type === "link" ? target.message || "Shared link"
    : target?.message || `message ${replyToMessageId.slice(0, 8)}`;

  return `[[reply:${replyToMessageId}]]\n↪ ${author}: ${preview}${message ? `\n\n${message}` : ""}`;
}

export function parseReplyFallbackText(message: string) {
  const match = message.match(/^\[\[reply:([0-9a-f-]+)\]\]\n([^\n]*)(?:\n\n([\s\S]*))?$/i);
  if (!match) return { replyId: null, quoteLabel: null, body: message };
  return { replyId: match[1], quoteLabel: match[2].replace(/^↪\s*/, ""), body: match[3] || "" };
}
