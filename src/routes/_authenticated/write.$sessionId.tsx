import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, Mic, Pause, Play, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  addUserMessage,
  displayContent,
  fetchMessages,
  fetchSession,
  finishSession,
  isPlaceholder,
  setSessionStatus,
  type JournalMessage,
} from "@/lib/journal";
import { requestCompanionReply } from "@/lib/companion.functions";

export const Route = createFileRoute("/_authenticated/write/$sessionId")({
  head: () => ({
    meta: [
      { title: "Writing — Reflective" },
      { name: "description", content: "A private conversation with your reflection companion." },
      { property: "og:title", content: "Writing — Reflective" },
      { property: "og:description", content: "A private journal conversation." },
    ],
  }),
  component: WriteSession,
});

function WriteSession() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const reply = useServerFn(requestCompanionReply);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const session = useQuery({ queryKey: ["session", sessionId], queryFn: () => fetchSession(sessionId) });
  const messages = useQuery({ queryKey: ["messages", sessionId], queryFn: () => fetchMessages(sessionId) });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.data?.length, sending]);

  const paused = session.data?.status === "paused";
  const completed = session.data?.status === "completed";

  const append = (m: JournalMessage) =>
    qc.setQueryData<JournalMessage[]>(["messages", sessionId], (old) => [...(old ?? []), m]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const saved = await addUserMessage(sessionId, text);
      append(saved);
      setDraft("");
      const res = await reply({ data: { sessionId } });
      append(res.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function togglePause() {
    try {
      await setSessionStatus(sessionId, paused ? "active" : "paused");
      await qc.invalidateQueries({ queryKey: ["session", sessionId] });
    } catch {
      toast.error("Couldn't update. Try again.");
    }
  }

  async function finish() {
    setFinishing(true);
    try {
      const entryId = await finishSession(sessionId);
      qc.invalidateQueries();
      navigate({ to: "/entries/$entryId", params: { entryId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't finish. Try again.");
      setFinishing(false);
    }
  }

  if (session.isLoading || messages.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-label="Loading" />
      </div>
    );
  }
  if (session.isError || messages.isError || !session.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="font-serif text-xl">We couldn't open this reflection.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { session.refetch(); messages.refetch(); }}>Try again</Button>
          <Button asChild><Link to="/journal">Back to journal</Link></Button>
        </div>
      </div>
    );
  }

  const list = messages.data ?? [];
  const hasUser = list.some((m) => m.role === "user");

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border px-3 py-3 sm:px-6">
        <Button variant="ghost" size="icon" asChild aria-label="Back to journal">
          <Link to="/journal"><ArrowLeft className="size-5" /></Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg leading-tight">Reflection</p>
          <p className="text-xs text-muted-foreground">{paused ? "Paused — your words are saved" : "Saved as you write"}</p>
        </div>
        {!completed && (
          <>
            <Button variant="ghost" size="sm" onClick={togglePause} aria-label={paused ? "Resume" : "Pause"}>
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              <span className="hidden sm:inline">{paused ? "Resume" : "Pause"}</span>
            </Button>
            <Button size="sm" onClick={finish} disabled={!hasUser || finishing || sending}>
              {finishing ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Finish
            </Button>
          </>
        )}
      </header>

      <div className="mx-auto w-full max-w-2xl border-b border-dashed border-border px-5 py-2 text-center text-[0.7rem] text-muted-foreground">
        Development preview: companion replies are fixed placeholder text, not AI.
      </div>

      <div className="flex-1 overflow-y-auto">
        <ol className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 sm:px-6" aria-live="polite">
          {list.length === 0 && (
            <li className="py-16 text-center">
              <p className="font-serif text-2xl">What's on your mind?</p>
              <p className="mt-2 text-sm text-muted-foreground">Start anywhere. A sentence is enough.</p>
            </li>
          )}
          {list.map((m) => (
            <MessageBubble key={m.id} m={m} />
          ))}
          {sending && (
            <li className="text-sm text-muted-foreground"><Loader2 className="inline size-4 animate-spin" /> …</li>
          )}
          <div ref={bottomRef} />
        </ol>
      </div>

      {completed ? (
        <div className="border-t border-border p-4 text-center text-sm text-muted-foreground">
          This reflection is finished.
        </div>
      ) : (
        <form
          className="border-t border-border bg-card/80 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
          onSubmit={(e) => { e.preventDefault(); send(); }}
        >
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <Button type="button" variant="ghost" size="icon" disabled aria-label="Voice input arrives in a later phase" title="Voice arrives later">
              <Mic className="size-5" />
            </Button>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={paused ? "Paused — resume to keep writing" : "Write what's on your mind…"}
              disabled={paused || sending}
              rows={1}
              className="max-h-40 min-h-11 resize-none bg-background"
              aria-label="Your message"
            />
            <Button type="submit" size="icon" disabled={!draft.trim() || paused || sending} aria-label="Send">
              <Send className="size-4" />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function MessageBubble({ m }: { m: JournalMessage }) {
  const mine = m.role === "user";
  return (
    <li className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed",
          mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-card",
        )}
      >
        {displayContent(m.content)}
      </div>
      {!mine && isPlaceholder(m.content) && (
        <span className="mt-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">Placeholder · not AI</span>
      )}
    </li>
  );
}
