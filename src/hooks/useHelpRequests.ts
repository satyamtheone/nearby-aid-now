
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
    console.log('Creating help request with data:', request);
    console.log('Current user:', user);
    console.log('User location:', userLocation);

    if (!user) {
      console.error('User not authenticated');
      return { error: 'User not authenticated' };
    }

    try {
      // First, let's check if the user has a profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Profile check error:', profileError);
        return { error: 'User profile not found. Please try signing out and back in.' };
      }

      console.log('User profile found:', profileData);

      const insertData = {
        user_id: user.id,
        category: request.category,
        message: request.message,
        is_urgent: request.is_urgent,
        location_name: request.location_name || userLocation?.name || null,
        location_point: userLocation ? `POINT(${userLocation.lng} ${userLocation.lat})` : null,
      };

      console.log('Inserting data:', insertData);

      const { data, error } = await supabase
        .from('help_requests')
        .insert(insertData)
        .select()
        .single();

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

      console.log('Help request created successfully:', data);

      // Refresh the list
      fetchHelpRequests();
      return { data };
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
