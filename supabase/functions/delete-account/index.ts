import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (status: number, body: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond(405, { error: "Method not allowed" });

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond(401, { error: "Sign in to delete your account" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Account deletion function is missing Supabase configuration");
    return respond(500, { error: "Account deletion is temporarily unavailable" });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return respond(401, { error: "Your session expired. Sign in again and retry." });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: userMessages, error: messagesError } = await admin
      .from("messages")
      .select("id")
      .eq("user_id", user.id)
      .is("help_request_id", null);
    if (messagesError) throw messagesError;
    const communityMessageIds = (userMessages || []).map((message) => message.id);
    const { error: pinOwnerError } = await admin.from("community_chat_pin").delete().eq("pinned_by", user.id);
    if (pinOwnerError) throw pinOwnerError;
    const { error: pinMessageError } = communityMessageIds.length
      ? await admin.from("community_chat_pin").delete().in("message_id", communityMessageIds)
      : { error: null };
    const pinError = pinMessageError;
    if (pinError) throw pinError;

    const { error: reportPrivacyError } = await admin
      .from("moderation_reports")
      .update({ reporter_id: null, details: null })
      .eq("reporter_id", user.id);
    if (reportPrivacyError) throw reportPrivacyError;

    // Remove this account's uploaded images/videos before deleting the profile.
    // The account's profile, requests, messages, feedback and push tokens use
    // cascading foreign keys and are deleted with auth.users.
    const bucket = admin.storage.from("community-media");
    const removeFolder = async (prefix: string): Promise<void> => {
      const { data, error } = await bucket.list(prefix, { limit: 1000 });
      if (error) {
        if (/bucket not found/i.test(error.message)) return;
        throw error;
      }
      for (const entry of data || []) {
        const path = `${prefix}/${entry.name}`;
        if (entry.id === null) await removeFolder(path);
        else {
          const { error: removeError } = await bucket.remove([path]);
          if (removeError) throw removeError;
        }
      }
    };
    await removeFolder(user.id);

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return respond(200, { message: "Your account and associated app data have been deleted." });
  } catch (error) {
    console.error("Account deletion failed:", error instanceof Error ? error.message : "unknown error");
    return respond(500, { error: "We could not finish deleting your account. Please contact support and try again." });
  }
});
