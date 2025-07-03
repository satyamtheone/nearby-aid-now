import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { reverseGeocode } from "@/utils/geocoding";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userLocation: { lat: number; lng: number; name: string } | null;
  nearbyUsersCount: number;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<{ error: any }>;
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
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
  } | null>(null);
  const [nearbyUsersCount, setNearbyUsersCount] = useState(0);

  // Get user's current location with proper geocoding
  const getCurrentLocation = (): Promise<{
    lat: number;
    lng: number;
    name: string;
  }> => {
    return new Promise(async (resolve) => {
      if (!navigator.geolocation) {
        console.error("Geolocation is not supported by this browser");
        const fallbackLocation = {
          lat: 28.5355,
          lng: 77.391,
          name: await reverseGeocode(28.5355, 77.391),
        };
        resolve(fallbackLocation);
        return;
      }

      console.log("Starting geolocation request...");
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          console.log("Raw location obtained:", {
            lat: latitude,
            lng: longitude,
          });

          // Get location name using our safe geocoding function
          const locationName = await reverseGeocode(latitude, longitude);

          const location = {
            lat: latitude,
            lng: longitude,
            name: locationName,
          };

          console.log("Final location object:", location);
          resolve(location);
        },
        async (error) => {
          console.error("Geolocation error:", error);
          const fallbackLocation = {
            lat: 28.5355,
            lng: 77.391,
            name: await reverseGeocode(28.5355, 77.391),
          };
          resolve(fallbackLocation);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000, // 1 minute
        }
      );
    });
  };

  // Set user online status
  const setUserOnline = async () => {
    if (!user || !userLocation) {
      console.log("Cannot set user online: missing user or location");
      return;
    }

    console.log("Setting user online:", user.id);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          status: "online",
          last_seen: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) {
        console.error("Error setting user online:", error);
      } else {
        console.log("User set to online successfully");
      }
    } catch (error) {
      console.error("Error in setUserOnline:", error);
    }
  };

  // Update user location and status in database
  const updateUserLocationAndStatus = async (
    lat: number,
    lng: number,
    locationName: string,
    forceOnline: boolean = false
  ) => {
    if (!user) {
      console.log("No user, skipping location update");
      return;
    }

    try {
      console.log(
        "Updating location and status for user:",
        user.id,
        "at",
        lat,
        lng,
        "location:",
        locationName,
        "forceOnline:",
        forceOnline
      );

      const updateData: any = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email || "Anonymous",
        username:
          user.user_metadata?.username || user.email?.split("@")[0] || "user",
        location_name: locationName,
        location_point: `POINT(${lng} ${lat})`,
        last_seen: new Date().toISOString(),
      };

      if (forceOnline) {
        updateData.status = "online";
      }

      const { error } = await supabase.from("profiles").upsert(updateData, {
        onConflict: "id",
      });

      if (error) {
        console.error("Error updating profile:", error);
      } else {
        console.log(
          "Profile updated successfully with location:",
          locationName
        );
      }
    } catch (error) {
      console.error("Error in updateUserLocationAndStatus:", error);
    }
  };

  // Get nearby users count
  const fetchNearbyUsers = async () => {
    if (!userLocation || !user) {
      console.log(
        "Missing requirements for nearby users - userLocation:",
        !!userLocation,
        "user:",
        !!user
      );
      return;
    }

    try {
      console.log("Fetching nearby users at:", userLocation);

      const { data, error } = await supabase.rpc("get_nearby_users" as any, {
        user_lat: userLocation.lat,
        user_lng: userLocation.lng,
        radius_km: 10.0,
      });

      if (error) {
        console.error("Error getting nearby users:", error);
        return;
      }

      const nearbyUsers = (data as NearbyUser[]) || [];
      console.log("Fetched nearby users:", nearbyUsers);

      const onlineCount = nearbyUsers.filter((u) => u.is_online).length;
      console.log(
        "Online users count:",
        onlineCount,
        "out of",
        nearbyUsers.length,
        "total"
      );

      setNearbyUsersCount(onlineCount);
    } catch (error) {
      console.error("Error in fetchNearbyUsers:", error);
    }
  };

  // Initialize user location when user is authenticated
  const initializeUserLocation = async () => {
    if (!user) {
      console.log("Cannot initialize location: missing user");
      return;
    }

    console.log("Initializing location for user:", user.email);

    try {
      // Get current location (coordinates only)
      const location = await getCurrentLocation();
      console.log("Location obtained:", location);

      // Set location immediately
      setUserLocation(location);

      // Update location in database and set status to online
      await updateUserLocationAndStatus(
        location.lat,
        location.lng,
        location.name,
        true
      );
    } catch (error) {
      console.error("Error initializing location:", error);
      // Set fallback location
      const fallback = {
        lat: 28.5355,
        lng: 77.391,
        name: "28.5355, 77.3910",
      };
      setUserLocation(fallback);
    }
  };

  // Set up auth state listener
  useEffect(() => {
    console.log("Setting up auth listener");

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event, session?.user?.email);

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (!session?.user) {
        setUserLocation(null);
        setNearbyUsersCount(0);
      }
    });

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Initial session:", session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialize location when user is available
  useEffect(() => {
    if (user && !userLocation) {
      console.log("User available, initializing location");
      initializeUserLocation();
    }
  }, [user]);

  // Keep user online and fetch nearby users periodically
  useEffect(() => {
    if (!user || !userLocation) return;

    console.log("Starting periodic updates for user:", user.email);

    const updateInterval = setInterval(async () => {
      console.log(
        "Periodic update - keeping user online and fetching nearby users"
      );

      // Keep user online
      await setUserOnline();

      // Fetch nearby users
      await fetchNearbyUsers();
    }, 10000); // Every 10 seconds

    // Also fetch nearby users immediately when location is available
    fetchNearbyUsers();

    return () => {
      console.log("Clearing periodic updates");
      clearInterval(updateInterval);
    };
  }, [user, userLocation]);

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
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    if (user && userLocation) {
      console.log("Setting user offline before sign out");
      await updateUserLocationAndStatus(
        userLocation.lat,
        userLocation.lng,
        userLocation.name,
        false
      );

      // Also explicitly set status to offline
      await supabase
        .from("profiles")
        .update({
          status: "offline",
          last_seen: new Date().toISOString(),
        })
        .eq("id", user.id);
    }

    const { error } = await supabase.auth.signOut();
    if (error) console.error("Error signing out:", error);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        userLocation,
        nearbyUsersCount,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
