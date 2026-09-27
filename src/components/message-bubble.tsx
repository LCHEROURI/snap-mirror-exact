import { cn } from "@/lib/utils";
import { displayContent, isPlaceholder, type JournalMessage } from "@/lib/journal";

export function MessageBubble({ m }: { m: JournalMessage }) {
  const mine = m.role === "user";
  return (
    <li className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed",
          mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-card",
        )}
      >
        {displayContent(m.content)}
      </div>
      {!mine && isPlaceholder(m.content) && (
        <span className="mt-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">Placeholder · not AI</span>
      )}
    </li>
  );
}
