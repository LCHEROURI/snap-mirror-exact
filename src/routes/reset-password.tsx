import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Reflective" },
      { name: "description", content: "Set a new password for your Reflective account." },
      { property: "og:title", content: "Choose a new password — Reflective" },
      { property: "og:description", content: "Set a new password for your Reflective account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The emailed link signs the user in with a short-lived recovery session.
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "PASSWORD_RECOVERY" || e === "SIGNED_IN") setReady(true); });
    supabase.auth.getSession().then(({ data: s }) => setReady((r) => r || !!s.session));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message || "Couldn't update your password.");
    toast.success("Password updated.");
    navigate({ to: "/journal" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6">
        <h1 className="font-serif text-2xl tracking-tight">Choose a new password</h1>
        {ready === false ? (
          <p className="text-sm text-muted-foreground">This link has expired or was already used. Request a new one from Settings → Account.</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="pw">New password</Label>
              <Input id="pw" type="password" minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy || pw.length < 8 || !ready}>Update password</Button>
          </>
        )}
      </form>
    </main>
  );
}
