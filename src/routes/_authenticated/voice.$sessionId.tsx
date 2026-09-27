import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Mic, MicOff, Pause, PenLine, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadError, Loading, meta } from "@/components/page-states";
import { VoiceOrb } from "@/components/voice-orb";
import { fetchMessages, displayContent } from "@/lib/journal";
import { finishJournalSession } from "@/lib/companion.functions";
import { useVoiceSession } from "@/hooks/use-voice-session";
import type { TranscriptLine } from "@/lib/voice/types";
import { cn } from "@/lib/utils";
import { profileQueryOptions } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/voice/$sessionId")({
  head: () => meta("Voice reflection", "Speak with your reflection companion."),
  component: VoicePage,
});

function VoicePage() {
  const { sessionId } = Route.useParams();
  const q = useQuery({ queryKey: ["messages", sessionId], queryFn: () => fetchMessages(sessionId), staleTime: Infinity });
  const prof = useQuery(profileQueryOptions);
  if (q.isLoading || prof.isLoading) return <main className="min-h-screen bg-background p-10"><Loading /></main>;
  if (q.isError) return <main className="min-h-screen bg-background p-10"><LoadError onRetry={() => q.refetch()} /></main>;
  const initial: TranscriptLine[] = (q.data ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", text: displayContent(m.content), final: true }));
  return <VoiceScreen sessionId={sessionId} initial={initial} autoPlay={prof.data?.auto_play_responses ?? true} />;
}

function VoiceScreen({ sessionId, initial, autoPlay }: { sessionId: string; initial: TranscriptLine[]; autoPlay: boolean }) {
  const navigate = useNavigate();
  const finishFn = useServerFn(finishJournalSession);
  const v = useVoiceSession(sessionId, initial, autoPlay);
  const [begun, setBegun] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }), [v.lines.length]);

  const micLive = begun && !v.muted && ["ready", "listening", "thinking", "speaking"].includes(v.state);
  const hasUserSpeech = v.lines.some((l) => l.role === "user" && l.final && l.text);

  async function finish() {
    v.stop();
    if (!hasUserSpeech) { navigate({ to: "/journal" }); return; }
    setFinishing(true);
    setFinishError(null);
    try {
      const r = await finishFn({ data: { sessionId } });
      if (!r.ok) { setFinishError(r.error); setFinishing(false); return; }
      navigate({ to: "/entries/$entryId", params: { entryId: r.entryId } });
    } catch {
      setFinishError("Couldn't finish just now. Your transcript is saved — try again.");
      setFinishing(false);
    }
  }
  const toText = () => { v.stop(); navigate({ to: "/write/$sessionId", params: { sessionId } }); };

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between px-4 py-3">
        <Button variant="ghost" size="sm" asChild><Link to="/journal" onClick={() => v.stop()}><ArrowLeft className="size-4" /> Home</Link></Button>
        <span className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-xs", micLive ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
          <span className={cn("size-2 rounded-full", micLive ? "bg-primary" : "bg-muted-foreground")} aria-hidden />
          {micLive ? "Microphone on" : "Microphone off"}
        </span>
        {v.mode && <span className="text-xs text-muted-foreground">{v.mode === "realtime" ? "Live voice" : "Turn-by-turn voice"}</span>}
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-4">
        {!begun ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <VoiceOrb state="ready" muted={false} />
            <p className="max-w-xs text-sm text-muted-foreground">Your words are saved as a transcript. Audio isn't stored.</p>
            <Button size="lg" className="h-14 px-8 text-base" onClick={() => { setBegun(true); void v.start(); }}><Mic className="size-5" /> Begin speaking</Button>
          </div>
        ) : (
          <VoiceOrb state={v.state} muted={v.muted} />
        )}
        {v.notice && <p className="max-w-sm text-center text-sm text-muted-foreground">{v.notice}</p>}
        {v.error && (
          <div role="alert" className="max-w-sm rounded-2xl border border-border bg-card p-4 text-center text-sm">
            <p>{v.error.message}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {v.error.code !== "expired" && <Button size="sm" onClick={() => { v.clearError(); void v.start(); }}>Retry</Button>}
              {v.mode === "realtime" && <Button size="sm" variant="outline" onClick={() => { v.clearError(); void v.useTurnMode(); }}>Use turn-by-turn voice</Button>}
              <Button size="sm" variant="outline" onClick={toText}>Switch to text</Button>
              {hasUserSpeech && <Button size="sm" variant="ghost" onClick={finish}>Finish reflection</Button>}
            </div>
          </div>
        )}
      </section>

      <section aria-label="Transcript" className="mx-auto max-h-[32vh] w-full max-w-xl overflow-y-auto px-5">
        <ul className="space-y-2 text-sm">
          {v.lines.map((l) => (
            <li key={l.id} className={cn("max-w-[85%] rounded-2xl px-4 py-2", l.role === "user" ? "ml-auto bg-primary/10" : "bg-card border border-border", !l.final && "opacity-60")}>
              <span className="sr-only">{l.role === "user" ? "You" : "Companion"}: </span>{l.text}
            </li>
          ))}
        </ul>
        <div ref={endRef} />
      </section>

      {begun && (
        <nav aria-label="Voice controls" className="mx-auto grid w-full max-w-xl grid-cols-4 gap-2 px-4 py-4">
          <Button variant="outline" className="h-14 flex-col gap-0.5 text-xs" onClick={v.toggleMute} aria-pressed={v.muted}>
            {v.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}{v.muted ? "Unmute" : "Mute"}
          </Button>
          {v.state === "paused" ? (
            <Button variant="outline" className="h-14 flex-col gap-0.5 text-xs" onClick={v.resume}><Play className="size-5" />Resume</Button>
          ) : (
            <Button variant="outline" className="h-14 flex-col gap-0.5 text-xs" onClick={v.pause} disabled={v.state === "ended" || v.state === "error"}><Pause className="size-5" />Pause</Button>
          )}
          {v.mode === "turn" ? (
            <Button className="h-14 flex-col gap-0.5 text-xs" onClick={v.endTurn} disabled={v.state !== "listening" || v.muted}><Square className="size-5" />Done speaking</Button>
          ) : (
            <Button variant="outline" className="h-14 flex-col gap-0.5 text-xs" onClick={toText}><PenLine className="size-5" />Write</Button>
          )}
          <Button variant="secondary" className="h-14 flex-col gap-0.5 text-xs" onClick={finish} disabled={finishing}><Check className="size-5" />{finishing ? "Saving…" : "End"}</Button>
        </nav>
      )}
      {finishError && <p role="alert" className="pb-4 text-center text-sm text-destructive">{finishError}</p>}
    </main>
  );
}
