import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const CURRENT_TERMS_VERSION = "2026-10-25";

export function TermsAcceptanceGate() {
  const { user } = useAuth();
  const location = useLocation();
  const [required, setRequired] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (["/account-deletion", "/privacy", "/terms"].includes(location.pathname)) { setRequired(false); return () => { active = false; }; }
    if (!user) { setRequired(false); setAccepted(false); return; }
    void (supabase.from("profiles") as any).select("terms_accepted_at, terms_version").eq("id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          toast({ title: "Could not load terms status", description: "Posting stays unavailable until we can verify your acceptance. Reload to retry.", variant: "destructive" });
          setRequired(true);
          return;
        }
        setRequired(data?.terms_version !== CURRENT_TERMS_VERSION || !data?.terms_accepted_at);
      });
    return () => { active = false; };
  }, [user?.id, location.pathname]);

  const saveAcceptance = async () => {
    if (!user || !accepted) return;
    setSaving(true);
    const { error } = await (supabase.from("profiles") as any).update({ terms_accepted_at: new Date().toISOString(), terms_version: CURRENT_TERMS_VERSION }).eq("id", user.id);
    setSaving(false);
    if (error) {
      const missingTermsSchema = /terms_accepted_at|terms_version/i.test(error.message || "")
        && /column|schema cache|does not exist|could not find/i.test(error.message || "");
      toast({
        title: "Could not save acceptance",
        description: missingTermsSchema
          ? "The hosted database is missing the terms columns. Apply 20261025120000_play_store_compliance.sql in Supabase SQL Editor, then reload this app."
          : error.message,
        variant: "destructive",
      });
      return;
    }
    setRequired(false);
    window.dispatchEvent(new Event("nearby-aid-terms-accepted"));
  };

  return <Dialog open={required} onOpenChange={() => {}}>
    <DialogContent hideCloseButton className="glass-panel border-white/25 bg-[#303b91]/95 text-white backdrop-blur-3xl">
      <DialogHeader><DialogTitle>Community rules and terms</DialogTitle><DialogDescription className="text-white/75">Please review and accept our terms before posting help requests, chat messages, or media.</DialogDescription></DialogHeader>
      <ul className="max-h-48 list-disc space-y-2 overflow-y-auto rounded-xl border border-white/15 bg-white/5 p-4 pl-8 text-sm text-white/85">
        <li>Be respectful. Harassment, threats, scams, illegal content, and sharing another person’s private information are not allowed.</li>
        <li>Only share content you have the right to post. Do not use Nearby Aid Now for emergencies; contact local emergency services.</li>
        <li>Reports may be reviewed by the service team. We may remove content or restrict accounts that violate these rules.</li>
        <li>Location is used to show nearby requests and users; choose carefully what you share in messages.</li>
      </ul>
      <p className="text-sm text-white/75">Read the full <Link className="underline underline-offset-4 text-cyan-100" to="/terms" target="_blank">Terms of Use</Link> and <Link className="underline underline-offset-4 text-cyan-100" to="/privacy" target="_blank">Privacy Policy</Link>.</p>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/15 bg-white/5 p-3 text-sm"><Checkbox checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} /><span>I agree to the Terms of Use and community rules.</span></label>
      <Button className="w-full" disabled={!accepted || saving} onClick={() => void saveAcceptance()}>{saving ? "Saving…" : "Accept and continue"}</Button>
    </DialogContent>
  </Dialog>;
}
