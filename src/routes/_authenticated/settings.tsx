import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SETTINGS_SECTIONS } from "@/lib/settings-sections";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const atHub = pathname === "/settings" || pathname === "/settings/";
  return (
    <AppShell>
      <div className="px-5 pt-8 sm:px-10 sm:pt-12">
        {atHub ? null : (
          <Link
            to="/settings"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:hidden"
          >
            <ArrowLeft className="size-4" /> Settings
          </Link>
        )}
        <h1
          className={cn(
            "font-serif text-3xl tracking-tight sm:text-4xl",
            !atHub && "sr-only md:not-sr-only",
          )}
        >
          Settings
        </h1>
      </div>
      <div className="gap-10 px-5 pt-6 sm:px-10 md:flex">
        <nav aria-label="Settings sections" className="hidden w-48 shrink-0 md:block">
          <ul className="space-y-1">
            {SETTINGS_SECTIONS.map((s) => (
              <li key={s.to}>
                <Link
                  to={s.to}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm transition-colors",
                    pathname.startsWith(s.to)
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60",
                  )}
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 max-w-xl flex-1 space-y-6 pb-10">
          <Outlet />
        </div>
      </div>
    </AppShell>
  );
}
