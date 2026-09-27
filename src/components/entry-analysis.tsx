import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retryEntryAnalysis } from "@/lib/companion.functions";
import type { JournalAnalysis } from "@/lib/ai/analysis";

function Chips({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{label}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((t) => (
          <li key={t} className="rounded-full border border-border bg-card px-3 py-1 text-sm">{t}</li>
        ))}
      </ul>
    </div>
  );
}

function Bullets({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{label}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
        {items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}

export function EntryAnalysis({
  entryId,
  status,
  error,
  summary,
  narrative,
  analysis,
  onUpdated,
}: {
  entryId: string;
  status: string;
  error: string | null;
  summary: string | null;
  narrative: string | null;
  analysis: JournalAnalysis | null;
  onUpdated: () => void;
}) {
  const retry = useServerFn(retryEntryAnalysis);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await retry({ data: { entryId } });
      if (!res.ok) setMsg(res.error);
      onUpdated();
    } catch (e) {
      setMsg(e instanceof Error && /unauthori[sz]ed/i.test(e.message) ? "Your sign-in has expired. Please sign in again." : "Connection problem. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (status !== "complete" || !analysis) {
    return (
      <section className="mt-8 rounded-2xl border border-dashed border-border px-5 py-6">
        <p className="font-serif text-lg">{status === "failed" ? "The reflection summary wasn't created" : "No reflection summary yet"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {msg ?? error ?? (status === "pending" ? "Your entry is saved. Tap below to create its summary." : "Your transcript is saved safely.")} Your transcript is untouched.
        </p>
        <Button className="mt-4" variant="outline" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {busy ? "Reflecting…" : "Create summary"}
        </Button>
      </section>
    );
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-[0.95rem] leading-relaxed">{summary}</p>
        {narrative && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{narrative}</p>}
        <p className="mt-3 text-[0.7rem] text-muted-foreground">AI-generated reflection — observations, not conclusions.</p>
      </div>
      <Chips label="Feelings" items={analysis.emotions} />
      <Bullets label="Decisions" items={analysis.decisions} />
      <Bullets label="Wins" items={analysis.wins} />
      <Bullets label="Concerns" items={analysis.concerns} />
    </section>
  );
}
