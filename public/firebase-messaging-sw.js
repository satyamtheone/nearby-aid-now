/* Firebase web push needs this worker at the site's root scope. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const fcmData = data.FCM_MSG?.data || data;
  const requestId = fcmData.requestId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId || "")) {
    return;
  }

  const targetUrl = new URL(`/chat/${requestId}`, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  }));
});

importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

try {
  const encodedConfig = new URL(self.location.href).searchParams.get("config");
  if (!encodedConfig) throw new Error("Firebase config was not provided");
  firebase.initializeApp(JSON.parse(encodedConfig));
  firebase.messaging();
} catch (error) {
  console.error("Could not initialize Firebase web messaging service worker:", error);
}
