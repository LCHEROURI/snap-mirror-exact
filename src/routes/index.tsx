import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reflective — a calm place to think out loud" },
      {
        name: "description",
        content:
          "Reflective is an AI journaling companion. Write or talk, get a gentle summary, and see how your themes and mood shift over time.",
      },
      { property: "og:title", content: "Reflective — a calm place to think out loud" },
      {
        property: "og:description",
        content: "AI journaling that remembers what matters and helps you notice patterns.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/40 blur-3xl" />
      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-20">
        <span className="font-serif text-sm tracking-[0.3em] text-muted-foreground uppercase">
          Reflective
        </span>
        <h1 className="mt-6 font-serif text-4xl leading-[1.1] tracking-tight text-balance text-foreground sm:text-6xl">
          A quiet place to think out loud at the end of the day.
        </h1>
        <p className="mt-6 max-w-prose text-base leading-relaxed text-muted-foreground">
          Write about your day and Reflective listens, asks one good question, and remembers what
          matters — so over time you can see your themes, the people in your life, and how your mood
          moves.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="sm:w-auto">
            <Link to="/auth">Start journaling</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link to="/auth" search={{ mode: "signin" }}>
              I already have an account
            </Link>
          </Button>
        </div>
        <p className="mt-12 text-xs leading-relaxed text-muted-foreground">
          Reflective is a reflection companion, not a therapist or a medical service. Your entries
          are private to your account.
        </p>
      </div>
    </div>
  );
}
