import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { PenLine } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { profileQueryOptions } from "@/lib/profile";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: "Your journal — Reflective" },
      { name: "description", content: "Start a reflection and revisit your recent entries." },
      { property: "og:title", content: "Your journal — Reflective" },
      { property: "og:description", content: "Start a reflection and revisit recent entries." },
    ],
  }),
  component: JournalHome,
});

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function JournalHome() {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useQuery(profileQueryOptions);

  useEffect(() => {
    if (!isLoading && profile && !profile.onboarded_at) {
      navigate({ to: "/onboarding" });
    }
  }, [isLoading, profile, navigate]);

  const { data: sessions } = useQuery({
    queryKey: ["recent-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_sessions")
        .select("id, title, started_at, mood_score")
        .order("started_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const name = profile?.display_name?.split(" ")[0];

  return (
    <AppShell>
      <PageHeader
        title={`${greeting()}${name ? `, ${name}` : ""}.`}
        subtitle="What's on your mind today? Take as long as you like — nothing here is shared."
      />

      <div className="px-5 sm:px-10">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-serif text-xl tracking-tight">Start a reflection</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Write freely about your day. Conversations with your companion arrive next.
          </p>
          <Button className="mt-5 w-full sm:w-auto" disabled>
            <PenLine className="size-4" />
            Coming in the next step
          </Button>
        </div>

        <section className="mt-10">
          <h2 className="font-serif text-lg tracking-tight">Recent entries</h2>
          {sessions && sessions.length > 0 ? (
            <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
              {sessions.map((session) => (
                <li key={session.id} className="px-5 py-4">
                  <p className="text-sm text-foreground">{session.title ?? "Untitled reflection"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(session.started_at).toLocaleDateString(undefined, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-border px-5 py-10 text-center">
              <p className="font-serif text-lg">Nothing here yet</p>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Your entries will gather here — a quiet record of how things have been going.
              </p>
            </div>
          )}
        </section>

        <p className="mt-10 max-w-prose text-xs leading-relaxed text-muted-foreground">
          Reflective is a reflection companion, not a therapist or medical service. If you're in
          crisis, please reach out to a local support line.{" "}
          <Link to="/settings" className="underline underline-offset-4">
            Privacy and settings
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
