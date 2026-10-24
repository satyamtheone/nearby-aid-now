import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getProfileRequirementStatus } from "@/utils/profileCompletion";

export function useProfileCompletion() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, isComplete: null as boolean | null, percentage: 0 });

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setState({ loading: false, isComplete: false, percentage: 0 });
      return () => { active = false; };
    }

    setState((current) => ({ ...current, loading: true }));
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, phone, home_address, current_address, social_links")
          .eq("id", user.id)
          .maybeSingle();
        if (!active) return;
        if (error) throw error;
        const completion = getProfileRequirementStatus(data || {});
        setState({ loading: false, isComplete: completion.isComplete, percentage: completion.percentage });
      } catch (error) {
        console.error("Could not load profile completion status:", error);
        if (active) setState({ loading: false, isComplete: null, percentage: 0 });
      }
    })();

    return () => { active = false; };
  }, [user?.id]);

  return state;
}
