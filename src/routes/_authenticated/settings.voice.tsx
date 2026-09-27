import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LoadError, Loading, meta } from "@/components/page-states";
import { ChoiceGroup, Section, useSaveProfile } from "@/components/settings-ui";
import { profileQueryOptions } from "@/lib/profile";
import { voiceSupported } from "@/lib/voice/types";

export const Route = createFileRoute("/_authenticated/settings/voice")({
  head: () => meta("Voice settings", "Turn voice reflections on or off and choose how replies sound."),
  component: VoiceSettings,
});

// Voices offered by the turn-by-turn speech service.
const VOICES = [
  { value: "Kore", label: "Kore", hint: "Calm, even" },
  { value: "Aoede", label: "Aoede", hint: "Light, warm" },
  { value: "Leda", label: "Leda", hint: "Soft, youthful" },
  { value: "Charon", label: "Charon", hint: "Low, steady" },
  { value: "Orus", label: "Orus", hint: "Firm, clear" },
  { value: "Puck", label: "Puck", hint: "Bright, upbeat" },
] as const;

function VoiceSettings() {
  const q = useQuery(profileQueryOptions);
  const save = useSaveProfile();
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => setSupported(voiceSupported()), []);
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <LoadError onRetry={() => q.refetch()} />;
  const p = q.data;

  return (
    <Section title="Voice" description="Voice reflections are transcribed into your journal. Audio recordings are never stored.">
      {supported === false ? (
        <p role="status" className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          This browser can't record audio, so voice reflections aren't available here. Try a recent Chrome, Safari or Edge. Your preferences below are still saved to your account.
        </p>
      ) : null}
      <Row id="voice-on" label="Voice reflections" hint="When off, the Voice screen won't start a session.">
        <Switch id="voice-on" checked={p.voice_enabled} onCheckedChange={(v) => save.mutate({ voice_enabled: v })} />
      </Row>
      <Row id="autoplay" label="Play replies aloud" hint="Turn-by-turn voice only. When off, replies appear as text and you keep talking.">
        <Switch id="autoplay" checked={p.auto_play_responses} disabled={!p.voice_enabled} onCheckedChange={(v) => save.mutate({ auto_play_responses: v })} />
      </Row>
      <div className={p.voice_enabled ? "" : "pointer-events-none opacity-50"} aria-disabled={!p.voice_enabled}>
        <ChoiceGroup
          label="Reply voice (turn-by-turn)"
          value={(p.voice_name ?? "Kore") as (typeof VOICES)[number]["value"]}
          options={[...VOICES]}
          onChange={(v) => save.mutate({ voice_name: v })}
        />
      </div>
    </Section>
  );
}

export function Row({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
