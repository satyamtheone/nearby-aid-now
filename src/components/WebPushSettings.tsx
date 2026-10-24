import { useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  enableWebPushNotifications,
  isFirebaseWebPushConfigured,
} from "@/lib/firebaseWebPush";

export function WebPushSettings() {
  const { user } = useAuth();
  const [enabling, setEnabling] = useState(false);

  if (!user || Capacitor.isNativePlatform() || !("Notification" in window)) return null;

  const permission = Notification.permission;
  const enabled = permission === "granted";

  const enable = async () => {
    setEnabling(true);
    try {
      await enableWebPushNotifications();
      toast({ title: "Notifications enabled", description: "This browser can now receive nearby help requests." });
    } catch (error) {
      toast({
        title: "Could not enable notifications",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setEnabling(false);
    }
  };

  return (
    <Card className="backdrop-blur-xl bg-white/10 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {enabled ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          <span>Browser Notifications</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-white/80">
          {enabled
            ? "This browser is enabled for nearby help request alerts."
            : permission === "denied"
              ? "Notifications are blocked. Allow them in this site's browser permissions, then return here."
              : "Enable alerts on this browser to hear about nearby help requests."}
        </p>
        {!enabled && (
          <Button onClick={enable} disabled={enabling || !isFirebaseWebPushConfigured}>
            {enabling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
            {isFirebaseWebPushConfigured ? "Enable browser notifications" : "Firebase web setup required"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
