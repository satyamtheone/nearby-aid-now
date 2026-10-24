
import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { reverseGeocode } from "@/utils/geocoding";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { takeFcmToken } from "@/lib/pushRegistration";
import { toast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  locationLoading: boolean;
  userLocation: { lat: number; lng: number; name: string } | null;
  nearbyUsersCount: number;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
    profileDetails?: {
      phone: string;
      homeAddress: string;
      socialLinks: { instagram: string; facebook: string };
    }
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
  const [locationLoading, setLocationLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
  } | null>(null);
  const [nearbyUsersCount, setNearbyUsersCount] = useState(0);

  // Use Capacitor's native location provider in Android and the browser API on web.
  const getCurrentLocation = async (): Promise<{
    lat: number;
    lng: number;
    name: string;
  }> => {
    const coords = Capacitor.isNativePlatform()
      ? await (async () => {
          let permission = await Geolocation.checkPermissions();
          if (permission.coarseLocation !== "granted" && permission.location !== "granted") {
            permission = await Geolocation.requestPermissions({ permissions: ["coarseLocation"] });
          }
          if (permission.coarseLocation !== "granted" && permission.location !== "granted") {
            throw new Error("Location permission was not granted");
          }
          return Geolocation.getCurrentPosition({
            // Approximate location is sufficient for the app's nearby help radius.
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 60000,
          }).then(({ coords: position }) => position);
        })()
      : await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by this browser"));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000,
          });
        }).then(({ coords: position }) => position);

    const name = await reverseGeocode(coords.latitude, coords.longitude);
    return { lat: coords.latitude, lng: coords.longitude, name };
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
          "Profile updated successfully with Google geocoded location:",
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

    setLocationLoading(true);
    console.log("Initializing location for authenticated user");

    try {
      // Get current location with Google geocoding
      const location = await getCurrentLocation();
      console.log("Location obtained with Google geocoding:", location);

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
      // Never substitute a fixed location: it could expose the wrong nearby users.
      setUserLocation(null);
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: /permission|denied/i.test(message) ? "Location permission needed" : "Could not get your location",
        description: /permission|denied/i.test(message)
          ? "Allow approximate location for Nearby Aid Now in Android app permissions to see nearby requests."
          : "Check that location services are on, then reopen the app.",
        variant: "destructive",
      });
    } finally {
      setLocationLoading(false);
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

  const signUp = async (
    email: string,
    password: string,
    fullName?: string,
    profileDetails?: {
      phone: string;
      homeAddress: string;
      socialLinks: { instagram: string; facebook: string };
    },
  ) => {
    const redirectUrl = Capacitor.isNativePlatform()
      ? "com.nearbyaidnow.app://auth"
      : `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone: profileDetails?.phone,
          home_address: profileDetails?.homeAddress,
          social_links: profileDetails?.socialLinks || {},
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    if (user && Capacitor.isNativePlatform()) {
      const token = takeFcmToken();
      if (token) {
        const { error: tokenError } = await supabase.rpc(
          "unregister_android_push_token",
          { p_token: token }
        );
        if (tokenError) {
          console.error("Could not remove device notification registration:", tokenError.code);
        }
      }
    } else if (user) {
      const token = takeFcmToken("web");
      if (token) {
        const { error: tokenError } = await supabase.rpc(
          "unregister_user_push_token",
          { p_token: token, p_platform: "web" }
        );
        if (tokenError) {
          console.error("Could not remove this browser's notification registration:", tokenError.code);
        }
      }
    }

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
        locationLoading,
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
