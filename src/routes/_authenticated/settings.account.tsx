import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { meta } from "@/components/page-states";
import { Section, TypedConfirm } from "@/components/settings-ui";
import { supabase } from "@/integrations/supabase/client";
import { deleteAccount } from "@/lib/privacy.functions";

export const Route = createFileRoute("/_authenticated/settings/account")({
  head: () => meta("Account", "Password, sign out and account deletion."),
  component: AccountSettings,
});

function AccountSettings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const deleteFn = useServerFn(deleteAccount);
  const user = useQuery({ queryKey: ["auth-user"], queryFn: async () => (await supabase.auth.getUser()).data.user });
  const [sending, setSending] = useState(false);

  async function resetPassword() {
    const email = user.data?.email;
    if (!email) return;
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setSending(false);
    if (error) toast.error("Couldn't send the email. Please try again.");
    else toast.success(`We sent a password reset link to ${email}.`);
  }

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth" });
  }

  async function removeAccount(phrase: string) {
    const r = await deleteFn({ data: { confirm: phrase } }).catch(() => null);
    if (!r) { toast.error("Couldn't reach Reflective. Your account wasn't deleted — try again."); return false; }
    if (!r.ok) { toast.error(r.error); return false; }
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    qc.clear();
    toast.success("Your account and journal data were deleted.");
    navigate({ to: "/auth", search: { mode: "signin" } });
    return true;
  }

  return (
    <>
      <Section title="Password" description="We'll email you a link to choose a new password.">
        <Button variant="outline" className="w-full" onClick={resetPassword} disabled={sending || !user.data?.email}>
          {sending ? "Sending…" : "Send password reset email"}
        </Button>
      </Section>
      <Section title="Sign out" description="Signs you out on this device.">
        <Button variant="outline" className="w-full" onClick={signOut}>Sign out</Button>
      </Section>
      <Section title="Delete account" description="This permanently deletes your account and personal journal data.">
        <TypedConfirm
          label="Delete my account"
          title="Delete your account?"
          deletes={["Your sign-in account", "Your profile and preferences", "Journal entries, conversations and transcripts", "Memories, goals, topics, people, moods and weekly reflections"]}
          onConfirm={removeAccount}
        />
      </Section>
    </>
  );
}
