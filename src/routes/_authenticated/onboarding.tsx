import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Lock, Mic, PenLine, Users, Leaf } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { profileQueryOptions } from "@/lib/profile";
import { createSession } from "@/lib/journal";
import { trackEvent } from "@/lib/product-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Getting started — Reflective" },
      { name: "description", content: "Tell Reflective a little about how you want to journal." },
      { property: "og:title", content: "Getting started — Reflective" },
      { property: "og:description", content: "Set up your journaling companion." },
    ],
  }),
  component: Onboarding,
});

const INTENTIONS = [
  { value: "understand", label: "Understand myself better" },
  { value: "unwind", label: "Unwind at the end of the day" },
  { value: "goals", label: "Stay close to my goals" },
  { value: "patterns", label: "Notice patterns over time" },
];

const TRUST = [
  { icon: Lock, text: "Your journal is private." },
  { icon: Users, text: "Your reflections are not shared with other users." },
  { icon: Leaf, text: "Reflective is a reflection companion, not a therapist or medical service." },
];

type Mode = "write" | "talk";

function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(profileQueryOptions);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [intention, setIntention] = useState("understand");
  const [pending, setPending] = useState<"personalize" | Mode | null>(null);
  const [sessionError, setSessionError] = useState(false);
  const busy = useRef(false);
  const prefilled = useRef(false);
  const chose = useRef(false);

  // Returning users never see onboarding again.
  useEffect(() => {
    if (profile?.onboarded_at && !chose.current) navigate({ to: "/journal", replace: true });
  }, [profile?.onboarded_at, navigate]);

  // Resume safely after a refresh: keep whatever was already saved.
  useEffect(() => {
    if (!profile || prefilled.current) return;
    prefilled.current = true;
    if (profile.display_name) setName(profile.display_name);
    if (profile.journaling_intention) setIntention(profile.journaling_intention);
    trackEvent("onboarding_started");
  }, [profile]);

  async function updateProfile(fields: Record<string, string | null>) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Not signed in");
    const { error } = await supabase.from("profiles").update(fields).eq("id", userData.user.id);
    if (error) throw error;
  }

  async function savePersonalize() {
    if (busy.current) return;
    busy.current = true;
    setPending("personalize");
    try {
      await updateProfile({ display_name: name.trim() || null, journaling_intention: intention });
      trackEvent("onboarding_personalized");
      setStep(2);
    } catch {
      toast.error("Couldn't save that. Please try again.");
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  async function choose(mode: Mode) {
    if (busy.current) return; // double-tap guard: one save, one session
    busy.current = true;
    chose.current = true;
    setPending(mode);
    setSessionError(false);
    try {
      await updateProfile({
        display_name: name.trim() || null,
        journaling_intention: intention,
        onboarded_at: profile?.onboarded_at ?? new Date().toISOString(),
      });
    } catch {
      toast.error("Couldn't save that. Please try again.");
      busy.current = false;
      chose.current = false;
      setPending(null);
      return;
    }
    trackEvent("onboarding_mode_selected", { mode });
    await queryClient.invalidateQueries({ queryKey: ["profile"] });

    if (mode === "talk") {
      // Existing voice flow creates the session; the microphone is only asked for there.
      navigate({ to: "/voice" });
      return;
    }
    try {
      const id = await createSession("text");
      trackEvent("first_reflection_started");
      navigate({ to: "/write/$sessionId", params: { sessionId: id } });
    } catch {
      // Profile is saved; only the session failed, so allow a retry from here.
      setSessionError(true);
      toast.error("Couldn't start your reflection. Try again.");
      busy.current = false;
      setPending(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 pt-[max(4rem,env(safe-area-inset-top))] pb-[max(4rem,env(safe-area-inset-bottom))]">
      <div className="mb-8 flex gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-border")}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Step {step + 1} of 3
      </p>

      {step === 0 && (
        <section className="space-y-8">
          <div className="space-y-4">
            <h1 className="font-serif text-3xl leading-tight tracking-tight text-balance">
              A private place to think things through.
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              Reflective helps you slow down, put thoughts into words, and notice patterns over
              time.
            </p>
          </div>
          <ul className="space-y-3">
            {TRUST.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm leading-relaxed">
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <Button size="lg" className="w-full" onClick={() => setStep(1)}>
            Begin
          </Button>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-6">
          <h1 className="font-serif text-3xl leading-tight tracking-tight text-balance">
            What would make Reflective useful to you?
          </h1>
          <div className="space-y-2">
            <Label htmlFor="name">What should I call you?</Label>
            <Input
              id="name"
              value={name}
              placeholder="Optional"
              autoComplete="given-name"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Choose one</legend>
            {INTENTIONS.map((option) => {
              const selected = intention === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setIntention(option.value)}
                  className={cn(
                    "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-card hover:bg-secondary",
                  )}
                >
                  {option.label}
                  {selected && <Check className="size-4 shrink-0" aria-hidden />}
                </button>
              );
            })}
          </fieldset>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              className="flex-1"
              onClick={savePersonalize}
              disabled={pending === "personalize"}
            >
              {pending === "personalize" && <Loader2 className="size-4 animate-spin" />}
              Continue
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <h1 className="font-serif text-3xl leading-tight tracking-tight">
            How would you like to begin?
          </h1>
          <div className="space-y-3">
            <ModeCard
              icon={PenLine}
              title="Write"
              body="Start with a sentence. Reflective will respond and help you explore what is on your mind."
              loading={pending === "write"}
              disabled={pending !== null}
              onClick={() => choose("write")}
            />
            <ModeCard
              icon={Mic}
              title="Talk"
              body="Speak naturally and reflect out loud."
              loading={pending === "talk"}
              disabled={pending !== null}
              onClick={() => choose("talk")}
            />
          </div>
          {sessionError && (
            <p role="alert" className="text-sm text-destructive">
              Couldn't start your reflection. Try again.
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            You can switch between writing and voice later.
          </p>
          <Button variant="ghost" onClick={() => setStep(1)} disabled={pending !== null}>
            Back
          </Button>
        </section>
      )}
    </div>
  );
}

function ModeCard({
  icon: Icon,
  title,
  body,
  loading,
  disabled,
  onClick,
}: {
  icon: typeof Mic;
  title: string;
  body: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={loading}
      className="flex w-full items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
        {loading ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
      </span>
      <span>
        <span className="block font-serif text-xl">{title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{body}</span>
      </span>
    </button>
  );
}
