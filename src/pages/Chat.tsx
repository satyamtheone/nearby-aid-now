import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Chat = () => {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");
  const [onlineUsersCount, setOnlineUsersCount] = useState(0);
  const [userOnlineStatus, setUserOnlineStatus] = useState<{
    [key: string]: boolean;
  }>({});
  const { user, userLocation } = useAuth();
  const { messages, loading, sendMessage } = useMessages();

  // Get online users and their status
  const getOnlineUsers = async () => {
    if (!userLocation) return;

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

      const nearbyUsers = (data as any[]) || [];
      console.log("Chat: Nearby users:", nearbyUsers);

      const onlineCount = nearbyUsers.filter((u) => u.is_online).length;
      setOnlineUsersCount(onlineCount);

      // Create status map for all users
      const statusMap: { [key: string]: boolean } = {};
      nearbyUsers.forEach((u) => {
        statusMap[u.user_id] = u.is_online;
      });
      setUserOnlineStatus(statusMap);

      console.log("Chat: Online count:", onlineCount, "Status map:", statusMap);
    } catch (error) {
      console.error("Chat: Error getting online users:", error);
    }
  };

  useEffect(() => {
    if (userLocation) {
      getOnlineUsers();
      const interval = setInterval(getOnlineUsers, 8000); // Every 8 seconds
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
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                online ? "bg-green-500" : "bg-gray-200"
                              }`}
                            ></div>
                            <span className="text-[13px] font-medium text-blue-600 capitalize ">
                              {userName}
                            </span>

                            {/* <span
                              className={`text-xs ${
                                online ? "text-green-600" : "text-gray-500"
                              }`}
                            >
                              {online ? "Online" : "Offline"}
                            </span> */}
                          </div>
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
