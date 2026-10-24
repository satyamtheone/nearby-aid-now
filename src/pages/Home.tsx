import React, { lazy, Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Users,
  MessageCircle,
  Clock,
  Navigation,
  LogOut,
  Globe,
  User2Icon,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { ModerationReportDialog } from "@/components/ModerationReportDialog";
import { useAuth } from "@/hooks/useAuth";
import { useHelpRequests } from "@/hooks/useHelpRequests";
import { formatTime } from "@/utils/timeUtils";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
const Map = lazy(() => import("@/components/Map"));

const Home = () => {
  const navigate = useNavigate();
  const { user, signOut, userLocation, locationLoading, nearbyUsersCount } = useAuth();
  const { helpRequests, loading, showAllLocations, toggleLocationFilter } =
    useHelpRequests();
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setProfileAvatarUrl(null);
      return;
    }
    supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (active && !error) setProfileAvatarUrl(data?.avatar_url || null);
      });
    return () => { active = false; };
  }, [user?.id]);

  const getCategoryColor = (category: string) => {
    const colors = {
      Medical: "bg-red-100 text-red-800 border-red-200",
      Food: "bg-orange-100 text-orange-800 border-orange-200",
      Vehicle: "bg-blue-100 text-blue-800 border-blue-200",
      Other: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[category as keyof typeof colors] || colors.Other;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleRequestReply = (requestId: string) => {
    navigate(`/chat/${requestId}`);
  };

  // Get user's display name
  const getUserDisplayName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    return user?.email || "User";
  };

  // Truncate location name for header if too long
  const getDisplayLocation = (location: string) => {
    if (location.length > 35) {
      const parts = location.split(",");
      if (parts.length > 1) {
        return `${parts[0].trim()}, ${parts[1].trim()}`;
      }
      return `${location.slice(0, 32)}...`;
    }
    return location;
  };

  return (
    <div className="app-page page-enter min-h-dvh text-white">
      {/* Header */}
      <header className="safe-area-top glass-header sticky top-0 z-40 border-b text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/30 bg-gradient-to-br from-sky-300/40 to-teal-300/25 shadow-inner">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">Nearby Aid</p>
              {userLocation ? (
                <p className="truncate text-sm font-semibold" title={userLocation.name}>{getDisplayLocation(userLocation.name)}</p>
              ) : locationLoading ? (
                <p className="flex items-center gap-2 text-sm text-white/75"><span className="loading-spinner h-3 w-3 rounded-full border-2 border-white/35 border-t-white" />Locating you</p>
              ) : <p className="text-sm text-white/65">Location unavailable</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_#6ee7b7]" />
              <Users className="h-3.5 w-3.5" />
              {nearbyUsersCount} nearby
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Open profile" onClick={() => navigate("/profile")} className="h-10 w-10 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20">
              {profileAvatarUrl ? (
                <img src={profileAvatarUrl} alt="Your profile" className="h-full w-full rounded-full object-cover" />
              ) : (
                <span className="text-sm font-bold">{getUserDisplayName().slice(0, 1).toUpperCase()}</span>
              )}
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Sign out" onClick={handleSignOut} className="h-10 w-10 rounded-full text-white/75 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 pb-32 pt-4 sm:px-6 sm:pb-12 sm:pt-6">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.75, 0.25, 1] }}
          className="glass-panel relative isolate overflow-hidden rounded-[1.75rem] p-4 sm:p-6 lg:p-7"
        >
          <div className="pointer-events-none absolute -right-10 -top-20 -z-10 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-7rem] right-[24%] -z-10 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-3xl" />
          <div className="grid items-center gap-4 md:grid-cols-[1fr_auto] md:gap-7">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85">
                <Sparkles className="h-3.5 w-3.5 text-amber-200" /> Local care, made easier
              </div>
              <p className="mb-2 text-sm font-medium text-white/70">Welcome back, {getUserDisplayName().split("@")[0]}</p>
              <h1 className="text-balance text-2xl font-semibold leading-[1.1] tracking-tight sm:text-3xl lg:text-4xl">Good neighbors make <span className="text-cyan-100">stronger</span> communities.</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75 sm:text-[15px]">Ask for a hand, offer what you can, and find support from people close by.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <Button onClick={() => navigate("/ask-help")} className="h-11 rounded-xl bg-gradient-to-r from-blue-500 to-teal-500 px-4 text-white shadow-lg shadow-blue-950/20 hover:from-blue-400 hover:to-teal-400">
                  <MessageCircle className="mr-2 h-4 w-4" /> Ask for help
                </Button>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/85 sm:hidden">
                  <Users className="h-4 w-4" /> {nearbyUsersCount} nearby
                </div>
              </div>
            </div>
            <motion.div
              aria-hidden="true"
              animate={{ y: [0, -7, 0], rotate: [0, 1.5, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="mx-auto hidden h-32 w-32 items-center justify-center rounded-[2rem] border border-white/25 bg-white/10 shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_24px_60px_rgb(34_47_120/0.2)] md:flex lg:h-36 lg:w-36"
            >
              <div className="grid h-20 w-20 place-items-center rounded-full border border-white/40 bg-gradient-to-br from-cyan-200/45 to-teal-300/15 shadow-[0_0_60px_rgb(125_231_255/0.2)]">
                <MapPin className="h-9 w-9 text-white" strokeWidth={1.5} />
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Map Section */}

        <div className="mx-auto grid w-full max-w-4xl gap-2.5 sm:grid-cols-2">
          {/* Location Filter Toggle */}
          <Button
            onClick={toggleLocationFilter}
            variant="outline"
            className={`h-11 w-full rounded-xl border-white/25 bg-white/10 text-white hover:border-white/50 hover:bg-white/15 ${
              showAllLocations
                ? "ring-1 ring-amber-200/25"
                : "ring-1 ring-emerald-200/20"
            }`}
          >
            {!showAllLocations ? (
              <>
                <Globe className="mr-2 h-5 w-5" />
                Show all locations
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-5 w-5" />
                Nearby requests · 10 km
              </>
            )}
          </Button>

          {/* Open live users and map drawer */}
          <Button
            onClick={() => setDiscoveryOpen(true)}
            variant="outline"
            className="h-11 w-full rounded-xl border-white/25 bg-white/10 text-white hover:bg-white/15"
          >
            <User2Icon className="mr-2 h-5 w-5" />
            Live users & map <span className="ml-1 rounded-full bg-white/15 px-2 py-0.5 text-xs">{nearbyUsersCount}</span>
          </Button>
        </div>

        {/* Recent Help Requests */}
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Community board</p>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {showAllLocations ? "All requests" : "Nearby requests"}
              </h2>
            </div>
            <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/75">
              {loading ? "Updating…" : `${helpRequests.length} ${helpRequests.length === 1 ? "request" : "requests"}`}
            </span>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card
                  key={i}
                  className="glass-panel h-36 animate-pulse overflow-hidden rounded-2xl"
                >
                  <CardHeader className="pb-3">
                    <div className="skeleton-shimmer skeleton-shimmer-on-dark h-4 w-3/4 rounded"></div>
                    <div className="skeleton-shimmer skeleton-shimmer-on-dark mt-2 h-3 w-1/2 rounded"></div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="skeleton-shimmer skeleton-shimmer-on-dark h-3 w-full rounded"></div>
                    <div className="skeleton-shimmer skeleton-shimmer-on-dark my-4 h-4 w-3/4 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="home-request-list grid gap-3 pb-8 md:grid-cols-2">
              {helpRequests.length === 0 ? (
                <Card className="glass-panel rounded-3xl md:col-span-2">
                  <CardContent className="p-8 text-center sm:p-12">
                    <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-white/10">
                      <MessageCircle className="h-6 w-6 text-white/80" />
                    </div>
                    <p className="font-medium text-white">
                      {showAllLocations
                        ? "No help requests yet. Be the first to ask for help!"
                        : "No help requests nearby. Try expanding to all locations."}
                    </p>
                    {!showAllLocations && <p className="mt-2 text-sm text-white/65">We’ll show requests from your community here.</p>}
                  </CardContent>
                </Card>
              ) : (
                helpRequests.map((request, index) => (
                  <motion.div
                    key={request.id}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: Math.min(index * 0.045, 0.25) }}
                    whileHover={{ y: -3 }}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRequestReply(request.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleRequestReply(request.id);
                      }
                    }}
                    className="home-request-card cursor-pointer rounded-2xl focus-visible:outline-none"
                  >
                    <Card className="glass-panel h-full rounded-2xl text-white transition-colors hover:border-white/45 hover:bg-white/15">
                    <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`border-white/25 bg-white/15 text-white ${getCategoryColor(
                                request.category
                              )}`}
                            >
                              {request.category}
                            </Badge>
                            {request.is_urgent && (
                              <Badge variant="destructive" className="text-xs">
                                Urgent
                              </Badge>
                            )}
                          </div>
                          <p className="line-clamp-3 break-words px-1 py-1 text-sm font-medium leading-relaxed text-white sm:text-[15px]">
                            {request.message}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 sm:px-5">
                      <div className="flex min-w-0 items-center gap-2 text-xs text-white/65 sm:text-sm">
                        {request.profiles?.avatar_url ? (
                          <img src={request.profiles.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full border border-white/30 object-cover" loading="lazy" />
                        ) : (
                          <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 text-xs font-semibold text-white">
                            {(request.profiles?.full_name || request.profiles?.username || "A").charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 truncate">Posted by <span className="font-semibold text-white/90">{request.profiles?.full_name || request.profiles?.username || "Anonymous"}</span></span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/15 pt-3">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-white/75 sm:text-xs">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              <span>{formatTime(request.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Navigation className="h-3 w-3" />
                              {request.distance_km
                                ? `${request.distance_km.toFixed(1)} km away`
                                : "Distance unknown"}
                            </div>
                          </div>
                        {request.user_id !== user?.id && <ModerationReportDialog target={{ help_request_id: request.id }} label="Report" />}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => { event.stopPropagation(); handleRequestReply(request.id); }}
                          className="h-8 shrink-0 rounded-lg border-white/25 bg-white/10 px-3 text-xs text-white hover:bg-white/20"
                        >
                          Reply
                        </Button>
                      </div>
                    </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      <Sheet open={discoveryOpen} onOpenChange={setDiscoveryOpen}>
        <SheetContent side="right" className="z-[70] flex h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-l-[1.75rem] border-l border-white/20 bg-[#303b91]/85 p-0 text-white shadow-2xl backdrop-blur-3xl sm:max-w-none sm:w-1/2">
          <SheetHeader className="glass-header shrink-0 border-b border-white/15 px-5 py-5 pr-14 text-left sm:px-7">
            <SheetTitle className="flex items-center gap-2 text-xl text-white sm:text-2xl"><Users className="h-5 w-5 text-cyan-100" /> People nearby</SheetTitle>
            <SheetDescription className="text-sm text-white/70">Live community members and their locations within 10 km.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
            <Suspense fallback={<div role="status" className="glass-panel h-80 animate-pulse rounded-3xl" />}>
              <Map />
            </Suspense>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Home;
