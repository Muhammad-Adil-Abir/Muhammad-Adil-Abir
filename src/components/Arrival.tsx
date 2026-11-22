import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ArrivalScene } from '../scenes/arrival/ArrivalScene';
import { ARRIVAL } from '../scenes/arrival/cues';
import { RenderLoop } from '../scenes/core/loop';
import { detectTier, webglAvailable } from '../scenes/core/quality';
import { site } from '../content/site';
import { Timeline } from '../lib/timeline';
import { EASE } from '../lib/motion';
import { useSettings } from '../lib/settings';
import { KEYS, readSession, urlFlag, writeSession } from '../lib/storage';
import { audio } from '../lib/audio';
import { registerCapture, unregisterCapture } from '../lib/capture';

type Phase = 'sequence' | 'settled';
type Mode = 'full' | 'reentry';
const END = ARRIVAL.duration;

function Letters({ text }: { text: string }) {
  return (
    <>
      {[...text].map((c, i) => (
        <span key={i} className="ch" aria-hidden="true">
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </>
  );
}

/**
 * CHAPTER 01 — THE ARRIVAL.
 * A full-viewport hero that plays an 8.6 s cinematic once per browsing session.
 * Never blocks the page: content below is always reachable, the sequence can be
 * skipped at any moment (button or Esc), and scrolling away simply completes it.
 */
export function Arrival() {
  const { reducedMotion } = useSettings();
  const capture = urlFlag('capture') === '1';
  const hideText = urlFlag('text') === '0';
  const hasGl = useMemo(() => webglAvailable(), []);

  const [phase, setPhase] = useState<Phase>(() =>
    capture ? 'sequence' : reducedMotion || readSession(KEYS.arrivalSeen) === '1' ? 'settled' : 'sequence',
  );
  const [mode, setMode] = useState<Mode>('full');
  const [run, setRun] = useState(0);
  const [gl, setGl] = useState<'pending' | 'on' | 'off'>(reducedMotion || !hasGl ? 'off' : 'pending');

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const kickerRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const ruleRef = useRef<HTMLSpanElement>(null);
  const supportRef = useRef<HTMLParagraphElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const barTopRef = useRef<HTMLDivElement>(null);
  const barBottomRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const hudRef = useRef<HTMLSpanElement>(null);
  const enterRef = useRef<HTMLAnchorElement>(null);

  const timeline = useRef<Timeline | null>(null);
  const seqRef = useRef(phase === 'settled' ? END : 0);
  const modeRef = useRef<Mode>(mode);
  const loopRef = useRef<RenderLoop | null>(null);
  const sceneRef = useRef<ArrivalScene | null>(null);
  const focusEnter = useRef(false);
  modeRef.current = mode;

  // ---------- WebGL scene (lazy-loaded chunk) ----------
  useEffect(() => {
    if (reducedMotion || !hasGl) {
      setGl('off');
      return;
    }
    const stageEl = stageRef.current!;
    const canvas = document.createElement('canvas');
    canvas.className = 'arrival__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    let disposed = false;
    let ro: ResizeObserver | null = null;
    let scene: ArrivalScene | null = null;

    import('../scenes/arrival/ArrivalScene')
      .then(({ ArrivalScene }) => {
        if (disposed) return;
        try {
          scene = new ArrivalScene(canvas, detectTier());
        } catch {
          setGl('off');
          return;
        }
        stageEl.prepend(canvas);
        sceneRef.current = scene;
        const size = () => scene!.resize(stageEl.clientWidth, stageEl.clientHeight);
        size();
        ro = new ResizeObserver(size);
        ro.observe(stageEl);
        let ambient = 0;
        const seq = () => (modeRef.current === 'full' && timeline.current ? timeline.current.time : seqRef.current) / 1000;
        if (capture) {
          registerCapture('arrival', {
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
          loopRef.current = new RenderLoop(stageEl, (_now, dt) => {
            ambient += dt / 1000;
            scene!.update(seq(), ambient);
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
      sceneRef.current = null;
      canvas.remove();
      unregisterCapture('arrival');
    };
  }, [reducedMotion, hasGl, capture]);

  // Idle at 30 fps once settled — the scene is ambient by then.
  useEffect(() => {
    loopRef.current?.setFpsCap(phase === 'settled' ? 30 : 60);
  }, [phase, gl]);

  // ---------- Sequence timeline: built before paint so nothing flashes ----------
  useLayoutEffect(() => {
    if (phase !== 'sequence') return;
    const full = mode === 'full';
    const withScene = full && hasGl && !reducedMotion;
    // Without WebGL (or for the short re-entry) the typography starts almost immediately.
    const o = withScene ? 0 : -(ARRIVAL.kicker - 300);
    const tl = new Timeline(full && withScene ? END : ARRIVAL.controls + o + 900);

    if (full) {
      tl.animate(barTopRef.current, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], {
        delay: ARRIVAL.letterbox + o,
        duration: 1100,
        easing: EASE.cinematic,
      });
      tl.animate(barBottomRef.current, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], {
        delay: ARRIVAL.letterbox + o,
        duration: 1100,
        easing: EASE.cinematic,
      });
      if (!withScene) tl.animate(posterRef.current, [{ opacity: 0 }, { opacity: 1 }], { delay: 0, duration: 1400, easing: EASE.drift });
    }
    tl.animate(
      kickerRef.current,
      [
        { opacity: 0, letterSpacing: '1.1em', filter: 'blur(6px)' },
        { opacity: 1, letterSpacing: '0.42em', filter: 'blur(0px)' },
      ],
      { delay: ARRIVAL.kicker + o, duration: 1300, easing: EASE.cinematic },
    );
    lineRef.current?.querySelectorAll('.ch').forEach((ch, i) => {
      tl.animate(
        ch,
        [
          { transform: 'translateY(105%) rotate(4deg)', opacity: 0, filter: 'blur(10px)' },
          { transform: 'translateY(0) rotate(0deg)', opacity: 1, filter: 'blur(0px)' },
        ],
        { delay: ARRIVAL.title + o + i * 42, duration: 1150, easing: EASE.cinematic },
      );
    });
    tl.animate(ruleRef.current, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
      delay: ARRIVAL.rule + o,
      duration: 1000,
      easing: EASE.cinematic,
    });
    tl.animate(
      supportRef.current,
      [
        { opacity: 0, transform: 'translateY(14px)', filter: 'blur(6px)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' },
      ],
      { delay: ARRIVAL.supporting + o, duration: 1100, easing: EASE.cinematic },
    );
    const tagLen = site.arrival.tagline.length + 3;
    tl.animate(taglineRef.current, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], {
      delay: ARRIVAL.tagline + o,
      duration: 1300,
      easing: `steps(${tagLen}, end)`,
    });
    tl.animate(
      controlsRef.current,
      [
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { delay: ARRIVAL.controls + o, duration: 800, easing: EASE.settle },
    );

    if (full && withScene) {
      tl.cue(ARRIVAL.reveal, () => audio.startDrone());
      tl.cue(ARRIVAL.riser, (skipped) => !skipped && audio.riser(1.45));
      tl.cue(ARRIVAL.ignite, (skipped) => !skipped && audio.impact(1));
      tl.cue(ARRIVAL.title, (skipped) => !skipped && audio.chime(523.25, 0.035));
    }
    tl.onTick((t) => {
      if (full) seqRef.current = withScene ? t : END;
      if (hudRef.current) hudRef.current.textContent = `T+${(t / 1000).toFixed(1).padStart(4, '0')}`;
    });
    tl.onEnd(() => {
      seqRef.current = END;
      if (!capture) writeSession(KEYS.arrivalSeen, '1');
      window.setTimeout(() => audio.stopDrone(), 5000);
      timeline.current = null;
      setPhase('settled');
      setMode('full');
    });
    if (!full) seqRef.current = END;
    timeline.current = tl;
    return () => {
      tl.dispose();
      if (timeline.current === tl) timeline.current = null;
    };
  }, [phase, mode, run, hasGl, reducedMotion, capture]);

  // Start once the scene is ready (or immediately without one). Never wait longer than 2.5 s.
  useEffect(() => {
    if (phase !== 'sequence' || capture) return;
    const tl = timeline.current;
    if (!tl) return;
    if (mode === 'reentry' || gl !== 'pending') {
      tl.play();
      return;
    }
    const t = window.setTimeout(() => tl.play(), 2500);
    return () => window.clearTimeout(t);
  }, [phase, mode, gl, run, capture]);

  const skip = useCallback(() => {
    focusEnter.current = true;
    timeline.current?.finish();
  }, []);

  // Switching motion off mid-sequence completes it immediately.
  useEffect(() => {
    if (reducedMotion && phase === 'sequence' && !capture) timeline.current?.finish();
  }, [reducedMotion, phase, capture]);

  // Esc skips; scrolling the hero mostly out of view completes the sequence.
  useEffect(() => {
    if (phase !== 'sequence' || capture) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip();
    };
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e && e.intersectionRatio < 0.2) timeline.current?.finish();
      },
      { threshold: [0, 0.2, 0.5] },
    );
    io.observe(sectionRef.current!);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      io.disconnect();
    };
  }, [phase, skip, capture]);

  useEffect(() => {
    if (phase === 'settled' && focusEnter.current) {
      focusEnter.current = false;
      enterRef.current?.focus({ preventScroll: true });
    }
  }, [phase]);

  // "Restart the journey" from the finale: return to the top and re-reveal the title only.
  useEffect(() => {
    const onRestart = () => {
      let done = false;
      const arrive = () => {
        if (done) return;
        done = true;
        titleRef.current?.focus({ preventScroll: true });
        if (!reducedMotion && phase === 'settled') {
          setMode('reentry');
          setRun((r) => r + 1);
          setPhase('sequence');
        }
      };
      if ('onscrollend' in window) window.addEventListener('scrollend', arrive, { once: true });
      window.setTimeout(arrive, reducedMotion ? 50 : 1400);
    };
    window.addEventListener('aether:restart', onRestart);
    return () => window.removeEventListener('aether:restart', onRestart);
  }, [reducedMotion, phase]);

  const replay = () => {
    seqRef.current = 0;
    setMode('full');
    setRun((r) => r + 1);
    setPhase('sequence');
  };

  const playing = phase === 'sequence' && mode === 'full';
  const poster = `${import.meta.env.BASE_URL}media/arrival-poster.webp`;
  const classes = [
    'arrival',
    `arrival--${phase}`,
    gl === 'on' ? 'arrival--gl' : gl === 'off' ? 'arrival--static' : 'arrival--loading',
    hideText ? 'arrival--no-text' : '',
  ].join(' ');

  return (
    <section id="arrival" ref={sectionRef} className={classes} aria-labelledby="arrival-title" data-phase={phase}>
      <div className="arrival__stage" ref={stageRef} aria-hidden="true">
        <img
          ref={posterRef}
          className="arrival__poster"
          src={poster}
          alt=""
          decoding="async"
          fetchPriority="high"
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
        />
        <div className="arrival__grade" />
        <div className="arrival__bar arrival__bar--top" ref={barTopRef} />
        <div className="arrival__bar arrival__bar--bottom" ref={barBottomRef} />
      </div>

      <div className="arrival__hud label" aria-hidden="true">
        <span>CH.01 — The Arrival</span>
        {gl !== 'off' && <span ref={hudRef}>{phase === 'settled' ? 'T+09.0' : 'T+00.0'}</span>}
      </div>

      <div className="arrival__content wrap">
        <h1 id="arrival-title" ref={titleRef} className="arrival__title" tabIndex={-1}>
          <span className="arrival__kicker" ref={kickerRef}>
            {site.arrival.kicker}
          </span>
          <span className="visually-hidden"> {site.arrival.title}</span>
          <span className="arrival__line" ref={lineRef} aria-hidden="true">
            <span className="arrival__word">
              <Letters text="Abir's" />
            </span>{' '}
            <span className="arrival__word">
              <Letters text="World." />
            </span>
          </span>
        </h1>
        <span className="arrival__rule" ref={ruleRef} aria-hidden="true" />
        <p className="arrival__supporting serif" ref={supportRef}>
          {site.arrival.supporting}
        </p>
        <p className="arrival__tagline" ref={taglineRef}>
          <span aria-hidden="true">// </span>
          {site.arrival.tagline}
        </p>
        <div className="arrival__controls" ref={controlsRef}>
          <a className="btn btn--primary" href="#manifesto" ref={enterRef}>
            Enter the world
            <svg className="btn__glyph" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 1v11M2.5 7.5 7 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </a>
          {gl === 'on' && phase === 'settled' && (
            <button type="button" className="btn btn--ghost" onClick={replay}>
              Replay arrival
            </button>
          )}
        </div>
      </div>

      {playing && !capture && (
        <button type="button" className="arrival__skip btn" onClick={skip}>
          Skip intro <kbd>Esc</kbd>
        </button>
      )}
    </section>
  );
}
