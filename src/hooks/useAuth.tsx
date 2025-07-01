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

interface NearbyUser {
  user_id: string;
  full_name: string;
  username: string;
  location_name: string;
  lat: number;
  lng: number;
  distance_km: number;
  is_online: boolean;
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
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`
      );
      const data = await response.json();
      
      if (data && data.display_name) {
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
    return new Promise<{ lat: number; lng: number; name: string }>((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            console.log('Got user location:', latitude, longitude);
            
            const locationName = await getLocationName(latitude, longitude);
            const location = {
              lat: latitude,
              lng: longitude,
              name: locationName
            };
            
            setUserLocation(location);
            resolve(location);
          },
          (error) => {
            console.error('Error getting location:', error);
            const fallbackLocation = {
              lat: 28.5355,
              lng: 77.3910,
              name: "Noida, Uttar Pradesh, India"
            };
            setUserLocation(fallbackLocation);
            resolve(fallbackLocation);
          }
        );
      } else {
        const fallbackLocation = {
          lat: 28.5355,
          lng: 77.3910,
          name: "Noida, Uttar Pradesh, India"
        };
        setUserLocation(fallbackLocation);
        resolve(fallbackLocation);
      }
    });
  };

  // Update user location in database
  const updateUserLocation = async (lat: number, lng: number, locationName: string) => {
    if (!user || !session) {
      console.log('User or session not available, skipping location update');
      return;
    }

    try {
      console.log('Updating user location for user:', user.id);
      
      // First update the profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          location_name: locationName,
          location_point: `POINT(${lng} ${lat})`,
          status: 'online',
          last_seen: new Date().toISOString(),
          full_name: user.user_metadata?.full_name || user.email || 'Anonymous'
        });

      if (profileError) {
        console.error('Error updating profile:', profileError);
      } else {
        console.log('Profile updated successfully');
      }

      // Then update user_locations table
      const { error: locationError } = await supabase
        .from('user_locations')
        .upsert({
          user_id: user.id,
          location_point: `POINT(${lng} ${lat})`,
          location_name: locationName,
          is_active: true,
          updated_at: new Date().toISOString()
        });

      if (locationError) {
        console.error('Error updating location:', locationError);
      } else {
        console.log('Location updated successfully');
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  // Get nearby users count
  const getNearbyUsersCount = async () => {
    if (!userLocation || !user || !session) {
      console.log('Missing requirements for nearby users count');
      return;
    }

    try {
      console.log('Getting nearby users for location:', userLocation);
      
      const { data, error } = await supabase.rpc('get_nearby_users' as any, {
        user_lat: userLocation.lat,
        user_lng: userLocation.lng,
        radius_km: 10.0
      });

      if (error) {
        console.error('Error getting nearby users:', error);
        return;
      }

      const nearbyUsers = (data as NearbyUser[]) || [];
      console.log('All nearby users from DB:', nearbyUsers);
      
      const onlineCount = nearbyUsers.filter(u => u.is_online).length;
      console.log('Online users count:', onlineCount);
      
      setNearbyUsersCount(onlineCount);
    } catch (error) {
      console.error('Error getting nearby users:', error);
    }
  };

  // Set up presence tracking
  const setupPresenceTracking = async (location: { lat: number; lng: number; name: string }) => {
    if (!user || !session) return;

    console.log('Setting up presence tracking for user:', user.id);

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        console.log('Presence sync:', state);
        // Refresh nearby users count when presence changes
        setTimeout(getNearbyUsersCount, 1000);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined presence:', key, newPresences);
        setTimeout(getNearbyUsersCount, 1000);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left presence:', key, leftPresences);
        setTimeout(getNearbyUsersCount, 1000);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to presence channel');
          
          // Update user status to online in the database
          await updateUserLocation(location.lat, location.lng, location.name);
          
          // Track presence
          const presenceData = {
            user_id: user.id,
            full_name: user.user_metadata?.full_name || user.email || 'Anonymous',
            online_at: new Date().toISOString(),
            location: location
          };
          
          console.log('Tracking presence with data:', presenceData);
          await channel.track(presenceData);
        }
      });

    // Keep updating location and status every 30 seconds
    const updateInterval = setInterval(async () => {
      if (user && session && location) {
        console.log('Periodic location and status update');
        await updateUserLocation(location.lat, location.lng, location.name);
        await getNearbyUsersCount();
      }
    }, 30000);

    return () => {
      console.log('Cleaning up presence tracking');
      channel.unsubscribe();
      clearInterval(updateInterval);
    };
  };

  // Initialize user location and presence when user logs in
  useEffect(() => {
    const initializeUserData = async () => {
      if (user && session && !userLocation) {
        console.log('Initializing user data for:', user.id);
        
        try {
          // Get current location
          const location = await getCurrentLocation();
          console.log('Got location:', location);
          
          // Update location in database
          await updateUserLocation(location.lat, location.lng, location.name);
          
          // Set up presence tracking
          const cleanup = await setupPresenceTracking(location);
          
          // Get initial nearby users count
          setTimeout(() => {
            getNearbyUsersCount();
          }, 2000);
          
          return cleanup;
        } catch (error) {
          console.error('Error initializing user data:', error);
        }
      }
    };

    initializeUserData();
  }, [user, session]);

  // Refresh nearby users count when location changes
  useEffect(() => {
    if (userLocation && user && session) {
      const interval = setInterval(getNearbyUsersCount, 15000);
      return () => clearInterval(interval);
    }
  }, [userLocation, user, session]);

  // Set up auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Reset location when user changes
        if (!session?.user) {
          setUserLocation(null);
          setNearbyUsersCount(0);
        }
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
    if (user) {
      // Update status to offline before signing out
      await supabase
        .from('profiles')
        .update({ 
          status: 'offline',
          last_seen: new Date().toISOString()
        })
        .eq('id', user.id);
    }
    
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
