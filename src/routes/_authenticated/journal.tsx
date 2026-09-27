import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, PenLine, Mic } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { profileQueryOptions } from "@/lib/profile";
import { createSession, fetchActiveSession, fetchEntries, formatDate } from "@/lib/journal";
import { HomeTracking } from "@/components/home-tracking";

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

  const { data: sessions } = useQuery({ queryKey: ["entries", "recent"], queryFn: () => fetchEntries().then((r) => r.slice(0, 5)) });
  const { data: active } = useQuery({ queryKey: ["active-session"], queryFn: fetchActiveSession });
  const [starting, setStarting] = useState(false);

  async function start() {
    setStarting(true);
    try {
      const id = await createSession();
      navigate({ to: "/write/$sessionId", params: { sessionId: id } });
    } catch {
      toast.error("Couldn't start a reflection. Try again.");
      setStarting(false);
    }
  }

  const name = profile?.display_name?.split(" ")[0];

  return (
    <AppShell>
      <PageHeader
        title={`${greeting()}${name ? `, ${name}` : ""}.`}
        subtitle="What's on your mind today? Take as long as you like — nothing here is shared."
      />

      <p className="-mt-3 mb-4 flex gap-4 px-5 text-sm sm:hidden">
        <Link to="/ask" className="text-primary underline-offset-4 hover:underline">Ask my journal</Link>
        <Link to="/settings" className="text-muted-foreground underline-offset-4 hover:underline">Settings</Link>
      </p>
      <div className="px-5 sm:px-10">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-serif text-xl tracking-tight">Start a reflection</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Write freely about your day. Everything is saved privately as you go.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button className="w-full sm:w-auto" onClick={start} disabled={starting}>
              {starting ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
              Write
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" asChild>
              <Link to="/voice"><Mic className="size-4" /> Talk</Link>
            </Button>
            {active && (
              <Button variant="outline" asChild className="w-full sm:w-auto">
                <Link to="/write/$sessionId" params={{ sessionId: active.id }}>Continue unfinished reflection</Link>
              </Button>
            )}
          </div>
        </div>

        <HomeTracking />

        <section className="mt-10">
          <h2 className="font-serif text-lg tracking-tight">Recent entries</h2>
          {sessions && sessions.length > 0 ? (
            <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
              {sessions.map((session) => (
                <li key={session.id}>
                  <Link to="/entries/$entryId" params={{ entryId: session.id }} className="block px-5 py-4 hover:bg-accent/40">
                    <p className="text-sm text-foreground">{session.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(session.started_at)}</p>
                  </Link>
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
