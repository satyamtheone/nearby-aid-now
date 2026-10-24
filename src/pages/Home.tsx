import React, { lazy, Suspense, useState } from "react";
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
import { useAuth } from "@/hooks/useAuth";
import { useHelpRequests } from "@/hooks/useHelpRequests";
import { formatTime } from "@/utils/timeUtils";
const Map = lazy(() => import("@/components/Map"));

const Home = () => {
  const navigate = useNavigate();
  const { user, signOut, userLocation, locationLoading, nearbyUsersCount } = useAuth();
  const { helpRequests, loading, showAllLocations, toggleLocationFilter } =
    useHelpRequests();
  const [showMap, setShowMap] = useState(false);

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
              <span className="text-sm font-bold">{getUserDisplayName().slice(0, 1).toUpperCase()}</span>
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Sign out" onClick={handleSignOut} className="h-10 w-10 rounded-full text-white/75 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-32 pt-5 sm:px-6 sm:pb-12 sm:pt-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.75, 0.25, 1] }}
          className="glass-panel relative isolate overflow-hidden rounded-[2rem] p-5 sm:p-8 lg:p-10"
        >
          <div className="pointer-events-none absolute -right-10 -top-20 -z-10 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-7rem] right-[24%] -z-10 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-3xl" />
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto] md:gap-10">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85">
                <Sparkles className="h-3.5 w-3.5 text-amber-200" /> Local care, made easier
              </div>
              <p className="mb-2 text-sm font-medium text-white/70">Welcome back, {getUserDisplayName().split("@")[0]}</p>
              <h1 className="text-balance text-3xl font-semibold leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl">Good neighbors make <span className="text-cyan-100">stronger</span> communities.</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">Ask for a hand, offer what you can, and find support from people close by.</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button onClick={() => navigate("/ask-help")} className="h-12 rounded-2xl bg-gradient-to-r from-blue-500 to-teal-500 px-5 text-white shadow-lg shadow-blue-950/20 hover:from-blue-400 hover:to-teal-400">
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
              className="mx-auto hidden h-40 w-40 items-center justify-center rounded-[2.5rem] border border-white/25 bg-white/10 shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_24px_60px_rgb(34_47_120/0.2)] md:flex lg:h-48 lg:w-48"
            >
              <div className="grid h-24 w-24 place-items-center rounded-full border border-white/40 bg-gradient-to-br from-cyan-200/45 to-teal-300/15 shadow-[0_0_60px_rgb(125_231_255/0.2)]">
                <MapPin className="h-11 w-11 text-white" strokeWidth={1.5} />
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Map Section */}

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Location Filter Toggle */}
          <Button
            onClick={toggleLocationFilter}
            variant="outline"
            className={`h-12 w-full rounded-2xl border-white/25 bg-white/10 text-white hover:border-white/50 hover:bg-white/15 ${
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

          {/* Live Users Map Toggle */}
          <Button
            onClick={() => setShowMap(!showMap)}
            variant="outline"
            className="h-12 w-full rounded-2xl border-white/25 bg-white/10 text-white hover:bg-white/15"
          >
            <User2Icon className="mr-2 h-5 w-5" />
            {showMap ? "Hide" : "Show"} Live Users
          </Button>
        </div>
        {showMap && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
            <Suspense fallback={<div role="status" className="glass-panel h-72 animate-pulse rounded-3xl" />}>
              <Map />
            </Suspense>
          </motion.div>
        )}

        {/* Recent Help Requests */}
        <div>
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
                  className="glass-panel h-44 animate-pulse overflow-hidden rounded-3xl"
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
            <div className="home-request-list grid gap-4 pb-8 md:grid-cols-2">
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
                    className="home-request-card cursor-pointer rounded-3xl focus-visible:outline-none"
                  >
                    <Card className="glass-panel h-full rounded-3xl text-white transition-colors hover:border-white/45 hover:bg-white/15">
                    <CardHeader className="pb-2">
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
                          <p className="line-clamp-4 break-words px-1 py-1 text-base font-medium leading-relaxed text-white sm:text-[17px]">
                            {request.message}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <span className="text-sm text-white/65">
                        Posted by{" "}
                        <span className="font-semibold text-white/90">
                          {request.profiles?.full_name ||
                            request.profiles?.username ||
                            "Anonymous"}
                        </span>
                      </span>

                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/15 pt-3">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/75">
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequestReply(request.id)}
                          className="h-9 shrink-0 rounded-xl border-white/25 bg-white/10 px-4 text-white hover:bg-white/20"
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
    </div>
  );
};

export default Home;
