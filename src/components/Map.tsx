
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface OnlineUser {
  id: string;
  full_name: string;
  username: string;
  location_name: string;
  lat: number;
  lng: number;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const Map = () => {
  const { userLocation, user } = useAuth();
  const [googleMapsKey, setGoogleMapsKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Fetch online users near current location
  const fetchOnlineUsers = async () => {
    if (!userLocation) return;

    try {
      const { data, error } = await supabase
        .from('user_locations')
        .select(`
          user_id,
          location_name,
          profiles (
            id,
            full_name,
            username
          )
        `)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching online users:', error);
        return;
      }

      // Transform data to include coordinates (simplified)
      const users = data?.map((item: any) => ({
        id: item.user_id,
        full_name: item.profiles?.full_name || 'Anonymous',
        username: item.profiles?.username || 'User',
        location_name: item.location_name,
        lat: userLocation.lat + (Math.random() - 0.5) * 0.01, // Mock nearby coordinates
        lng: userLocation.lng + (Math.random() - 0.5) * 0.01,
      })) || [];

      setOnlineUsers(users.filter(u => u.id !== user?.id));
    } catch (error) {
      console.error('Error fetching online users:', error);
    }
  };

  useEffect(() => {
    if (userLocation && user) {
      fetchOnlineUsers();
      const interval = setInterval(fetchOnlineUsers, 30000);
      return () => clearInterval(interval);
    }
  }, [userLocation, user]);

  const loadGoogleMapsScript = () => {
    if (window.google) {
      initializeMap();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&callback=initMap`;
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

    // Initialize Google Map
    map.current = new window.google.maps.Map(mapContainer.current, {
      center: { lat: userLocation.lat, lng: userLocation.lng },
      zoom: 12,
      mapTypeId: 'roadmap',
    });

    // Add user's location marker
    new window.google.maps.Marker({
      position: { lat: userLocation.lat, lng: userLocation.lng },
      map: map.current,
      title: 'You are here',
      icon: {
        url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
      }
    });

    // Add online users markers
    onlineUsers.forEach((user) => {
      const marker = new window.google.maps.Marker({
        position: { lat: user.lat, lng: user.lng },
        map: map.current,
        title: user.full_name,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
        }
      });

      // Add info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `<div><strong>${user.full_name}</strong><br/>${user.location_name}</div>`
      });

      marker.addListener('click', () => {
        infoWindow.open(map.current, marker);
      });
    });
  };

  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (googleMapsKey.trim()) {
      setShowKeyInput(false);
      loadGoogleMapsScript();
    }
  };

  useEffect(() => {
    if (!showKeyInput && googleMapsKey && userLocation && isLoaded) {
      initializeMap();
    }
  }, [onlineUsers, showKeyInput, googleMapsKey, userLocation, isLoaded]);

  if (showKeyInput) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>Live Users Map</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter your Google Maps API key to view online users on the map.
              Get your free API key from{' '}
              <a 
                href="https://console.cloud.google.com/google/maps-apis" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google Cloud Console
              </a>
              {' '}(28,000 free map loads per month)
            </p>
            <form onSubmit={handleKeySubmit} className="space-y-3">
              <Input
                type="password"
                placeholder="Enter Google Maps API key"
                value={googleMapsKey}
                onChange={(e) => setGoogleMapsKey(e.target.value)}
                required
              />
              <Button type="submit" className="w-full">
                Load Map
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>Live Users Map</span>
          </div>
          <div className="flex items-center space-x-1 text-green-600">
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">{onlineUsers.length}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={mapContainer} className="w-full h-64 rounded-lg border" />
        <div className="mt-4 space-y-2">
          <h4 className="font-medium text-sm">Online Users Nearby:</h4>
          {onlineUsers.length === 0 ? (
            <p className="text-sm text-gray-500">No other users online nearby</p>
          ) : (
            <div className="space-y-1">
              {onlineUsers.slice(0, 5).map((user) => (
                <div key={user.id} className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="font-medium">{user.full_name}</span>
                  <span className="text-gray-500">at {user.location_name}</span>
                </div>
              ))}
              {onlineUsers.length > 5 && (
                <p className="text-xs text-gray-500">
                  +{onlineUsers.length - 5} more users
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
