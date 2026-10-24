import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type ReportTarget = { reported_user_id: string } | { message_id: string; reported_user_id?: string } | { help_request_id: string; reported_user_id?: string };

export function ModerationReportDialog({ target, label = "Report" }: { target: ReportTarget; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const targetKey = "reported_user_id" in target && target.reported_user_id
    ? "reported_user_id"
    : "message_id" in target ? "message_id" : "help_request_id";

  const submit = async () => {
    if (!reason) return;
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Sign in required", description: "Sign in before sending a report.", variant: "destructive" });
      setSubmitting(false);
      return;
    }
    const { error } = await ((supabase as any).from("moderation_reports") as any).insert({
      reporter_id: user.id,
      [targetKey]: target[targetKey as keyof ReportTarget],
      reason,
      details: details.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not send report", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    setReason("");
    setDetails("");
    toast({ title: "Report submitted", description: "Thank you. The report has been sent for review." });
  };

  return <>
    <Button type="button" size="sm" variant="ghost" className="gap-1 text-rose-100 hover:bg-rose-400/15 hover:text-white" onClick={(event) => { event.stopPropagation(); setOpen(true); }}><Flag className="h-4 w-4" />{label}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="glass-panel border-white/25 bg-[#303b91]/95 text-white backdrop-blur-3xl">
        <DialogHeader>
          <DialogTitle>Report {targetKey === "reported_user_id" ? "user" : "content"}</DialogTitle>
          <DialogDescription className="text-white/75">Reports are private and help us review unsafe or inappropriate activity.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}><SelectTrigger className="border-white/25 bg-white/10 text-white"><SelectValue placeholder="Choose a reason" /></SelectTrigger><SelectContent>
              <SelectItem value="harassment">Harassment or bullying</SelectItem><SelectItem value="threats">Threats or unsafe behavior</SelectItem><SelectItem value="spam">Spam or scam</SelectItem><SelectItem value="inappropriate">Inappropriate content</SelectItem><SelectItem value="privacy">Personal information or privacy</SelectItem><SelectItem value="other">Other policy concern</SelectItem>
            </SelectContent></Select>
          </div>
          <div className="space-y-2"><Label htmlFor="report-details">Details (optional)</Label><Textarea id="report-details" maxLength={1000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Tell us what happened" className="border-white/25 bg-white/10 text-white placeholder:text-white/50" /></div>
          <Button className="w-full" disabled={!reason || submitting} onClick={() => void submit()}>{submitting ? "Submitting…" : "Submit report"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
