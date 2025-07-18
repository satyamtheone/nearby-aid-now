import React, { useState, useEffect } from "react";
import {
  MapPin,
  Users,
  MessageCircle,
  Clock,
  Navigation,
  LogOut,
  Map as MapIcon,
  Globe,
  User2Icon,
  User2,
  CircleUserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useHelpRequests } from "@/hooks/useHelpRequests";
import { formatTime } from "@/utils/timeUtils";
import Map from "@/components/Map";

const Home = () => {
  const navigate = useNavigate();
  const { user, signOut, userLocation, nearbyUsersCount } = useAuth();
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

  return (
    <div className="min-h-screen ">
      {/* Header */}
      <div className=" sticky top-0 z-50 border-b-[0.5px]  border-blue-200 backdrop-blur-xl  bg-black/10 text-shadow-2xl text-white   text-shadow-blue-200 ">
        <div className="max-w-md max-md:max-w-lg md:max-w-3xl mx-auto px-4 py-4 relative ">
          <div
            className="absolute -bottom-[15px] left-[47.5%] right-[50%]"
            onClick={() => navigate("/profile")}
          >
            <div>
              <CircleUserRound className="h-10 w-10 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white backdrop-blur-xl rounded-full cursor-pointer" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-between space-x-2 ">
              <MapPin className="h-5 w-5" />
              <div>
                <p className="text-sm">Your location</p>
                <p className="font-semibold">
                  {userLocation ? userLocation.name : "Getting location..."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-3">
              <div className="text-right">
                <div className="flex items-center space-x-1 text-green-600">
                  <Users className="h-4 w-4 text-white" />
                  <span className="text-sm font-medium  text-white">
                    {nearbyUsersCount}
                  </span>
                </div>
                <p className="text-xs ">Nearby</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="p-2"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {user && (
            <p className="text-xs text-shadow-2xl text-white text-shadow-blue-200 mt-1">
              Welcome,{" "}
              <span className=" font-bold capitalize">
                {getUserDisplayName()}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="max-w-md max-md:max-w-lg md:max-w-3xl mx-auto sm:px-4 px-1 py-6 space-y-6">
        {/* Ask for Help Button */}
        <div className=" fixed  bottom-10 right-3 z-50 rounded-xl shadow-md shadow-black/20 ">
          <Button
            onClick={() => navigate("/ask-help")}
            className="rounded-xl  bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <MessageCircle className="sm:mr-2 h-5 w-5" />
            <span className="">Ask for Help</span>
          </Button>
        </div>

        {/* Map Section */}

        <div className=" flex flex-col md:flex-row gap-4">
          {/* Location Filter Toggle */}
          <Button
            onClick={toggleLocationFilter}
            variant="outline"
            className={`w-full h-12 transition-all duration-200 ${
              showAllLocations
                ? "border-orange-200 text-orange-600 hover:bg-orange-50"
                : "border-green-200 text-green-600 hover:bg-green-50"
            }`}
          >
            {!showAllLocations ? (
              <>
                <Globe className="mr-2 h-5 w-5" />
                Show requests from all Locations
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-5 w-5" />
                Show users Within 10km
              </>
            )}
          </Button>

          {/* Live Users Map Toggle */}
          <Button
            onClick={() => setShowMap(!showMap)}
            variant="outline"
            className="w-full h-12 border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            <User2Icon className="mr-2 h-5 w-5" />
            {showMap ? "Hide" : "Show"} Live Users
          </Button>
        </div>
        {showMap && (
          <div className=" animate-in transition-all">
            <Map />
          </div>
        )}

        {/* Recent Help Requests */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-shadow-2xl text-white   text-shadow-blue-200">
              {showAllLocations ? "All Requests" : "Nearby Requests"}
            </h2>
            {/* <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/chat")}
              className=" text-white"
            >
              View All
            </Button> */}
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card
                  key={i}
                  className="animate-pulse h-44 rounded-2xl  border-[0.5px]  border-blue-200 backdrop-blur-xl  bg-white/10"
                >
                  <CardHeader className="pb-3">
                    <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2 mt-2"></div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="h-3 bg-gray-300 rounded w-full"></div>
                    <div className="h-4 bg-gray-300 rounded w-3/4 my-4"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4 mb-32">
              {helpRequests.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-500">
                      {showAllLocations
                        ? "No help requests yet. Be the first to ask for help!"
                        : "No help requests nearby. Try expanding to all locations."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                helpRequests.map((request) => (
                  <Card
                    key={request.id}
                    onClick={() => handleRequestReply(request.id)}
                    className="rounded-xl  border-[0.5px] cursor-pointer border-blue-200 backdrop-blur-md  bg-white/10 text-white"
                  >
                    <CardHeader className="pb-1">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge
                              variant="outline"
                              className={`text-xs ${getCategoryColor(
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
                          <p className="text-md capitalize font-medium first-letter:text-xl  first-letter:font-bold text-white text-shadow-blue-200  text-shadow-2xl leading-relaxed p-2">
                            {request.message}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <span className="text-sm capitalize italic">
                        by{" "}
                        <span className="font-bold">
                          {request.profiles?.full_name ||
                            request.profiles?.username ||
                            "Anonymous"}
                        </span>
                      </span>

                      <div className="flex justify-between mt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex text-[10px] sm:text-xs gap-4  text-white text-shadow-blue-200  text-shadow-2xl">
                            <div className="flex gap-0.5 ">
                              <Clock className="h-3 w-3" />
                              <span>{formatTime(request.created_at)}</span>
                            </div>
                            <div className="flex gap-0.5 items-center ">
                              <Navigation className="h-3 w-3" />
                              {/* <span>
                                {request.distance_km.toFixed(1)} km away
                              </span> */}
                              {request.distance_km
                                ? `${request.distance_km.toFixed(1)} km away`
                                : "Distance unknown"}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequestReply(request.id)}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50 rounded-xl"
                        >
                          Reply
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
