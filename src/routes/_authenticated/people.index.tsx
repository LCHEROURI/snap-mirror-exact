import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Empty, LoadError, Loading, meta, shortDate } from "@/components/page-states";
import { fetchPeople } from "@/lib/tracking";
import { syncTags } from "@/lib/tracking.functions";

export const Route = createFileRoute("/_authenticated/people/")({
  head: () => meta("People", "The people you mention in your journal."),
  component: PeoplePage,
});

function PeoplePage() {
  const sync = useServerFn(syncTags);
  const q = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      await sync().catch(() => undefined);
      return fetchPeople();
    },
  });
  return (
    <AppShell>
      <PageHeader title="People" subtitle="Who shows up in your reflections." />
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
            <Empty title="People you mention often will appear here." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {q.data!.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/people/$personId"
                    params={{ personId: p.id }}
                    className="block rounded-2xl border border-border bg-card p-4 hover:bg-secondary"
                  >
                    <span className="block font-medium">{p.name}</span>
                    {p.relationship && (
                      <span className="block text-sm text-muted-foreground">{p.relationship}</span>
                    )}
                    <span className="mt-2 block text-xs text-muted-foreground">
                      {p.count} {p.count === 1 ? "mention" : "mentions"} · last {shortDate(p.last)}
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
