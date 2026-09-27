import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { MoodPicker } from "@/components/mood-picker";
import { Empty, LoadError, Loading, meta, shortDate } from "@/components/page-states";
import { fetchMoods } from "@/lib/tracking";

export const Route = createFileRoute("/_authenticated/mood")({
  head: () => meta("Mood", "Your optional mood check-ins over time."),
  component: MoodPage,
});

const MIN_FOR_AVERAGE = 5;

export function moodSummary(moods: { score: number; recorded_at: string }[], now = Date.now()) {
  const week = 7 * 86_400_000;
  const thisWeek = moods.filter((m) => now - +new Date(m.recorded_at) < week);
  const lastWeek = moods.filter((m) => {
    const a = now - +new Date(m.recorded_at);
    return a >= week && a < 2 * week;
  });
  const pos = (l: typeof moods) => l.filter((m) => m.score >= 4).length;
  if (thisWeek.length >= 2 && lastWeek.length >= 2 && pos(thisWeek) > pos(lastWeek))
    return "You logged more positive moods this week than last week.";
  if (thisWeek.length >= 2 && lastWeek.length >= 2 && pos(thisWeek) < pos(lastWeek))
    return "You logged fewer positive moods this week than last week.";
  return null;
}

function MoodPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["moods"], queryFn: fetchMoods });
  const moods = q.data ?? [];
  const series = [...moods].reverse().slice(-30);
  const avg =
    moods.length >= MIN_FOR_AVERAGE ? moods.reduce((s, m) => s + m.score, 0) / moods.length : null;
  const note = moodSummary(moods);
  const W = 300,
    H = 80;
  const pts = series.map(
    (m, i) =>
      [
        series.length === 1 ? W / 2 : (i / (series.length - 1)) * W,
        H - ((m.score - 1) / 4) * (H - 10) - 5,
      ] as const,
  );

  return (
    <AppShell>
      <PageHeader
        title="Mood"
        subtitle="Optional check-ins — a simple record, not an assessment."
      />
      <div className="max-w-2xl space-y-6 px-5 sm:px-10">
        <Link to="/insights" className="text-sm text-muted-foreground underline underline-offset-2">
          ← Insights
        </Link>
        <MoodPicker onSaved={() => qc.invalidateQueries({ queryKey: ["moods"] })} />
        {q.isLoading ? (
          <Loading />
        ) : q.isError ? (
          <LoadError onRetry={() => q.refetch()} />
        ) : !moods.length ? (
          <Empty title="No mood check-ins yet.">
            Log one above, or after finishing a reflection.
          </Empty>
        ) : (
          <>
            <section
              className="rounded-2xl border border-border bg-card p-5"
              aria-label="Mood trend"
            >
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
                Recent trend
              </h2>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="mt-3 h-24 w-full"
                role="img"
                aria-label={`Line of your last ${series.length} mood check-ins, from 1 (very low) to 5 (great)`}
              >
                {pts.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-primary"
                    points={pts.map((p) => p.join(",")).join(" ")}
                  />
                )}
                {pts.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r="3" className="fill-primary" />
                ))}
              </svg>
              <p className="mt-2 text-sm text-muted-foreground">
                {avg != null
                  ? `Average across ${moods.length} check-ins: ${avg.toFixed(1)} of 5.`
                  : `An average appears after ${MIN_FOR_AVERAGE} check-ins.`}
                {note && <> {note}</>}
              </p>
            </section>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {moods.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <span>
                    <span className="font-serif text-base">{m.score}</span> · {m.label ?? ""}
                  </span>
                  <span className="text-right text-xs text-muted-foreground">
                    {shortDate(m.recorded_at)}
                    {m.journal_entry_id && (
                      <Link
                        to="/entries/$entryId"
                        params={{ entryId: m.journal_entry_id }}
                        className="block underline"
                      >
                        {(m.journal_entries as { title: string } | null)?.title ?? "Entry"}
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </AppShell>
  );
}
