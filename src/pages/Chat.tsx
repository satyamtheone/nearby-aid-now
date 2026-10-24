import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Send,
  MapPin,
  Users,
  ChevronDown,
  ChevronUp,
  Loader2,
  Image as ImageIcon,
  Video,
  Link as LinkIcon,
  Smile,
  Pin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { useMessages } from "@/hooks/useMessages";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import UserProfileModal from "@/components/UserProfileModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseReplyFallbackText } from "@/utils/chatMessageUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { ModerationReportDialog } from "@/components/ModerationReportDialog";

interface ActiveUser {
  user_id: string;
  full_name: string;
  username: string;
  location_name: string;
  lat: number;
  lng: number;
  distance_km: number;
  is_online: boolean;
  avatar_emoji: string;
  avatar_url?: string | null;
}

const Chat = () => {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReferencePicker, setShowReferencePicker] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState<any>(null);
  const [pinningMessageId, setPinningMessageId] = useState<string | null>(null);
  const [pendingJumpId, setPendingJumpId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = useState<{ type: "image" | "video"; url: string; name?: string } | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [showActiveUsers, setShowActiveUsers] = useState(false);
  const [userOnlineStatus, setUserOnlineStatus] = useState<{
    [key: string]: boolean;
  }>({});
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { user, userLocation, locationLoading } = useAuth();
  const { loading: profileStatusLoading, isComplete: profileComplete } = useProfileCompletion();
  const canSendMessages = !profileStatusLoading && profileComplete === true;
  const { messages, loading, sendMessage, fetchMessageById } = useMessages();

  const ensureProfileCanMessage = () => {
    if (canSendMessages) return true;
    toast({
      title: profileComplete === null ? "Could not verify your profile" : "Complete your profile to message",
      description: profileComplete === null
        ? "Please try again in a moment."
        : "Add your legal name, mobile number, address, and Instagram or Facebook profile. You can update these in Profile.",
      variant: "destructive",
    });
    return false;
  };

  const fetchPinnedMessage = async () => {
    const { data: pin, error } = await supabase.from("community_chat_pin")
      .select("message_id, pinned_by, created_at").eq("id", true).maybeSingle();
    if (error) {
      console.error("Unable to fetch pinned community message:", error);
      return;
    }
    if (!pin) {
      setPinnedMessage(null);
      return;
    }
    const { data: message, error: messageError } = await supabase.from("messages")
      .select("*, profiles(username, full_name, avatar_url)").eq("id", pin.message_id).maybeSingle();
    if (!messageError) setPinnedMessage(message ? { ...message, pinned_by: pin.pinned_by } : null);
  };

  useEffect(() => {
    fetchPinnedMessage();
    const channel = supabase.channel("community_chat_pin_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_chat_pin" }, fetchPinnedMessage)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Get online users and their status
  const getOnlineUsers = async (showLoader = false) => {
    if (!userLocation) return;

    if (showLoader) setLoadingUsers(true);

    try {
      console.log("Chat: Getting online users");

      const { data, error } = await supabase.rpc("get_nearby_users" as any, {
        user_lat: userLocation.lat,
        user_lng: userLocation.lng,
        radius_km: 2,
      });

      if (error) {
        console.error("Chat: Error getting online users:", error);
        return;
      }

      const nearbyUsers = (data as ActiveUser[]) || [];
      console.log("Chat: Nearby users:", nearbyUsers);

      const userIds = nearbyUsers.map((nearbyUser) => nearbyUser.user_id);
      const { data: avatarProfiles, error: avatarError } = userIds.length
        ? await supabase.from("profiles").select("id, avatar_url").in("id", userIds)
        : { data: [], error: null };
      if (avatarError) console.warn("Chat: Could not load active user pictures:", avatarError);
      const avatarByUserId = new Map((avatarProfiles || []).map((profile) => [profile.id, profile.avatar_url]));
      const usersWithAvatars = nearbyUsers.map((nearbyUser) => ({
        ...nearbyUser,
        avatar_url: avatarByUserId.get(nearbyUser.user_id) || null,
      }));

      // Store all nearby users
      setActiveUsers(usersWithAvatars);

      // Create status map for all users
      const statusMap: { [key: string]: boolean } = {};
      usersWithAvatars.forEach((u) => {
        statusMap[u.user_id] = u.is_online;
      });
      setUserOnlineStatus(statusMap);

      console.log("Chat: Nearby users:", nearbyUsers.length);
    } catch (error) {
      console.error("Chat: Error getting online users:", error);
    } finally {
      if (showLoader) setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (userLocation) {
      getOnlineUsers(true);
      const interval = setInterval(() => getOnlineUsers(false), 8000); // Every 8 seconds
      return () => clearInterval(interval);
    }
  }, [userLocation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const jumpToMessage = async (messageId: string) => {
    setPendingJumpId(messageId);
    if (!messages.some((message) => message.id === messageId)) {
      const result = await fetchMessageById(messageId);
      if (result.error || !result.data) {
        setPendingJumpId(null);
        toast({ title: "Referenced message unavailable", description: result.error || "This message may have been removed.", variant: "destructive" });
      }
    }
  };

  useEffect(() => {
    if (!pendingJumpId) return;
    const element = messageRefs.current[pendingJumpId];
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(pendingJumpId);
    setPendingJumpId(null);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 2400);
  }, [pendingJumpId, messages]);

  useEffect(() => () => {
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ensureProfileCanMessage()) return;
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage("");

    const { error, warning } = await sendMessage(messageText, { reply_to_message_id: replyToMessageId });
    if (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      setNewMessage(messageText);
    } else {
      setReplyToMessageId(null);
      if (warning) toast({ title: "Message sent with a quoted reference", description: warning });
    }
  };

  const shareLocation = async () => {
    if (!ensureProfileCanMessage()) return;
    if (!userLocation) {
      toast({ title: "Location unavailable", description: "Allow location access and try again.", variant: "destructive" });
      return;
    }
    const mapUrl = `https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}`;
    const { error, warning } = await sendMessage("Shared a location", {
      content_type: "location",
      attachment_url: mapUrl,
      location_name: userLocation.name,
      location_point: `POINT(${userLocation.lng} ${userLocation.lat})`,
      reply_to_message_id: replyToMessageId,
    });
    if (error) toast({ title: "Could not share location", description: error, variant: "destructive" });
    else {
      setReplyToMessageId(null);
      if (warning) toast({ title: "Location shared with a quoted reference", description: warning });
    }
  };

  const handleMediaSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!ensureProfileCanMessage()) return;
    if (!file || !user) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast({ title: "Unsupported file", description: "Choose an image or video.", variant: "destructive" });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File is too large", description: "Images and videos must be 50 MB or smaller.", variant: "destructive" });
      return;
    }

    const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "media";
    const path = `${user.id}/chat/${crypto.randomUUID()}.${extension}`;
    setUploadingMedia(true);
    try {
      const { error: uploadError } = await supabase.storage.from("community-media").upload(path, file, {
        cacheControl: "3600", contentType: file.type, upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("community-media").getPublicUrl(path);
      const { error: messageError, warning } = await sendMessage("", {
        content_type: file.type.startsWith("video/") ? "video" : "image",
        attachment_url: publicUrl,
        attachment_name: file.name,
        reply_to_message_id: replyToMessageId,
      });
      if (messageError) {
        await supabase.storage.from("community-media").remove([path]);
        throw new Error(messageError);
      }
      setReplyToMessageId(null);
      if (warning) toast({ title: "Media sent with a quoted reference", description: warning });
    } catch (error: any) {
      console.error("Media share failed:", error);
      const message = error?.message || "Try again with a smaller image or video.";
      toast({ title: "Could not send media", description: /bucket not found/i.test(message) ? "The community-media bucket is missing in Supabase. Apply migration 20261024020000_chat_media_links_and_pins.sql to create it." : message, variant: "destructive" });
    } finally {
      setUploadingMedia(false);
    }
  };

  const shareLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ensureProfileCanMessage()) return;
    try {
      const url = new URL(linkInput.trim());
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Use a link that starts with http:// or https://");
      const { error, warning } = await sendMessage("Shared a link", { content_type: "link", attachment_url: url.toString(), reply_to_message_id: replyToMessageId });
      if (error) throw new Error(error);
      setLinkInput("");
      setShowLinkInput(false);
      setReplyToMessageId(null);
      if (warning) toast({ title: "Link shared with a quoted reference", description: warning });
    } catch (error: any) {
      const message = error?.message || "Enter a valid web link.";
      toast({ title: "Could not share link", description: /column|schema cache/i.test(message) ? "Apply migration 20261024020000_chat_media_links_and_pins.sql, then refresh the app." : message, variant: "destructive" });
    }
  };

  const pinMessage = async (message: any) => {
    if (!user) return;
    setPinningMessageId(message.id);
    const { error } = await supabase.from("community_chat_pin").upsert({
      id: true, message_id: message.id, pinned_by: user.id, created_at: new Date().toISOString(),
    }, { onConflict: "id" });
    setPinningMessageId(null);
    if (error) {
      toast({ title: "Could not pin message", description: error.message, variant: "destructive" });
      return;
    }
    setPinnedMessage({ ...message, pinned_by: user.id });
    toast({ title: "Message pinned", description: "The pinned reference is now visible to everyone in community chat." });
  };

  const jumpToPinnedMessage = () => {
    const messageElement = pinnedMessage && messageRefs.current[pinnedMessage.id];
    if (messageElement) messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
    else if (pinnedMessage) toast({ title: "Pinned message", description: "This reference is older than the messages currently loaded." });
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const isUserOnline = (userId: string) => {
    return userOnlineStatus[userId] || false;
  };

  const onlineUsersCount =
    (user?.id ? 1 : 0) + activeUsers.filter((u) => u.is_online).length;
  const onlineUsers = activeUsers.filter((u) => u.is_online);

  return (
    <div className="app-page flex h-[100dvh] min-h-0 flex-col overflow-hidden text-white text-shadow-2xl text-shadow-blue-200">
      {/* Header */}
      <div className="glass-header safe-area-top z-30 shrink-0 border-b border-white/20">
        <div className="mx-auto max-w-5xl px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="p-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Community Chat</h1>
                <p className="text-sm  flex items-center">
                  <MapPin className="h-3 w-3 mr-1" />
                  {userLocation?.name || (locationLoading ? "Finding your location…" : "Location unavailable")} • 2km radius
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-1 text-green-600">
                <Users className="h-4 w-4 text-white" />
                <span className="text-lg font-medium text-white">
                  {onlineUsersCount}
                </span>
              </div>
              <p className="text-xs ">online</p>
            </div>
          </div>

          {/* Active Users Toggle */}
          <button
            onClick={() => setShowActiveUsers(!showActiveUsers)}
            className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-lg border-[0.5px] border-blue-200 backdrop-blur-md bg-white/10 hover:bg-white/20 transition-all"
          >
            <div className="flex items-center space-x-2">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white">Active Users</p>
                <p className="text-xs text-green-400">
                  {onlineUsersCount} online now
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {loadingUsers ? (
                <Loader2 className="loading-spinner h-4 w-4 text-white" />
              ) : (
                <div className="flex -space-x-1.5">
                  {onlineUsers.slice(0, 3).map((u) => (
                    <div
                      key={u.user_id}
                      className="w-6 h-6 rounded-full border-2 border-white bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-[10px] font-bold text-white"
                    >
                      {(u.full_name || u.username || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  ))}
                </div>
              )}
              {showActiveUsers ? (
                <ChevronUp className="h-4 w-4 text-white" />
              ) : (
                <ChevronDown className="h-4 w-4 text-white" />
              )}
            </div>
          </button>

          {/* Active Users List */}
          {showActiveUsers && (
            <div className="mt-2 rounded-lg border-[0.5px] border-blue-200 backdrop-blur-md bg-white/10 overflow-hidden animate-in slide-in-from-top-2 duration-200">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="loading-spinner h-5 w-5 text-white" />
                  <span className="ml-2 text-xs text-white">
                    Loading active users...
                  </span>
                </div>
              ) : onlineUsers.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-white">
                    No other users online nearby
                  </p>
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto">
                  {onlineUsers.map((u) => (
                    <UserProfileModal
                      key={u.user_id}
                      userId={u.user_id}
                      userName={u.full_name || u.username || "Unknown User"}
                      isOnline={true}
                      distance={u.distance_km}
                    >
                      <div className="flex items-center space-x-3 px-3 py-2 hover:bg-white/10 cursor-pointer transition-colors border-b-[0.5px] border-white/10 last:border-b-0">
                        <div className="relative">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={`${u.full_name || u.username || "Community member"}'s profile`} className="h-8 w-8 rounded-full border border-white/30 object-cover" loading="lazy" />
                          ) : u.avatar_emoji ? (
                            <div className="h-8 w-8 flex items-center justify-center text-lg rounded-full border border-white/30 bg-white/10">
                              {u.avatar_emoji}
                            </div>
                          ) : (
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-teal-500 text-white">
                                {(u.full_name || u.username || "U")
                                  .charAt(0)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate capitalize">
                            {u.full_name || u.username || "Unknown User"}
                          </p>
                          <p className="text-xs text-white/60 truncate">
                            {u.location_name || "Unknown location"}
                            {!isNaN(u.distance_km) &&
                              ` • ${u.distance_km.toFixed(1)} km`}
                          </p>
                        </div>
                        <span className="text-xs text-green-400 font-medium flex items-center">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                          Online
                        </span>
                      </div>
                    </UserProfileModal>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {pinnedMessage && (
        <button onClick={jumpToPinnedMessage} className="max-w-md max-md:max-w-lg md:max-w-3xl mx-auto w-full px-3 pt-3 text-left">
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 shadow-sm">
            <Pin className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">Pinned message reference</p>
              <p className="truncate text-xs">
                {pinnedMessage.profiles?.full_name || pinnedMessage.profiles?.username || "Community member"}: {pinnedMessage.content_type === "image" ? "📷 Photo" : pinnedMessage.content_type === "video" ? "🎥 Video" : pinnedMessage.content_type === "location" ? `📍 ${pinnedMessage.location_name || "Location"}` : pinnedMessage.content_type === "link" ? pinnedMessage.attachment_url : pinnedMessage.message}
              </p>
            </div>
            <span className="text-xs">Jump</span>
          </div>
        </button>
      )}
      <div className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-5">
        <div className="mx-auto max-w-4xl">
        {loading ? (
          <div className="space-y-4 py-2" role="status" aria-label="Loading messages">
            {["start", "end", "start"].map((side, index) => (
              <div key={index} className={`flex ${side === "end" ? "justify-end" : "justify-start"}`}>
                <div className="w-[72%] max-w-sm rounded-2xl border border-white/15 bg-white/10 p-4">
                  <Skeleton className="skeleton-shimmer-on-dark mb-3 h-3 w-24" />
                  <Skeleton className="skeleton-shimmer-on-dark h-4 w-full" />
                  <Skeleton className="skeleton-shimmer-on-dark mt-2 h-3 w-3/5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  No messages yet. Start the conversation!
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isOwnMessage = message.user_id === user?.id;
                const userName = isOwnMessage
                  ? "You"
                  : message.profiles?.full_name ||
                    message.profiles?.username ||
                    "Anonymous";
                const online = isOwnMessage
                  ? true
                  : isUserOnline(message.user_id);
                const fallbackReply = parseReplyFallbackText(message.message || "");
                const referencedMessageId = message.reply_to_message_id || fallbackReply.replyId;
                const replyTarget = referencedMessageId
                  ? messages.find((candidate) => candidate.id === referencedMessageId)
                  : null;
                const replyPreview = replyTarget ? (replyTarget.content_type === "image" ? "📷 Photo" : replyTarget.content_type === "video" ? "🎥 Video" : replyTarget.content_type === "location" ? `📍 ${replyTarget.location_name || "Location"}` : replyTarget.content_type === "link" ? replyTarget.attachment_url : replyTarget.message) : fallbackReply.quoteLabel || "Referenced message";
                const visibleMessage = fallbackReply.body === "Shared a link" || fallbackReply.body === "Shared a location" ? "" : fallbackReply.body;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    key={message.id}
                    ref={(element) => { messageRefs.current[message.id] = element; }}
                    className={`flex ${
                      isOwnMessage ? "justify-end" : "justify-start"
                    } ${highlightedMessageId === message.id ? "rounded-xl bg-amber-300/30 ring-4 ring-amber-300 shadow-xl transition-all duration-300" : "transition-all duration-300"}`}
                  >
                    <div
                      className={`chat-message-bubble w-fit max-w-[88%] rounded-2xl border border-white/25 px-3 py-3 sm:max-w-[72%] sm:px-4 ${
                        isOwnMessage ? "bg-white" : ""
                      }`}
                    >
                      {!isOwnMessage && (
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <UserProfileModal
                            userId={message.user_id}
                            userName={userName}
                            isOnline={online}
                          >
                            <button className="flex max-w-full items-center gap-2 rounded-full border border-cyan-100/20 bg-white/10 px-2.5 py-1 hover:bg-white/15">
                              <div
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10 ${
                                  online ? "bg-green-500" : "bg-gray-200"
                                }`}
                              ></div>
                              <span className="max-w-[15rem] truncate text-sm font-semibold text-cyan-100 capitalize">
                                {userName}
                              </span>
                            </button>
                          </UserProfileModal>
                        </div>
                      )}
                      {referencedMessageId && (
                        <button type="button" onClick={() => void jumpToMessage(referencedMessageId)} className="mb-2 block w-full cursor-pointer rounded-r-xl border-l-2 border-amber-300 bg-white/10 px-3 py-2 text-left text-xs text-white/90 hover:bg-white/15">
                          <span className="block font-semibold">Replying to {replyTarget?.profiles?.full_name || replyTarget?.profiles?.username || "message"}</span>
                          <span className="block truncate">{replyPreview}</span>
                        </button>
                      )}
                      {message.content_type === "image" && message.attachment_url && (
                        <button type="button" onClick={() => setMediaPreview({ type: "image", url: message.attachment_url!, name: message.attachment_name || undefined })} className="message-media-button group cursor-zoom-in">
                          <img src={message.attachment_url} alt={message.attachment_name || "Shared image"} className="max-h-[26rem] w-full object-contain transition-transform duration-300 group-hover:scale-[1.015]" loading="lazy" />
                        </button>
                      )}
                      {message.content_type === "video" && message.attachment_url && (
                        <button type="button" onClick={() => setMediaPreview({ type: "video", url: message.attachment_url!, name: message.attachment_name || undefined })} className="message-media-button group relative cursor-zoom-in">
                          <video src={message.attachment_url} muted preload="metadata" className="max-h-[26rem] w-full object-contain" aria-label={message.attachment_name || "Shared video"} />
                          <span className="absolute inset-0 flex items-center justify-center text-3xl text-white drop-shadow">▶</span>
                        </button>
                      )}
                      {message.content_type === "link" && message.attachment_url && (
                        <a href={message.attachment_url} target="_blank" rel="noopener noreferrer" className="message-link-card my-2 block max-w-full break-all rounded-xl p-3 text-cyan-100 hover:bg-white/15">
                          <span className="flex items-start gap-2"><LinkIcon className="mt-0.5 h-4 w-4 shrink-0" /><span className="line-clamp-3">{message.attachment_url}</span></span>
                        </a>
                      )}
                      {message.content_type === "location" && message.attachment_url && (
                        <a href={message.attachment_url} target="_blank" rel="noopener noreferrer" className="message-link-card my-2 flex items-center gap-2 rounded-xl p-3 text-emerald-50 hover:bg-emerald-300/20">
                          <MapPin className="h-5 w-5 shrink-0 text-emerald-200" />
                          <span><span className="block font-semibold">Shared location</span><span className="text-xs">{message.location_name || "Open in Maps"}</span></span>
                        </a>
                      )}
                      {!!visibleMessage && (
                        <p className="whitespace-pre-wrap break-words px-1 py-1 text-[15px] leading-relaxed text-white">{visibleMessage}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 border-t border-white/10 pt-2">
                        {message.location_name && message.content_type !== "location" && !isOwnMessage && (
                          <Badge variant="outline" className="text-xs text-gray-500 bg-white">{message.location_name}</Badge>
                        )}
                        <button type="button" onClick={() => { setReplyToMessageId(message.id); setShowReferencePicker(false); }} className="inline-flex items-center gap-1 text-xs text-blue-100 hover:text-white">Reply</button>
                        <button type="button" onClick={() => pinMessage(message)} disabled={pinningMessageId === message.id} className="inline-flex items-center gap-1 text-xs text-amber-200 hover:text-amber-100 disabled:opacity-50">
                          <Pin className="h-3 w-3" />{pinnedMessage?.id === message.id ? "Pinned" : pinningMessageId === message.id ? "Pinning..." : "Pin reference"}
                        </button>
                        {!isOwnMessage && <ModerationReportDialog target={{ message_id: message.id }} />}
                        <p
                          className={`text-xs mt-1
                             text-blue-100  `}
                        >
                          {formatTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
        </div>
      </div>

      {/* Message Input */}
      <div className="safe-area-bottom z-20 shrink-0 px-2 pb-2 pt-2 sm:px-5 sm:pb-3">
        <div className="chat-composer-panel mx-auto max-w-4xl p-2 sm:p-3">
          <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaSelected} />
          {!canSendMessages && (
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-100/25 bg-amber-100/10 px-3 py-2 text-xs text-white/85" role="status">
              <span>{profileStatusLoading ? "Checking profile…" : profileComplete === null ? "Profile status is unavailable; messaging is paused." : "Complete your profile to send messages and build trust."}</span>
              {!profileStatusLoading && <Button type="button" size="sm" variant="secondary" className="h-8 text-xs text-white" onClick={() => navigate("/profile")}>Complete profile</Button>}
            </div>
          )}
          {showLinkInput && (
            <form onSubmit={shareLink} className="mb-2 flex gap-2">
              <Input type="url" value={linkInput} onChange={(event) => setLinkInput(event.target.value)} placeholder="Paste a link (https://...)" className="text-black" />
              <Button type="submit" size="sm" disabled={!canSendMessages || !linkInput.trim()}>Share</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowLinkInput(false)}>Cancel</Button>
            </form>
          )}
          {showEmojiPicker && (
            <div className="mb-2 flex flex-wrap gap-1 rounded-xl border bg-white p-2" aria-label="Emoji picker">
              {"😀 😃 😄 😁 😊 🙂 🥰 😎 🤝 🙏 👋 👍 ❤️ 🎉 🌍 📍 🚗 🍲 🩺".split(" ").map((emoji) => (
                <button key={emoji} type="button" className="rounded p-1 text-xl hover:bg-gray-100" onClick={() => setNewMessage((current) => `${current}${emoji}`)}>{emoji}</button>
              ))}
            </div>
          )}
          {showReferencePicker && (
            <div className="mb-2 max-h-56 overflow-y-auto rounded-xl border border-blue-200 bg-white p-2 text-gray-900 shadow-lg">
              <p className="px-2 pb-1 text-xs font-semibold text-gray-600">Choose a recent message to pin as the group reference</p>
              {messages.length === 0 ? <p className="p-2 text-sm text-gray-500">There are no messages to reference yet.</p> : messages.slice(-20).reverse().map((message) => {
                const author = message.profiles?.full_name || message.profiles?.username || "Community member";
                const preview = message.content_type === "image" ? "📷 Photo" : message.content_type === "video" ? "🎥 Video" : message.content_type === "location" ? `📍 ${message.location_name || "Location"}` : message.content_type === "link" ? message.attachment_url : message.message;
                return <button key={message.id} type="button" onClick={() => { void pinMessage(message); setShowReferencePicker(false); }} className="block w-full truncate rounded-md px-2 py-2 text-left text-sm hover:bg-blue-50"><span className="font-medium">{author}:</span> {preview || "Message"}{pinnedMessage?.id === message.id ? " · Current reference" : ""}</button>;
              })}
            </div>
          )}
          {replyToMessageId && (() => {
            const target = messages.find((item) => item.id === replyToMessageId);
            const preview = !target ? "Referenced message" : target.content_type === "image" ? "📷 Photo" : target.content_type === "video" ? "🎥 Video" : target.content_type === "location" ? `📍 ${target.location_name || "Location"}` : target.content_type === "link" ? target.attachment_url : target.message;
            return <div className="mb-2 flex items-center gap-2 rounded-lg border-l-4 border-amber-400 bg-white/15 px-3 py-2 text-sm text-white"><div className="min-w-0 flex-1"><p className="text-xs font-semibold">Replying to {target?.profiles?.full_name || target?.profiles?.username || "message"}</p><p className="truncate text-xs">{preview}</p></div><button type="button" aria-label="Cancel reply" onClick={() => setReplyToMessageId(null)} className="px-2 text-lg">×</button></div>;
          })()}
          <div className="mb-2 flex snap-x items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Button type="button" size="sm" variant="ghost" onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = "image/*"; fileInputRef.current.click(); } }} disabled={!canSendMessages || uploadingMedia} className="h-9 gap-1 px-2 text-xs text-white"><ImageIcon className="h-4 w-4" /><span>Image</span></Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = "video/*"; fileInputRef.current.click(); } }} disabled={!canSendMessages || uploadingMedia} className="h-9 gap-1 px-2 text-xs text-white"><Video className="h-4 w-4" /><span>Video</span></Button>
            <Button type="button" size="sm" variant="ghost" onClick={shareLocation} disabled={!canSendMessages} className="h-9 gap-1 px-2 text-xs text-white"><MapPin className="h-4 w-4" /><span>Location</span></Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowLinkInput((current) => !current)} disabled={!canSendMessages} className="h-9 gap-1 px-2 text-xs text-white"><LinkIcon className="h-4 w-4" /><span>Link</span></Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowEmojiPicker((current) => !current)} disabled={!canSendMessages} className="h-9 gap-1 px-2 text-xs text-white"><Smile className="h-4 w-4" /><span>Emoji</span></Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowReferencePicker((current) => !current)} disabled={!canSendMessages} className="h-9 gap-1 border border-amber-200/70 px-2 text-xs text-white"><Pin className="h-4 w-4" /><span>Reference</span></Button>
            {uploadingMedia && <span role="status" className="inline-flex items-center gap-1 text-xs text-white"><Loader2 className="loading-spinner h-3.5 w-3.5" />Uploading…</span>}
          </div>
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={!canSendMessages} placeholder={canSendMessages ? "Type your message..." : "Complete your profile to message"} className="flex-1 rounded-full border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500" maxLength={1000} />
            <Button type="submit" size="sm" disabled={!canSendMessages || !newMessage.trim()} className="rounded-full border-[0.5px] border-blue-200 shadow-white/15 h-10 w-10 p-0 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700"><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      </div>
      <Dialog open={!!mediaPreview} onOpenChange={(open) => { if (!open) setMediaPreview(null); }}>
        <DialogContent className="max-w-5xl border-white/20 bg-slate-950 p-3">
          <DialogHeader><DialogTitle className="text-white">{mediaPreview?.name || (mediaPreview?.type === "video" ? "Shared video" : "Shared image")}</DialogTitle></DialogHeader>
          {mediaPreview?.type === "image" && <img src={mediaPreview.url} alt={mediaPreview.name || "Shared image"} className="mx-auto max-h-[70vh] max-w-full rounded-lg object-contain" />}
          {mediaPreview?.type === "video" && <video src={mediaPreview.url} controls autoPlay playsInline className="mx-auto max-h-[70vh] max-w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Chat;
