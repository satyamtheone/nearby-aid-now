
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

  // Get user's live location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Reverse geocoding to get location name (simplified)
          const locationName = `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
          
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
          // Fallback to default location
          setUserLocation({
            lat: 28.5355, // Noida coordinates
            lng: 77.3910,
            name: "Noida Sector 135"
          });
        }
      );
    }
  };

  // Update user location in database
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
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  // Get nearby users count
  const getNearbyUsersCount = async () => {
    if (!userLocation) return;

    try {
      const { data, error } = await supabase.rpc('get_nearby_users_count', {
        user_lat: userLocation.lat,
        user_lng: userLocation.lng,
        radius_km: 2
      });

      if (error) {
        console.error('Error getting nearby users:', error);
        return;
      }

      setNearbyUsersCount(data || 0);
    } catch (error) {
      console.error('Error getting nearby users:', error);
    }
  };

  // Track user presence
  const trackUserPresence = async () => {
    if (!user) return;

    const channel = supabase.channel('online-users');
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineUsers = Object.keys(state).length;
        setNearbyUsersCount(onlineUsers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
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
