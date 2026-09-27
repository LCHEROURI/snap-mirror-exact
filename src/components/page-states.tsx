import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Loading() {
  return <div className="flex justify-center py-12" role="status" aria-label="Loading"><Loader2 className="size-5 animate-spin text-muted-foreground motion-reduce:animate-none" /></div>;
}
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-dashed border-border px-5 py-8 text-center">
      <p className="text-sm">Couldn't load this right now.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Try again</Button>
    </div>
  );
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
      <p className="font-serif text-lg">{title}</p>
      {children && <div className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{children}</div>}
    </div>
  );
}
export const shortDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
export function meta(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — Reflective` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — Reflective` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
