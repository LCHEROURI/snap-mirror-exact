import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { meta } from "@/components/page-states";
import { createSession } from "@/lib/journal";

export const Route = createFileRoute("/_authenticated/voice/")({
  head: () => meta("Voice reflection", "Start a spoken reflection with your companion."),
  component: StartVoice,
});

/** Creates a new voice journal session, then opens the voice screen. */
function StartVoice() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    createSession("voice")
      .then((id) => navigate({ to: "/voice/$sessionId", params: { sessionId: id }, replace: true }))
      .catch(() => setFailed(true));
  }, [navigate]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      {failed ? (
        <>
          <p>Couldn't start a voice reflection.</p>
          <div className="flex gap-2"><Button onClick={() => location.reload()}>Try again</Button><Button variant="outline" asChild><Link to="/journal">Back home</Link></Button></div>
        </>
      ) : <p role="status" className="text-muted-foreground">Preparing your voice reflection…</p>}
    </main>
  );
}
