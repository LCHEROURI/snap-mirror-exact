import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Empty, LoadError, Loading, meta, shortDate } from "@/components/page-states";
import { createGoal, fetchGoals, GOAL_STATUSES, updateGoal, type GoalStatus } from "@/lib/tracking";

export const Route = createFileRoute("/_authenticated/goals/")({
  head: () => meta("Goals", "The things you're working toward, with small next steps and check-ins."),
  component: GoalsPage,
});

const LABEL: Record<GoalStatus, string> = { active: "Active", paused: "Paused", completed: "Completed", archived: "Archived" };

function GoalsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");
  const create = useMutation({
    mutationFn: () => createGoal({ title, description: desc, target_date: date || null }),
    onSuccess: () => { setTitle(""); setDesc(""); setDate(""); setOpen(false); qc.invalidateQueries({ queryKey: ["goals"] }); toast.success("Goal added."); },
    onError: () => toast.error("Couldn't save the goal. Please try again."),
  });
  const status = useMutation({
    mutationFn: (v: { id: string; status: GoalStatus }) => updateGoal(v.id, { status: v.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
    onError: () => toast.error("Couldn't update the goal. Please try again."),
  });

  return (
    <AppShell>
      <PageHeader title="Goals" subtitle="What you're working toward — at your own pace." />
      <div className="max-w-2xl space-y-8 px-5 sm:px-10">
        {open ? (
          <form className="space-y-3 rounded-2xl border border-border bg-card p-5" onSubmit={(e) => { e.preventDefault(); if (title.trim()) create.mutate(); }}>
            <div className="space-y-1.5"><Label htmlFor="g-title">Goal</Label><Input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus /></div>
            <div className="space-y-1.5"><Label htmlFor="g-desc">Description (optional)</Label><Textarea id="g-desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="g-date">Target date (optional)</Label><Input id="g-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="flex gap-2"><Button type="submit" disabled={!title.trim() || create.isPending}>Add goal</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
          </form>
        ) : (
          <Button onClick={() => setOpen(true)}>New goal</Button>
        )}

        {q.isLoading ? <Loading /> : q.isError ? <LoadError onRetry={() => q.refetch()} /> : (
          <>
            {!q.data!.some((g) => g.status === "active") && (
              <Empty title="No active goals yet.">When something you want to work toward appears in a reflection, you can turn it into a goal — or add one above.</Empty>
            )}
            {GOAL_STATUSES.map((s) => {
              const list = q.data!.filter((g) => g.status === s);
              if (!list.length) return null;
              return (
                <section key={s} aria-labelledby={`h-${s}`}>
                  <h2 id={`h-${s}`} className="mb-3 font-serif text-lg">{LABEL[s]}</h2>
                  <ul className="space-y-3">
                    {list.map((g) => (
                      <li key={g.id} className="rounded-2xl border border-border bg-card p-4">
                        <Link to="/goals/$goalId" params={{ goalId: g.id }} className="block font-medium hover:underline">{g.title}</Link>
                        {g.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{g.description}</p>}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {LABEL[g.status as GoalStatus]}{g.target_date && ` · by ${shortDate(g.target_date)}`}
                          {g.lastCheckin && ` · last check-in ${shortDate(g.lastCheckin.created_at)}`}
                          {g.created_from_entry_id && <> · <Link to="/entries/$entryId" params={{ entryId: g.created_from_entry_id }} className="underline">from an entry</Link></>}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1">
                          <Button size="sm" variant="ghost" asChild><Link to="/goals/$goalId" params={{ goalId: g.id }}>Open</Link></Button>
                          {g.status === "active" && <Button size="sm" variant="ghost" onClick={() => status.mutate({ id: g.id, status: "paused" })}>Pause</Button>}
                          {g.status !== "active" && g.status !== "completed" && <Button size="sm" variant="ghost" onClick={() => status.mutate({ id: g.id, status: "active" })}>Resume</Button>}
                          {g.status !== "completed" && <Button size="sm" variant="ghost" onClick={() => status.mutate({ id: g.id, status: "completed" })}>Complete</Button>}
                          {g.status !== "archived" && <Button size="sm" variant="ghost" onClick={() => status.mutate({ id: g.id, status: "archived" })}>Archive</Button>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </div>
    </AppShell>
  );
}
