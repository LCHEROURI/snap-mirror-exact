import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/confirm-button";
import { Empty, LoadError, Loading, meta, shortDate } from "@/components/page-states";
import {
  addCheckin,
  deleteGoal,
  fetchGoal,
  GOAL_STATUSES,
  updateGoal,
  type GoalStatus,
  type NextAction,
} from "@/lib/tracking";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/goals/$goalId")({
  head: () => meta("Goal", "A goal with its check-ins, next actions and journal mentions."),
  component: GoalDetail,
});

function GoalDetail() {
  const { goalId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["goal", goalId], queryFn: () => fetchGoal(goalId) });
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [action, setAction] = useState("");
  useEffect(() => {
    if (q.data) {
      setTitle(q.data.goal.title);
      setDesc(q.data.goal.description ?? "");
      setDate(q.data.goal.target_date ?? "");
    }
  }, [q.data]);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["goal", goalId] });
    qc.invalidateQueries({ queryKey: ["goals"] });
  };
  const fail = () => toast.error("Couldn't save. Please try again.");

  const save = useMutation({
    mutationFn: () =>
      updateGoal(goalId, { title: title.trim(), description: desc, target_date: date || null }),
    onSuccess: () => {
      refresh();
      toast.success("Saved.");
    },
    onError: fail,
  });
  const setStatus = useMutation({
    mutationFn: (s: GoalStatus) => updateGoal(goalId, { status: s }),
    onSuccess: refresh,
    onError: fail,
  });
  const actions = useMutation({
    mutationFn: (a: NextAction[]) => updateGoal(goalId, { next_actions: a }),
    onSuccess: refresh,
    onError: fail,
  });
  const checkin = useMutation({
    mutationFn: () => addCheckin(goalId, note),
    onSuccess: () => {
      setNote("");
      refresh();
      toast.success("Check-in added.");
    },
    onError: fail,
  });
  const del = useMutation({
    mutationFn: () => deleteGoal(goalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      navigate({ to: "/goals" });
      toast.success("Goal deleted.");
    },
    onError: fail,
  });

  if (q.isLoading)
    return (
      <AppShell>
        <Loading />
      </AppShell>
    );
  if (q.isError)
    return (
      <AppShell>
        <div className="p-5">
          <LoadError onRetry={() => q.refetch()} />
        </div>
      </AppShell>
    );
  if (!q.data)
    return (
      <AppShell>
        <div className="p-5">
          <Empty title="This goal wasn't found.">
            <Link to="/goals" className="underline">
              Back to goals
            </Link>
          </Empty>
        </div>
      </AppShell>
    );
  const { goal, checkins, source, mentions } = q.data;
  const next = goal.next_actions;

  return (
    <AppShell>
      <PageHeader title={goal.title} subtitle={`Started ${shortDate(goal.created_at)}`} />
      <div className="max-w-2xl space-y-6 px-5 sm:px-10">
        <Link to="/goals" className="text-sm text-muted-foreground underline underline-offset-2">
          ← All goals
        </Link>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Goal status">
          {GOAL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus.mutate(s)}
              aria-pressed={goal.status === s}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs capitalize",
                goal.status === s
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border hover:bg-secondary",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <form
          className="space-y-3 rounded-2xl border border-border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="t">Title</Label>
            <Input
              id="t"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d">Description</Label>
            <Textarea id="d" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dt">Target date</Label>
            <Input id="dt" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button type="submit" disabled={save.isPending || !title.trim()}>
            Save changes
          </Button>
        </form>

        <section
          className="space-y-3 rounded-2xl border border-border bg-card p-5"
          aria-labelledby="na"
        >
          <h2 id="na" className="font-serif text-lg">
            Next actions
          </h2>
          {next.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No next actions yet — add one small step.
            </p>
          )}
          <ul className="space-y-2">
            {next.map((a, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <Checkbox
                  id={`a${i}`}
                  checked={a.done}
                  onCheckedChange={(c) =>
                    actions.mutate(next.map((x, j) => (j === i ? { ...x, done: !!c } : x)))
                  }
                />
                <label
                  htmlFor={`a${i}`}
                  className={cn("flex-1", a.done && "text-muted-foreground line-through")}
                >
                  {a.text}
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${a.text}`}
                  onClick={() => actions.mutate(next.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (action.trim()) {
                actions.mutate([...next, { text: action.trim().slice(0, 200), done: false }]);
                setAction("");
              }
            }}
          >
            <Input
              aria-label="New next action"
              placeholder="A small next step…"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!action.trim()}>
              Add
            </Button>
          </form>
        </section>

        <section
          className="space-y-3 rounded-2xl border border-border bg-card p-5"
          aria-labelledby="ci"
        >
          <h2 id="ci" className="font-serif text-lg">
            Check-ins
          </h2>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (note.trim()) checkin.mutate();
            }}
          >
            <Textarea
              aria-label="New check-in"
              rows={2}
              placeholder="Worked on this for 30 minutes today…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
            <Button type="submit" size="sm" disabled={!note.trim() || checkin.isPending}>
              Add check-in
            </Button>
          </form>
          {checkins.length === 0 ? (
            <p className="text-sm text-muted-foreground">No check-ins yet.</p>
          ) : (
            <ol className="space-y-2">
              {checkins.map((c) => (
                <li key={c.id} className="border-l-2 border-border pl-3 text-sm">
                  <span className="block text-xs text-muted-foreground">
                    {shortDate(c.created_at)}
                  </span>
                  {c.note}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="space-y-2" aria-labelledby="jm">
          <h2 id="jm" className="font-serif text-lg">
            From your journal
          </h2>
          {source ? (
            <p className="text-sm">
              Came from{" "}
              <Link to="/entries/$entryId" params={{ entryId: source.id }} className="underline">
                {source.title}
              </Link>{" "}
              ({shortDate(source.completed_at)})
            </p>
          ) : goal.created_from_entry_id === null ? null : (
            <p className="text-sm text-muted-foreground">The source entry has been deleted.</p>
          )}
          {mentions.filter((m) => m.id !== source?.id).length > 0 ? (
            <ul className="space-y-1 text-sm">
              {mentions
                .filter((m) => m.id !== source?.id)
                .map((m) => (
                  <li key={m.id}>
                    <Link to="/entries/$entryId" params={{ entryId: m.id }} className="underline">
                      {m.title}
                    </Link>{" "}
                    · {shortDate(m.completed_at)}
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No other journal mentions yet.</p>
          )}
        </section>

        <ConfirmButton
          label="Delete goal"
          title="Delete this goal?"
          description="The goal and its check-ins will be removed. Your journal entries stay as they are."
          confirm="Delete"
          onConfirm={() => del.mutate()}
        />
      </div>
    </AppShell>
  );
}
