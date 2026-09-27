import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, CalendarDays, MessageCircleQuestion, Sparkles, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/history", label: "History", icon: CalendarDays },
  { to: "/ask", label: "Ask", icon: MessageCircleQuestion },
  { to: "/insights", label: "Insights", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background sm:flex">
      <aside className="hidden sm:flex sm:w-56 sm:shrink-0 sm:flex-col sm:gap-1 sm:border-r sm:border-border sm:bg-sidebar sm:px-3 sm:py-6">
        <span className="mb-6 px-3 font-serif text-xl tracking-tight text-sidebar-foreground">
          Reflective
        </span>
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              pathname.startsWith(to)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </aside>

      <main className="flex-1 pb-24 sm:pb-10">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur sm:hidden">
        <ul className="mx-auto flex max-w-md">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-3 text-[0.7rem] transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-5 pt-8 pb-6 sm:px-10 sm:pt-12">
      <h1 className="font-serif text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      ) : null}
    </header>
  );
}
