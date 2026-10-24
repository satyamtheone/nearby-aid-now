
import { lazy, Suspense } from "react";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { WebPushManager } from "@/components/WebPushManager";
import { MobileDock } from "@/components/MobileDock";
import { ProfileCompletionPrompt } from "@/components/ProfileCompletionPrompt";
import { MotionConfig } from "framer-motion";
import { TermsAcceptanceGate } from "@/components/TermsAcceptanceGate";
const Home = lazy(() => import("./pages/Home"));
const AskHelp = lazy(() => import("./pages/AskHelp"));
const Chat = lazy(() => import("./pages/Chat"));
const RequestChat = lazy(() => import("./pages/RequestChat"));
const Profile = lazy(() => import("./pages/Profile"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const AccountDeletion = lazy(() => import("./pages/AccountDeletion"));
const ModerationDashboard = lazy(() => import("./pages/ModerationDashboard"));

const NativeAuthRedirectHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const completeAuth = async (url: string) => {
      try {
        const callback = new URL(url);
        const code = callback.searchParams.get("code");
        const hashParams = new URLSearchParams(callback.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        const result = code
          ? await supabase.auth.exchangeCodeForSession(code)
          : accessToken && refreshToken
            ? await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
            : null;

        if (result?.error) throw result.error;
        if (result?.data.session) navigate("/", { replace: true });
      } catch (error) {
        console.error("Could not complete the app sign-in callback:", error);
        navigate("/auth", { replace: true });
      }
    };

    const listener = CapacitorApp.addListener("appUrlOpen", ({ url }) => {
      void completeAuth(url);
    });
    void CapacitorApp.getLaunchUrl().then((launch) => {
      if (launch?.url) void completeAuth(launch.url);
    });

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [navigate]);

  return null;
};

const queryClient = new QueryClient();

const App = () => (
  <MotionConfig reducedMotion="user">
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <NativeAuthRedirectHandler />
          <PushNotificationManager />
          <WebPushManager />
          <MobileDock />
          <ProfileCompletionPrompt />
          <TermsAcceptanceGate />
          <Suspense
            fallback={
              <div className="safe-area-top flex min-h-dvh items-center justify-center bg-gradient-to-br from-teal-400 via-purple-400 to-blue-500 text-white">
                <div role="status" aria-label="Loading page" className="loading-spinner h-9 w-9 rounded-full border-[3px] border-white/35 border-t-white" />
              </div>
            }
          >
            <Routes>
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/account-deletion" element={<AccountDeletion />} />
              <Route path="/moderation" element={<ModerationDashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              } />
              <Route path="/ask-help" element={
                <ProtectedRoute>
                  <AskHelp />
                </ProtectedRoute>
              } />
              <Route path="/chat" element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              } />
              <Route path="/chat/:requestId" element={
                <ProtectedRoute>
                  <RequestChat />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </MotionConfig>
);

export default App;
