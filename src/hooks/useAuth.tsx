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

  // Get location name from coordinates
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
        
        return parts.length > 0 ? parts.join(', ') : data.display_name;
      }
    } catch (error) {
      console.error('Error getting location name:', error);
    }
    
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  // Get user's current location
  const getCurrentLocation = () => {
    return new Promise<{ lat: number; lng: number; name: string }>((resolve) => {
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
            
            resolve(location);
          },
          (error) => {
            console.error('Error getting location:', error);
            // Fallback to a default location
            const fallbackLocation = {
              lat: 28.5355,
              lng: 77.3910,
              name: "Noida, Uttar Pradesh, India"
            };
            resolve(fallbackLocation);
          }
        );
      } else {
        const fallbackLocation = {
          lat: 28.5355,
          lng: 77.3910,
          name: "Noida, Uttar Pradesh, India"
        };
        resolve(fallbackLocation);
      }
    });
  };

  // Update user location and status in database
  const updateUserLocationAndStatus = async (lat: number, lng: number, locationName: string) => {
    if (!user || !session) {
      console.log('No user or session, skipping location update');
      return;
    }

    try {
      console.log('Updating location for user:', user.id, 'at', lat, lng);
      
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email || 'Anonymous',
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
          location_name: locationName,
          location_point: `POINT(${lng} ${lat})`,
          status: 'online',
          last_seen: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (error) {
        console.error('Error updating profile:', error);
      } else {
        console.log('Profile updated successfully');
      }
    } catch (error) {
      console.error('Error in updateUserLocationAndStatus:', error);
    }
  };

  // Get nearby users count
  const fetchNearbyUsers = async () => {
    if (!userLocation || !user || !session) {
      console.log('Missing requirements for nearby users');
      return;
    }

    try {
      console.log('Fetching nearby users at:', userLocation);
      
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
      console.log('All nearby users:', nearbyUsers);
      
      const onlineCount = nearbyUsers.filter(u => u.is_online).length;
      console.log('Online users count:', onlineCount);
      
      setNearbyUsersCount(onlineCount);
    } catch (error) {
      console.error('Error fetching nearby users:', error);
    }
  };

  // Initialize user data when user logs in
  const initializeUserData = async () => {
    if (!user || !session) return;

    console.log('Initializing user data for:', user.id);
    
    try {
      // Get current location
      const location = await getCurrentLocation();
      console.log('Got location:', location);
      
      setUserLocation(location);
      
      // Update location in database
      await updateUserLocationAndStatus(location.lat, location.lng, location.name);
      
      // Fetch nearby users
      setTimeout(() => {
        fetchNearbyUsers();
      }, 1000);
      
    } catch (error) {
      console.error('Error initializing user data:', error);
    }
  };

  // Set up auth state listener
  useEffect(() => {
    console.log('Setting up auth listener');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (!session?.user) {
          setUserLocation(null);
          setNearbyUsersCount(0);
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialize user data when user and session are available
  useEffect(() => {
    if (user && session && !userLocation) {
      initializeUserData();
    }
  }, [user, session]);

  // Keep updating status and fetching nearby users
  useEffect(() => {
    if (!user || !session || !userLocation) return;

    const updateInterval = setInterval(async () => {
      console.log('Periodic update - updating status and fetching nearby users');
      await updateUserLocationAndStatus(userLocation.lat, userLocation.lng, userLocation.name);
      await fetchNearbyUsers();
    }, 15000); // Every 15 seconds

    return () => clearInterval(updateInterval);
  }, [user, session, userLocation]);

  // Fetch nearby users when location changes
  useEffect(() => {
    if (userLocation && user && session) {
      fetchNearbyUsers();
    }
  }, [userLocation]);

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
