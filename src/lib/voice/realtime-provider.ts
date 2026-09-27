// Live voice over WebRTC with an ephemeral secret from the server. Only finalized transcripts are saved,
// keyed by the provider's item id so reconnects never duplicate messages.
import { micError, type VoiceEvents, type VoiceProvider } from "./types";

type Secret =
  | { ok: true; clientSecret: string; idleTimeoutSeconds: number }
  | { ok: false; code: string; error: string };
type Deps = {
  getSecret: () => Promise<Secret>;
  saveTurn: (
    role: "user" | "assistant",
    text: string,
    itemId: string,
  ) => Promise<
    | { ok: true; safety: boolean; safetyMessage?: string }
    | { ok: false; code: string; error: string }
  >;
  /** Called when live voice can't continue so the screen can offer turn-based voice. */
  onFallback: (reason: string) => void;
};

export class RealtimeVoiceProvider implements VoiceProvider {
  readonly kind = "realtime" as const;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;
  private stopped = false;
  private reconnected = false;
  private muted = false;
  private idle: ReturnType<typeof setTimeout> | null = null;
  private idleSeconds = 120;
  private partial = new Map<string, string>();

  constructor(
    private deps: Deps,
    private ev: VoiceEvents,
  ) {}

  async start() {
    this.ev.onState("connecting");
    if (typeof RTCPeerConnection === "undefined") return this.deps.onFallback("unsupported");
    try {
      this.stream ??= await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      this.ev.onError(micError(e), "");
      this.ev.onState("error");
      return;
    }
    const s = await this.deps.getSecret().catch(() => null);
    if (!s || !s.ok) return this.deps.onFallback(s && !s.ok ? s.error : "unavailable");
    this.idleSeconds = s.idleTimeoutSeconds;
    try {
      await this.connect(s.clientSecret);
    } catch {
      this.cleanupConnection();
      this.deps.onFallback("connection");
    }
  }

  private async connect(secret: string) {
    const pc = new RTCPeerConnection();
    this.pc = pc;
    this.audio ??= Object.assign(document.createElement("audio"), { autoplay: true });
    pc.ontrack = (e) => {
      if (this.audio) this.audio.srcObject = e.streams[0] ?? null;
    };
    this.stream!.getAudioTracks().forEach((t) => pc.addTrack(t, this.stream!));
    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.onmessage = (m) => this.handle(JSON.parse(m.data as string));
    dc.onopen = () => {
      this.ev.onState("ready");
      this.armIdle();
    };
    pc.onconnectionstatechange = () => {
      if (this.stopped) return;
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected")
        void this.reconnect();
    };
    await pc.setLocalDescription(await pc.createOffer());
    const res = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: pc.localDescription!.sdp,
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/sdp" },
    });
    if (!res.ok) throw new Error("sdp");
    await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
  }

  /** One safe reconnect with a fresh secret; otherwise hand over to turn-based voice. */
  private async reconnect() {
    this.cleanupConnection();
    if (this.reconnected) {
      this.ev.onError("connection_lost", "");
      return this.deps.onFallback("connection");
    }
    this.reconnected = true;
    this.ev.onState("reconnecting");
    const s = await this.deps.getSecret().catch(() => null);
    if (!s || !s.ok || this.stopped) return this.deps.onFallback("connection");
    try {
      await this.connect(s.clientSecret);
    } catch {
      this.cleanupConnection();
      this.deps.onFallback("connection");
    }
  }

  private armIdle() {
    if (this.idle) clearTimeout(this.idle);
    this.idle = setTimeout(() => {
      if (!this.stopped) this.pause();
    }, this.idleSeconds * 1000);
  }

  private handle(e: { type: string; item_id?: string; transcript?: string; delta?: string }) {
    switch (e.type) {
      case "input_audio_buffer.speech_started":
        this.armIdle();
        this.ev.onState("listening"); // server VAD interrupts any reply in progress (barge-in)
        break;
      case "input_audio_buffer.speech_stopped":
        this.ev.onState("thinking");
        break;
      case "output_audio_buffer.started":
        this.ev.onState("speaking");
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        this.ev.onState("ready");
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (e.item_id && e.transcript) void this.finalize("user", e.item_id, e.transcript);
        break;
      case "response.output_audio_transcript.delta":
        if (e.item_id && e.delta) {
          const t = (this.partial.get(e.item_id) ?? "") + e.delta;
          this.partial.set(e.item_id, t);
          this.ev.onTranscript({ id: e.item_id, role: "assistant", text: t, final: false });
        }
        break;
      case "response.output_audio_transcript.done":
        if (e.item_id) {
          this.partial.delete(e.item_id);
          if (e.transcript) void this.finalize("assistant", e.item_id, e.transcript);
        }
        break;
      case "error":
        this.ev.onError("other", "");
        break;
    }
  }

  private async finalize(role: "user" | "assistant", itemId: string, text: string) {
    this.ev.onTranscript({ id: itemId, role, text, final: true });
    const r = await this.deps.saveTurn(role, text, itemId).catch(() => null);
    if (r && r.ok && r.safety) {
      // Same server-side safety layer as text: stop ordinary conversation and show the safety message.
      this.dc?.send(JSON.stringify({ type: "response.cancel" }));
      this.dc?.send(JSON.stringify({ type: "output_audio_buffer.clear" }));
      this.ev.onTranscript({
        id: `${itemId}:safety`,
        role: "assistant",
        text: r.safetyMessage ?? "",
        final: true,
      });
      this.pause();
    } else if (r && !r.ok && r.code === "expired") {
      this.ev.onError("expired", r.error);
      this.stop();
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !m));
  }
  pause() {
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = false));
    if (this.dc?.readyState === "open") this.dc.send(JSON.stringify({ type: "response.cancel" }));
    if (this.audio) this.audio.muted = true;
    if (this.idle) clearTimeout(this.idle);
    this.ev.onState("paused");
  }
  resume() {
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
    if (this.audio) this.audio.muted = false;
    this.armIdle();
    this.ev.onState("ready");
  }
  private cleanupConnection() {
    this.dc?.close();
    this.pc?.close();
    this.dc = null;
    this.pc = null;
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.idle) clearTimeout(this.idle);
    this.cleanupConnection();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.audio) {
      this.audio.srcObject = null;
      this.audio = null;
    }
    this.ev.onState("ended");
  }
  /** Hands the live mic to a successor provider isn't supported; fallback re-requests its own stream. */
  releaseMic() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
