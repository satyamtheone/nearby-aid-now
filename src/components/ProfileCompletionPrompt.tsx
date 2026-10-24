import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";

export function ProfileCompletionPrompt() {
  const { user } = useAuth();
  const { loading, isComplete, percentage } = useProfileCompletion();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const storageKey = user?.id ? `profile-completion-prompt-dismissed:${user.id}` : "";

  useEffect(() => {
    if (!user || loading || isComplete !== false) return;
    if (location.pathname === "/profile" || location.pathname === "/auth") {
      setOpen(false);
      return;
    }
    try {
      if (sessionStorage.getItem(storageKey) !== "1") setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [user?.id, loading, isComplete, location.pathname, storageKey]);

  const dismissForSession = () => {
    try {
      if (storageKey) sessionStorage.setItem(storageKey, "1");
    } catch {
      // The prompt can still be dismissed for the current render if storage is unavailable.
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) dismissForSession(); else setOpen(true); }}>
      <DialogContent className="glass-panel border-white/25 bg-[#303b91]/90 text-white backdrop-blur-3xl sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 grid h-12 w-12 place-items-center rounded-2xl border border-cyan-100/25 bg-cyan-200/10 text-cyan-100">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl text-white">Complete your profile for more trust</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-white/75">
            Adding your legal name, mobile number, address, and one social profile helps neighbors feel more confident. Your profile is {percentage}% complete. You can do this now or later.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" className="text-white hover:bg-white/15" onClick={dismissForSession}>Maybe later</Button>
          <Button type="button" onClick={() => { dismissForSession(); navigate("/profile"); }}>
            <BadgeCheck className="h-4 w-4" /> Complete profile
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
