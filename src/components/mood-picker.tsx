import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MOODS } from "@/lib/tags";
import { saveMood } from "@/lib/tracking";
import { cn } from "@/lib/utils";

/** Optional 1–5 mood check-in. Skip simply hides it; nothing is stored. */
export function MoodPicker({ entryId, current, onSaved, compact }: {
  entryId?: string | null; current?: number | null; onSaved?: () => void; compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<number | null>(current ?? null);
  const [skipped, setSkipped] = useState(false);
  if (skipped) return null;

  async function pick(score: number, label: string) {
    setBusy(true);
    try {
      await saveMood({ score, label, journal_entry_id: entryId ?? null });
      setPicked(score);
      toast.success("Mood saved.");
      onSaved?.();
    } catch {
      toast.error("Couldn't save your mood. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card", compact ? "p-4" : "p-5")}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-serif text-base" id="mood-q">How are you feeling?</p>
        <span className="text-xs text-muted-foreground">Optional</span>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5" role="group" aria-labelledby="mood-q">
        {MOODS.map((m) => (
          <button key={m.score} type="button" disabled={busy} onClick={() => pick(m.score, m.label)} aria-pressed={picked === m.score}
            className={cn("rounded-lg border px-1 py-2 text-[11px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              picked === m.score ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-secondary")}>
            <span className="block font-serif text-base">{m.score}</span>{m.label}
          </button>
        ))}
      </div>
      {picked == null && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSkipped(true)}>Skip</Button>
      )}
    </div>
  );
}
