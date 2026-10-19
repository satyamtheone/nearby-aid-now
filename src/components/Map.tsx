import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import UserProfileModal from "@/components/UserProfileModal";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface OnlineUser {
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

// Custom marker icons
const createCustomIcon = (isOnline: boolean, avatarEmoji?: string | null) => {
  const emoji = avatarEmoji || (isOnline ? "🟢" : "⚪");
  return L.divIcon({
    className: "custom-user-marker",
    html: `
      <div class="marker-wrapper ${isOnline ? "online" : "offline"}">
        <div class="marker-pulse ${isOnline ? "online" : ""}"></div>
        <div class="marker-emoji">${emoji}</div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 38],
    popupAnchor: [0, -38],
  });
};

const createUserIcon = (isOnline: boolean, avatarEmoji?: string | null) => {
  const emoji = avatarEmoji || "📍";
  return L.divIcon({
    className: "custom-user-marker",
    html: `
      <div class="current-user-marker">
        <div class="marker-pulse-user"></div>
        <div class="marker-emoji-user">${emoji}</div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 42],
    popupAnchor: [0, -42],
  });
};

const Map = () => {
  const { userLocation, user } = useAuth();
  const [allNearbyUsers, setAllNearbyUsers] = useState<OnlineUser[]>([]);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const userMarkerRef = useRef<L.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Custom CSS for markers
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .marker-wrapper {
        position: relative;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .marker-wrapper.offline { opacity: 0.7; filter: grayscale(0.5); }
      .marker-pulse {
        position: absolute;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(16, 185, 129, 0.3);
        animation: markerPulse 2s infinite;
      }
      .marker-pulse.online { background: rgba(16, 185, 129, 0.4); }
      .marker-emoji {
        position: relative;
        font-size: 20px;
        line-height: 1;
        filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));
      }
      .current-user-marker {
        position: relative;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .marker-pulse-user {
        position: absolute;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(37, 99, 235, 0.35);
        animation: markerPulse 1.5s infinite;
        border: 2px solid rgba(37, 99, 235, 0.6);
      }
      .marker-emoji-user {
        position: relative;
        font-size: 22px;
        line-height: 1;
        filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));
      }
      @keyframes markerPulse {
        0% { transform: scale(0.8); opacity: 0.8; }
        50% { transform: scale(1.2); opacity: 0.4; }
        100% { transform: scale(0.8); opacity: 0.8; }
      }
      .leaflet-popup-content-wrapper {
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      }
      .leaflet-popup-content {
        margin: 12px 14px;
        font-family: inherit;
      }
      .map-popup-user {
        text-align: center;
        min-width: 140px;
      }
      .map-popup-user .popup-name {
        font-weight: 600;
        font-size: 13px;
        color: #1f2937;
        text-transform: capitalize;
      }
      .map-popup-user .popup-location {
        font-size: 11px;
        color: #6b7280;
        margin-top: 2px;
      }
      .map-popup-user .popup-status {
        font-size: 11px;
        font-weight: 500;
        margin-top: 4px;
      }
      .map-popup-user .popup-status.online { color: #059669; }
      .map-popup-user .popup-status.offline { color: #9ca3af; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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

  // Initialize Leaflet map
  useEffect(() => {
    if (!userLocation || !mapContainerRef.current) return;

    // Create map if it doesn't exist
    if (!mapRef.current) {
      console.log("Map: Creating Leaflet map instance");
      const map = L.map(mapContainerRef.current, {
        center: [userLocation.lat, userLocation.lng],
        zoom: 14,
        scrollWheelZoom: true,
        zoomControl: true,
      });

      // OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setIsLoaded(true);

      // Invalidate size after a tick to ensure proper rendering
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }

    return () => {
      // Don't destroy map here - clean up on unmount only
    };
  }, [userLocation]);

  // Clean up map on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = {};
        userMarkerRef.current = null;
      }
    };
  }, []);

  // Update user marker when location changes
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    // Add/update current user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    } else {
      const marker = L.marker([userLocation.lat, userLocation.lng], {
        icon: createUserIcon(true, "🧑‍💻"),
        zIndexOffset: 1000,
      }).addTo(mapRef.current);

      marker.bindPopup(
        `<div class="map-popup-user">
          <div class="popup-name">You</div>
          <div class="popup-location">${
            userLocation.name || "Your location"
          }</div>
          <div class="popup-status online">● Online</div>
        </div>`
      );

      userMarkerRef.current = marker;
    }
  }, [userLocation, mapRef.current]);

  // Update nearby user markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove markers for users no longer in the list
    const currentIds = new Set(allNearbyUsers.map((u) => u.user_id));
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      if (!currentIds.has(id)) {
        mapRef.current?.removeLayer(marker);
        delete markersRef.current[id];
      }
    });

    // Add or update markers for each nearby user
    allNearbyUsers.forEach((nearbyUser) => {
      const {
        user_id,
        lat,
        lng,
        is_online,
        avatar_emoji,
        full_name,
        username,
        location_name,
        distance_km,
      } = nearbyUser;

      if (
        isNaN(lat) ||
        isNaN(lng) ||
        lat === null ||
        lng === null ||
        lat === undefined ||
        lng === undefined
      ) {
        return;
      }

      const existingMarker = markersRef.current[user_id];
      const displayName = full_name || username || "Unknown User";
      const distanceText = !isNaN(distance_km)
        ? `${distance_km.toFixed(1)} km away`
        : "";
      const popupContent = `
        <div class="map-popup-user">
          <div class="popup-name">${displayName}</div>
          <div class="popup-location">${location_name || "Unknown location"}${
        distanceText ? ` • ${distanceText}` : ""
      }</div>
          <div class="popup-status ${is_online ? "online" : "offline"}">${
        is_online ? "● Online" : "○ Offline"
      }</div>
        </div>
      `;

      if (existingMarker) {
        existingMarker.setLatLng([lat, lng]);
        existingMarker.setIcon(createCustomIcon(is_online, avatar_emoji));
        existingMarker.setPopupContent(popupContent);
      } else {
        const marker = L.marker([lat, lng], {
          icon: createCustomIcon(is_online, avatar_emoji),
        }).addTo(mapRef.current!);

        marker.bindPopup(popupContent);
        markersRef.current[user_id] = marker;
      }
    });
  }, [allNearbyUsers, mapRef.current]);

  if (!userLocation) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <p className="text-gray-500">Getting your location...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const onlineUsers = allNearbyUsers.filter((u) => u.is_online);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            <span className="text-gray-900">Live Users Map</span>
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
        {/* Interactive Leaflet Map */}
        <div className="w-full h-72 rounded-lg border overflow-hidden relative bg-blue-50 mb-4">
          <div ref={mapContainerRef} className="w-full h-full z-0" />
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-[500]">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Loading map...</p>
              </div>
            </div>
          )}
          {mapError && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-red-50 text-red-600 text-xs font-medium px-3 py-1.5 rounded-full shadow z-[500]">
              {mapError}
            </div>
          )}
          {/* Legend */}
          <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm rounded-lg shadow px-3 py-2 text-xs space-y-1.5 z-[500]">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
              <span className="text-gray-600 font-medium">You</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
              <span className="text-gray-600 font-medium">Online user</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-gray-400 inline-block"></span>
              <span className="text-gray-600 font-medium">Offline user</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-sm text-gray-900">
            Users Nearby (10km radius):
          </h4>
          {allNearbyUsers.length === 0 ? (
            <p className="text-sm text-gray-500">No other users nearby</p>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              {allNearbyUsers
                .sort((a, b) =>
                  b.is_online === a.is_online ? 0 : b.is_online ? 1 : -1
                )
                .map((nearbyUser) => (
                  <UserProfileModal
                    key={nearbyUser.user_id}
                    userId={nearbyUser.user_id}
                    userName={
                      nearbyUser.full_name ||
                      nearbyUser.username ||
                      "Unknown User"
                    }
                    isOnline={nearbyUser.is_online}
                    distance={nearbyUser.distance_km}
                  >
                    <div className="flex items-center space-x-3 p-2 my-2 neuromorphic hover:bg-gray-100 cursor-pointer transition-colors">
                      <div className="relative">
                        {nearbyUser.avatar_emoji ? (
                          <div className="h-8 w-8 flex items-center justify-center text-lg rounded-full border">
                            {nearbyUser.avatar_emoji}
                          </div>
                        ) : (
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {(nearbyUser.full_name || "U")
                                .charAt(0)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={`absolute -top-1 -right-1 w-3 h-3 ${
                            nearbyUser.is_online
                              ? "bg-green-500"
                              : "bg-gray-400"
                          } border-2 border-white rounded-full`}
                        ></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {nearbyUser.full_name || "Unknown User"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          at {nearbyUser.location_name || "Unknown location"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {isNaN(nearbyUser.distance_km)
                            ? "Distance unknown"
                            : `${nearbyUser.distance_km.toFixed(1)} km away`}
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
                  </UserProfileModal>
                ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Map;
