import { useEffect, useRef, useState } from 'react';
import { site } from '../content/site';
import { settings, useSettings } from '../lib/settings';
import { audio } from '../lib/audio';
import { urlFlag } from '../lib/storage';

export const CHAPTERS = [
  { id: 'arrival', index: '01', name: 'Arrival' },
  { id: 'manifesto', index: '02', name: 'Manifesto' },
  { id: 'work', index: '03', name: 'Work' },
  { id: 'archive', index: '04', name: 'Archive' },
  { id: 'contact', index: '05', name: 'Contact' },
  { id: 'protocol', index: '06', name: 'Protocol' },
] as const;

function useActiveChapter() {
  const [active, setActive] = useState<string>('arrival');
  useEffect(() => {
    const els = CHAPTERS.map((c) => document.getElementById(c.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return active;
}

function SoundToggle() {
  const { sound } = useSettings();
  const toggle = async () => {
    if (sound) {
      audio.disable();
      settings.setSound(false);
    } else {
      await audio.enable();
      settings.setSound(true);
    }
  };
  // A remembered "on" choice still needs a fresh gesture before audio may start.
  useEffect(() => {
    if (!sound || audio.enabled) return;
    const arm = () => void audio.enable();
    window.addEventListener('pointerdown', arm, { once: true });
    window.addEventListener('keydown', arm, { once: true });
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, [sound]);
  return (
    <button type="button" className="toggle" aria-pressed={sound} onClick={toggle}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" />
        {sound ? (
          <path d="M11.5 5.5a3.5 3.5 0 0 1 0 5M13 3.5a6 6 0 0 1 0 9" fill="none" stroke="currentColor" strokeWidth="1.2" />
        ) : (
          <path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" strokeWidth="1.2" />
        )}
      </svg>
      <span>Sound {sound ? 'on' : 'off'}</span>
    </button>
  );
}

function MotionToggle() {
  const { reducedMotion } = useSettings();
  return (
    <button
      type="button"
      className="toggle"
      aria-pressed={reducedMotion}
      onClick={() => settings.setMotion(reducedMotion ? 'full' : 'reduced')}
      title="Reduce motion: replaces cinematic sequences with still frames"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M1 8c2-4 4-4 6 0s4 4 6 0" fill="none" stroke="currentColor" strokeWidth="1.2" />
        {reducedMotion && <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.2" />}
      </svg>
      <span>Reduce motion</span>
    </button>
  );
}

export function Nav() {
  const active = useActiveChapter();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        menuBtn.current?.focus();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (urlFlag('chrome') === '0') return null;

  return (
    <header className={`nav${solid ? ' nav--solid' : ''}${open ? ' nav--open' : ''}`}>
      <div className="nav__inner">
        <a className="nav__brand" href="#arrival" aria-label={`${site.name} — back to the top`}>
          <span className="nav__mark" aria-hidden="true">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <path d="M10 2 3 18M10 2l7 16M6.4 11.5h7.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </span>
          <span className="nav__name">Aether</span>
          <span className="nav__sub label">{site.monogram}</span>
        </a>
        <nav className="nav__links" aria-label="Chapters">
          {CHAPTERS.slice(1).map((c) => (
            <a key={c.id} href={`#${c.id}`} aria-current={active === c.id ? 'location' : undefined}>
              <span className="nav__idx">{c.index}</span>
              {c.name}
            </a>
          ))}
        </nav>
        <div className="nav__tools">
          <SoundToggle />
          <MotionToggle />
        </div>
        <button
          ref={menuBtn}
          type="button"
          className="nav__menu"
          aria-expanded={open}
          aria-controls="nav-sheet"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="label">{open ? 'Close' : 'Menu'}</span>
        </button>
      </div>
      <div id="nav-sheet" className="nav__sheet" hidden={!open}>
        <nav aria-label="Chapters">
          {CHAPTERS.map((c, i) => (
            <a key={c.id} ref={i === 0 ? firstLink : undefined} href={`#${c.id}`} onClick={() => setOpen(false)}>
              <span className="label">{c.index}</span>
              {c.name}
            </a>
          ))}
        </nav>
        <div className="nav__sheet-tools">
          <SoundToggle />
          <MotionToggle />
        </div>
      </div>
    </header>
  );
}

/** Desktop-only flight path down the right edge, marking the current chapter. */
export function ChapterRail() {
  const active = useActiveChapter();
  if (urlFlag('chrome') === '0') return null;
  return (
    <nav className="rail" aria-label="Chapter progress">
      <ol>
        {CHAPTERS.map((c) => (
          <li key={c.id}>
            <a href={`#${c.id}`} aria-current={active === c.id ? 'location' : undefined}>
              <span className="rail__tick" aria-hidden="true" />
              <span className="rail__label">
                {c.index} {c.name}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
