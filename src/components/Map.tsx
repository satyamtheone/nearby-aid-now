
import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface OnlineUser {
  user_id: string;
  full_name: string;
  username: string;
  location_name: string;
  lat: number;
  lng: number;
  distance_km: number;
  is_online: boolean;
}

const Map = () => {
  const { userLocation, user } = useAuth();
  const [allNearbyUsers, setAllNearbyUsers] = useState<OnlineUser[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Fetch nearby users from database
  const fetchNearbyUsers = async () => {
    if (!userLocation || !user) {
      console.log("Map: Missing userLocation or user");
      return;
    }

    try {
      console.log("Map: Fetching nearby users at:", userLocation);

      const { data, error } = await supabase.rpc("get_nearby_users" as any, {
        user_lat: userLocation.lat,
        user_lng: userLocation.lng,
        radius_km: 10.0,
      });

      if (error) {
        console.error("Map: Error fetching nearby users:", error);
        setMapError("Failed to fetch nearby users");
        return;
      }

      const users = (data as OnlineUser[]) || [];
      console.log("Map: Fetched users:", users);

      setAllNearbyUsers(users);
      setMapError(null);
    } catch (error) {
      console.error("Map: Error fetching nearby users:", error);
      setMapError("Failed to fetch nearby users");
    }
  };

  // Fetch nearby users when component mounts and periodically
  useEffect(() => {
    if (userLocation && user) {
      fetchNearbyUsers();
      const interval = setInterval(fetchNearbyUsers, 8000); // Every 8 seconds
      return () => clearInterval(interval);
    }
  }, [userLocation, user]);

  // Initialize simple map visualization
  const initializeMap = () => {
    console.log("Map: initializeMap called", {
      hasCanvas: !!canvasRef.current,
      hasUserLocation: !!userLocation,
      userLocation: userLocation
    });

    if (!canvasRef.current) {
      console.log("Map: Canvas ref not available");
      setMapError("Canvas not ready");
      setIsLoaded(false);
      return;
    }

    if (!userLocation) {
      console.log("Map: User location not available");
      setMapError("Location not available");
      setIsLoaded(false);
      return;
    }

    try {
      console.log("Map: Initializing simple map with users:", allNearbyUsers);

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error("Map: Failed to get canvas context");
        setMapError("Failed to create map context");
        setIsLoaded(false);
        return;
      }

      // Set canvas size
      canvas.width = 400;
      canvas.height = 300;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background
      ctx.fillStyle = '#e8f4fd';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate bounds - ensure we have valid numbers
      const allLats = [userLocation.lat, ...allNearbyUsers.map(u => u.lat)].filter(lat => !isNaN(lat) && lat !== null && lat !== undefined);
      const allLngs = [userLocation.lng, ...allNearbyUsers.map(u => u.lng)].filter(lng => !isNaN(lng) && lng !== null && lng !== undefined);
      
      if (allLats.length === 0 || allLngs.length === 0) {
        console.log("Map: No valid coordinates to display");
        setMapError("No valid coordinates to display");
        setIsLoaded(false);
        return;
      }

      const minLat = Math.min(...allLats) - 0.01;
      const maxLat = Math.max(...allLats) + 0.01;
      const minLng = Math.min(...allLngs) - 0.01;
      const maxLng = Math.max(...allLngs) + 0.01;

      // Convert lat/lng to canvas coordinates
      const latToY = (lat: number) => {
        if (isNaN(lat) || maxLat === minLat) return canvas.height / 2;
        return ((maxLat - lat) / (maxLat - minLat)) * (canvas.height - 40) + 20;
      };
      
      const lngToX = (lng: number) => {
        if (isNaN(lng) || maxLng === minLng) return canvas.width / 2;
        return ((lng - minLng) / (maxLng - minLng)) * (canvas.width - 40) + 20;
      };

      // Draw user's location (blue dot)
      const userX = lngToX(userLocation.lng);
      const userY = latToY(userLocation.lat);
      
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(userX, userY, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      // Add user label
      ctx.fillStyle = '#1f2937';
      ctx.font = '12px Arial';
      ctx.fillText('You', userX - 10, userY - 12);

      // Draw nearby users
      allNearbyUsers.forEach((nearbyUser) => {
        if (isNaN(nearbyUser.lat) || isNaN(nearbyUser.lng) || 
            nearbyUser.lat === null || nearbyUser.lat === undefined ||
            nearbyUser.lng === null || nearbyUser.lng === undefined) {
          console.log("Map: Skipping user with invalid coordinates:", nearbyUser);
          return;
        }

        const x = lngToX(nearbyUser.lng);
        const y = latToY(nearbyUser.lat);
        
        // Choose color based on online status
        ctx.fillStyle = nearbyUser.is_online ? '#10b981' : '#ef4444';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();
        
        // Add user name
        ctx.fillStyle = '#1f2937';
        ctx.font = '10px Arial';
        const userName = nearbyUser.full_name || 'Unknown';
        const textWidth = ctx.measureText(userName).width;
        ctx.fillText(userName, x - textWidth/2, y - 10);
      });

      setIsLoaded(true);
      setMapError(null);
      console.log("Map: Successfully initialized and set isLoaded to true");
    } catch (error) {
      console.error("Map: Error initializing map:", error);
      setMapError("Failed to initialize map");
      setIsLoaded(false);
    }
  };

  // Initialize map when we have location and canvas is ready
  useEffect(() => {
    // Add a small delay to ensure canvas is mounted
    const timeout = setTimeout(() => {
      if (userLocation) {
        console.log("Map: UserLocation available, initializing map");
        initializeMap();
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [allNearbyUsers, userLocation]);

  if (!userLocation) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">Getting your location...</p>
        </CardContent>
      </Card>
    );
  }

  const onlineUsers = allNearbyUsers.filter((u) => u.is_online);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>Live Users Map</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1 text-green-600">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">{onlineUsers.length}</span>
              <span className="text-xs">online</span>
            </div>
            <div className="flex items-center space-x-1 text-gray-600">
              <span className="text-sm font-medium">
                {allNearbyUsers.length}
              </span>
              <span className="text-xs">total</span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full h-64 rounded-lg border mb-4 flex items-center justify-center">
          {mapError ? (
            <div className="text-center">
              <p className="text-red-500 text-sm mb-2">Map Error</p>
              <p className="text-gray-500 text-xs">{mapError}</p>
            </div>
          ) : !isLoaded ? (
            <p className="text-gray-500">Loading map...</p>
          ) : (
            <canvas
              ref={canvasRef}
              className="w-full h-full border rounded-lg bg-blue-50"
              style={{ maxWidth: '400px', maxHeight: '300px' }}
            />
          )}
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-sm">Users Nearby (10km radius):</h4>
          {allNearbyUsers.length === 0 ? (
            <p className="text-sm text-gray-500">No other users nearby</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {allNearbyUsers
                .sort((a, b) =>
                  b.is_online === a.is_online ? 0 : b.is_online ? 1 : -1
                )
                .map((nearbyUser) => (
                  <div
                    key={nearbyUser.user_id}
                    className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg"
                  >
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {(nearbyUser.full_name || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`absolute -top-1 -right-1 w-3 h-3 ${
                          nearbyUser.is_online ? "bg-green-500" : "bg-gray-400"
                        } border-2 border-white rounded-full`}
                      ></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {nearbyUser.full_name || 'Unknown User'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        at {nearbyUser.location_name || 'Unknown location'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {isNaN(nearbyUser.distance_km) ? 'Distance unknown' : `${nearbyUser.distance_km.toFixed(1)} km away`}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <span
                        className={`text-xs font-medium ${
                          nearbyUser.is_online
                            ? "text-green-600"
                            : "text-gray-500"
                        }`}
                      >
                        {nearbyUser.is_online ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Map;
