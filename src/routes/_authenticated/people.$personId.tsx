import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/confirm-button";
import { MergeSelect } from "@/components/merge-select";
import { Empty, LoadError, Loading, meta, shortDate } from "@/components/page-states";
import { deletePerson, fetchPeople, fetchPerson, mergePeople, updatePerson } from "@/lib/tracking";

export const Route = createFileRoute("/_authenticated/people/$personId")({
  head: () => meta("Person", "Mentions of one person across your journal."),
  component: PersonDetail,
});

function PersonDetail() {
  const { personId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["person", personId], queryFn: () => fetchPerson(personId) });
  const all = useQuery({ queryKey: ["people"], queryFn: fetchPeople });
  const [name, setName] = useState("");
  const [rel, setRel] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => { if (q.data) { setName(q.data.person.name); setRel(q.data.person.relationship ?? ""); setNotes(q.data.person.notes ?? ""); } }, [q.data]);
  const done = () => { qc.invalidateQueries({ queryKey: ["people"] }); qc.invalidateQueries({ queryKey: ["person", personId] }); qc.invalidateQueries({ queryKey: ["entry-tags"] }); };

  const save = useMutation({ mutationFn: () => updatePerson(personId, { name, relationship: rel, notes }), onSuccess: () => { done(); toast.success("Saved."); }, onError: () => toast.error("Couldn't save. Please try again.") });
  const merge = useMutation({ mutationFn: (t: string) => mergePeople(personId, t), onSuccess: (_d, t) => { done(); toast.success("Merged."); navigate({ to: "/people/$personId", params: { personId: t } }); }, onError: () => toast.error("Couldn't merge. Nothing was changed.") });
  const del = useMutation({ mutationFn: () => deletePerson(personId), onSuccess: () => { done(); navigate({ to: "/people" }); toast.success("Removed. Entries are untouched."); }, onError: () => toast.error("Couldn't delete. Please try again.") });

  if (q.isLoading) return <AppShell><Loading /></AppShell>;
  if (q.isError) return <AppShell><div className="p-5"><LoadError onRetry={() => q.refetch()} /></div></AppShell>;
  if (!q.data) return <AppShell><div className="p-5"><Empty title="This person wasn't found."><Link to="/people" className="underline">All people</Link></Empty></div></AppShell>;
  const { person, entries, topics } = q.data;

  return (
    <AppShell>
      <PageHeader title={person.name} subtitle={person.relationship ?? `${entries.length} ${entries.length === 1 ? "mention" : "mentions"}`} />
      <div className="max-w-2xl space-y-6 px-5 sm:px-10">
        <Link to="/people" className="text-sm text-muted-foreground underline underline-offset-2">← All people</Link>

        {topics.length > 0 && (
          <div>
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Common topics</h2>
            <p className="mt-1 text-sm">{topics.join(" · ")}</p>
          </div>
        )}

        <section className="space-y-2">
          <h2 className="font-serif text-lg">Recent mentions</h2>
          {entries.length === 0 ? <p className="text-sm text-muted-foreground">No linked entries.</p> : (
            <ul className="space-y-2">
              {entries.map((e) => (
                <li key={e.id}>
                  <Link to="/entries/$entryId" params={{ entryId: e.id }} className="block rounded-xl border border-border bg-card p-3 hover:bg-secondary">
                    <span className="block text-xs text-muted-foreground">{shortDate(e.completed_at)}</span>{e.title}
                    {e.summary && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{e.summary}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form className="space-y-3 rounded-2xl border border-border bg-card p-5" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate(); }}>
          <div className="space-y-1.5"><Label htmlFor="pn">Name</Label><Input id="pn" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></div>
          <div className="space-y-1.5"><Label htmlFor="pr">Relationship (optional)</Label><Input id="pr" placeholder="Friend, manager, sister…" value={rel} onChange={(e) => setRel(e.target.value)} maxLength={60} /></div>
          <div className="space-y-1.5"><Label htmlFor="pno">Notes (optional)</Label><Textarea id="pno" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
          <Button type="submit" disabled={!name.trim() || save.isPending}>Save</Button>
        </form>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Only merge if these are definitely the same person.</p>
          <MergeSelect noun="person" options={(all.data ?? []).filter((p) => p.id !== personId)} onMerge={(id) => merge.mutate(id)} disabled={merge.isPending} />
          <ConfirmButton label="Delete person" title={`Delete ${person.name}?`} description="This person and their links are removed. Your journal entries are not deleted." confirm="Delete" onConfirm={() => del.mutate()} />
        </section>
      </div>
    </AppShell>
  );
}
