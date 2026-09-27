import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LoadError, Loading, meta } from "@/components/page-states";
import { ChoiceGroup, Section, useSaveProfile } from "@/components/settings-ui";
import { profileQueryOptions } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/settings/reflection")({
  head: () => meta("Reflection preferences", "Choose how you like to reflect and how your companion responds."),
  component: ReflectionSettings,
});

const INTERACTION = [
  { value: "voice", label: "Voice" },
  { value: "writing", label: "Writing" },
  { value: "both", label: "Both" },
] as const;
const STYLE = [
  { value: "gentle", label: "Gentle", hint: "Soft, patient" },
  { value: "curious", label: "Curious", hint: "Open questions" },
  { value: "direct", label: "Direct", hint: "Plain, to the point" },
  { value: "practical", label: "Practical", hint: "Next steps" },
] as const;

function ReflectionSettings() {
  const q = useQuery(profileQueryOptions);
  const save = useSaveProfile("Preference saved. It applies to your next replies.");
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <LoadError onRetry={() => q.refetch()} />;
  return (
    <Section title="Reflection preferences" description="Changes apply to future replies. Past entries stay exactly as they are.">
      <ChoiceGroup
        label="I prefer to reflect by"
        value={(q.data.preferred_interaction ?? "both") as "voice" | "writing" | "both"}
        options={[...INTERACTION]}
        onChange={(v) => save.mutate({ preferred_interaction: v })}
      />
      <ChoiceGroup
        label="Reflection style"
        value={(q.data.reflection_style ?? "curious") as "gentle" | "curious" | "direct" | "practical"}
        options={[...STYLE]}
        onChange={(v) => save.mutate({ reflection_style: v })}
      />
    </Section>
  );
}
