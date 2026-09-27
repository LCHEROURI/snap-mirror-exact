import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { LoadError, Loading, meta } from "@/components/page-states";
import { WeeklyReportView } from "@/components/weekly-report-view";
import { deleteReport, fetchReport, fetchTimezone } from "@/lib/reports";
import { addDays, currentWeekStart, mondayOf, WEEK_RE, weekLabel } from "@/lib/weekly";
import { useGenerateWeekly } from "@/hooks/use-generate-weekly";

export const Route = createFileRoute("/_authenticated/reports/$weekStart")({
  head: () => meta("Weekly reflection", "Your weekly reflection."),
  component: ReportPage,
});

function ReportPage() {
  const { weekStart: raw } = Route.useParams();
  const weekStart = WEEK_RE.test(raw)
    ? mondayOf(raw)
    : mondayOf(new Date().toISOString().slice(0, 10));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["reports", weekStart], queryFn: () => fetchReport(weekStart) });
  const tz = useQuery({ queryKey: ["timezone"], queryFn: fetchTimezone });
  const g = useGenerateWeekly();
  const current = tz.data ? currentWeekStart(tz.data) : null;
  const isFuture = !!current && weekStart > current;
  const go = (w: string) => navigate({ to: "/reports/$weekStart", params: { weekStart: w } });

  return (
    <AppShell>
      <PageHeader title={weekLabel(weekStart)} subtitle="Weekly reflection" />
      <div className="mx-auto grid max-w-2xl gap-4 px-5 pb-10 sm:px-10">
        <nav aria-label="Week navigation" className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => go(addDays(weekStart, -7))}>
            <ChevronLeft className="size-4" aria-hidden /> Previous week
          </Button>
          <Link
            to="/reports"
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            All weeks
          </Link>
          <Button
            variant="ghost"
            size="sm"
            disabled={!current || weekStart >= current}
            onClick={() => go(addDays(weekStart, 7))}
          >
            Next week <ChevronRight className="size-4" aria-hidden />
          </Button>
        </nav>

        {q.isLoading ? (
          <Loading />
        ) : q.isError ? (
          <LoadError onRetry={() => q.refetch()} />
        ) : isFuture ? (
          <p className="text-sm text-muted-foreground">That week hasn't happened yet.</p>
        ) : q.data ? (
          <>
            <WeeklyReportView report={q.data} />
            <div className="flex flex-wrap gap-2">
              <ConfirmButton
                label={g.pending ? "Regenerating…" : "Regenerate"}
                title="Regenerate this reflection?"
                description="The current version for this week will be replaced."
                confirm="Regenerate"
                variant="outline"
                disabled={g.pending}
                onConfirm={() => void g.run(weekStart, true)}
              />
              <ConfirmButton
                label="Delete reflection"
                title="Delete this weekly reflection?"
                description="Your journal entries are not affected."
                confirm="Delete"
                variant="ghost"
                onConfirm={() =>
                  void (async () => {
                    await deleteReport(q.data!.id);
                    await qc.invalidateQueries({ queryKey: ["reports"] });
                    await qc.invalidateQueries({ queryKey: ["insights"] });
                    navigate({ to: "/reports" });
                  })()
                }
              />
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm">No reflection for this week yet.</p>
            <Button className="mt-3" disabled={g.pending} onClick={() => g.run(weekStart)}>
              {g.pending
                ? "Writing your reflection…"
                : weekStart === current
                  ? "Generate this week's reflection"
                  : "Generate reflection for this week"}
            </Button>
          </div>
        )}
        {g.error && (
          <p role="alert" className="text-sm text-destructive">
            {g.error}
          </p>
        )}
      </div>
    </AppShell>
  );
}
