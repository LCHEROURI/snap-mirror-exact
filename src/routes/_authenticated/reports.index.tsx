import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Empty, LoadError, Loading, meta } from "@/components/page-states";
import { fetchReports, fetchTimezone } from "@/lib/reports";
import { currentWeekStart, weekLabel } from "@/lib/weekly";
import { useGenerateWeekly } from "@/hooks/use-generate-weekly";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => meta("Weekly reflections", "Your saved weekly reflections, week by week."),
  component: ReportsPage,
});

function ReportsPage() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["reports"], queryFn: fetchReports });
  const tz = useQuery({ queryKey: ["timezone"], queryFn: fetchTimezone });
  const g = useGenerateWeekly();
  const current = tz.data ? currentWeekStart(tz.data) : null;
  const open = (w: string) => navigate({ to: "/reports/$weekStart", params: { weekStart: w } });

  async function generate(regenerate = false) {
    const r = await g.run(current ?? undefined, regenerate);
    if (r && r.status !== "exists") open(r.week_start);
  }

  return (
    <AppShell>
      <PageHeader title="Weekly reflections" subtitle="A short look back at your week, written from your own entries." />
      <div className="mx-auto grid max-w-2xl gap-4 px-5 pb-10 sm:px-10">
        <div className="rounded-2xl border border-border bg-card p-5">
          {g.existsFor ? (
            <>
              <p className="text-sm">You already have a reflection for this week.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => open(g.existsFor!)}>View existing</Button>
                <Button variant="outline" disabled={g.pending} onClick={() => { g.clearExists(); generate(true); }}>{g.pending ? "Regenerating…" : "Regenerate"}</Button>
              </div>
            </>
          ) : (
            <Button onClick={() => generate()} disabled={g.pending || !current}>{g.pending ? "Writing your reflection…" : "Generate this week's reflection"}</Button>
          )}
          {g.error && <p role="alert" className="mt-3 text-sm text-destructive">{g.error}</p>}
        </div>

        {q.isLoading ? <Loading /> : q.isError ? <LoadError onRetry={() => q.refetch()} /> : !q.data?.length ? (
          <Empty title="Your first weekly reflection will appear after you generate one." />
        ) : (
          <ul className="grid gap-3">
            {q.data.map((r) => (
              <li key={r.id}>
                <Link to="/reports/$weekStart" params={{ weekStart: r.week_start }} className="block rounded-2xl border border-border bg-card p-5 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{weekLabel(r.week_start)}</span>
                  <p className="mt-1 line-clamp-2 text-sm">{r.summary}</p>
                  {r.themes?.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{r.themes.map((t) => t.title).join(" · ")}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
