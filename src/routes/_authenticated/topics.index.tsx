import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Empty, LoadError, Loading, meta, shortDate } from "@/components/page-states";
import { fetchTopics } from "@/lib/tracking";
import { syncTags } from "@/lib/tracking.functions";

export const Route = createFileRoute("/_authenticated/topics/")({
  head: () => meta("Topics", "The subjects you return to most in your journal."),
  component: TopicsPage,
});

function TopicsPage() {
  const sync = useServerFn(syncTags);
  const q = useQuery({
    queryKey: ["topics"],
    queryFn: async () => {
      await sync().catch(() => undefined);
      return fetchTopics();
    },
  });
  return (
    <AppShell>
      <PageHeader title="Topics" subtitle="What you write about, and how often." />
      <div className="max-w-2xl px-5 sm:px-10">
        <Link to="/insights" className="text-sm text-muted-foreground underline underline-offset-2">
          ← Insights
        </Link>
        <div className="mt-4">
          {q.isLoading ? (
            <Loading />
          ) : q.isError ? (
            <LoadError onRetry={() => q.refetch()} />
          ) : !q.data!.length ? (
            <Empty title="Topics will appear as your journal grows.">
              <Link to="/journal" className="underline">
                Start a reflection
              </Link>
            </Empty>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {q.data!.map((t) => (
                <li key={t.id}>
                  <Link
                    to="/topics/$topicId"
                    params={{ topicId: t.id }}
                    className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-secondary"
                  >
                    <span>{t.name}</span>
                    <span className="text-right text-xs text-muted-foreground">
                      {t.count} {t.count === 1 ? "entry" : "entries"} · {shortDate(t.last)}
                      {t.recent > 0 && (
                        <span className="block">{t.recent} in the last 2 weeks</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
