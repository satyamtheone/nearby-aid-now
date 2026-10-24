import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type FirebaseServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type PushTarget = {
  push_token_id: string;
  recipient_id: string;
  token: string;
};

type Delivery = {
  id: string;
  push_token_id: string;
  status: "pending" | "sending" | "sent" | "failed" | "invalid_token";
};

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

const base64Url = (input: Uint8Array | string) => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

const getFirebaseAccessToken = async (account: FirebaseServiceAccount) => {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.value;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsignedToken = `${header}.${claims}`;
  const pem = account.private_key.replace(/\\n/g, "\n");
  const encodedKey = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(encodedKey), (char) => char.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedToken),
  ));
  const assertion = `${unsignedToken}.${base64Url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const result = await response.json();
  if (!response.ok || typeof result.access_token !== "string") {
    throw new Error("Firebase OAuth token request failed");
  }

  cachedAccessToken = {
    value: result.access_token,
    expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000,
  };
  return cachedAccessToken.value;
};

const getFcmErrorCode = (body: any, status: number) => {
  const details = Array.isArray(body?.error?.details) ? body.error.details : [];
  const fcmDetail = details.find((detail: any) =>
    detail?.["@type"] === "type.googleapis.com/google.firebase.fcm.v1.FcmError"
  );
  return typeof fcmDetail?.errorCode === "string"
    ? fcmDetail.errorCode
    : typeof body?.error?.status === "string"
      ? body.error.status
      : `HTTP_${status}`;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authentication required" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const firebaseSecret = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !firebaseSecret) {
    console.error("Push notification service configuration is incomplete");
    return jsonResponse({ error: "Push notifications are not configured" }, 503);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: authError } = await callerClient.auth.getUser();
  if (authError || !user) return jsonResponse({ error: "Invalid session" }, 401);

  let requestId: string;
  try {
    const body = await request.json();
    requestId = typeof body?.requestId === "string" ? body.requestId : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
      return jsonResponse({ error: "A valid request ID is required" }, 400);
    }
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: helpRequest, error: requestError } = await admin
    .from("help_requests")
    .select("id, user_id, category, message, location_name, location_point, is_resolved, created_at")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError) {
    console.error("Could not load request for push notification:", requestError.code);
    return jsonResponse({ error: "Could not load the request" }, 500);
  }
  if (!helpRequest || helpRequest.user_id !== user.id || helpRequest.is_resolved) {
    return jsonResponse({ error: "Request not found or not owned by this user" }, 404);
  }
  if (!helpRequest.location_point) return jsonResponse({ sent: 0, failed: 0 });

  const { data: targets, error: targetError } = await admin.rpc(
    "get_request_push_targets",
    { p_request_id: requestId },
  );
  if (targetError) {
    console.error("Could not resolve nearby push targets:", targetError.code);
    return jsonResponse({ error: "Could not find nearby registered devices" }, 500);
  }
  const pushTargets = (targets || []) as PushTarget[];
  if (!pushTargets.length) return jsonResponse({ sent: 0, failed: 0 });

  const { error: queueError } = await admin.from("request_push_deliveries").upsert(
    pushTargets.map((target) => ({
      request_id: requestId,
      recipient_id: target.recipient_id,
      push_token_id: target.push_token_id,
    })),
    { onConflict: "request_id,push_token_id", ignoreDuplicates: true },
  );
  if (queueError) {
    console.error("Could not queue push deliveries:", queueError.code);
    return jsonResponse({ error: "Could not queue notifications" }, 500);
  }

  const { data: deliveries, error: deliveryError } = await admin
    .from("request_push_deliveries")
    .select("id, push_token_id, status")
    .eq("request_id", requestId)
    .in("push_token_id", pushTargets.map((target) => target.push_token_id));
  if (deliveryError) {
    console.error("Could not read push delivery status:", deliveryError.code);
    return jsonResponse({ error: "Could not read notification status" }, 500);
  }

  let serviceAccount: FirebaseServiceAccount;
  try {
    serviceAccount = JSON.parse(firebaseSecret) as FirebaseServiceAccount;
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("Invalid Firebase service account");
    }
  } catch {
    console.error("Firebase service account secret is invalid JSON or incomplete");
    return jsonResponse({ error: "Push notifications are not configured" }, 503);
  }

  let accessToken: string;
  try {
    accessToken = await getFirebaseAccessToken(serviceAccount);
  } catch {
    console.error("Could not authorize with Firebase Cloud Messaging");
    return jsonResponse({ error: "Firebase authorization failed" }, 502);
  }

  const targetByTokenId = new Map(pushTargets.map((target) => [target.push_token_id, target]));
  const pending = (deliveries || []) as Delivery[];
  let sent = 0;
  let failed = 0;
  let nextDelivery = 0;
  const workerCount = Math.min(pending.length, 12);
  const title = `Help Request Chat · ${helpRequest.category}`.slice(0, 100);
  const messageText = String(helpRequest.message || "A neighbor nearby needs help")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  const location = String(helpRequest.location_name || "Nearby")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const notificationBody = `${messageText}${location ? ` · ${location}` : ""}`.slice(0, 240);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextDelivery < pending.length) {
      const delivery = pending[nextDelivery++];
      if (delivery.status === "sent" || delivery.status === "invalid_token") continue;
      const target = targetByTokenId.get(delivery.push_token_id);
      if (!target) continue;

      const { data: claimed, error: claimError } = await admin.rpc(
        "claim_request_push_delivery",
        { p_delivery_id: delivery.id },
      );
      if (claimError || !claimed) continue;

      try {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(serviceAccount.project_id)}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: target.token,
                notification: { title, body: notificationBody },
                data: {
                  requestId,
                  deepLink: `/chat/${requestId}`,
                },
                android: {
                  priority: "HIGH",
                  notification: { channel_id: "nearby-requests" },
                },
              },
            }),
          },
        );

        if (response.ok) {
          await admin.from("request_push_deliveries").update({
            status: "sent",
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_error_code: null,
          }).eq("id", delivery.id);
          sent++;
          continue;
        }

        const responseBody = await response.json().catch(() => ({}));
        const errorCode = getFcmErrorCode(responseBody, response.status).slice(0, 100);
        const invalidToken = errorCode === "UNREGISTERED";
        await admin.from("request_push_deliveries").update({
          status: invalidToken ? "invalid_token" : "failed",
          updated_at: new Date().toISOString(),
          last_error_code: errorCode,
        }).eq("id", delivery.id);
        if (invalidToken) {
          await admin.from("device_push_tokens").delete().eq("id", target.push_token_id);
        }
        failed++;
      } catch {
        await admin.from("request_push_deliveries").update({
          status: "failed",
          updated_at: new Date().toISOString(),
          last_error_code: "NETWORK_ERROR",
        }).eq("id", delivery.id);
        failed++;
      }
    }
  }));

  return jsonResponse({ sent, failed });
});
