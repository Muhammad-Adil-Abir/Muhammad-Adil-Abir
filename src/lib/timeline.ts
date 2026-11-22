/**
 * A single clock for a cinematic sequence.
 *
 * Web Animations are created paused and their currentTime is driven from here,
 * so DOM typography, WebGL scenes and audio cues stay frame-locked. The same
 * clock can be paused and seeked, which is how the preview videos are rendered
 * deterministically (see scripts/capture-previews.ts).
 */

interface Cue {
  at: number;
  run: (skipped: boolean) => void;
  fired: boolean;
}

export class Timeline {
  readonly duration: number;
  time = 0;
  private animations: Animation[] = [];
  private cues: Cue[] = [];
  private raf = 0;
  private last = 0;
  private playing = false;
  private tickers = new Set<(time: number) => void>();
  private ended = new Set<() => void>();

  constructor(duration: number) {
    this.duration = duration;
  }

  /** Registers a keyframe animation that starts `delay` ms into the sequence. */
  animate(el: Element | null, keyframes: Keyframe[], opts: { delay: number; duration: number; easing?: string }) {
    if (!el) return;
    const a = el.animate(keyframes, {
      delay: opts.delay,
      duration: opts.duration,
      easing: opts.easing ?? 'linear',
      fill: 'both',
    });
    a.pause();
    a.currentTime = this.time;
    this.animations.push(a);
  }

  /** Runs once when the clock passes `at`. `skipped` is true when it was jumped over by seek/finish. */
  cue(at: number, run: (skipped: boolean) => void) {
    this.cues.push({ at, run, fired: false });
    this.cues.sort((a, b) => a.at - b.at);
  }

  onTick(fn: (time: number) => void) {
    this.tickers.add(fn);
    return () => this.tickers.delete(fn);
  }

  onEnd(fn: () => void) {
    this.ended.add(fn);
    return () => this.ended.delete(fn);
  }

  get isPlaying() {
    return this.playing;
  }

  get isDone() {
    return this.time >= this.duration;
  }

  play() {
    if (this.playing || this.isDone) return;
    this.playing = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.playing) return;
      // Clamp large gaps (background tab) so the sequence never jumps ahead unseen.
      const dt = Math.min(now - this.last, 100);
      this.last = now;
      this.apply(this.time + dt, false);
      if (this.isDone) {
        this.playing = false;
        this.ended.forEach((fn) => fn());
        return;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
  }

  seek(time: number) {
    this.apply(Math.max(0, Math.min(time, this.duration)), true);
  }

  /** Jumps to the final frame, firing any cues that were skipped over. */
  finish() {
    const wasDone = this.isDone;
    this.pause();
    this.apply(this.duration, true);
    if (!wasDone) this.ended.forEach((fn) => fn());
  }

  private apply(time: number, jumped: boolean) {
    this.time = Math.min(time, this.duration);
    for (const a of this.animations) a.currentTime = this.time;
    for (const c of this.cues) {
      if (!c.fired && c.at <= this.time) {
        c.fired = true;
        c.run(jumped && this.time - c.at > 120);
      }
    }
    this.tickers.forEach((fn) => fn(this.time));
  }

  dispose() {
    this.pause();
    for (const a of this.animations) a.cancel();
    this.animations = [];
    this.cues = [];
    this.tickers.clear();
    this.ended.clear();
  }
}
