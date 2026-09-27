import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, Mic, Pause, Play, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageBubble } from "@/components/message-bubble";
import { fetchMessages, fetchSession, setSessionStatus, type JournalMessage } from "@/lib/journal";
import { finishJournalSession, retryJournalReply, sendJournalMessage } from "@/lib/companion.functions";

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
  const sendFn = useServerFn(sendJournalMessage);
  const retryFn = useServerFn(retryJournalReply);
  const finishFn = useServerFn(finishJournalSession);
  const busyRef = useRef(false);
  const [replyError, setReplyError] = useState<string | null>(null);
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
    if (!text || busyRef.current) return; // duplicate-send guard
    busyRef.current = true;
    setSending(true);
    setReplyError(null);
    try {
      const res = await sendFn({ data: { sessionId, message: text } });
      if (res.ok) {
        append(res.userMessage);
        append(res.assistantMessage);
        setDraft("");
      } else {
        if (res.code === "ai") setDraft("");
        setReplyError(res.error);
        await messages.refetch();
      }
    } catch {
      setReplyError("Connection problem. Check your internet and try again.");
    } finally {
      busyRef.current = false;
      setSending(false);
    }
  }

  async function retry() {
    if (busyRef.current) return;
    busyRef.current = true;
    setSending(true);
    setReplyError(null);
    try {
      const res = await retryFn({ data: { sessionId } });
      if (res.ok) append(res.assistantMessage);
      else setReplyError(res.error);
    } catch {
      setReplyError("Connection problem. Check your internet and try again.");
    } finally {
      busyRef.current = false;
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
    if (busyRef.current) return;
    busyRef.current = true;
    setFinishing(true);
    try {
      const res = await finishFn({ data: { sessionId } });
      if (!res.ok) throw new Error(res.error);
      qc.invalidateQueries();
      if (!res.analysisOk) toast.message("Entry saved. The reflection summary couldn't be created — you can retry on the entry page.");
      navigate({ to: "/entries/$entryId", params: { entryId: res.entryId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't finish. Try again.");
      busyRef.current = false;
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
            <li className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <span className="inline-flex gap-1" aria-hidden>
                <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
                <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
              </span>
              <span className="sr-only">Companion is thinking</span>
            </li>
          )}
          {finishing && (
            <li className="text-center text-sm text-muted-foreground" role="status">
              <Loader2 className="mr-2 inline size-4 animate-spin" />Saving and reflecting on your entry…
            </li>
          )}
          {replyError && !sending && (
            <li className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
              <p>{replyError}</p>
              {list[list.length - 1]?.role === "user" && (
                <Button size="sm" variant="outline" className="mt-2" onClick={retry}>Ask again</Button>
              )}
            </li>
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
              disabled={paused || sending || finishing}
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
