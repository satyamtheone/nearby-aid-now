import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Send, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useHelpRequests } from "@/hooks/useHelpRequests";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

const AskHelp = () => {
  const navigate = useNavigate();
  const { createHelpRequest } = useHelpRequests();
  const { userLocation, locationLoading } = useAuth();
  const [category, setCategory] = useState<
    Database["public"]["Enums"]["help_category"] | ""
  >("");
  const [message, setMessage] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { value: "Medical" as const, label: "Medical", icon: "🏥" },
    { value: "Food" as const, label: "Food & Groceries", icon: "🍽️" },
    { value: "Vehicle" as const, label: "Vehicle & Transport", icon: "🚗" },
    { value: "Other" as const, label: "Other", icon: "🤝" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a category and enter your message.",
        variant: "destructive",
      });
      return;
    }

    if (!userLocation) {
      toast({
        title: "Location Required",
        description: "Please allow location access to send help requests.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error, notificationError } = await createHelpRequest({
        category,
        message: message.trim(),
        is_urgent: isUrgent,
        location_name: userLocation.name,
      });

      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Help Request Sent!",
          description: notificationError
            ? `Your request is posted, but nearby push notifications could not be confirmed. ${notificationError}`
            : "Your request was posted and sent to nearby devices with notifications enabled.",
        });
        navigate("/");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send help request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-page page-enter min-h-dvh text-white">
      {/* Header */}
      <header className="safe-area-top glass-header sticky top-0 z-40 border-b text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-10 w-10 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center space-x-3">
            <div>
              <h1 className="text-base font-semibold sm:text-lg">Ask for help</h1>
              <p className="flex max-w-[70vw] items-center gap-1.5 truncate text-xs text-white/70 sm:text-sm">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {userLocation?.name || (locationLoading ? "Finding your location…" : "Location unavailable")}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 pb-32 pt-5 sm:px-6 sm:pt-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Card className="glass-panel rounded-3xl text-white sm:rounded-[2rem]">
          <CardHeader className="space-y-2 px-5 pb-4 pt-6 sm:px-8 sm:pt-8">
            <CardTitle className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              What do you need a hand with?
            </CardTitle>
            <p className="text-sm leading-relaxed text-white/70">
              Share a little detail and nearby neighbors can respond.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-6 sm:px-8 sm:pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Category Selection */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-white/90">
                  Choose a category
                </label>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  {categories.map((cat) => {
                    const selected = category === cat.value;
                    return (
                      <motion.button
                        key={cat.value}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        aria-pressed={selected}
                        onClick={() => setCategory(cat.value)}
                        className={`flex min-h-[5.25rem] items-center gap-3 rounded-2xl border p-3 text-left transition-colors sm:min-h-[5.75rem] sm:p-4 ${selected ? "border-cyan-100/70 bg-cyan-100/15 ring-2 ring-cyan-100/25" : "border-white/20 bg-white/[0.07] hover:bg-white/[0.13]"}`}
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/10 text-xl sm:h-11 sm:w-11">{cat.icon}</span>
                        <span className="min-w-0 text-sm font-semibold leading-tight sm:text-base">{cat.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Message Input */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-white/90">
                  Tell us what’s going on
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe what help you need..."
                  className="min-h-[140px] resize-y rounded-2xl border-white/25 bg-slate-950/10 text-white placeholder:text-white/50 focus-visible:ring-cyan-100/60"
                  maxLength={200}
                />
                <p className="mt-1.5 text-right text-xs text-white/60">
                  {message.length}/200 characters
                </p>
              </div>

              {/* Urgent Toggle */}
              <div className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition-colors ${isUrgent ? "border-rose-200/50 bg-rose-300/10" : "border-white/20 bg-white/[0.07]"}`}>
                <div>
                  <p className="font-semibold text-white">Is this urgent?</p>
                  <p className="text-sm text-white/65">
                    Let nearby people know it needs quicker attention.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={isUrgent ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setIsUrgent(!isUrgent)}
                  className={!isUrgent ? "shrink-0 border-white/25 bg-white/10 text-white hover:bg-white/20" : "shrink-0"}
                >
                  {isUrgent ? "Mark normal" : "Mark urgent"}
                </Button>
              </div>

              {/* Preview */}
              {category && message && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass-panel overflow-hidden rounded-2xl p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/60">
                    Preview:
                  </p>
                  <div className="flex items-start space-x-2 mb-2">
                    <Badge variant="outline" className="border-white/25 bg-white/15 text-xs text-white">
                      {category}
                    </Badge>
                    {isUrgent && (
                      <Badge variant="destructive" className="text-xs">
                        Urgent
                      </Badge>
                    )}
                  </div>
                  <p className="break-words text-sm font-medium leading-relaxed text-white sm:text-base">
                    {message}
                  </p>
                </motion.div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="h-12 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-teal-500 text-base font-semibold text-white shadow-lg shadow-blue-950/20 hover:from-blue-400 hover:to-teal-400 sm:h-14"
                disabled={
                  isSubmitting || !category || !message.trim() || !userLocation
                }
              >
                {isSubmitting ? (
                  <div className="loading-spinner mr-2 h-5 w-5 rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send className="mr-2 h-5 w-5" />
                )}
                {isSubmitting ? "Sending Help Request..." : "Send Help Request"}
              </Button>
            </form>
          </CardContent>
        </Card>
        </motion.div>

        {/* Info Card */}
        <Card className="glass-panel rounded-2xl text-white">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <div className="rounded-xl border border-white/20 bg-white/10 p-2.5">
                <MapPin className="h-4 w-4 text-cyan-100" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Location-Based Help
                </p>
                <p className="mt-1 text-sm leading-relaxed text-white/70">
                  Your request will only be visible to users within 10km of your
                  location
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AskHelp;
