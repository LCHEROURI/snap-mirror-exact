import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { updateMemory } from "@/lib/memory.functions";

type Sort = "date" | "importance" | "type";
const KEY = ["memories"];

async function fetchMemories() {
  const { data, error } = await supabase
    .from("memories")
    .select(
      "id, content, memory_type, importance_score, created_at, journal_entry_id, embedding_status, superseded_by",
    )
    .is("superseded_by", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data;
}

export function MemoryManager({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const [sort, setSort] = useState<Sort>("date");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const q = useQuery({ queryKey: KEY, queryFn: fetchMemories });
  const updateFn = useServerFn(updateMemory);

  const rows = useMemo(() => {
    const list = [...(q.data ?? [])];
    if (sort === "importance")
      list.sort((a, b) => Number(b.importance_score) - Number(a.importance_score));
    if (sort === "type") list.sort((a, b) => a.memory_type.localeCompare(b.memory_type));
    return list;
  }, [q.data, sort]);

  const save = useMutation({
    mutationFn: async (v: { id: string; content: string }) => {
      const r = await updateFn({ data: v });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Memory updated.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update."),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("memories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Memory deleted. Your entries are untouched.");
    },
    onError: () => toast.error("Couldn't delete. Please try again."),
  });
  const delAll = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("auth");
      const { error } = await supabase.from("memories").delete().eq("user_id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("All memories deleted. Your entries are untouched.");
    },
    onError: () => toast.error("Couldn't delete memories. Please try again."),
  });

  return (
    <section
      className="space-y-4 rounded-2xl border border-border bg-card p-5"
      aria-labelledby="memory-h"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="memory-h" className="font-serif text-lg tracking-tight">
          Memory
        </h2>
        <span className="text-xs text-muted-foreground">
          {enabled ? "On — remembering and recalling" : "Off — nothing new is saved or recalled"}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Short notes Reflective keeps from your finished reflections. Deleting a memory never deletes
        a journal entry.
      </p>

      <div className="flex gap-2" role="group" aria-label="Sort memories">
        {(["date", "importance", "type"] as Sort[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            aria-pressed={sort === s}
            className={
              "rounded-lg border px-3 py-1.5 text-xs capitalize " +
              (sort === s
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border hover:bg-secondary")
            }
          >
            {s}
          </button>
        ))}
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading memories…</p>}
      {q.isError && (
        <div className="text-sm">
          Couldn't load memories.{" "}
          <Button variant="link" className="px-1" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {q.data && !rows.length && (
        <p className="text-sm text-muted-foreground">
          No memories yet. They appear after you finish a reflection.
        </p>
      )}

      <ul className="space-y-3">
        {rows.map((m) => (
          <li key={m.id} className="rounded-xl border border-border p-3">
            <div className="mb-1 flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>{m.memory_type}</span>
              <span>· {new Date(m.created_at).toLocaleDateString()}</span>
              {m.journal_entry_id && (
                <Link
                  to="/entries/$entryId"
                  params={{ entryId: m.journal_entry_id }}
                  className="underline underline-offset-2"
                >
                  · source entry
                </Link>
              )}
              {m.embedding_status !== "ready" && <span>· not searchable yet</span>}
            </div>
            {editing === m.id ? (
              <div className="space-y-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="Edit memory"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={save.isPending || draft.trim().length < 3}
                    onClick={() => save.mutate({ id: m.id, content: draft })}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm leading-relaxed">{m.content}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(m.id);
                      setDraft(m.content);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={del.isPending}
                    onClick={() => del.mutate(m.id)}
                  >
                    Delete
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {!!rows.length && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full">
              Delete all memories
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all memories?</AlertDialogTitle>
              <AlertDialogDescription>
                Every saved memory will be permanently removed. Your journal entries stay exactly as
                they are.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep them</AlertDialogCancel>
              <AlertDialogAction onClick={() => delAll.mutate()}>Delete all</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </section>
  );
}
