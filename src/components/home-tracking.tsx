import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoodPicker } from "@/components/mood-picker";
import { fetchGoals, fetchMoods, fetchTopics } from "@/lib/tracking";

/** Small, quiet Home cards: current goal, recent topic, optional mood check-in. */
export function HomeTracking() {
  const qc = useQueryClient();
  const goals = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });
  const topics = useQuery({ queryKey: ["topics"], queryFn: fetchTopics });
  const moods = useQuery({ queryKey: ["moods"], queryFn: fetchMoods });
  const goal = goals.data?.find((g) => g.status === "active");
  const topic = [...(topics.data ?? [])].filter((t) => t.last).sort((a, b) => (b.last ?? "").localeCompare(a.last ?? ""))[0];
  const today = new Date().toDateString();
  const loggedToday = moods.data?.some((m) => new Date(m.recorded_at).toDateString() === today);

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <Link to={goal ? "/goals/$goalId" : "/goals"} params={goal ? { goalId: goal.id } : {}} className="rounded-2xl border border-border bg-card p-4 hover:bg-secondary">
        <span className="block text-xs uppercase tracking-wide text-muted-foreground">Current goal</span>
        <span className="mt-1 block text-sm">{goal ? goal.title : "No active goals yet."}</span>
      </Link>
      <Link to={topic ? "/topics/$topicId" : "/topics"} params={topic ? { topicId: topic.id } : {}} className="rounded-2xl border border-border bg-card p-4 hover:bg-secondary">
        <span className="block text-xs uppercase tracking-wide text-muted-foreground">Recent topic</span>
        <span className="mt-1 block text-sm">{topic ? topic.name : "Topics will appear as your journal grows."}</span>
      </Link>
      {moods.data && !loggedToday && (
        <div className="sm:col-span-2"><MoodPicker compact onSaved={() => qc.invalidateQueries({ queryKey: ["moods"] })} /></div>
      )}
    </div>
  );
}
