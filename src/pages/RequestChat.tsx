import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Send,
  MessageCircle,
  Clock,
  User,
  CheckCircle,
  Star,
  Image as ImageIcon,
  Video,
  Link as LinkIcon,
  MapPin,
  Smile,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRequestMessages } from "@/hooks/useRequestMessages";
import { formatTime, formatChatTime } from "@/utils/timeUtils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import UserProfileModal from "@/components/UserProfileModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { parseReplyFallbackText } from "@/utils/chatMessageUtils";
import { Skeleton } from "@/components/ui/skeleton";

const RequestChat = () => {
  const navigate = useNavigate();
  const { requestId } = useParams<{ requestId: string }>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newMessage, setNewMessage] = useState("");
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [pendingJumpId, setPendingJumpId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [mediaPreview, setMediaPreview] = useState<{
    type: "image" | "video";
    url: string;
    name?: string;
  } | null>(null);
  const [userOnlineStatus, setUserOnlineStatus] = useState<{
    [key: string]: boolean;
  }>({});
  const [userDistances, setUserDistances] = useState<{ [key: string]: number }>(
    {}
  );
  const [currentRequest, setCurrentRequest] = useState<any>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [selectedHelper, setSelectedHelper] = useState("");
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [noHelpersConfirmed, setNoHelpersConfirmed] = useState(false);
  const [feedbackedHelperId, setFeedbackedHelperId] = useState<string | null>(
    null
  );
  const { user, userLocation } = useAuth();
  const { messages, loading, sendMessage, fetchMessageById } =
    useRequestMessages(requestId || null);
  const [requestLoading, setRequestLoading] = useState(true);

  useEffect(() => {
    if (!requestId) return;
    let active = true;
    supabase
      .from("help_requests")
      .select("*, profiles(username, full_name)")
      .eq("id", requestId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error)
          toast({
            title: "Unable to load request",
            description: error.message,
            variant: "destructive",
          });
        setCurrentRequest(data);
        setRequestLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestId]);

  const helpers = [
    ...new Map(
      messages
        .filter((message) => message.user_id !== currentRequest?.user_id)
        .map((message) => [
          message.user_id,
          {
            id: message.user_id,
            name:
              message.profiles?.full_name ||
              message.profiles?.username ||
              "Community member",
          },
        ])
    ).values(),
  ];

  useEffect(() => {
    if (!requestId || !currentRequest?.is_resolved) return;
    let active = true;
    supabase
      .from("request_feedback")
      .select("helper_id")
      .eq("request_id", requestId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (active && !error && data) setFeedbackedHelperId(data.helper_id);
      });
    return () => {
      active = false;
    };
  }, [requestId, currentRequest?.is_resolved]);

  const feedbackedHelper = helpers.find(
    (helper) => helper.id === feedbackedHelperId
  );

  const openFulfillmentDialog = () => {
    if (
      !currentRequest ||
      currentRequest.user_id !== user?.id ||
      currentRequest.is_resolved
    )
      return;
    setFeedbackOpen(true);
  };

  const submitFulfillment = async () => {
    if (
      !user ||
      !currentRequest ||
      currentRequest.user_id !== user.id ||
      currentRequest.is_resolved
    )
      return;
    if (helpers.length && (!selectedHelper || !rating || !feedback.trim()))
      return;
    if (!helpers.length && !noHelpersConfirmed) return;

    setSubmittingFeedback(true);
    let feedbackSubmitted: boolean | null = null;
    try {
      const { data, error } = await supabase.rpc("fulfill_help_request", {
        p_request_id: requestId!,
        p_helper_id: helpers.length ? selectedHelper : null,
        p_rating: helpers.length ? rating : null,
        p_feedback: helpers.length ? feedback.trim() : null,
        p_confirm_no_helpers: !helpers.length && noHelpersConfirmed,
      });
      if (error) throw error;
      feedbackSubmitted = data;
    } catch (error: any) {
      console.error("Request fulfillment failed:", error);
      const description =
        error?.code === "PGRST202"
          ? "Supabase is missing the fulfill_help_request function. Apply 20261024010000_atomic_request_fulfillment.sql after 20261024000000_request_fulfillment_feedback.sql in the Supabase SQL Editor, then reload this page and try again."
          : `${error?.message || "A network error occurred."}${
              error?.details ? ` ${error.details}` : ""
            }${error?.hint ? ` ${error.hint}` : ""}`;
      toast({
        title: "Could not fulfill request",
        description,
        variant: "destructive",
      });
      return;
    } finally {
      setSubmittingFeedback(false);
    }

    if (feedbackSubmitted) setFeedbackedHelperId(selectedHelper);
    setCurrentRequest((previous: any) => ({
      ...previous,
      is_resolved: true,
      closed_without_helper: !feedbackSubmitted,
    }));
    toast({
      title: "Request fulfilled",
      description: feedbackSubmitted
        ? "Your feedback was saved and the request is now closed."
        : "The request is closed without feedback because nobody else joined the chat.",
    });
    setFeedbackOpen(false);
  };

  // Get online status and distance for users
  const getOnlineStatusAndDistance = async () => {
    if (!userLocation || !messages.length) return;

    try {
      // Get unique user IDs from messages
      const userIds = [...new Set(messages.map((m) => m.user_id))];

      const { data, error } = await supabase.rpc("get_nearby_users" as any, {
        user_lat: userLocation.lat,
        user_lng: userLocation.lng,
        radius_km: 50, // Wider radius for request chats
      });

      if (error) {
        console.error("Error getting user status:", error);
        return;
      }

      const nearbyUsers = (data as any[]) || [];

      // Update online status
      const statusMap: { [key: string]: boolean } = {};
      nearbyUsers.forEach((u) => {
        statusMap[u.user_id] = u.is_online;
      });
      setUserOnlineStatus(statusMap);

      // Calculate distances for help request creator and participants
      const distanceMap: { [key: string]: number } = {};

      if (currentRequest && userLocation) {
        // Get distance to request creator
        const { data: creatorDistance } = await supabase.rpc(
          "get_help_request_user_distance" as any,
          {
            request_user_id: currentRequest.user_id,
            current_user_lat: userLocation.lat,
            current_user_lng: userLocation.lng,
          }
        );

        if (creatorDistance !== null) {
          distanceMap[currentRequest.user_id] = creatorDistance;
        }
      }

      setUserDistances(distanceMap);
    } catch (error) {
      console.error("Error getting user status and distance:", error);
    }
  };

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
        toast({
          title: "Referenced message unavailable",
          description: result.error || "This message may have been removed.",
          variant: "destructive",
        });
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
    highlightTimeoutRef.current = setTimeout(
      () => setHighlightedMessageId(null),
      2400
    );
  }, [pendingJumpId, messages]);

  useEffect(
    () => () => {
      if (highlightTimeoutRef.current)
        clearTimeout(highlightTimeoutRef.current);
    },
    []
  );

  useEffect(() => {
    if (userLocation && messages.length > 0) {
      getOnlineStatusAndDistance();
      const interval = setInterval(getOnlineStatusAndDistance, 10000);
      return () => clearInterval(interval);
    }
  }, [userLocation, messages.length, currentRequest]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage("");

    const { error, warning } = await sendMessage(messageText, {
      reply_to_message_id: replyToMessageId,
    });
    if (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      setNewMessage(messageText); // Restore the message
    } else {
      setReplyToMessageId(null);
      if (warning)
        toast({
          title: "Message sent with a quoted reference",
          description: warning,
        });
    }
  };

  const handleMediaSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast({
        title: "Unsupported file",
        description: "Choose an image or video.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File is too large",
        description: "Images and videos must be 50 MB or smaller.",
        variant: "destructive",
      });
      return;
    }
    const extension =
      file.name
        .split(".")
        .pop()
        ?.replace(/[^a-zA-Z0-9]/g, "") || "media";
    const path = `${user.id}/chat/${crypto.randomUUID()}.${extension}`;
    setUploadingMedia(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from("community-media")
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const publicUrl = supabase.storage
        .from("community-media")
        .getPublicUrl(path).data.publicUrl;
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
      if (warning)
        toast({
          title: "Media sent with a quoted reference",
          description: warning,
        });
    } catch (error: any) {
      console.error("Chat media upload failed:", error);
      const message = error?.message || "Please try again.";
      toast({
        title: "Could not send media",
        description: /bucket not found/i.test(message)
          ? "The community-media bucket is missing in Supabase. Apply migration 20261024020000_chat_media_links_and_pins.sql to create it."
          : message,
        variant: "destructive",
      });
    } finally {
      setUploadingMedia(false);
    }
  };

  const shareLink = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const url = new URL(linkInput.trim());
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error("Use a link that starts with http:// or https://");
      const { error, warning } = await sendMessage("Shared a link", {
        content_type: "link",
        attachment_url: url.toString(),
        reply_to_message_id: replyToMessageId,
      });
      if (error) throw new Error(error);
      setLinkInput("");
      setShowLinkInput(false);
      setReplyToMessageId(null);
      if (warning)
        toast({
          title: "Link shared with a quoted reference",
          description: warning,
        });
    } catch (error: any) {
      const message = error?.message || "Enter a valid web link.";
      toast({
        title: "Could not share link",
        description: /column|schema cache/i.test(message)
          ? "Apply migration 20261024020000_chat_media_links_and_pins.sql, then refresh the app."
          : message,
        variant: "destructive",
      });
    }
  };

  const shareLocation = async () => {
    if (!userLocation) {
      toast({
        title: "Location unavailable",
        description: "Allow location access and try again.",
        variant: "destructive",
      });
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
    if (error)
      toast({
        title: "Could not share location",
        description: error,
        variant: "destructive",
      });
    else {
      setReplyToMessageId(null);
      if (warning)
        toast({
          title: "Location shared with a quoted reference",
          description: warning,
        });
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      Medical: "bg-red-100 text-red-800 border-red-200",
      Food: "bg-orange-100 text-orange-800 border-orange-200",
      Vehicle: "bg-blue-100 text-blue-800 border-blue-200",
      Other: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[category as keyof typeof colors] || colors.Other;
  };

  if (!requestId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">No request selected</p>
          <Button onClick={() => navigate("/")} className="mt-4">
            Go Back Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="z-50 border-b-[0.5px] border-blue-200 backdrop-blur-md  bg-black/10 sticky top-0 text-shadow-2xl text-white   text-shadow-blue-200 ">
        <div className="max-w-md max-md:max-w-lg md:max-w-3xl mx-auto px-4 py-4 ">
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
              <div className="flex-1">
                <h1 className="text-lg font-semibold">Help Request Chat</h1>
                {currentRequest && (
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge
                      variant="outline"
                      className={`text-xs ${getCategoryColor(
                        currentRequest.category
                      )}`}
                    >
                      {currentRequest.category}
                    </Badge>
                    {currentRequest.is_urgent && (
                      <Badge variant="destructive" className="text-xs">
                        Urgent
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {currentRequest &&
                !currentRequest.is_resolved &&
                currentRequest.user_id === user?.id && (
                  <Button
                    onClick={openFulfillmentDialog}
                    disabled={requestLoading || loading}
                    size="sm"
                    className="h-8 px-2 text-xs bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Mark fulfilled
                  </Button>
                )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/profile")}
                className="p-2"
              >
                <User className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Request Details */}
      {requestLoading ? (
        <div className="px-1 sm:px-4 py-3">
          <CardHeader className="rounded-lg border border-white/20 bg-white/10 p-5 py-10 backdrop-blur-md">
            <div className="skeleton-shimmer skeleton-shimmer-on-dark h-4 w-3/4 rounded"></div>
            <div className="skeleton-shimmer skeleton-shimmer-on-dark mt-2 h-3 w-1/2 rounded"></div>
          </CardHeader>
        </div>
      ) : (
        <div>
          <div className="max-w-md max-md:max-w-lg md:max-w-3xl mx-auto px-1 sm:px-4 py-3 ">
            <Card>
              <CardHeader className="pb-2">
                <p className="text-sm font-medium text-gray-900">
                  {currentRequest.message}
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(currentRequest.created_at)}</span>
                  </div>
                  <UserProfileModal
                    userId={currentRequest.user_id}
                    userName={
                      currentRequest.profiles?.full_name ||
                      currentRequest.profiles?.username ||
                      "Anonymous"
                    }
                    isOnline={userOnlineStatus[currentRequest.user_id] || false}
                    distance={userDistances[currentRequest.user_id]}
                  >
                    <button className="capitalize font-bold  text-[14px] text-blue-600 transition-colors">
                      by{" "}
                      {currentRequest.profiles?.full_name.slice(0, 10) ||
                        currentRequest.profiles?.username.slice(0, 10) ||
                        "Anonymous"}
                      {userOnlineStatus[currentRequest.user_id] && (
                        <span className="ml-2 text-green-600">●</span>
                      )}
                      {userDistances[currentRequest.user_id] && (
                        <span className="ml-2 text-xs text-gray-500">
                          (
                          {userDistances[currentRequest.user_id] === 0
                            ? `${Math.round(
                                userDistances[currentRequest.user_id] * 1000
                              )}m`
                            : `${userDistances[currentRequest.user_id].toFixed(
                                1
                              )}km`}
                          )
                        </span>
                      )}
                    </button>
                  </UserProfileModal>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {currentRequest && (
        <div className="max-w-md max-md:max-w-lg md:max-w-3xl mx-auto w-full px-1 sm:px-4">
          {currentRequest.is_resolved ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 flex flex-wrap items-center gap-2">
              <CheckCircle className="h-4 w-4" /> This request has been
              fulfilled and is closed.
              {feedbackedHelperId && (
                <span className="w-full pl-6">
                  Helped by{" "}
                  <strong>
                    {feedbackedHelper?.name || "a community member"}
                  </strong>
                </span>
              )}
              {currentRequest.closed_without_helper && (
                <span className="w-full pl-6">
                  Closed without feedback because nobody else joined the chat.
                </span>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 max-w-md max-md:max-w-lg md:max-w-3xl mx-auto w-full px-1 sm:px-4 py-4 overflow-y-auto">
        {loading ? (
          <div className="space-y-4 py-2" role="status" aria-label="Loading request messages">
            {["start", "end"].map((side, index) => (
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
          <div className="space-y-4 ">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="h-12 w-12 text-white mx-auto mb-3" />
                <p className="text-white">
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
                const fallbackReply = parseReplyFallbackText(
                  message.message || ""
                );
                const referencedMessageId =
                  message.reply_to_message_id || fallbackReply.replyId;
                const replyTarget = referencedMessageId
                  ? messages.find(
                      (candidate) => candidate.id === referencedMessageId
                    )
                  : null;
                const replyPreview = replyTarget
                  ? replyTarget.content_type === "image"
                    ? "📷 Photo"
                    : replyTarget.content_type === "video"
                    ? "🎥 Video"
                    : replyTarget.content_type === "location"
                    ? `📍 ${replyTarget.location_name || "Location"}`
                    : replyTarget.content_type === "link"
                    ? replyTarget.attachment_url
                    : replyTarget.message
                  : fallbackReply.quoteLabel || "Referenced message";
                const visibleMessage =
                  fallbackReply.body === "Shared a link" ||
                  fallbackReply.body === "Shared a location"
                    ? ""
                    : fallbackReply.body;

                return (
                  <div
                    key={message.id}
                    ref={(element) => {
                      messageRefs.current[message.id] = element;
                    }}
                    className={`flex ${
                      isOwnMessage ? "justify-end" : "justify-start"
                    } ${
                      highlightedMessageId === message.id
                        ? "rounded-xl bg-amber-300/30 ring-4 ring-amber-300 shadow-xl transition-all duration-300"
                        : "transition-all duration-300"
                    }`}
                  >
                    <div
                      className={`chat-message-bubble max-w-[80%] rounded-xl px-4 py-3 border-[0.5px] border-blue-200 backdrop-blur-md bg-white/10
                        
                      `}
                    >
                      {!isOwnMessage && (
                        <div className="flex items-center justify-between mb-1">
                          <UserProfileModal
                            userId={message.user_id}
                            userName={userName}
                            isOnline={
                              userOnlineStatus[message.user_id] || false
                            }
                            distance={userDistances[message.user_id]}
                          >
                            <button className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  userOnlineStatus[message.user_id]
                                    ? "bg-green-500"
                                    : "bg-gray-400"
                                }`}
                              ></div>
                              <span className="text-[13px] font-medium text-blue-600 capitalize">
                                {userName}
                              </span>
                            </button>
                          </UserProfileModal>
                        </div>
                      )}
                      {referencedMessageId && (
                        <button
                          type="button"
                          onClick={() =>
                            void jumpToMessage(referencedMessageId)
                          }
                          className="mb-2 block w-full cursor-pointer border-l-2 border-amber-400 bg-black/10 px-2 py-1 text-left text-xs text-white/80 hover:bg-black/20"
                        >
                          <span className="block font-semibold">
                            Replying to{" "}
                            {replyTarget?.profiles?.full_name ||
                              replyTarget?.profiles?.username ||
                              "message"}
                          </span>
                          <span className="block truncate">{replyPreview}</span>
                        </button>
                      )}
                      {message.content_type === "image" &&
                        message.attachment_url && (
                          <button
                            type="button"
                            onClick={() =>
                              setMediaPreview({
                                type: "image",
                                url: message.attachment_url!,
                                name: message.attachment_name || undefined,
                              })
                            }
                            className="block cursor-zoom-in"
                          >
                            <img
                              src={message.attachment_url}
                              alt={message.attachment_name || "Shared image"}
                              className="max-h-72 max-w-full rounded-lg object-contain"
                              loading="lazy"
                            />
                          </button>
                        )}
                      {message.content_type === "video" &&
                        message.attachment_url && (
                          <button
                            type="button"
                            onClick={() =>
                              setMediaPreview({
                                type: "video",
                                url: message.attachment_url!,
                                name: message.attachment_name || undefined,
                              })
                            }
                            className="relative block cursor-zoom-in"
                          >
                            <video
                              src={message.attachment_url}
                              muted
                              preload="metadata"
                              className="max-h-72 max-w-full rounded-lg"
                              aria-label={
                                message.attachment_name || "Shared video"
                              }
                            />
                            <span className="absolute inset-0 flex items-center justify-center text-3xl text-white drop-shadow">
                              ▶
                            </span>
                          </button>
                        )}
                      {message.content_type === "link" &&
                        message.attachment_url && (
                          <a
                            href={message.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="my-2 block break-all rounded-lg bg-blue-50 p-3 text-blue-700 underline"
                          >
                            <LinkIcon className="mr-2 inline h-4 w-4" />
                            {message.attachment_url}
                          </a>
                        )}
                      {message.content_type === "location" &&
                        message.attachment_url && (
                          <a
                            href={message.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="my-2 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-emerald-800"
                          >
                            <MapPin className="h-5 w-5" />
                            <span>
                              <strong className="block">Shared location</strong>
                              <span className="text-xs">
                                {message.location_name || "Open in Maps"}
                              </span>
                            </span>
                          </a>
                        )}
                      {!!visibleMessage && (
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white">
                          {visibleMessage}
                        </p>
                      )}
                      <div
                        className={`mt-2 flex items-center gap-3 text-xs text-white ${
                          isOwnMessage ? "justify-end" : "justify-start"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setReplyToMessageId(message.id)}
                          className="underline underline-offset-2 hover:text-amber-200"
                        >
                          💬 Reply
                        </button>
                        <span>{formatChatTime(message.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      {!currentRequest?.is_resolved && (
        <div className=" border-t-[0.5px] border-blue-200 backdrop-blur-md  bg-black/10 sticky bottom-0 p-4">
          <div className="max-w-md max-md:max-w-lg md:max-w-3xl mx-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleMediaSelected}
            />
            {replyToMessageId &&
              (() => {
                const target = messages.find(
                  (item) => item.id === replyToMessageId
                );
                const preview = !target
                  ? "Referenced message"
                  : target.content_type === "image"
                  ? "📷 Photo"
                  : target.content_type === "video"
                  ? "🎥 Video"
                  : target.content_type === "location"
                  ? `📍 ${target.location_name || "Location"}`
                  : target.content_type === "link"
                  ? target.attachment_url
                  : target.message;
                return (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border-l-4 border-amber-400 bg-white/15 px-3 py-2 text-sm text-white">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">
                        Replying to{" "}
                        {target?.profiles?.full_name ||
                          target?.profiles?.username ||
                          "message"}
                      </p>
                      <p className="truncate text-xs">{preview}</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Cancel reply"
                      onClick={() => setReplyToMessageId(null)}
                      className="px-2 text-lg"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })()}
            {showLinkInput && (
              <form onSubmit={shareLink} className="mb-2 flex gap-2">
                <Input
                  type="url"
                  value={linkInput}
                  onChange={(event) => setLinkInput(event.target.value)}
                  placeholder="Paste a link (https://...)"
                  className="text-black"
                />
                <Button type="submit" size="sm" disabled={!linkInput.trim()}>
                  Share link
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowLinkInput(false)}
                >
                  Cancel
                </Button>
              </form>
            )}
            {showEmojiPicker && (
              <div
                className="mb-2 flex flex-wrap gap-1 rounded-xl border bg-white p-2"
                aria-label="Emoji picker"
              >
                {"😀 😃 😄 😊 🙂 🥰 😎 🤝 🙏 👋 👍 ❤️ 🎉 🌍 📍"
                  .split(" ")
                  .map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="rounded p-1 text-xl hover:bg-gray-100"
                      onClick={() =>
                        setNewMessage((current) => `${current}${emoji}`)
                      }
                    >
                      {emoji}
                    </button>
                  ))}
              </div>
            )}
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "image/*";
                    fileInputRef.current.click();
                  }
                }}
                disabled={uploadingMedia}
                className="h-9 gap-1 px-2 text-xs text-white"
              >
                <ImageIcon className="h-4 w-4" />
                Image
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "video/*";
                    fileInputRef.current.click();
                  }
                }}
                disabled={uploadingMedia}
                className="h-9 gap-1 px-2 text-xs text-white"
              >
                <Video className="h-4 w-4" />
                Video
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={shareLocation}
                className="h-9 gap-1 px-2 text-xs text-white"
              >
                <MapPin className="h-4 w-4" />
                Location
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowLinkInput((current) => !current)}
                className="h-9 gap-1 px-2 text-xs text-white"
              >
                <LinkIcon className="h-4 w-4" />
                Link
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowEmojiPicker((current) => !current)}
                className="h-9 gap-1 px-2 text-xs text-white"
              >
                <Smile className="h-4 w-4" />
                Emoji
              </Button>
              {uploadingMedia && (
                <span role="status" className="inline-flex items-center gap-1 text-xs text-white"><Loader2 className="loading-spinner h-3.5 w-3.5" />Uploading…</span>
              )}
            </div>
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 rounded-full focus:border-white focus:ring-white"
                maxLength={200}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newMessage.trim()}
                className={`rounded-full h-10 w-10 p-0 bg-gradient-to-r from-blue-600 to-teal-600 border-2 hover:from-blue-700 hover:to-teal-700 ${
                  !newMessage.trim() ? "border-gray-400" : " border-white"
                }`}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-white">
              Fulfill this request
            </DialogTitle>
            <DialogDescription className="text-white/80">
              {helpers.length
                ? "Choose the person who helped and submit a rating and feedback. The request will close after everything is saved."
                : "Nobody else has joined this chat. You can confirm closing without feedback, or keep the request open."}
            </DialogDescription>
          </DialogHeader>
          {helpers.length ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-white">
                  Who helped you?
                </label>
                <Select
                  value={selectedHelper}
                  onValueChange={setSelectedHelper}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a chat participant" />
                  </SelectTrigger>
                  <SelectContent>
                    {helpers.map((helper) => (
                      <SelectItem key={helper.id} value={helper.id}>
                        {helper.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-white">Rating</label>
                <div
                  className="flex gap-1 mt-1"
                  role="radiogroup"
                  aria-label="Rating"
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${value} stars`}
                      aria-pressed={rating === value}
                      onClick={() => setRating(value)}
                      className="p-1"
                    >
                      <Star
                        className={`h-7 w-7 ${
                          rating >= value
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-white/60"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-white">
                  Feedback
                </label>
                <Textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  maxLength={500}
                  placeholder="Tell others about your experience with this helper"
                />
              </div>
              <Button
                className="w-full"
                onClick={submitFulfillment}
                disabled={
                  submittingFeedback ||
                  !selectedHelper ||
                  !rating ||
                  !feedback.trim()
                }
              >
                {submittingFeedback
                  ? "Saving feedback and closing..."
                  : "Submit feedback and fulfill request"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="flex items-start gap-3 text-sm text-white">
                <Checkbox
                  checked={noHelpersConfirmed}
                  onCheckedChange={(checked) =>
                    setNoHelpersConfirmed(checked === true)
                  }
                />
                <span>
                  No one else joined this chat. I want to close this request
                  without feedback.
                </span>
              </label>
              <Button
                className="w-full"
                variant="destructive"
                onClick={submitFulfillment}
                disabled={submittingFeedback || !noHelpersConfirmed}
              >
                {submittingFeedback
                  ? "Closing request..."
                  : "Confirm and close without feedback"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!mediaPreview}
        onOpenChange={(open) => {
          if (!open) setMediaPreview(null);
        }}
      >
        <DialogContent className="max-w-5xl border-white/20 bg-slate-950 p-3">
          <DialogHeader>
            <DialogTitle className="text-white">
              {mediaPreview?.name ||
                (mediaPreview?.type === "video"
                  ? "Shared video"
                  : "Shared image")}
            </DialogTitle>
          </DialogHeader>
          {mediaPreview?.type === "image" && (
            <img
              src={mediaPreview.url}
              alt={mediaPreview.name || "Shared image"}
              className="mx-auto max-h-[70vh] max-w-full rounded-lg object-contain"
            />
          )}
          {mediaPreview?.type === "video" && (
            <video
              src={mediaPreview.url}
              controls
              autoPlay
              playsInline
              className="mx-auto max-h-[70vh] max-w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestChat;
