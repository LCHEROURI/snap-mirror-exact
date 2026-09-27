import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";

/** Pick another record to merge this one into. Merging requires confirmation. */
export function MergeSelect({ options, noun, onMerge, disabled }: {
  options: { id: string; name: string }[]; noun: string; onMerge: (targetId: string) => void; disabled?: boolean;
}) {
  const [target, setTarget] = useState("");
  if (!options.length) return null;
  const t = options.find((o) => o.id === target);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="merge" className="text-sm">Merge into</label>
      <select id="merge" value={target} onChange={(e) => setTarget(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
        <option value="">Choose a {noun}…</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <ConfirmButton label="Merge" disabled={!t || disabled} title={`Merge into ${t?.name ?? ""}?`}
        description={`All journal links move to ${t?.name ?? "the other"} ${noun} and this one is removed. Journal entries are not changed.`}
        confirm="Merge" onConfirm={() => t && onMerge(t.id)} />
    </div>
  );
}
