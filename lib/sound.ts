/**
 * Synthesized UI sounds via the Web Audio API.
 * No audio files: nothing extra to download on mobile, instant playback.
 */
type Ctx = AudioContext;

class SoundEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastTick = 0;
  enabled = true;

  /** Must be called from a user gesture (iOS Safari requirement). */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(this.ctx);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private ready(): Ctx | null {
    if (!this.enabled) return null;
    this.unlock();
    return this.ctx && this.ctx.state !== "closed" ? this.ctx : null;
  }

  private makeNoise(ctx: Ctx) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private tone(
    freq: number,
    start: number,
    dur: number,
    { type = "sine" as OscillatorType, gain = 0.3, endFreq = 0 } = {},
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(this.master!);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  /** Peg tick while the wheel is spinning. `speed` 0..1 slightly pitches it. */
  tick(speed = 0.5) {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastTick < 0.028) return; // avoid a buzz at high speed
    this.lastTick = now;

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2600 + speed * 1600;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    src.connect(bp).connect(g).connect(this.master!);
    src.start(now, Math.random() * 0.4, 0.04);
    this.tone(1400 + speed * 500, now, 0.03, { type: "triangle", gain: 0.12 });
  }

  /** Whoosh when the spin starts. */
  spin() {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = "bandpass";
    lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(300, now);
    lp.frequency.exponentialRampToValueAtTime(2400, now + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.35, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    src.connect(lp).connect(g).connect(this.master!);
    src.start(now);
    src.stop(now + 0.6);
    this.tone(220, now, 0.35, { type: "sine", gain: 0.15, endFreq: 660 });
  }

  /** Celebration arpeggio when the wheel lands. */
  win() {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime + 0.02;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      this.tone(f, now + i * 0.09, 0.32, { type: "triangle", gain: 0.22 });
      this.tone(f * 2, now + i * 0.09, 0.2, { type: "sine", gain: 0.05 });
    });
    // final shimmer chord
    [1046.5, 1318.5, 1568].forEach((f) =>
      this.tone(f, now + 0.42, 0.7, { type: "sine", gain: 0.08 }),
    );
  }

  /** Soft pop for taps. */
  click() {
    const ctx = this.ready();
    if (!ctx) return;
    this.tone(660, ctx.currentTime, 0.08, { type: "sine", gain: 0.18, endFreq: 440 });
  }

  /** Two-note blip for toggles. */
  toggle(on: boolean) {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const [a, b] = on ? [520, 780] : [780, 520];
    this.tone(a, now, 0.07, { type: "triangle", gain: 0.16 });
    this.tone(b, now + 0.07, 0.09, { type: "triangle", gain: 0.16 });
  }

  /** Bright chime for success (e.g. dish added). */
  success() {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(880, now, 0.12, { type: "sine", gain: 0.18 });
    this.tone(1320, now + 0.08, 0.22, { type: "sine", gain: 0.16 });
  }

  /** Low buzz for errors. */
  error() {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(180, now, 0.12, { type: "square", gain: 0.06 });
    this.tone(150, now + 0.12, 0.16, { type: "square", gain: 0.06 });
  }
}

export const sound = new SoundEngine();

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* not allowed – ignore */
    }
  }
}
