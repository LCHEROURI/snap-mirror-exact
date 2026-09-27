import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { profileQueryOptions } from "@/lib/profile";
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

const REMINDERS = [
  { value: "evening", label: "Evening" },
  { value: "morning", label: "Morning" },
  { value: "none", label: "No reminders" },
];

function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(profileQueryOptions);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [intention, setIntention] = useState("understand");
  const [reminder, setReminder] = useState("evening");

  useEffect(() => {
    if (profile?.display_name) setName(profile.display_name);
  }, [profile?.display_name]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: name.trim() || null,
          journaling_intention: intention,
          reminder_preference: reminder,
          onboarded_at: new Date().toISOString(),
        })
        .eq("id", userData.user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      navigate({ to: "/journal" });
    },
    onError: () => toast.error("Couldn't save that. Please try again."),
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-8 flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-border")}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-6">
          <h1 className="font-serif text-3xl leading-tight tracking-tight">
            What should I call you?
          </h1>
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              value={name}
              placeholder="Laredj"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={() => setStep(1)}>
            Continue
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <h1 className="font-serif text-3xl leading-tight tracking-tight">
            What do you want from journaling?
          </h1>
          <div className="space-y-2">
            {INTENTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setIntention(option.value)}
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                  intention === option.value
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-card hover:bg-secondary",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button className="flex-1" onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h1 className="font-serif text-3xl leading-tight tracking-tight">
            When would you like a nudge?
          </h1>
          <p className="text-sm text-muted-foreground">
            You can change this any time in settings.
          </p>
          <div className="space-y-2">
            {REMINDERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setReminder(option.value)}
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                  reminder === option.value
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-card hover:bg-secondary",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
              Start journaling
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
