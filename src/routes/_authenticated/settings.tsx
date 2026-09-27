import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { profileQueryOptions } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Reflective" },
      { name: "description", content: "Your name, reminders, memory preference and privacy." },
      { property: "og:title", content: "Settings — Reflective" },
      { property: "og:description", content: "Manage your Reflective account and privacy." },
    ],
  }),
  component: SettingsPage,
});

const REMINDERS = [
  { value: "evening", label: "Evening" },
  { value: "morning", label: "Morning" },
  { value: "none", label: "No reminders" },
];

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(profileQueryOptions);

  const [name, setName] = useState("");
  const [reminder, setReminder] = useState("evening");
  const [memory, setMemory] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name ?? "");
    setReminder(profile.reminder_preference);
    setMemory(profile.ai_memory_enabled);
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: name.trim() || null,
          reminder_preference: reminder,
          ai_memory_enabled: memory,
        })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Saved.");
    },
    onError: () => toast.error("Couldn't save your settings. Please try again."),
  });

  async function signOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/auth" });
  }

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Your details, reminders and privacy." />
      <div className="max-w-lg space-y-8 px-5 sm:px-10">
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Reminders</Label>
            <div className="flex gap-2">
              {REMINDERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setReminder(option.value)}
                  className={
                    "flex-1 rounded-lg border px-3 py-2 text-xs transition-colors " +
                    (reminder === option.value
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border hover:bg-secondary")
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 pt-2">
            <div>
              <Label htmlFor="memory">Let Reflective remember</Label>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Keeps a short set of notes about what matters to you, so conversations feel
                continuous. You'll be able to view and delete them.
              </p>
            </div>
            <Switch id="memory" checked={memory} onCheckedChange={setMemory} />
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
            Save changes
          </Button>
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-serif text-lg tracking-tight">Privacy</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your entries are visible only to your account. Export and permanent deletion of your
            journal arrive in a later step. Reflective is a reflection companion, not a therapist or
            medical service.
          </p>
        </section>

        <Button variant="outline" className="w-full" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </AppShell>
  );
}
