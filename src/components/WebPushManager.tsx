import { useEffect } from "react";
import { onMessage } from "firebase/messaging";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";
import { getFirebaseWebMessaging, refreshWebPushToken } from "@/lib/firebaseWebPush";

export function WebPushManager() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || Capacitor.isNativePlatform()) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        const messaging = await getFirebaseWebMessaging();
        if (!active || !messaging) return;
        unsubscribe = onMessage(messaging, (payload) => {
          toast({
            title: payload.notification?.title || "Nearby help request",
            description: payload.notification?.body || "A neighbor nearby needs help.",
          });
        });
        if (Notification.permission === "granted") await refreshWebPushToken();
      } catch (error) {
        console.error("Could not initialize browser notifications:", error);
      }
    })();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [user?.id]);

  return null;
}
