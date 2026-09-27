import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askMyJournal } from "@/lib/ask.functions";

export const Route = createFileRoute("/_authenticated/ask")({
  head: () => ({
    meta: [
      { title: "Ask My Journal — Reflective" },
      { name: "description", content: "Ask questions across your own journal history." },
      { property: "og:title", content: "Ask My Journal — Reflective" },
      { property: "og:description", content: "Answers grounded only in your own journal entries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AskPage,
});

const CHIPS = [
  "What has been on my mind lately?",
  "What themes keep repeating?",
  "What have I said about work?",
  "What goals have I mentioned?",
  "What decisions am I still thinking about?",
];

const CONF: Record<string, string> = { high: "Well supported", medium: "Partly supported", low: "Limited evidence" };

function AskPage() {
  const ask = useServerFn(askMyJournal);
  const [question, setQuestion] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const m = useMutation({
    mutationFn: async (q: string) => {
      try {
        return await ask({ data: { question: q } });
      } catch (e) {
        return {
          ok: false as const,
          code: "network",
          error: e instanceof Error && /unauthori[sz]ed/i.test(e.message) ? "Your sign-in has expired. Please sign in again." : "Connection problem. Please try again.",
        };
      }
    },
  });

  useEffect(() => {
    if (m.data) answerRef.current?.focus();
  }, [m.data]);

  const submit = () => {
    const q = question.trim();
    if (q.length >= 3 && !m.isPending) m.mutate(q);
  };
  const r = m.data;

  return (
    <AppShell>
      <PageHeader title="Ask My Journal" subtitle="Ask questions across your journal history." />
      <div className="max-w-2xl space-y-6 px-5 sm:px-10">
        <form className="space-y-3 rounded-2xl border border-border bg-card p-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label htmlFor="ask-q" className="sr-only">Your question</label>
          <Textarea
            id="ask-q" ref={inputRef} rows={3} value={question} maxLength={500}
            placeholder="Ask anything about your journal…"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            className="resize-none border-0 bg-transparent p-0 font-serif text-lg shadow-none focus-visible:ring-0"
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Example questions">
            {CHIPS.map((c) => (
              <button key={c} type="button" onClick={() => { setQuestion(c); inputRef.current?.focus(); }}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {c}
              </button>
            ))}
          </div>
          <Button type="submit" className="w-full sm:w-auto" disabled={m.isPending || question.trim().length < 3}>
            {m.isPending ? "Looking through your journal…" : "Ask"}
          </Button>
        </form>

        <div aria-live="polite" className="sr-only">{m.isPending ? "Looking through your journal" : r ? "Answer ready" : ""}</div>

        {m.isPending && (
          <div className="space-y-2 rounded-2xl border border-border bg-card p-5" aria-hidden>
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </div>
        )}

        {r && !r.ok && r.code === "no_history" && (
          <div ref={answerRef} tabIndex={-1} className="space-y-3 rounded-2xl border border-border bg-card p-5 text-center outline-none">
            <p className="font-serif text-lg">{r.error}</p>
            <Button asChild><Link to="/journal">Start a Reflection</Link></Button>
          </div>
        )}

        {r && !r.ok && r.code !== "no_history" && (
          <div ref={answerRef} tabIndex={-1} role="alert" className="space-y-3 rounded-2xl border border-destructive/40 bg-card p-5 outline-none">
            <p className="text-sm">{r.error}</p>
            <Button variant="outline" size="sm" onClick={submit}>Try again</Button>
          </div>
        )}

        {r && r.ok && (
          <article ref={answerRef} tabIndex={-1} className="space-y-4 rounded-2xl border border-border bg-card p-5 outline-none">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>{CONF[r.confidence]}</span>
              {r.range && <span>· {r.range}</span>}
            </div>
            <p className="font-serif text-lg leading-relaxed">{r.answer}</p>
            {r.related_entries.length > 0 && (
              <section aria-labelledby="rel-h" className="space-y-2 border-t border-border pt-4">
                <h2 id="rel-h" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Related entries</h2>
                <ul className="space-y-2">
                  {r.related_entries.map((e) => (
                    <li key={e.entry_id}>
                      <Link to="/entries/$entryId" params={{ entryId: e.entry_id }}
                        className="block rounded-xl border border-border p-3 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span className="block text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                        <span className="block font-medium">{e.title}</span>
                        <span className="block text-sm text-muted-foreground">{e.reason}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        )}
      </div>
    </AppShell>
  );
}
