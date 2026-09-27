import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
// Editable preference fields only — ownership (id) and timestamps are never sent.
type Editable = Omit<ProfileUpdate, "id" | "created_at" | "updated_at" | "onboarded_at">;

export function useSaveProfile(success = "Saved.") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Editable) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("expired");
      const { error } = await supabase.from("profiles").update(patch).eq("id", u.user.id);
      if (error) throw error;
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["profile"] }); toast.success(success); },
    onError: (e) => toast.error(e instanceof Error && e.message === "expired" ? "Your session has ended. Please sign in again." : "Couldn't save. Please try again."),
  });
}

export function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-label={title}>
      <div>
        <h2 className="font-serif text-lg tracking-tight">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function ChoiceGroup<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === o.value ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-secondary",
            )}
          >
            <span className="block">{o.label}{value === o.value ? <span className="sr-only"> (selected)</span> : null}</span>
            {o.hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{o.hint}</span> : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Destructive action gated by typing DELETE. Success is shown only after the server confirms. */
export function TypedConfirm({ label, title, deletes, keeps, onConfirm, busyLabel = "Deleting…" }: {
  label: string; title: string; deletes: string[]; keeps?: string[];
  onConfirm: (phrase: string) => Promise<boolean>; busyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const id = `confirm-${label.replace(/\W+/g, "-").toLowerCase()}`;
  async function run() {
    setBusy(true);
    const ok = await onConfirm(phrase).catch(() => false);
    setBusy(false);
    if (ok) { setOpen(false); setPhrase(""); }
  }
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!busy) { setOpen(o); if (!o) setPhrase(""); } }}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10">{label}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-foreground">This permanently deletes:</p>
                <ul className="mt-1 list-disc pl-5">{deletes.map((d) => <li key={d}>{d}</li>)}</ul>
              </div>
              {keeps?.length ? (
                <div>
                  <p className="font-medium text-foreground">This stays:</p>
                  <ul className="mt-1 list-disc pl-5">{keeps.map((d) => <li key={d}>{d}</li>)}</ul>
                </div>
              ) : null}
              <p>This can't be undone.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor={id}>Type DELETE to confirm</Label>
          <Input id={id} value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" autoCapitalize="characters" />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={phrase !== "DELETE" || busy} onClick={run}>
            {busy ? busyLabel : label}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
