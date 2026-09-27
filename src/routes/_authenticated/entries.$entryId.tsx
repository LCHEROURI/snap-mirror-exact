import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteEntry, fetchEntry, fetchMessages, formatDate, renameEntry } from "@/lib/journal";
import { MessageBubble } from "@/components/message-bubble";
import { EntryAnalysis } from "@/components/entry-analysis";
import { EntryTracking } from "@/components/entry-tracking";
import type { JournalAnalysis } from "@/lib/ai/analysis";

export const Route = createFileRoute("/_authenticated/entries/$entryId")({
  head: () => ({
    meta: [
      { title: "Journal entry — Reflective" },
      { name: "description", content: "Revisit a saved reflection and its full transcript." },
      { property: "og:title", content: "Journal entry — Reflective" },
      { property: "og:description", content: "A saved reflection and its transcript." },
    ],
  }),
  component: EntryDetail,
});

function EntryDetail() {
  const { entryId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const entry = useQuery({ queryKey: ["entry", entryId], queryFn: () => fetchEntry(entryId) });
  const sessionId = entry.data?.session_id;
  const transcript = useQuery({
    queryKey: ["messages", sessionId],
    queryFn: () => fetchMessages(sessionId!),
    enabled: !!sessionId,
  });

  async function saveTitle() {
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      await renameEntry(entryId, t.slice(0, 120));
      await qc.invalidateQueries({ queryKey: ["entry", entryId] });
      qc.invalidateQueries({ queryKey: ["entries"] });
      setEditing(false);
    } catch {
      toast.error("Couldn't rename. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteEntry(entryId);
      qc.invalidateQueries();
      toast.success("Entry deleted");
      navigate({ to: "/history" });
    } catch {
      toast.error("Couldn't delete. Try again.");
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-5 pt-6 sm:px-10 sm:pt-10">
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link to="/history"><ArrowLeft className="size-4" /> History</Link>
        </Button>

        {entry.isLoading ? (
          <div className="py-20 text-center text-muted-foreground"><Loader2 className="mx-auto size-5 animate-spin" /></div>
        ) : entry.isError ? (
          <div className="py-20 text-center">
            <p className="font-serif text-xl">Couldn't load this entry.</p>
            <Button className="mt-4" variant="outline" onClick={() => entry.refetch()}>Try again</Button>
          </div>
        ) : !entry.data ? (
          <div className="py-20 text-center">
            <p className="font-serif text-xl">This entry doesn't exist.</p>
            <Button className="mt-4" asChild><Link to="/history">Back to history</Link></Button>
          </div>
        ) : (
          <>
            <header className="mt-4">
              {editing ? (
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); saveTitle(); }}>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus aria-label="Entry title" maxLength={120} />
                  <Button type="submit" disabled={busy || !title.trim()}>Save</Button>
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </form>
              ) : (
                <div className="flex items-start gap-2">
                  <h1 className="flex-1 font-serif text-3xl leading-tight tracking-tight">{entry.data.title}</h1>
                  <Button variant="ghost" size="icon" aria-label="Edit title" onClick={() => { setTitle(entry.data!.title); setEditing(true); }}>
                    <Pencil className="size-4" />
                  </Button>
                </div>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                {formatDate(entry.data.started_at, true)} · {entry.data.session_type === "voice" ? "Voice" : "Written"} · {entry.data.word_count} words
              </p>
            </header>

            <EntryAnalysis
              entryId={entryId}
              status={entry.data.analysis_status}
              error={entry.data.analysis_error}
              summary={entry.data.summary}
              narrative={entry.data.narrative}
              analysis={entry.data.analysis as unknown as JournalAnalysis | null}
              onUpdated={() => { entry.refetch(); qc.invalidateQueries({ queryKey: ["entries"] }); }}
            />
            {entry.data.analysis_status === "complete" && (
              <EntryTracking
                entryId={entryId}
                analysis={entry.data.analysis as unknown as JournalAnalysis | null}
                dismissed={entry.data.dismissed_goal_candidates ?? []}
              />
            )}

            <section className="mt-10">
              <h2 className="font-serif text-lg">Transcript</h2>
              {transcript.isLoading ? (
                <Loader2 className="mt-4 size-5 animate-spin text-muted-foreground" />
              ) : transcript.isError ? (
                <Button className="mt-4" variant="outline" onClick={() => transcript.refetch()}>Retry loading transcript</Button>
              ) : (
                <ol className="mt-4 flex flex-col gap-4">
                  {(transcript.data ?? []).map((m) => <MessageBubble key={m.id} m={m} />)}
                </ol>
              )}
            </section>

            <div className="mt-12 border-t border-border pt-6">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive"><Trash2 className="size-4" /> Delete entry</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the entry and its transcript. Your other entries and goals are not affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction onClick={remove} disabled={busy}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
