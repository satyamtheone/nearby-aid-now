import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function AccountDeletion() {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const deleteAccount = async () => {
    if (!user || confirmation !== "DELETE") return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("delete-account", { body: {} });
    if (error) {
      setBusy(false);
      toast({ title: "Could not delete account", description: error.message || "Please try again or contact support.", variant: "destructive" });
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    setDone(true);
    setBusy(false);
  };

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) toast({ title: "Could not sign in", description: error.message, variant: "destructive" });
  };

  return <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-600 px-4 py-10 text-white">
    <section className="w-full max-w-xl space-y-5 rounded-3xl border border-white/25 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl sm:p-9">
      <Link to="/" className="text-sm text-cyan-100 underline">Nearby Aid Now</Link>
      {done ? <><h1 className="text-2xl font-bold">Account deleted</h1><p>Your account and associated app data have been deleted.</p><Link to="/" className="underline">Return to Nearby Aid Now</Link></> : <>
        <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-300/15 text-rose-100"><Trash2 /></span><div><h1 className="text-2xl font-bold">Delete your account</h1><p className="text-sm text-white/75">This permanently deletes your Nearby Aid Now account.</p></div></div>
        <p className="text-sm leading-relaxed text-white/80">Your profile, help requests, chat messages, ratings, notification registrations, and uploaded photos/videos will be deleted. This action cannot be undone. Abuse reports needed for safety review may be retained with identifying account references removed.</p>
        {!user ? <form onSubmit={authenticate} className="space-y-3 rounded-2xl border border-white/15 bg-white/5 p-4">
          <p className="text-sm">Sign in to verify ownership before requesting deletion.</p><div className="space-y-1"><Label htmlFor="delete-email">Email</Label><Input id="delete-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div><div className="space-y-1"><Label htmlFor="delete-password">Password</Label><Input id="delete-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div><Button className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in to continue"}</Button>
        </form> : <div className="space-y-3 rounded-2xl border border-rose-200/25 bg-rose-300/10 p-4"><div className="flex items-start gap-2 text-sm text-rose-50"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Signed in as <strong>{user.email}</strong>. Type <strong>DELETE</strong> to confirm.</span></div><Input aria-label="Type DELETE to confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoCapitalize="characters" placeholder="DELETE" /><Button variant="destructive" className="w-full" disabled={busy || confirmation !== "DELETE"} onClick={() => void deleteAccount()}>{busy ? "Deleting account…" : "Permanently delete account"}</Button></div>}
        <p className="text-xs text-white/65">Need help? Contact the support email shown on the Google Play listing. See the <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
      </>}
    </section>
  </main>;
}
