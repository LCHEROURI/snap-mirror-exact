import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LoadError, Loading, meta } from "@/components/page-states";
import { Section, useSaveProfile } from "@/components/settings-ui";
import { MemoryManager } from "@/components/memory-manager";
import { profileQueryOptions } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/settings/memory")({
  head: () =>
    meta("Memory settings", "Choose whether Reflective remembers, and manage saved memories."),
  component: MemorySettings,
});

function MemorySettings() {
  const q = useQuery(profileQueryOptions);
  const save = useSaveProfile();
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <LoadError onRetry={() => q.refetch()} />;
  return (
    <>
      <Section title="Memory" description="Deleting memories does not delete your journal.">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="memory">Let Reflective remember</Label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              When off, no new memories are saved and none are recalled in conversations. Existing
              memories stay until you delete them.
            </p>
          </div>
          <Switch
            id="memory"
            checked={q.data.ai_memory_enabled}
            onCheckedChange={(v) => save.mutate({ ai_memory_enabled: v })}
          />
        </div>
      </Section>
      <MemoryManager enabled={q.data.ai_memory_enabled} />
    </>
  );
}
