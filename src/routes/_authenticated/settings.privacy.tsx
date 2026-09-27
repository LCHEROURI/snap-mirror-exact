import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { strToU8, zipSync } from "fflate";
import { Button } from "@/components/ui/button";
import { meta } from "@/components/page-states";
import { Section, TypedConfirm } from "@/components/settings-ui";
import { deleteMyData, exportMyData } from "@/lib/privacy.functions";

export const Route = createFileRoute("/_authenticated/settings/privacy")({
  head: () => meta("Privacy & Data", "Export your journal or delete your data."),
  component: PrivacySettings,
});

const README = `Reflective export

data.json  – everything in your account as structured data (profile, preferences, sessions, transcripts,
             entries, memories, topics, people, goals, check-ins, moods, weekly reflections).
journal.md – your entries and transcripts in readable form.

Search embeddings and internal settings are not included.
`;

function PrivacySettings() {
  const qc = useQueryClient();
  const exportFn = useServerFn(exportMyData);
  const deleteFn = useServerFn(deleteMyData);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");

  async function doExport() {
    setExporting(true);
    setStatus("Preparing your export…");
    try {
      const r = await exportFn();
      if (!r.ok) { toast.error(r.error); setStatus(r.error); return; }
      // Zipped in the browser: nothing is stored on a server or behind a link.
      const zip = zipSync({
        "reflective-export/data.json": strToU8(JSON.stringify(r.json, null, 2)),
        "reflective-export/journal.md": strToU8(r.markdown),
        "reflective-export/README.txt": strToU8(README),
      });
      const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `reflective-export-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setStatus("Your export has downloaded.");
    } catch {
      const m = "Your export couldn't be prepared. Check your connection and try again.";
      toast.error(m); setStatus(m);
    } finally {
      setExporting(false);
    }
  }

  function remover(scope: "history" | "memories" | "all_data", done: string) {
    return async (phrase: string) => {
      const r = await deleteFn({ data: { scope, confirm: phrase } }).catch(() => null);
      if (!r) { toast.error("Couldn't reach Reflective. Nothing was deleted — try again."); return false; }
      if (!r.ok) { toast.error(r.error); return false; }
      await qc.invalidateQueries();
      toast.success(done);
      setStatus(done);
      return true;
    };
  }

  return (
    <>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Your journal entries are private to your account. They are used only to create your own reflections, and never for advertising.
      </p>
      <p role="status" aria-live="polite" className="sr-only">{status}</p>

      <Section title="Export my data" description="Downloads a ZIP with data.json (everything, structured) and journal.md (readable entries and transcripts).">
        <Button onClick={doExport} disabled={exporting} className="w-full">{exporting ? "Preparing…" : "Export my data"}</Button>
      </Section>

      <Section title="Delete a journal entry" description="Open any entry and choose Delete entry. That removes the entry, its transcript and its mood check-in. Memories, goals, topics and people are kept.">
        <Button asChild variant="outline" className="w-full"><Link to="/history">Go to my journal</Link></Button>
      </Section>

      <Section title="Delete journal history" description="Removes every journal entry and conversation.">
        <TypedConfirm
          label="Delete journal history"
          title="Delete your journal history?"
          deletes={["All journal entries and their summaries", "All conversations and transcripts (text and voice)", "Mood check-ins saved with an entry", "Topic and people links on entries", "Weekly reflections (they are built from your entries)"]}
          keeps={["Your account and preferences", "Memories", "Goals and check-ins", "Topics and people (without entry links)", "Mood check-ins logged on their own"]}
          onConfirm={remover("history", "Your journal history was deleted.")}
        />
      </Section>

      <Section title="Delete memories" description="Deleting memories does not delete your journal.">
        <TypedConfirm
          label="Delete all memories"
          title="Delete all memories?"
          deletes={["Every saved memory and its search data"]}
          keeps={["Journal entries and transcripts", "Goals, topics, people and moods", "Your account"]}
          onConfirm={remover("memories", "All memories were deleted. Your journal is untouched.")}
        />
      </Section>

      <Section title="Delete all personal data" description="Clears everything you've created, but keeps your sign-in so you can start fresh.">
        <TypedConfirm
          label="Delete all personal data"
          title="Delete all your personal data?"
          deletes={["Journal entries, conversations and transcripts", "Memories", "Topics and people", "Goals and check-ins", "All mood check-ins", "Weekly reflections"]}
          keeps={["Your sign-in account", "Your profile and preferences"]}
          onConfirm={remover("all_data", "All your personal data was deleted.")}
        />
      </Section>

      <Section title="Delete account" description="Permanently deletes your account and all your journal data.">
        <Button asChild variant="outline" className="w-full"><Link to="/settings/account">Go to account deletion</Link></Button>
      </Section>
    </>
  );
}
