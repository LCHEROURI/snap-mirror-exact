import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { ReportRow } from "@/lib/reports";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-label={title}>
      <h2 className="font-serif text-lg">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
const Bullets = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-1 pl-5">{items.map((i) => <li key={i}>{i}</li>)}</ul>
);

/** Renders stored report sections; empty sections are omitted rather than padded. */
export function WeeklyReportView({ report }: { report: ReportRow }) {
  return (
    <div className="grid gap-3">
      <Section title="Your Week"><p>{report.summary}</p><p className="mt-2 text-xs text-muted-foreground">From {report.entry_count} {report.entry_count === 1 ? "entry" : "entries"} · AI-generated reflection — observations, not conclusions.</p></Section>
      {report.themes.length > 0 && (
        <Section title="Key Themes">
          <ul className="space-y-2">{report.themes.map((t) => <li key={t.title}><span className="font-medium">{t.title}</span> — {t.description}</li>)}</ul>
        </Section>
      )}
      {report.wins.length > 0 && <Section title="Wins"><Bullets items={report.wins} /></Section>}
      {report.challenges.length > 0 && <Section title="Challenges"><Bullets items={report.challenges} /></Section>}
      <Section title="Recurring Patterns">
        {report.patterns.length ? (
          <ul className="space-y-1">{report.patterns.map((p) => <li key={p.observation}>{p.observation} <span className="text-xs text-muted-foreground">({p.evidence_count} entries)</span></li>)}</ul>
        ) : <p className="text-muted-foreground">Patterns become clearer as your journal grows.</p>}
      </Section>
      {report.decisions.length > 0 && <Section title="Important Decisions"><Bullets items={report.decisions} /></Section>}
      {report.goal_progress.length > 0 && (
        <Section title="Goals & Progress">
          <ul className="space-y-2">{report.goal_progress.map((g) => (
            <li key={g.goal_title}>{g.goal_id ? <Link to="/goals/$goalId" params={{ goalId: g.goal_id }} className="font-medium underline-offset-2 hover:underline">{g.goal_title}</Link> : <span className="font-medium">{g.goal_title}</span>} — {g.summary}</li>
          ))}</ul>
        </Section>
      )}
      {report.worth_noticing && <Section title="Something Worth Noticing"><p>{report.worth_noticing}</p></Section>}
      {report.next_week.length > 0 && <Section title="Next Week"><Bullets items={report.next_week} /></Section>}
    </div>
  );
}
