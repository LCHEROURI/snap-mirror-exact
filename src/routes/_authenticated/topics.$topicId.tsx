import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/confirm-button";
import { MergeSelect } from "@/components/merge-select";
import { Empty, LoadError, Loading, meta, shortDate } from "@/components/page-states";
import { deleteTopic, fetchTopic, fetchTopics, mergeTopics, renameTopic, unlinkTopic } from "@/lib/tracking";

export const Route = createFileRoute("/_authenticated/topics/$topicId")({
  head: () => meta("Topic", "Journal entries linked to one topic."),
  component: TopicDetail,
});

function monthCounts(dates: string[]) {
  const m = new Map<string, number>();
  for (const d of dates) { const k = d.slice(0, 7); m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort();
}

function TopicDetail() {
  const { topicId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["topic", topicId], queryFn: () => fetchTopic(topicId) });
  const all = useQuery({ queryKey: ["topics"], queryFn: fetchTopics });
  const [name, setName] = useState("");
  useEffect(() => { if (q.data) setName(q.data.topic.name); }, [q.data]);
  const done = () => { qc.invalidateQueries({ queryKey: ["topics"] }); qc.invalidateQueries({ queryKey: ["topic", topicId] }); qc.invalidateQueries({ queryKey: ["entry-tags"] }); };
  const err = (e: unknown) => toast.error(e instanceof Error && e.message.includes("already") ? e.message : "Couldn't save. Please try again.");

  const rename = useMutation({ mutationFn: () => renameTopic(topicId, name), onSuccess: () => { done(); toast.success("Renamed."); }, onError: err });
  const merge = useMutation({ mutationFn: (target: string) => mergeTopics(topicId, target), onSuccess: (_d, target) => { done(); toast.success("Merged."); navigate({ to: "/topics/$topicId", params: { topicId: target } }); }, onError: () => toast.error("Couldn't merge. Nothing was changed.") });
  const del = useMutation({ mutationFn: () => deleteTopic(topicId), onSuccess: () => { done(); navigate({ to: "/topics" }); toast.success("Topic removed. Entries are untouched."); }, onError: err });
  const unlink = useMutation({ mutationFn: (entryId: string) => unlinkTopic(entryId, topicId), onSuccess: done, onError: err });

  if (q.isLoading) return <AppShell><Loading /></AppShell>;
  if (q.isError) return <AppShell><div className="p-5"><LoadError onRetry={() => q.refetch()} /></div></AppShell>;
  if (!q.data) return <AppShell><div className="p-5"><Empty title="This topic wasn't found."><Link to="/topics" className="underline">All topics</Link></Empty></div></AppShell>;
  const { topic, entries } = q.data;
  const months = monthCounts(entries.map((e) => e.completed_at));
  const max = Math.max(1, ...months.map(([, n]) => n));

  return (
    <AppShell>
      <PageHeader title={topic.name} subtitle={`${entries.length} ${entries.length === 1 ? "entry" : "entries"}`} />
      <div className="max-w-2xl space-y-6 px-5 sm:px-10">
        <Link to="/topics" className="text-sm text-muted-foreground underline underline-offset-2">← All topics</Link>

        {months.length > 0 && (
          <section aria-label="Entries per month" className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">When it came up</h2>
            <ul className="flex items-end gap-2" style={{ height: 80 }}>
              {months.map(([m, n]) => (
                <li key={m} className="flex flex-1 flex-col items-center justify-end gap-1" aria-label={`${m}: ${n}`}>
                  <span className="w-full max-w-8 rounded-t bg-primary/70" style={{ height: `${(n / max) * 56}px` }} />
                  <span className="text-[10px] text-muted-foreground">{new Date(m + "-01").toLocaleDateString(undefined, { month: "short" })}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-serif text-lg">Entries</h2>
          {entries.length === 0 ? <p className="text-sm text-muted-foreground">No entries linked right now.</p> : (
            <ul className="space-y-2">
              {entries.map((e) => (
                <li key={e.id} className="rounded-xl border border-border bg-card p-3">
                  <Link to="/entries/$entryId" params={{ entryId: e.id }} className="block hover:underline">
                    <span className="block text-xs text-muted-foreground">{shortDate(e.completed_at)}</span>{e.title}
                  </Link>
                  {e.summary && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.summary}</p>}
                  <Button size="sm" variant="ghost" className="mt-1" onClick={() => unlink.mutate(e.id)}>Remove from topic</Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim() && name.trim() !== topic.name) rename.mutate(); }}>
            <Input aria-label="Topic name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            <Button type="submit" variant="outline" disabled={!name.trim() || name.trim() === topic.name}>Rename</Button>
          </form>
          <MergeSelect noun="topic" options={(all.data ?? []).filter((t) => t.id !== topicId)} onMerge={(id) => merge.mutate(id)} disabled={merge.isPending} />
          <ConfirmButton label="Delete topic" title="Delete this topic?" description="The topic and its links are removed. Your journal entries are not deleted." confirm="Delete" onConfirm={() => del.mutate()} />
        </section>
      </div>
    </AppShell>
  );
}
