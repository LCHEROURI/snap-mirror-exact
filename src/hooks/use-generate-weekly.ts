import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { generateWeekly } from "@/lib/weekly.functions";

/** Single entry point for weekly generation; the server refuses duplicates unless regenerate is set. */
export function useGenerateWeekly() {
  const gen = useServerFn(generateWeekly);
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existsFor, setExistsFor] = useState<string | null>(null);

  async function run(weekStart?: string, regenerate = false) {
    setPending(true);
    setError(null);
    try {
      const r = await gen({ data: { week_start: weekStart, regenerate, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      if (!r.ok) {
        setError(r.error);
        return null;
      }
      if (r.status === "exists") setExistsFor(r.week_start);
      await qc.invalidateQueries({ queryKey: ["reports"] });
      await qc.invalidateQueries({ queryKey: ["insights"] });
      return r;
    } catch {
      setError("Your session may have expired. Please sign in again and retry.");
      return null;
    } finally {
      setPending(false);
    }
  }
  return { run, pending, error, existsFor, clearExists: () => setExistsFor(null) };
}
