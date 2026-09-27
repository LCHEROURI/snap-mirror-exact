import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchEntries, formatDate, type EntryFilters } from "@/lib/journal";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "History — Reflective" },
      { name: "description", content: "Browse and search every reflection you've saved." },
      { property: "og:title", content: "History — Reflective" },
      { property: "og:description", content: "Browse and search your saved reflections." },
    ],
  }),
  component: History,
});

function History() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<NonNullable<EntryFilters["range"]>>("all");

  useEffect(() => {
    const t = setTimeout(() => setSearch(input), 250);
    return () => clearTimeout(t);
  }, [input]);

  const entries = useQuery({
    queryKey: ["entries", search, range],
    queryFn: () => fetchEntries({ search, range }),
  });

  const filtered = !!search || range !== "all";

  return (
    <AppShell>
      <PageHeader title="History" subtitle="Every reflection you've saved, newest first." />
      <div className="px-5 sm:px-10">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search titles and text"
              className="pl-9"
              aria-label="Search entries"
            />
          </div>
          <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <SelectTrigger className="sm:w-40" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any time</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="year">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Select disabled>
            <SelectTrigger
              className="sm:w-40"
              aria-label="Topic filter (coming later)"
              title="Topics arrive in a later phase"
            >
              <SelectValue placeholder="All topics" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All topics</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6">
          {entries.isLoading ? (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="mx-auto size-5 animate-spin" aria-label="Loading" />
            </div>
          ) : entries.isError ? (
            <div className="rounded-2xl border border-border px-5 py-10 text-center">
              <p className="font-serif text-lg">Couldn't load your entries.</p>
              <Button variant="outline" className="mt-4" onClick={() => entries.refetch()}>
                Try again
              </Button>
            </div>
          ) : entries.data && entries.data.length > 0 ? (
            <ul className="space-y-3">
              {entries.data.map((e) => (
                <li key={e.id}>
                  <Link
                    to="/entries/$entryId"
                    params={{ entryId: e.id }}
                    className="block rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-serif text-base">{e.title}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {e.session_type === "voice" ? "Voice" : "Written"}
                      </span>
                    </div>
                    {e.preview && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.preview}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">{formatDate(e.started_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
              <p className="font-serif text-lg">
                {filtered ? "No entries match" : "Your journal starts with one thought."}
              </p>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {filtered
                  ? "Try a different word or date range."
                  : "Finished reflections will appear here."}
              </p>
              {!filtered && (
                <Button asChild className="mt-4">
                  <Link to="/journal">Start writing</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
