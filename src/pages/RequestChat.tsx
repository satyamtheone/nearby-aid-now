import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, MessageCircle, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRequestMessages } from "@/hooks/useRequestMessages";
import { useHelpRequests } from "@/hooks/useHelpRequests";
import { formatTime, formatChatTime } from "@/utils/timeUtils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import UserProfileModal from "@/components/UserProfileModal";

const RequestChat = () => {
  const navigate = useNavigate();
  const { requestId } = useParams<{ requestId: string }>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");
  const [userOnlineStatus, setUserOnlineStatus] = useState<{[key: string]: boolean}>({});
  const [userDistances, setUserDistances] = useState<{[key: string]: number}>({});
  const { user, userLocation } = useAuth();
  const { messages, loading, sendMessage } = useRequestMessages(
    requestId || null
  );
  const { helpRequests } = useHelpRequests();

  const currentRequest = helpRequests.find((req) => req.id === requestId);

  // Get online status and distance for users
  const getOnlineStatusAndDistance = async () => {
    if (!userLocation || !messages.length) return;

    try {
      // Get unique user IDs from messages
      const userIds = [...new Set(messages.map(m => m.user_id))];
      
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
        const { data: creatorDistance } = await supabase.rpc("get_help_request_user_distance" as any, {
          request_user_id: currentRequest.user_id,
          current_user_lat: userLocation.lat,
          current_user_lng: userLocation.lng,
        });
        
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

  useEffect(() => {
    if (userLocation && messages.length > 0) {
      getOnlineStatusAndDistance();
      const interval = setInterval(getOnlineStatusAndDistance, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
  }, [userLocation, messages.length, currentRequest]);

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
      setNewMessage(messageText); // Restore the message
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

      {/* Request Details */}
      {currentRequest && (
        <div className="">
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
                    userName={currentRequest.profiles?.full_name || currentRequest.profiles?.username || "Anonymous"}
                    isOnline={userOnlineStatus[currentRequest.user_id] || false}
                    distance={userDistances[currentRequest.user_id]}
                  >
                    <button className="capitalize text-black hover:text-blue-600 transition-colors">
                      by{" "}
                      {currentRequest.profiles?.full_name ||
                        currentRequest.profiles?.username ||
                        "Anonymous"}
                      {userOnlineStatus[currentRequest.user_id] && (
                        <span className="ml-2 text-green-600">●</span>
                      )}
                      {userDistances[currentRequest.user_id] && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({userDistances[currentRequest.user_id] < 1 
                            ? `${Math.round(userDistances[currentRequest.user_id] * 1000)}m` 
                            : `${userDistances[currentRequest.user_id].toFixed(1)}km`})
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

      {/* Messages */}
      <div className="flex-1 max-w-md max-md:max-w-lg md:max-w-3xl mx-auto w-full px-1 sm:px-4 py-4 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          </div>
        ) : (
          <div className="space-y-4 ">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
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

                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      isOwnMessage ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-3 border-[0.5px] border-blue-200 backdrop-blur-md bg-white/10 
                        
                      `}
                    >
                      {!isOwnMessage && (
                        <div className="flex items-center justify-between mb-1">
                          <UserProfileModal
                            userId={message.user_id}
                            userName={userName}
                            isOnline={userOnlineStatus[message.user_id] || false}
                            distance={userDistances[message.user_id]}
                          >
                            <button className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                              <div className={`w-2 h-2 rounded-full ${
                                userOnlineStatus[message.user_id] ? "bg-green-500" : "bg-gray-400"
                              }`}></div>
                              <span className="text-[13px] font-medium text-blue-600 capitalize">
                                {userName}
                              </span>
                            </button>
                          </UserProfileModal>
                        </div>
                      )}
                      <p className={`text-sm leading-relaxed text-white`}>
                        {message.message}
                      </p>
                      <p
                        className={`text-xs mt-1 text-white ${
                          isOwnMessage
                            ? "flex justify-end"
                            : " flex justify-start"
                        }`}
                      >
                        {formatChatTime(message.created_at)}
                      </p>
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
      <div className=" border-t-[0.5px] border-blue-200 backdrop-blur-md  bg-black/10 sticky bottom-0 p-4">
        <div className="max-w-md max-md:max-w-lg md:max-w-3xl mx-auto">
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 rounded-full border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              maxLength={200}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newMessage.trim()}
              className="rounded-full h-10 w-10 p-0 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RequestChat;
