import { createFileRoute, Link } from "@tanstack/react-router";
import { Flag, Hash, SmilePlus, Users } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { meta } from "@/components/page-states";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => meta("Insights", "Topics, people, goals and mood drawn from your journal."),
  component: Insights,
});

const CARDS = [
  { to: "/topics", title: "Topics", body: "What you write about most.", icon: Hash },
  { to: "/people", title: "People", body: "Who shows up in your reflections.", icon: Users },
  { to: "/mood", title: "Mood", body: "Optional check-ins over time.", icon: SmilePlus },
  { to: "/goals", title: "Goals", body: "What you're working toward.", icon: Flag },
] as const;

function Insights() {
  return (
    <AppShell>
      <PageHeader title="Insights" subtitle="Insights become more useful as your journal grows." />
      <ul className="grid max-w-2xl gap-3 px-5 sm:grid-cols-2 sm:px-10">
        {CARDS.map(({ to, title, body, icon: Icon }) => (
          <li key={to}>
            <Link to={to} className="flex gap-3 rounded-2xl border border-border bg-card p-5 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Icon className="mt-0.5 size-5 text-primary" aria-hidden />
              <span><span className="block font-serif text-lg">{title}</span><span className="text-sm text-muted-foreground">{body}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
