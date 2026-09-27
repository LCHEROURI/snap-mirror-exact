import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { LoadError, Loading, meta, shortDate } from "@/components/page-states";
import { fetchInsights } from "@/lib/reports";
import { weekLabel } from "@/lib/weekly";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => meta("Insights", "This week, mood, topics, goals, people and patterns from your journal."),
  component: Insights,
});

const MIN_MOOD_POINTS = 3;

function Card({ title, to, children }: { title: string; to?: "/topics" | "/people" | "/mood" | "/goals" | "/reports"; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-label={title}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg">{title}</h2>
        {to && <Link to={to} className="-my-3 -mr-2 inline-flex min-h-11 items-center px-2 text-xs text-muted-foreground underline-offset-2 hover:underline">See all</Link>}
      </div>
      <div className="mt-3 text-sm">{children}</div>
    </section>
  );
}
const Muted = ({ children }: { children: ReactNode }) => <p className="text-muted-foreground">{children}</p>;

function MoodChart({ series }: { series: { date: string; score: number }[] }) {
  const W = 300, H = 80;
  const x = (i: number) => (series.length === 1 ? W / 2 : (i / (series.length - 1)) * (W - 8) + 4);
  const y = (s: number) => H - 4 - ((s - 1) / 4) * (H - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full" role="img" aria-label={`Daily mood over the last 30 days, ${series.length} days with check-ins, scale 1 to 5`}>
      <polyline fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" points={series.map((p, i) => `${x(i)},${y(p.score)}`).join(" ")} />
      {series.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.score)} r="3" className="fill-primary" />)}
    </svg>
  );
}

function Insights() {
  const q = useQuery({ queryKey: ["insights"], queryFn: fetchInsights });
  return (
    <AppShell>
      <PageHeader title="Insights" subtitle="Counts come straight from your journal. Weekly reflections add the patterns." />
      <div className="mx-auto grid max-w-3xl gap-3 px-5 pb-10 sm:grid-cols-2 sm:px-10">
        {q.isLoading ? <div className="sm:col-span-2"><Loading /></div> : q.isError || !q.data ? <div className="sm:col-span-2"><LoadError onRetry={() => q.refetch()} /></div> : (() => {
          const d = q.data;
          const w = d.thisWeek;
          return (
            <>
              <Card title="This Week">
                <p className="text-xs text-muted-foreground">{weekLabel(d.weekStart)}</p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                  {[["Entries", w.entries], ["Reflections", w.reflections], ["Goals touched", w.goalsTouched]].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-secondary p-2"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-serif text-xl">{v}</dd></div>
                  ))}
                </dl>
                {w.topTopics.length > 0 && <p className="mt-3">Most on your mind: {w.topTopics.map((t) => t.name).join(", ")}</p>}
                {w.mood && <p className="mt-1 text-muted-foreground">{w.mood.count} mood check-ins, averaging {w.mood.avg.toFixed(1)} of 5.</p>}
                {w.entries === 0 && <Muted>No entries yet this week.</Muted>}
              </Card>

              <Card title="Mood" to="/mood">
                {d.moodSeries.length >= MIN_MOOD_POINTS ? <MoodChart series={d.moodSeries} /> : <Muted>{d.moodSeries.length ? "A trend appears after a few more days of check-ins." : "Mood insights will appear when you choose to log how you're feeling."}</Muted>}
              </Card>

              <Card title="Topics" to="/topics">
                {d.topics.length ? (
                  <ul className="space-y-1">{d.topics.map((t) => (
                    <li key={t.id} className="flex justify-between gap-2"><Link to="/topics/$topicId" params={{ topicId: t.id }} className="underline-offset-2 hover:underline">{t.name}</Link><span className="text-muted-foreground">{t.count}</span></li>
                  ))}</ul>
                ) : <Muted>Topics appear after you finish a few reflections.</Muted>}
                <p className="mt-2 text-xs text-muted-foreground">Entries in the last 30 days</p>
              </Card>

              <Card title="Goals" to="/goals">
                {d.goals.active + d.goals.completed === 0 ? <Muted>Goal insights will appear as you create and track goals.</Muted> : (
                  <>
                    <p>{d.goals.active} active · {d.goals.completed} completed</p>
                    {d.goals.recentCheckins.length > 0 && (
                      <ul className="mt-2 space-y-1 text-muted-foreground">{d.goals.recentCheckins.map((c) => (
                        <li key={c.id}><Link to="/goals/$goalId" params={{ goalId: c.goal_id }} className="text-foreground underline-offset-2 hover:underline">{c.goalTitle}</Link>: {c.note} <span className="text-xs">({shortDate(c.created_at)})</span></li>
                      ))}</ul>
                    )}
                  </>
                )}
              </Card>

              <Card title="People" to="/people">
                {d.people.length ? (
                  <ul className="space-y-1">{d.people.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2"><Link to="/people/$personId" params={{ personId: p.id }} className="underline-offset-2 hover:underline">{p.name}</Link><span className="text-muted-foreground">{p.count} {p.count === 1 ? "entry" : "entries"}</span></li>
                  ))}</ul>
                ) : <Muted>People you mention will appear here.</Muted>}
              </Card>

              <Card title="Patterns">
                {d.patterns.length ? (
                  <ul className="space-y-2">{d.patterns.map((p) => <li key={p.week_start + p.observation}>{p.observation} <span className="text-xs text-muted-foreground">({weekLabel(p.week_start)})</span></li>)}</ul>
                ) : <Muted>Patterns become clearer as your journal grows.</Muted>}
              </Card>

              <div className="sm:col-span-2">
                <Card title="Recent Weekly Reflections" to="/reports">
                  {d.reports.length ? (
                    <ul className="space-y-3">{d.reports.map((r) => (
                      <li key={r.id}><Link to="/reports/$weekStart" params={{ weekStart: r.week_start }} className="block rounded-xl p-2 hover:bg-secondary">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">{weekLabel(r.week_start)}</span>
                        <span className="mt-1 line-clamp-2 block">{r.summary}</span>
                      </Link></li>
                    ))}</ul>
                  ) : <Muted>Your first weekly reflection will appear after you generate one.</Muted>}
                  <Link to="/reports" className="mt-3 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline">Generate this week's reflection</Link>
                </Card>
              </div>
            </>
          );
        })()}
      </div>
    </AppShell>
  );
}
