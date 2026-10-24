import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Report = { id: string; reported_user_id: string | null; reported_user_name: string; target_type: string; target_content: string; reason: string; details: string | null; status: string; created_at: string };

export default function ModerationDashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isModerator = ["moderator", "admin"].includes(String(user?.app_metadata?.role || ""));

  const refresh = useCallback(async () => {
    if (!isModerator) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc("get_moderation_queue" as never);
    if (error) toast({ title: "Could not load reports", description: error.message, variant: "destructive" });
    else setReports((data || []) as unknown as Report[]);
    setLoading(false);
  }, [isModerator]);

  useEffect(() => { void refresh(); }, [refresh]);

  const updateReport = async (id: string, status: "reviewing" | "resolved" | "dismissed", removeContent = false) => {
    setBusyId(id);
    const { error } = await supabase.rpc("review_moderation_report" as never, { p_report_id: id, p_status: status, p_remove_content: removeContent } as never);
    setBusyId(null);
    if (error) toast({ title: "Could not update report", description: error.message, variant: "destructive" });
    else { toast({ title: removeContent ? "Content removed" : "Report updated" }); void refresh(); }
  };

  return <main className="min-h-dvh bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-600 px-4 py-8 text-white sm:px-6">
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between"><div><Link to="/" className="text-sm text-cyan-100 underline">Nearby Aid Now</Link><h1 className="mt-2 flex items-center gap-2 text-2xl font-bold"><ShieldAlert className="h-6 w-6" />Safety reports</h1></div><Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
      {!user ? <Card className="glass-panel text-white"><CardContent className="p-5">Sign in with an authorized moderator account to review reports.</CardContent></Card> : !isModerator ? <Card className="glass-panel text-white"><CardContent className="p-5">This account does not have moderator access.</CardContent></Card> : loading ? <p role="status">Loading reports…</p> : reports.length === 0 ? <Card className="glass-panel text-white"><CardContent className="p-5">No reports are waiting for review.</CardContent></Card> : <div className="space-y-3">{reports.map((report) => <Card key={report.id} className="glass-panel border-white/20 text-white"><CardContent className="space-y-3 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge variant="outline" className="border-white/30 text-white">{report.target_type}</Badge><Badge className={report.status === "open" ? "bg-rose-500" : "bg-white/20"}>{report.status}</Badge><span className="text-sm text-white/70">{new Date(report.created_at).toLocaleString()}</span></div><span className="text-sm font-semibold">{report.reason}</span></div><p className="text-sm"><span className="text-white/60">Reported user: </span>{report.reported_user_name}</p><div className="rounded-xl border border-white/15 bg-black/10 p-3 text-sm"><p className="whitespace-pre-wrap break-words">{report.target_content}</p>{report.details && <p className="mt-2 border-t border-white/10 pt-2 text-white/75">Reporter details: {report.details}</p>}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busyId === report.id} onClick={() => void updateReport(report.id, "reviewing")}>Mark reviewing</Button>{report.target_type !== "user" && <Button size="sm" variant="destructive" disabled={busyId === report.id} onClick={() => { if (window.confirm("Remove this content from the app and resolve the report?")) void updateReport(report.id, "resolved", true); }}>Remove content</Button>}<Button size="sm" disabled={busyId === report.id} onClick={() => void updateReport(report.id, "resolved")}>Resolve</Button><Button size="sm" variant="ghost" className="text-white" disabled={busyId === report.id} onClick={() => void updateReport(report.id, "dismissed")}>Dismiss</Button></div></CardContent></Card>)}</div>}
    </div>
  </main>;
}
