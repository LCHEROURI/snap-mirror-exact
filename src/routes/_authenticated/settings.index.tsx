import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { meta } from "@/components/page-states";
import { SETTINGS_SECTIONS } from "@/lib/settings-sections";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => meta("Settings", "Your profile, preferences, memory, privacy and account."),
  component: SettingsHub,
});

function SettingsHub() {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {SETTINGS_SECTIONS.map((s) => (
        <li key={s.to}>
          <Link
            to={s.to}
            className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-secondary/60 focus-visible:bg-secondary focus-visible:outline-none"
          >
            <span>
              <span className="block text-sm font-medium">{s.label}</span>
              <span className="block text-xs text-muted-foreground">{s.hint}</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
