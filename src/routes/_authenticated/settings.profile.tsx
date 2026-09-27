import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadError, Loading, meta } from "@/components/page-states";
import { Section, useSaveProfile } from "@/components/settings-ui";
import { supabase } from "@/integrations/supabase/client";
import { profileQueryOptions } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/settings/profile")({
  head: () => meta("Profile settings", "Your name, email and timezone."),
  component: ProfileSettings,
});

function zones() {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(
      "timeZone",
    );
  } catch {
    return ["UTC"];
  }
}

function ProfileSettings() {
  const q = useQuery(profileQueryOptions);
  const user = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const save = useSaveProfile("Profile saved.");
  const [first, setFirst] = useState("");
  const [display, setDisplay] = useState("");
  const [tz, setTz] = useState("UTC");
  const [email, setEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const list = useMemo(zones, []);

  useEffect(() => {
    if (!q.data) return;
    setFirst(q.data.first_name ?? "");
    setDisplay(q.data.display_name ?? "");
    setTz(q.data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");
  }, [q.data]);

  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <LoadError onRetry={() => q.refetch()} />;

  async function changeEmail() {
    setEmailBusy(true);
    const { error } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: `${window.location.origin}/auth` },
    );
    setEmailBusy(false);
    if (error) {
      toast.error(error.message || "Couldn't start the email change.");
      return;
    }
    toast.success(
      "Check both inboxes to confirm the change. Your email stays the same until you do.",
    );
    setEmail("");
  }

  return (
    <>
      <Section
        title="Profile"
        description="How Reflective addresses you, and the timezone used for weeks and dates."
      >
        <div className="space-y-2">
          <Label htmlFor="first">First name</Label>
          <Input
            id="first"
            maxLength={60}
            value={first}
            onChange={(e) => setFirst(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="display">Display name</Label>
          <Input
            id="display"
            maxLength={80}
            value={display}
            onChange={(e) => setDisplay(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tz">Timezone</Label>
          <select
            id="tz"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {(list.includes(tz) ? list : [tz, ...list]).map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
        <Button
          className="w-full"
          disabled={save.isPending}
          onClick={() =>
            save.mutate({
              first_name: first.trim() || null,
              display_name: display.trim() || null,
              timezone: tz,
            })
          }
        >
          Save profile
        </Button>
      </Section>

      <Section
        title="Email"
        description={
          <>
            Signed in as <span className="text-foreground">{user.data?.email ?? "…"}</span>.
            Changing it sends a confirmation link.
          </>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="email">New email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button
          variant="outline"
          className="w-full"
          disabled={emailBusy || !/^\S+@\S+\.\S+$/.test(email)}
          onClick={changeEmail}
        >
          Send confirmation
        </Button>
      </Section>
    </>
  );
}
