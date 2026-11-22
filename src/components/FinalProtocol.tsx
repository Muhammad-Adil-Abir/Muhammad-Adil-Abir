import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FinaleScene } from '../scenes/finale/FinaleScene';
import { FINALE } from '../scenes/finale/cues';
import { RenderLoop } from '../scenes/core/loop';
import { detectTier, webglAvailable } from '../scenes/core/quality';
import { site } from '../content/site';
import { Timeline } from '../lib/timeline';
import { EASE } from '../lib/motion';
import { isReducedMotion, useSettings } from '../lib/settings';
import { urlFlag } from '../lib/storage';
import { audio } from '../lib/audio';
import { registerCapture, unregisterCapture } from '../lib/capture';

type Phase = 'idle' | 'sequence' | 'complete';
const END = FINALE.duration;

/** Letters grouped per word, so animated letters can never wrap mid-word. */
function Letters({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((w, wi) => (
        <span key={wi} className="word">
          {[...w].map((c, i) => (
            <span key={i} className="ch">
              {c}
            </span>
          ))}
          {wi < words.length - 1 && <span className="ch">{'\u00a0'}</span>}
        </span>
      ))}
    </>
  );
}

/** Scrolls back to the top and asks the Arrival to re-reveal its title (not the full intro). */
export function restartJourney() {
  window.scrollTo({ top: 0, behavior: isReducedMotion() ? 'auto' : 'smooth' });
  window.dispatchEvent(new CustomEvent('aether:restart'));
}

/**
 * CHAPTER 06 — THE FINAL PROTOCOL.
 * Plays once when the section is mostly in view (a gentle trigger, not scroll-scrubbing),
 * can be skipped or replayed, and never traps the visitor: the page simply ends here.
 */
