// Turn-based voice: record a complete WAV turn → server transcribes + replies → play the reply → listen again.
import { micError, type VoiceEvents, type VoiceProvider } from "./types";

type Deps = {
  sendTurn: (audio: File) => Promise<{ ok: true; userText: string; assistant: { id: string; content: string }; safety: boolean } | { ok: false; code: string; error: string }>;
  speak: (messageId: string) => Promise<{ ok: true; audio: string; mime: string } | { ok: false; code: string; error: string }>;
  idleTimeoutSeconds: number;
};

function encodeWav(chunks: Float32Array[], rate: number) {
  const len = chunks.reduce((s, c) => s + c.length, 0);
  const buf = new ArrayBuffer(44 + len * 2);
  const v = new DataView(buf);
  const tag = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  tag(0, "RIFF"); v.setUint32(4, 36 + len * 2, true); tag(8, "WAVE"); tag(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); tag(36, "data"); v.setUint32(40, len * 2, true);
  let o = 44;
  for (const c of chunks) for (const x of c) { const s = Math.max(-1, Math.min(1, x)); v.setInt16(o, s * (s < 0 ? 32768 : 32767), true); o += 2; }
  return new File([buf], "turn.wav", { type: "audio/wav" });
}

export class TurnVoiceProvider implements VoiceProvider {
  readonly kind = "turn" as const;
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private node: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private recording = false;
  private muted = false;
  private paused = false;
  private stopped = false;
  private audioEl: HTMLAudioElement | null = null;
  private idle: ReturnType<typeof setTimeout> | null = null;
  private turn = 0;

  constructor(private deps: Deps, private ev: VoiceEvents) {}

  async start() {
    this.ev.onState("connecting");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const code = micError(e);
      this.ev.onError(code, "");
      this.ev.onState("error");
      return;
    }
    this.ctx = new AudioContext();
    await this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    this.node.onaudioprocess = (e) => { if (this.recording && !this.muted) this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
    src.connect(this.node);
    this.node.connect(this.ctx.destination);
    // A device being unplugged ends the track.
    this.stream.getAudioTracks().forEach((t) => (t.onended = () => { if (!this.stopped) { this.ev.onError("no_mic", ""); this.stop(); } }));
    this.listen();
  }

  private armIdle() {
    if (this.idle) clearTimeout(this.idle);
    this.idle = setTimeout(() => { if (!this.stopped) { this.pause(); } }, this.deps.idleTimeoutSeconds * 1000);
  }

  private listen() {
    if (this.stopped || this.paused) return;
    this.chunks = [];
    this.recording = true;
    this.armIdle();
    this.ev.onState("listening");
  }

  endTurn() {
    if (!this.recording || this.stopped) return;
    this.recording = false;
    if (this.idle) clearTimeout(this.idle);
    const file = encodeWav(this.chunks, this.ctx?.sampleRate ?? 48000);
    this.chunks = [];
    void this.send(file);
  }

  private async send(file: File) {
    const n = ++this.turn;
    this.ev.onState("thinking");
    const pendingId = `pending-${n}`;
    this.ev.onTranscript({ id: pendingId, role: "user", text: "Transcribing…", final: false });
    let r: Awaited<ReturnType<Deps["sendTurn"]>>;
    try {
      r = await this.deps.sendTurn(file);
    } catch {
      this.ev.onTranscript({ id: pendingId, role: "user", text: "", final: true });
      this.ev.onError(navigator.onLine ? "other" : "connection_lost", "");
      this.listen();
      return;
    }
    if (this.stopped) return;
    if (!r.ok) {
      this.ev.onTranscript({ id: pendingId, role: "user", text: "", final: true });
      const code = r.code === "empty" || r.code === "transcription" ? "transcription" : r.code === "expired" ? "expired" : "other";
      this.ev.onError(code, r.error);
      if (code !== "expired") this.listen();
      return;
    }
    this.ev.onTranscript({ id: pendingId, role: "user", text: r.userText, final: true });
    this.ev.onTranscript({ id: r.assistant.id, role: "assistant", text: r.assistant.content, final: true });
    await this.play(r.assistant.id);
    this.listen();
  }

  private async play(messageId: string) {
    if (this.muted === undefined || this.stopped) return;
    const s = await this.deps.speak(messageId).catch(() => null);
    if (this.stopped) return;
    if (!s || !s.ok) { this.ev.onError("playback", s && !s.ok ? s.error : ""); return; }
    this.ev.onState("speaking");
    const el = new Audio(`data:${s.mime};base64,${s.audio}`);
    this.audioEl = el;
    try {
      await el.play();
      await new Promise<void>((res) => { el.onended = () => res(); el.onerror = () => res(); el.onpause = () => res(); });
    } catch {
      this.ev.onError("playback", "Your browser blocked audio playback. Tap the screen, then continue — the reply is shown as text.");
    } finally {
      this.audioEl = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !m));
  }
  pause() {
    this.paused = true;
    this.recording = false;
    this.chunks = [];
    this.audioEl?.pause();
    if (this.idle) clearTimeout(this.idle);
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = false));
    this.ev.onState("paused");
  }
  resume() {
    this.paused = false;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
    this.listen();
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.recording = false;
    if (this.idle) clearTimeout(this.idle);
    this.audioEl?.pause();
    this.node?.disconnect();
    if (this.node) this.node.onaudioprocess = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => {});
    this.ev.onState("ended");
  }
}
