import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { entryCountQueryOptions } from "@/lib/journal";
import { profileQueryOptions } from "@/lib/profile";
import { cn } from "@/lib/utils";

const REMINDERS = [
  { value: "morning", label: "Morning" },
  { value: "evening", label: "Evening" },
  { value: "none", label: "No reminders" },
];

/** Calm success note shown only while the user has exactly one saved entry. */
export function FirstReflectionCard({ entryId }: { entryId: string }) {
  const qc = useQueryClient();
  const count = useQuery(entryCountQueryOptions);
  const { data: profile } = useQuery(profileQueryOptions);
  const dismissKey = `reflective-first-seen:${entryId}`;
  const [dismissed, setDismissed] = useState(true);
  const [reminder, setReminder] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(dismissKey) === "1");
  }, [dismissKey]);

  if (count.data !== 1 || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(dismissKey, "1");
    setDismissed(true);
  };

  async function saveReminder() {
    if (!reminder || !profile || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ reminder_preference: reminder })
        .eq("id", profile.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["profile"] });
      setSaved(true);
    } catch {
      toast.error("Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="first-reflection-title"
      className="mt-4 rounded-2xl border border-border bg-card p-5"
    >
      <h2 id="first-reflection-title" className="font-serif text-xl">
        Your first reflection is saved.
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        You've started your journal. From here, Reflective can begin helping you notice patterns
        over time.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild onClick={dismiss}>
          <Link to="/journal">Go to my journal</Link>
        </Button>
        <Button variant="outline" asChild onClick={dismiss}>
          <Link to="/journal">Reflect again</Link>
        </Button>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        {saved ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Check className="size-4" aria-hidden /> Preference saved. You can change it in
            Settings.
          </p>
        ) : (
          <fieldset>
            <legend className="text-sm font-medium">Would a gentle reminder help?</legend>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
              {REMINDERS.map((r) => {
                const on = reminder === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setReminder(r.value)}
                    className={cn(
                      "flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-background hover:bg-secondary",
                    )}
                  >
                    {on && <Check className="size-3.5" aria-hidden />}
                    {r.label}
                  </button>
                );
              })}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 -ml-3"
              disabled={!reminder || saving}
              onClick={saveReminder}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save my preference
            </Button>
          </fieldset>
        )}
      </div>
    </section>
  );
}
