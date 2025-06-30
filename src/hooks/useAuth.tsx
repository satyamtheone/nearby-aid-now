import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userLocation: { lat: number; lng: number; name: string } | null;
  nearbyUsersCount: number;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [nearbyUsersCount, setNearbyUsersCount] = useState(0);

  // Get location name from coordinates using free geocoding service
  const getLocationName = async (lat: number, lng: number) => {
    try {
      // Using free Nominatim OpenStreetMap geocoding service
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`
      );
      const data = await response.json();
      
      if (data && data.display_name) {
        // Extract relevant parts for a clean location name
        const address = data.address || {};
        const parts = [];
        
        if (address.suburb || address.neighbourhood) {
          parts.push(address.suburb || address.neighbourhood);
        }
        if (address.city || address.town || address.village) {
          parts.push(address.city || address.town || address.village);
        }
        if (address.state) {
          parts.push(address.state);
        }
        if (address.country) {
          parts.push(address.country);
        }
        
        return parts.length > 0 ? parts.join(', ') : data.display_name;
      }
    } catch (error) {
      console.error('Error getting location name:', error);
    }
    
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  // Get user's live location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          console.log('Got user location:', latitude, longitude);
          
          // Show coordinates first, then update with name
          setUserLocation({
            lat: latitude,
            lng: longitude,
            name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          });

          // Get readable location name
          const locationName = await getLocationName(latitude, longitude);
          
          setUserLocation({
            lat: latitude,
            lng: longitude,
            name: locationName
          });

          // Update user location in database if user is logged in
          if (user) {
            await updateUserLocation(latitude, longitude, locationName);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          // Fallback to default location with proper name
          setUserLocation({
            lat: 28.5355,
            lng: 77.3910,
            name: "Noida, Uttar Pradesh, India"
          });
        }
      );
    }
  };

  // Update user location in database with better presence tracking
  const updateUserLocation = async (lat: number, lng: number, locationName: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_locations')
        .upsert({
          user_id: user.id,
          location_point: `POINT(${lng} ${lat})`,
          location_name: locationName,
          is_active: true,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error updating location:', error);
      } else {
        console.log('Location updated successfully');
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  // Get nearby users count using the new function
  const getNearbyUsersCount = async () => {
    if (!userLocation) return;

    try {
      const { data, error } = await supabase.rpc('get_nearby_users', {
        user_lat: userLocation.lat,
        user_lng: userLocation.lng,
        radius_km: 2
      });

      if (error) {
        console.error('Error getting nearby users:', error);
        return;
      }

      setNearbyUsersCount(data?.length || 0);
    } catch (error) {
      console.error('Error getting nearby users:', error);
    }
  };

  // Enhanced presence tracking
  const trackUserPresence = async () => {
    if (!user || !userLocation) return;

    const channel = supabase.channel('user-presence');
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineUsers = Object.keys(state).length;
        console.log('Online users:', onlineUsers);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
        getNearbyUsersCount();
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
        getNearbyUsersCount();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
            location: userLocation,
            full_name: user.user_metadata?.full_name || user.email
          });
        }
      });

    // Keep location updated every 30 seconds
    const locationUpdateInterval = setInterval(() => {
      if (userLocation) {
        updateUserLocation(userLocation.lat, userLocation.lng, userLocation.name);
      }
    }, 30000);

    return () => {
      channel.unsubscribe();
      clearInterval(locationUpdateInterval);
    };
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      getCurrentLocation();
      trackUserPresence();
    }
  }, [user]);

  useEffect(() => {
    if (userLocation && user) {
      getNearbyUsersCount();
      // Update nearby users count every 30 seconds
      const interval = setInterval(getNearbyUsersCount, 30000);
      return () => clearInterval(interval);
    }
  }, [userLocation, user]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        }
      }
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error signing out:', error);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      userLocation,
      nearbyUsersCount,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
