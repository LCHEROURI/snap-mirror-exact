import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { LoadError, Loading, meta } from "@/components/page-states";
import { ChoiceGroup, Section, useSaveProfile } from "@/components/settings-ui";
import { profileQueryOptions } from "@/lib/profile";
import { Row } from "./settings.voice";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  head: () => meta("Notification preferences", "Choose which reminders you'd like."),
  component: NotificationSettings,
});

function NotificationSettings() {
  const q = useQuery(profileQueryOptions);
  const save = useSaveProfile();
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <LoadError onRetry={() => q.refetch()} />;
  const p = q.data;
  return (
    <Section title="Notifications" description="Reflective doesn't send notifications yet. These choices are saved so they apply once reminders are available.">
      <Row id="weekly" label="Weekly reflection ready" hint="Let me know when a new weekly reflection can be generated.">
        <Switch id="weekly" checked={p.weekly_report_enabled} onCheckedChange={(v) => save.mutate({ weekly_report_enabled: v })} />
      </Row>
      <Row id="remind" label="Reflection reminders" hint="A gentle nudge to reflect.">
        <Switch id="remind" checked={p.reflection_reminders_enabled} onCheckedChange={(v) => save.mutate({ reflection_reminders_enabled: v })} />
      </Row>
      <div className={p.reflection_reminders_enabled ? "" : "pointer-events-none opacity-50"} aria-disabled={!p.reflection_reminders_enabled}>
        <ChoiceGroup
          label="Reminder time"
          value={(p.reminder_preference === "morning" ? "morning" : "evening") as "morning" | "evening"}
          options={[{ value: "morning", label: "Morning" }, { value: "evening", label: "Evening" }]}
          onChange={(v) => save.mutate({ reminder_preference: v })}
        />
      </div>
    </Section>
  );
}
