import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MoodPicker } from "@/components/mood-picker";
import type { JournalAnalysis } from "@/lib/ai/analysis";
import { createGoal, dismissGoalCandidate, fetchEntryTags } from "@/lib/tracking";

export function EntryTracking({
  entryId,
  analysis,
  dismissed,
}: {
  entryId: string;
  analysis: JournalAnalysis | null;
  dismissed: string[];
}) {
  const qc = useQueryClient();
  const tags = useQuery({
    queryKey: ["entry-tags", entryId],
    queryFn: () => fetchEntryTags(entryId),
  });
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["entry-tags", entryId] });
    qc.invalidateQueries({ queryKey: ["entry", entryId] });
    qc.invalidateQueries({ queryKey: ["goals"] });
  };
  const added = new Set((tags.data?.goals ?? []).map((g) => g.title.toLowerCase()));
  const candidates = (analysis?.goal_candidates ?? []).filter(
    (g) => !dismissed.includes(g.title) && !added.has(g.title.toLowerCase()),
  );

  async function add(g: JournalAnalysis["goal_candidates"][number]) {
    setBusy(g.title);
    try {
      await createGoal({
        title: g.title,
        description: g.description,
        created_from_entry_id: entryId,
        next_actions: g.next_action ? [{ text: g.next_action, done: false }] : [],
      });
      toast.success("Goal added.");
      refresh();
    } catch {
      toast.error("Couldn't add this goal. Please try again.");
    } finally {
      setBusy(null);
    }
  }
  async function dismiss(title: string) {
    setBusy(title);
    try {
      await dismissGoalCandidate(entryId, title, dismissed);
      refresh();
    } catch {
      toast.error("Couldn't dismiss. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-6 space-y-5" aria-label="Topics, people, mood and goals">
      {tags.isError && (
        <p className="text-sm text-muted-foreground">
          Couldn't load topics and people.{" "}
          <button className="underline" onClick={() => tags.refetch()}>
            Retry
          </button>
        </p>
      )}
      {!!tags.data?.topics.length && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Topics</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {tags.data.topics.map((t) => (
              <li key={t.id}>
                <Link
                  to="/topics/$topicId"
                  params={{ topicId: t.id }}
                  className="block rounded-full border border-border bg-card px-3 py-1 text-sm hover:bg-secondary"
                >
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!tags.data?.people.length && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground">People</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {tags.data.people.map((p) => (
              <li key={p.id}>
                <Link
                  to="/people/$personId"
                  params={{ personId: p.id }}
                  className="block rounded-full border border-border bg-card px-3 py-1 text-sm hover:bg-secondary"
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {tags.data && (
        <MoodPicker
          entryId={entryId}
          current={tags.data.mood?.score ?? null}
          compact
          onSaved={refresh}
        />
      )}
      {!!tags.data?.goals.length && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
            Goals from this entry
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {tags.data.goals.map((g) => (
              <li key={g.id}>
                <Link
                  to="/goals/$goalId"
                  params={{ goalId: g.id }}
                  className="underline underline-offset-2"
                >
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {candidates.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Possible goals</h3>
          <ul className="mt-2 space-y-2">
            {candidates.map((g) => (
              <li key={g.title} className="rounded-xl border border-border px-4 py-3 text-sm">
                <p>
                  I noticed a possible goal: <span className="font-medium">{g.title}</span>
                </p>
                {g.next_action && (
                  <p className="mt-1 text-muted-foreground">A small next step: {g.next_action}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" disabled={busy === g.title} onClick={() => add(g)}>
                    Add Goal
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === g.title}
                    onClick={() => dismiss(g.title)}
                  >
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
