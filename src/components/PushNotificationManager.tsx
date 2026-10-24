import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { rememberFcmToken } from "@/lib/pushRegistration";

const isRequestId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function PushNotificationManager() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }

    let active = true;
    const listeners: PluginListenerHandle[] = [];

    const setupPushNotifications = async () => {
      listeners.push(await PushNotifications.addListener("registration", async ({ value }) => {
        if (!active || !value) return;
        rememberFcmToken(value);
        const { error } = await supabase.rpc("register_android_push_token", { p_token: value });
        if (error) console.error("Could not save this device's notification registration:", error.code);
      }));

      listeners.push(await PushNotifications.addListener("registrationError", ({ error }) => {
        console.error("Android push registration failed:", error);
      }));

      listeners.push(await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const requestId = notification.data?.requestId;
        if (isRequestId(requestId)) navigate(`/chat/${requestId}`);
      }));

      await PushNotifications.createChannel({
        id: "nearby-requests",
        name: "Nearby help requests",
        description: "New help requests from people near your saved location",
        importance: 4,
        visibility: 0,
        vibration: true,
      });

      // Attach the action listener even while auth is restoring so a cold-start
      // notification tap is not lost before the persisted session is available.
      if (!user) return;

      let permission = await PushNotifications.checkPermissions();
      if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
        permission = await PushNotifications.requestPermissions();
      }
      if (!active || permission.receive !== "granted") return;

      await PushNotifications.register();
    };

    void setupPushNotifications().catch((error: unknown) => {
      console.error("Could not initialize Android notifications:", error);
    });

    return () => {
      active = false;
      listeners.forEach((listener) => void listener.remove());
    };
  }, [user?.id, navigate]);

  return null;
}
