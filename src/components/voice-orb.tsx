import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceState } from "@/lib/voice/types";

export const STATE_LABEL: Record<VoiceState, string> = {
  connecting: "Connecting…",
  ready: "Ready — start speaking",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Speaking",
  paused: "Paused",
  reconnecting: "Reconnecting…",
  ended: "Ended",
  error: "Needs attention",
};

/** Central orb. State is always also shown as text, so nothing depends on animation. */
export function VoiceOrb({ state, muted }: { state: VoiceState; muted: boolean }) {
  const live = state === "listening" || state === "speaking";
  return (
    <div className="flex flex-col items-center gap-5">
      <div
        aria-hidden
        className={cn(
          "relative grid size-44 place-items-center rounded-full bg-primary/15 transition-transform duration-700 motion-reduce:transition-none sm:size-56",
          live && "scale-105",
          state === "thinking" && "animate-pulse motion-reduce:animate-none",
        )}
      >
        {live && (
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/10 motion-reduce:hidden" />
        )}
        <div
          className={cn(
            "grid size-28 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg sm:size-36",
            state === "paused" && "opacity-60",
          )}
        >
          {muted ? <MicOff className="size-10" /> : <Mic className="size-10" />}
        </div>
      </div>
      <p role="status" aria-live="polite" className="font-serif text-xl">
        {muted && state !== "ended" ? "Muted" : STATE_LABEL[state]}
      </p>
    </div>
  );
}
