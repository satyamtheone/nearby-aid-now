import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Send,
  MapPin,
  Users,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import UserProfileModal from "@/components/UserProfileModal";

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
}

const Chat = () => {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [showActiveUsers, setShowActiveUsers] = useState(false);
  const [userOnlineStatus, setUserOnlineStatus] = useState<{
    [key: string]: boolean;
  }>({});
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { user, userLocation } = useAuth();
  const { messages, loading, sendMessage } = useMessages();

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

      // Store all nearby users
      setActiveUsers(nearbyUsers);

      // Create status map for all users
      const statusMap: { [key: string]: boolean } = {};
      nearbyUsers.forEach((u) => {
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage("");

    const { error } = await sendMessage(messageText);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      setNewMessage(messageText);
    }
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
    <div className="min-h-screen  flex flex-col text-shadow-2xl text-white   text-shadow-blue-200">
      {/* Header */}
      <div className="shadow-sm  sticky top-0 border-b-[0.5px] border-blue-200 backdrop-blur-2xl  bg-black/10 z-50 ">
        <div className="max-w-md max-md:max-w-lg md:max-w-3xl mx-auto px-4 py-4">
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
                  {userLocation?.name || "Getting location..."} • 2km radius
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
                <Loader2 className="h-4 w-4 text-white animate-spin" />
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
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
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
                          {u.avatar_emoji ? (
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
      <div className="flex-1 max-w-md max-md:max-w-lg md:max-w-3xl mx-auto w-full  px-1 sm:px-4 py-4 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
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

                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      isOwnMessage ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl border-[0.5px] border-blue-200 backdrop-blur-sm  bg-white/10 px-4 py-3 ${
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
                            <button className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  online ? "bg-green-500" : "bg-gray-200"
                                }`}
                              ></div>
                              <span className="text-[13px] font-medium text-blue-600 capitalize">
                                {userName}
                              </span>
                            </button>
                          </UserProfileModal>
                        </div>
                      )}
                      <p
                        className={`text-sm leading-relaxed   text-white p-2 `}
                      >
                        {message.message}
                      </p>
                      <div className="flex justify-end gap-4 pt-4">
                        {!isOwnMessage && (
                          <Badge
                            variant="outline"
                            className="text-xs text-gray-500  bg-white"
                          >
                            {message.location_name || "No location found"}
                          </Badge>
                        )}
                        <p
                          className={`text-xs mt-1
                             text-blue-100  `}
                        >
                          {formatTime(message.created_at)}
                        </p>
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
      <div className=" p-4 sticky bottom-0 border-t-[0.5px] border-blue-200 backdrop-blur-2xl  bg-white/10">
        <div className="max-w-md max-md:max-w-lg md:max-w-3xl mx-auto sm:px-4 px-1">
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 rounded-full border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500"
              maxLength={200}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newMessage.trim()}
              className="rounded-full border-[0.5px] border-blue-200 shadow-white/15 h-10 w-10 p-0 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
