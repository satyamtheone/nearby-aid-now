
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Database } from '@/integrations/supabase/types';

type HelpRequest = Database['public']['Tables']['help_requests']['Row'] & {
  profiles: {
    username: string | null;
    full_name: string | null;
  };
  distance_km?: number;
};

export function useHelpRequests() {
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const { user, userLocation } = useAuth();

  const fetchHelpRequests = async () => {
    try {
      if (!showAllLocations && userLocation) {
        // Fetch nearby requests using the geographical function
        const { data, error } = await supabase.rpc('get_nearby_help_requests', {
          user_lat: userLocation.lat,
          user_lng: userLocation.lng,
          radius_km: 10.0
        });

        if (error) {
          console.error('Error fetching nearby help requests:', error);
          return;
        }

        // Transform the data to match our expected format
        const transformedData = data?.map((request: any) => ({
          ...request,
          profiles: {
            username: null,
            full_name: null
          },
          distance_km: request.distance_km
        })) || [];

        // Get profile information for each request
        const requestsWithProfiles = await Promise.all(
          transformedData.map(async (request) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, full_name')
              .eq('id', request.user_id)
              .single();

            return {
              ...request,
              profiles: profile || { username: null, full_name: null }
            };
          })
        );

        setHelpRequests(requestsWithProfiles);
      } else {
        // Fetch all requests (original functionality)
        const { data, error } = await supabase
          .from('help_requests')
          .select(`
            *,
            profiles (
              username,
              full_name
            )
          `)
          .eq('is_resolved', false)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          console.error('Error fetching help requests:', error);
          return;
        }

        setHelpRequests(data || []);
      }
    } catch (error) {
      console.error('Error fetching help requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const createHelpRequest = async (request: {
    category: Database['public']['Enums']['help_category'];
    message: string;
    is_urgent: boolean;
    location_name?: string;
  }) => {
    if (!user) {
      console.error('User not authenticated');
      return { error: 'User not authenticated' };
    }

    try {
      // First, let's check if the user has a profile
      const { error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Profile check error:', profileError);
        return { error: 'User profile not found. Please try signing out and back in.' };
      }

      const { data: requestId, error } = await supabase.rpc('create_help_request', {
        p_category: request.category,
        p_message: request.message,
        p_is_urgent: request.is_urgent,
        p_location_name: request.location_name || userLocation?.name || null,
        p_latitude: userLocation?.lat ?? null,
        p_longitude: userLocation?.lng ?? null,
      });

      if (error) {
        console.error('Error creating help request:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return { error: `Database error: ${error.message}` };
      }

      if (!requestId) {
        return { error: 'The database did not return the new request ID. Please try again.' };
      }

      console.log('Help request created successfully:', requestId);

      // Refresh the list
      fetchHelpRequests();
      let notificationError: string | null = null;
      try {
        const { data: notificationResult, error } = await supabase.functions.invoke(
          'notify-nearby-request',
          { body: { requestId } },
        );
        notificationError = error?.message || (
          notificationResult?.reason === 'request_location_missing'
            ? 'Your request was posted, but it has no location for nearby alerts.'
            : notificationResult?.reason === 'no_registered_devices_in_range'
              ? 'Your request was posted, but no nearby devices have notifications enabled.'
              : notificationResult?.failed > 0
                ? `${notificationResult.failed} nearby notification(s) could not be delivered.`
                : notificationResult?.sent === 0
                  ? 'Your request was posted, but no notifications were delivered.'
                  : null
        );
      } catch (error) {
        notificationError = error instanceof Error
          ? error.message
          : 'Nearby notifications could not be confirmed.';
      }
      return {
        data: { id: requestId },
        notificationError,
      };
    } catch (error) {
      console.error('Unexpected error creating help request:', error);
      return { error: 'Failed to create help request. Please try again.' };
    }
  };

  const toggleLocationFilter = () => {
    setShowAllLocations(!showAllLocations);
  };

  useEffect(() => {
    if (user) {
      fetchHelpRequests();

      // Set up real-time subscription
      const channel = supabase
        .channel('help_requests_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'help_requests'
          },
          () => {
            fetchHelpRequests();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, showAllLocations, userLocation]);

  return {
    helpRequests,
    loading,
    showAllLocations,
    createHelpRequest,
    toggleLocationFilter,
    refetch: fetchHelpRequests,
  };
}
