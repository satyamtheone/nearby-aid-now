import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  type Messaging,
} from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";
import { rememberFcmToken } from "@/lib/pushRegistration";

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export const isFirebaseWebPushConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    vapidKey,
);

let messagingPromise: Promise<Messaging> | null = null;

export async function getFirebaseWebMessaging(): Promise<Messaging | null> {
  if (!isFirebaseWebPushConfigured || typeof window === "undefined") return null;
  if (!window.isSecureContext || !("serviceWorker" in navigator)) {
    throw new Error("Browser push notifications require HTTPS (or localhost).");
  }
  if (!(await isSupported())) {
    throw new Error("This browser does not support Firebase web push notifications.");
  }

  if (!messagingPromise) {
    messagingPromise = (async () => {
      const app = getApps().find((candidate) => candidate.name === "nearby-aid-now-push") ??
        initializeApp(firebaseConfig, "nearby-aid-now-push");
      const workerUrl = new URL("/firebase-messaging-sw.js", window.location.origin);
      workerUrl.searchParams.set("config", JSON.stringify(firebaseConfig));
      await navigator.serviceWorker.register(
        workerUrl.toString(),
        { scope: "/" },
      );
      await navigator.serviceWorker.ready;
      return getMessaging(app);
    })();
  }

  try {
    return await messagingPromise;
  } catch (error) {
    messagingPromise = null;
    throw error;
  }
}

async function fetchAndSaveWebPushToken() {
  const messaging = await getFirebaseWebMessaging();
  if (!messaging) throw new Error("Firebase web push settings are missing.");

  const serviceWorkerRegistration = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  });
  if (!token) throw new Error("Firebase did not issue a browser notification token.");

  const { error } = await supabase.rpc("register_user_push_token", {
    p_token: token,
    p_platform: "web",
  });
  if (error) throw new Error("Could not save this browser's notification registration.");
  rememberFcmToken(token, "web");
  return token;
}

export async function enableWebPushNotifications() {
  if (!isFirebaseWebPushConfigured) {
    throw new Error("Firebase web configuration is missing from the app environment.");
  }
  if (!("Notification" in window)) {
    throw new Error("This browser does not support notifications.");
  }

  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== "granted") {
    throw new Error(permission === "denied"
      ? "Notifications are blocked in browser settings. Allow them for this site and try again."
      : "Notification permission was not granted.");
  }

  return fetchAndSaveWebPushToken();
}

export async function refreshWebPushToken() {
  if (!isFirebaseWebPushConfigured || typeof window === "undefined") return null;
  if (!("Notification" in window) || Notification.permission !== "granted") return null;
  return fetchAndSaveWebPushToken();
}