export function FinalProtocol() {
  const { reducedMotion } = useSettings();
  const capture = urlFlag('capture') === '1';
  const hideText = urlFlag('text') === '0';
  const hasGl = useMemo(() => webglAvailable(), []);
  const staticMode = reducedMotion || !hasGl;

  const [phase, setPhase] = useState<Phase>(staticMode && !capture ? 'complete' : 'idle');
  const [run, setRun] = useState(0);
  const [near, setNear] = useState(false);
  const [gl, setGl] = useState<'pending' | 'on' | 'off'>(staticMode ? 'off' : 'pending');

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<HTMLSpanElement>(null);
  const line2Ref = useRef<HTMLSpanElement>(null);
  const codaRef = useRef<HTMLParagraphElement>(null);
  const sigRef = useRef<HTMLParagraphElement>(null);
  const thanksRef = useRef<HTMLParagraphElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const timeline = useRef<Timeline | null>(null);
  const seqRef = useRef(phase === 'complete' ? END : 0);
  const loopRef = useRef<RenderLoop | null>(null);
  const focusRestart = useRef(false);
  const active = phase !== 'complete';

  // Load the scene only when the visitor gets close to the end of the page.
  useEffect(() => {
    if (staticMode) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setNear(true), { rootMargin: '900px 0px' });
    io.observe(sectionRef.current!);
    return () => io.disconnect();
  }, [staticMode]);

  const load = near || capture;
  useEffect(() => {
    if (staticMode) {
      setGl('off');
      return;
    }
    if (!load) return;
    const stageEl = stageRef.current!;
    const canvas = document.createElement('canvas');
    canvas.className = 'finale__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    let disposed = false;
    let ro: ResizeObserver | null = null;
    let scene: FinaleScene | null = null;
    import('../scenes/finale/FinaleScene')
      .then(({ FinaleScene }) => {
        if (disposed) return;
        try {
          scene = new FinaleScene(canvas, detectTier());
        } catch {
          setGl('off');
          return;
        }
        stageEl.prepend(canvas);
        const size = () => scene!.resize(stageEl.clientWidth, stageEl.clientHeight);
        size();
        ro = new ResizeObserver(size);
        ro.observe(stageEl);
        if (capture) {
          registerCapture('finale', {
            duration: END,
            seek: (ms) => {
              timeline.current?.seek(ms);
              scene!.update(ms / 1000, ms / 1000);
              scene!.render(ms / 1000);
            },
          });
          scene.update(0, 0);
          scene.render(0);
        } else {
          let ambient = 0;
          loopRef.current = new RenderLoop(stageEl, (_n, dt) => {
            ambient += dt / 1000;
            const seq = (timeline.current ? timeline.current.time : seqRef.current) / 1000;
            scene!.update(seq, ambient);
            scene!.render(ambient, dt);
          });
        }
        setGl('on');
      })
      .catch(() => setGl('off'));
    return () => {
      disposed = true;
      loopRef.current?.dispose();
      loopRef.current = null;
      ro?.disconnect();
      scene?.dispose();
      canvas.remove();
      unregisterCapture('finale');
    };
  }, [load, staticMode, capture]);

  useEffect(() => {
    loopRef.current?.setFpsCap(phase === 'sequence' ? 60 : 30);
  }, [phase, gl]);

  // Build the sequence (paused) while idle, so the message starts hidden but stays in the accessibility tree.
  useLayoutEffect(() => {
    if (!active) return;
    const tl = new Timeline(END);
    const rise = (el: Element | null, at: number, dur = 1100) =>
      tl.animate(
        el,
        [
          { opacity: 0, transform: 'translateY(12px)', filter: 'blur(6px)' },
          { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' },
        ],
        { delay: at, duration: dur, easing: EASE.cinematic },
      );
    const letters = (root: Element | null, at: number) =>
      root?.querySelectorAll('.ch').forEach((ch, i) =>
        tl.animate(
          ch,
          [
            { opacity: 0, transform: 'translateY(40%)', filter: 'blur(14px)' },
            { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' },
          ],
          { delay: at + i * 34, duration: 1300, easing: EASE.cinematic },
        ),
      );
    letters(line1Ref.current, FINALE.line1);
    letters(line2Ref.current, FINALE.line2);
    tl.animate(codaRef.current, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], {
      delay: FINALE.coda,
      duration: 1300,
      easing: EASE.cinematic,
    });
    tl.animate(
      sigRef.current,
      [
        { opacity: 0, letterSpacing: '0.6em' },
        { opacity: 1, letterSpacing: '0.24em' },
      ],
      { delay: FINALE.signature, duration: 1400, easing: EASE.cinematic },
    );
    rise(thanksRef.current, FINALE.thanks);
    rise(controlsRef.current, FINALE.restart, 800);
    // One short, soft flash — well under any photosensitivity threshold.
    tl.animate(
      flashRef.current,
      [
        { opacity: 0, offset: 0 },
        { opacity: 0.35, offset: 0.12 },
        { opacity: 0, offset: 1 },
      ],
      { delay: FINALE.pulse - 30, duration: 800, easing: 'ease-out' },
    );
    tl.cue(FINALE.converge, (s) => !s && audio.riser(1.5));
    tl.cue(FINALE.pulse, (s) => !s && audio.impact(1.15));
    tl.cue(FINALE.silence, () => audio.hush(0.4));
    tl.cue(FINALE.line1, (s) => !s && audio.chime(392, 0.04));
    tl.cue(FINALE.coda, (s) => !s && audio.chime(587.33, 0.028));
    tl.onTick((t) => {
      seqRef.current = t;
      if (statusRef.current) statusRef.current.textContent = t >= END ? 'Protocol complete' : t > 0 ? 'Protocol engaged' : 'Awaiting signal';
    });
    tl.onEnd(() => {
      seqRef.current = END;
      timeline.current = null;
      setPhase('complete');
    });
    seqRef.current = 0;
    timeline.current = tl;
    return () => {
      tl.dispose();
      if (timeline.current === tl) timeline.current = null;
    };
  }, [active, run]);

  // Trigger once the finale is mostly in view, after the scene is ready (or a short grace period).
  useEffect(() => {
    if (phase !== 'idle' || capture) return;
    let timer = 0;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        window.clearTimeout(timer);
        if (e && e.intersectionRatio >= 0.55) timer = window.setTimeout(() => setPhase('sequence'), 450);
      },
      { threshold: [0, 0.55, 0.8] },
    );
    io.observe(sectionRef.current!);
    return () => {
      window.clearTimeout(timer);
      io.disconnect();
    };
  }, [phase, capture]);

  useEffect(() => {
    if (phase !== 'sequence' || capture) return;
    const tl = timeline.current;
    if (!tl) return;
    if (gl !== 'pending') {
      tl.play();
      return;
    }
    const t = window.setTimeout(() => tl.play(), 2000);
    return () => window.clearTimeout(t);
  }, [phase, gl, run, capture]);

  const skip = useCallback(() => {
    focusRestart.current = true;
    if (phase === 'idle') setPhase('sequence');
    timeline.current?.finish();
  }, [phase]);

  useEffect(() => {
    if (phase !== 'sequence' || capture) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && skip();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, skip, capture]);

  useEffect(() => {
    if (phase === 'complete' && focusRestart.current) {
      focusRestart.current = false;
      restartRef.current?.focus({ preventScroll: true });
    }
  }, [phase]);

  const replay = () => {
    seqRef.current = 0;
    setRun((r) => r + 1);
    setPhase('sequence');
  };

  const poster = `${import.meta.env.BASE_URL}media/finale-poster.webp`;
  const { lines, coda, signature, thanks } = site.finale;

  return (
    <section
      id="protocol"
      ref={sectionRef}
      className={`finale finale--${phase} ${gl === 'on' ? 'finale--gl' : gl === 'off' ? 'finale--static' : ''}${hideText ? ' finale--no-text' : ''}`}
      aria-labelledby="protocol-title"
    >
      <h2 id="protocol-title" className="visually-hidden">
        The Final Protocol
      </h2>
      <div className="finale__stage" ref={stageRef} aria-hidden="true">
        <img
          className="finale__poster"
          src={poster}
          alt=""
          loading="lazy"
          decoding="async"
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
        />
        <div className="finale__grade" />
      </div>
      <div className="finale__flash" ref={flashRef} aria-hidden="true" />

      <div className="finale__hud label" aria-hidden="true">
        <span>CH.06 — The Final Protocol</span>
        <span ref={statusRef}>{phase === 'idle' ? 'Awaiting signal' : phase === 'sequence' ? 'Protocol engaged' : 'Protocol complete'}</span>
      </div>

      <div className="finale__message wrap">
        <p className="finale__lines">
          <span className="visually-hidden">
            {lines[0]} {lines[1]}
          </span>
          <span className="finale__line" ref={line1Ref} aria-hidden="true">
            <Letters text={lines[0]} />
          </span>
          <span className="finale__line" ref={line2Ref} aria-hidden="true">
            <Letters text={lines[1]} />
          </span>
        </p>
        <p className="finale__coda" ref={codaRef}>
          {coda}
        </p>
        <p className="finale__signature" ref={sigRef}>
          {signature}
        </p>
        <p className="finale__thanks serif" ref={thanksRef}>
          {thanks}
        </p>
        <div className="finale__controls" ref={controlsRef}>
          <button type="button" className="btn btn--primary" ref={restartRef} onClick={restartJourney}>
            <svg className="btn__glyph" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 13V2M2.5 6.5 7 2l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            Restart the journey
          </button>
          {gl === 'on' && phase === 'complete' && (
            <button type="button" className="btn btn--ghost" onClick={replay}>
              Replay protocol
            </button>
          )}
        </div>
      </div>

      {phase === 'sequence' && !capture && (
        <button type="button" className="finale__skip btn" onClick={skip}>
          Skip <kbd>Esc</kbd>
        </button>
      )}

      <footer className="finale__footer wrap label">
        <span>Project Aether · Cinematic Edition</span>
        <span>
          © {new Date().getFullYear()} {site.name}
        </span>
        <a href={site.sourceUrl}>Source on GitHub ↗</a>
      </footer>
    </section>
  );
}
