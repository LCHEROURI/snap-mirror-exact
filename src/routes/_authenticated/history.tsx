import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "History — Reflective" },
      { name: "description", content: "Browse every reflection you've written, grouped by date." },
      { property: "og:title", content: "History — Reflective" },
      { property: "og:description", content: "Browse every reflection you've written." },
    ],
  }),
  component: History,
});

function History() {
  const { data: sessions } = useQuery({
    queryKey: ["all-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_sessions")
        .select("id, title, started_at")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell>
      <PageHeader
        title="History"
        subtitle="Every reflection you've written, newest first."
      />
      <div className="px-5 sm:px-10">
        {sessions && sessions.length > 0 ? (
          <ul className="space-y-3">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="rounded-2xl border border-border bg-card px-5 py-4"
              >
                <p className="text-sm">{session.title ?? "Untitled reflection"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(session.started_at).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
            <p className="font-serif text-lg">No entries yet</p>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Once you write your first reflection it will appear here as a quiet timeline.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
