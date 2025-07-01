import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

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

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyC0bUeOzUhunKJZ_jI5aJoCmwdTIa0dj70';

const Map = () => {
  const { userLocation, user } = useAuth();
  const [allNearbyUsers, setAllNearbyUsers] = useState<OnlineUser[]>([]);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Fetch nearby users from database
  const fetchNearbyUsers = async () => {
    if (!userLocation || !user) {
      console.log('Map: Missing userLocation or user');
      return;
    }

    try {
      console.log('Map: Fetching nearby users at:', userLocation);
      
      const { data, error } = await supabase.rpc('get_nearby_users' as any, {
        user_lat: userLocation.lat,
        user_lng: userLocation.lng,
        radius_km: 10.0
      });

      if (error) {
        console.error('Map: Error fetching nearby users:', error);
        return;
      }

      const users = (data as OnlineUser[]) || [];
      console.log('Map: Fetched users:', users);
      console.log('Map: Online users:', users.filter(u => u.is_online));
      
      setAllNearbyUsers(users);
    } catch (error) {
      console.error('Map: Error fetching nearby users:', error);
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

  const loadGoogleMapsScript = () => {
    if (window.google) {
      initializeMap();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap`;
    script.async = true;
    script.defer = true;
    
    window.initMap = () => {
      setIsLoaded(true);
      initializeMap();
    };

    document.head.appendChild(script);
  };

  const initializeMap = () => {
    if (!mapContainer.current || !userLocation || !window.google) return;

    console.log('Map: Initializing map with users:', allNearbyUsers);

    // Initialize Google Map
    map.current = new window.google.maps.Map(mapContainer.current, {
      center: { lat: userLocation.lat, lng: userLocation.lng },
      zoom: 12,
      mapTypeId: 'roadmap',
    });

    // Add user's location marker (blue)
    new window.google.maps.Marker({
      position: { lat: userLocation.lat, lng: userLocation.lng },
      map: map.current,
      title: 'You are here',
      icon: {
        url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
      }
    });

    // Add all nearby users markers
    allNearbyUsers.forEach((nearbyUser) => {
      console.log('Map: Adding marker for user:', nearbyUser.full_name, 'Online:', nearbyUser.is_online);
      
      const marker = new window.google.maps.Marker({
        position: { lat: nearbyUser.lat, lng: nearbyUser.lng },
        map: map.current,
        title: `${nearbyUser.full_name} - ${nearbyUser.is_online ? 'Online' : 'Offline'}`,
        icon: {
          url: nearbyUser.is_online 
            ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'  // Online = green
            : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'    // Offline = red
        }
      });

      // Add info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `<div><strong>${nearbyUser.full_name}</strong><br/>${nearbyUser.location_name}<br/><span style="color: ${nearbyUser.is_online ? 'green' : 'red'};">● ${nearbyUser.is_online ? 'Online' : 'Offline'}</span><br/><small>${nearbyUser.distance_km.toFixed(1)} km away</small></div>`
      });

      marker.addListener('click', () => {
        infoWindow.open(map.current, marker);
      });
    });
  };

  useEffect(() => {
    if (userLocation) {
      loadGoogleMapsScript();
    }
  }, [userLocation]);

  useEffect(() => {
    if (!userLocation || !isLoaded) return;
    initializeMap();
  }, [allNearbyUsers, userLocation, isLoaded]);

  if (!userLocation) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">Getting your location...</p>
        </CardContent>
      </Card>
    );
  }

  const onlineUsers = allNearbyUsers.filter(u => u.is_online);

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
              <span className="text-sm font-medium">{allNearbyUsers.length}</span>
              <span className="text-xs">total</span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={mapContainer} className="w-full h-64 rounded-lg border mb-4" />
        
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Users Nearby (10km radius):</h4>
          {allNearbyUsers.length === 0 ? (
            <p className="text-sm text-gray-500">No other users nearby</p>
          ) : (
            <div className="space-y-2">
              {allNearbyUsers.slice(0, 8).map((nearbyUser) => (
                <div key={nearbyUser.user_id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {nearbyUser.full_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -top-1 -right-1 w-3 h-3 ${nearbyUser.is_online ? 'bg-green-500' : 'bg-gray-400'} border-2 border-white rounded-full`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{nearbyUser.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">at {nearbyUser.location_name}</p>
                    <p className="text-xs text-gray-400">{nearbyUser.distance_km.toFixed(1)} km away</p>
                  </div>
                  <div className="flex items-center">
                    <span className={`text-xs font-medium ${nearbyUser.is_online ? 'text-green-600' : 'text-gray-500'}`}>
                      {nearbyUser.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              ))}
              {allNearbyUsers.length > 8 && (
                <p className="text-xs text-gray-500 text-center">
                  +{allNearbyUsers.length - 8} more users nearby
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Map;
