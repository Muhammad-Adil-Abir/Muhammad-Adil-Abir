/**
 * AETHER sound design — fully synthesized with the Web Audio API.
 * No recorded or third-party audio is used. Sound is opt-in only: the context
 * is created on the first user gesture that switches sound on, never on load.
 *
 * Principles: sub-bass weight instead of loudness, long tails, real silence
 * after big events, and a master level that stays well below clipping.
 */

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let reverb: ConvolverNode | null = null;
let enabled = false;
const live = new Set<AudioScheduledSourceNode>();
let drone: { stop: () => void } | null = null;

function impulse(c: Ctx, seconds: number, decay: number) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function ensure(): Ctx | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 4.5, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    reverb.connect(wet).connect(master);
  }
  return ctx;
}

function out(c: Ctx, node: AudioNode, wet = true) {
  node.connect(master!);
  if (wet && reverb) node.connect(reverb);
  return c;
}

function track<T extends AudioScheduledSourceNode>(n: T): T {
  live.add(n);
  n.addEventListener('ended', () => live.delete(n));
  return n;
}

function noiseBuffer(c: Ctx, seconds: number) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export const audio = {
  get enabled() {
    return enabled;
  },

  async enable() {
    const c = ensure();
    if (!c || !master) return;
    enabled = true;
    if (c.state !== 'running') await c.resume();
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setTargetAtTime(0.55, c.currentTime, 0.4);
  },

  disable() {
    enabled = false;
    if (!ctx || !master) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    drone?.stop();
    drone = null;
    window.setTimeout(() => {
      if (!enabled) void ctx?.suspend();
    }, 800);
  },

  /** Low, slowly breathing atmosphere. */
  startDrone() {
    if (!enabled || !ctx || drone) return;
    const c = ctx;
    const g = c.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.16, c.currentTime, 2.5);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const lfo = track(c.createOscillator());
    lfo.frequency.value = 0.07;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain).connect(lp.frequency);
    const oscs = [43.65, 43.9, 65.4].map((f, i) => {
      const o = track(c.createOscillator());
      o.type = i === 2 ? 'sine' : 'sawtooth';
      o.frequency.value = f;
      o.connect(lp);
      o.start();
      return o;
    });
    lp.connect(g);
    out(c, g);
    lfo.start();
    drone = {
      stop: () => {
        g.gain.setTargetAtTime(0, c.currentTime, 0.8);
        const end = c.currentTime + 4;
        oscs.forEach((o) => o.stop(end));
        lfo.stop(end);
      },
    };
  },

  stopDrone() {
    drone?.stop();
    drone = null;
  },

  /** Filtered noise rising toward an event. */
  riser(seconds: number) {
    if (!enabled || !ctx) return;
    const c = ctx;
    const src = track(c.createBufferSource());
    src.buffer = noiseBuffer(c, seconds + 0.5);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(180, c.currentTime);
    bp.frequency.exponentialRampToValueAtTime(3200, c.currentTime + seconds);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + seconds);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + seconds + 0.35);
    src.connect(bp).connect(g);
    out(c, g);
    src.start();
    src.stop(c.currentTime + seconds + 0.5);
  },

  /** Sub-bass drop plus a filtered noise burst with a long tail. */
  impact(weight = 1) {
    if (!enabled || !ctx) return;
    const c = ctx;
    const t = c.currentTime;
    const sub = track(c.createOscillator());
    sub.type = 'sine';
    sub.frequency.setValueAtTime(95, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 1.8);
    const sg = c.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(0.9 * weight, t + 0.02);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    sub.connect(sg);
    out(c, sg, false);
    sub.start(t);
    sub.stop(t + 2.7);

    const n = track(c.createBufferSource());
    n.buffer = noiseBuffer(c, 3);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4200, t);
    lp.frequency.exponentialRampToValueAtTime(140, t + 2.4);
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.45 * weight, t + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    n.connect(lp).connect(ng);
    out(c, ng);
    n.start(t);
    n.stop(t + 3);
  },

  /** A soft, glassy tone used when typography lands. */
  chime(freq = 659.25, level = 0.05) {
    if (!enabled || !ctx) return;
    const c = ctx;
    const t = c.currentTime;
    [1, 2.01, 3.02].forEach((h, i) => {
      const o = track(c.createOscillator());
      o.type = 'sine';
      o.frequency.value = freq * h;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level / (i + 1), t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5 / (i + 1));
      o.connect(g);
      out(c, g);
      o.start(t);
      o.stop(t + 4.6);
    });
  },

  /** Immediately silences everything that is playing (used before the finale's quiet beat). */
  hush(seconds = 0.6) {
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    drone?.stop();
    drone = null;
    live.forEach((n) => {
      try {
        n.stop(t + seconds);
      } catch {
        /* already stopped */
      }
    });
  },
};
