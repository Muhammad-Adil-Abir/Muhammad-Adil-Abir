/** Runs a render callback only while the element is on screen and the tab is visible. */
export class RenderLoop {
  private raf = 0;
  private running = false;
  private visible = true;
  private onScreen = false;
  private last = 0;
  private observer: IntersectionObserver;
  private minFrame: number;

  constructor(
    el: Element,
    private frame: (now: number, dt: number) => void,
    fpsCap = 60,
  ) {
    this.minFrame = 1000 / fpsCap - 1;
    this.observer = new IntersectionObserver(
      (entries) => {
        this.onScreen = entries.some((e) => e.isIntersecting);
        this.sync();
      },
      { threshold: 0 },
    );
    this.observer.observe(el);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  setFpsCap(fps: number) {
    this.minFrame = 1000 / fps - 1;
  }

  private onVisibility = () => {
    this.visible = document.visibilityState === 'visible';
    this.sync();
  };

  private sync() {
    const should = this.visible && this.onScreen;
    if (should && !this.running) {
      this.running = true;
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    } else if (!should && this.running) {
      this.running = false;
      cancelAnimationFrame(this.raf);
    }
  }

  private tick = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = now - this.last;
    if (dt < this.minFrame) return;
    this.last = now;
    this.frame(now, Math.min(dt, 100));
  };

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
