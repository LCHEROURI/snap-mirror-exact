import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Reflective" },
      { name: "description", content: "Themes, people and mood patterns drawn from your journal." },
      { property: "og:title", content: "Insights — Reflective" },
      { property: "og:description", content: "Themes, people and mood patterns over time." },
    ],
  }),
  component: Insights,
});

function Insights() {
  return (
    <AppShell>
      <PageHeader
        title="Insights"
        subtitle="Themes, people, goals and mood — drawn gently from what you've written."
      />
      <div className="px-5 sm:px-10">
        <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
          <p className="font-serif text-lg">Nothing to show yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            After a few reflections, patterns start to appear here — the topics you return to, the
            people you mention, and how your mood moves week to week.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
