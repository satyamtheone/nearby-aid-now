
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

const GOOGLE_MAPS_API_KEY = 'AIzaSyC0bUeOzUhunKJZ_jI5aJoCmwdTIa0dj70';

const Map = () => {
  const { userLocation, user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(true);

  // Fetch online users with real coordinates from database
  const fetchOnlineUsers = async () => {
    if (!userLocation || !user) return;

    try {
      const { data, error } = await supabase.rpc('get_nearby_users', {
        user_lat: userLocation.lat,
        user_lng: userLocation.lng,
        radius_km: 10.0
      });

      if (error) {
        console.error('Error fetching online users:', error);
        return;
      }

      console.log('Fetched online users:', data);
      const users = data?.map((item: any) => ({
        id: item.user_id,
        full_name: item.full_name || 'Anonymous',
        username: item.username || 'User',
        location_name: item.location_name,
        lat: item.lat,
        lng: item.lng,
      })) || [];

      setOnlineUsers(users.filter(u => u.id !== user?.id));
    } catch (error) {
      console.error('Error fetching online users:', error);
    }
  };

  useEffect(() => {
    if (userLocation && user) {
      fetchOnlineUsers();
      const interval = setInterval(fetchOnlineUsers, 15000); // Update every 15 seconds
      return () => clearInterval(interval);
    }
  }, [userLocation, user]);

  // Set up real-time presence tracking
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('online-users-map');
    
    channel
      .on('presence', { event: 'sync' }, () => {
        fetchOnlineUsers(); // Refresh when presence changes
      })
      .on('presence', { event: 'join' }, () => {
        fetchOnlineUsers();
      })
      .on('presence', { event: 'leave' }, () => {
        fetchOnlineUsers();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && userLocation) {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
            location: userLocation
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user, userLocation]);

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
        content: `<div><strong>${user.full_name}</strong><br/>${user.location_name}<br/><span style="color: green;">● Online</span></div>`
      });

      marker.addListener('click', () => {
        infoWindow.open(map.current, marker);
      });
    });
  };

  const cleanAllData = async () => {
    if (!confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
      return;
    }

    try {
      // Delete all messages
      await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Delete all help requests
      await supabase.from('help_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Delete all user locations except current user
      await supabase.from('user_locations').delete().neq('user_id', user?.id || '');
      
      console.log('All data cleaned successfully');
      alert('All data has been cleaned! You can now test from scratch.');
      
      // Refresh the page
      window.location.reload();
    } catch (error) {
      console.error('Error cleaning data:', error);
      alert('Error cleaning data. Please try again.');
    }
  };

  useEffect(() => {
    if (userLocation) {
      loadGoogleMapsScript();
    }
  }, [userLocation]);

  useEffect(() => {
    if (!userLocation || !isLoaded) return;
    initializeMap();
  }, [onlineUsers, userLocation, isLoaded]);

  if (!userLocation) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">Getting your location...</p>
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
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 text-green-600">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">{onlineUsers.length}</span>
            </div>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={cleanAllData}
              className="text-xs"
            >
              Clean Data
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={mapContainer} className="w-full h-64 rounded-lg border mb-4" />
        
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Online Users Nearby:</h4>
          {onlineUsers.length === 0 ? (
            <p className="text-sm text-gray-500">No other users online nearby</p>
          ) : (
            <div className="space-y-2">
              {onlineUsers.slice(0, 5).map((user) => (
                <div key={user.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {user.full_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">at {user.location_name}</p>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs text-green-600 font-medium">Online</span>
                  </div>
                </div>
              ))}
              {onlineUsers.length > 5 && (
                <p className="text-xs text-gray-500 text-center">
                  +{onlineUsers.length - 5} more users online
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
