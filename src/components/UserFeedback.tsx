import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

type FeedbackEntry = { id: string; rating: number; feedback: string; created_at: string };

export default function UserFeedback({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.from("request_feedback").select("id, rating, feedback, created_at")
      .eq("helper_id", userId).order("created_at", { ascending: false }).limit(50)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error("Unable to load user feedback:", error);
        setEntries(data || []);
        setLoading(false);
      });
    return () => { active = false; };
  }, [userId]);

  const average = entries.length ? entries.reduce((total, entry) => total + entry.rating, 0) / entries.length : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">Ratings &amp; Feedback
          {!loading && <span className="font-normal text-amber-600">{entries.length ? `${average.toFixed(1)} ★ · ${entries.length} ${entries.length === 1 ? "review" : "reviews"}` : "No ratings yet"}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <div className="space-y-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /></div> : entries.length ? entries.map((entry) => (
          <div key={entry.id} className="border-b last:border-b-0 pb-3 last:pb-0">
            <div className="flex items-center gap-1" aria-label={`${entry.rating} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, index) => <Star key={index} className={`h-4 w-4 ${index < entry.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />)}
              <span className="ml-2 text-xs text-gray-500">{new Date(entry.created_at).toLocaleDateString()}</span>
            </div>
            <p className="mt-1 text-sm text-gray-700">{entry.feedback}</p>
          </div>
        )) : <p className="text-sm text-gray-500">This user hasn’t received feedback yet.</p>}
      </CardContent>
    </Card>
  );
}
