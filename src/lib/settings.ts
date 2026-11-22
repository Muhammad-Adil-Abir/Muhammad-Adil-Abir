import { useSyncExternalStore } from 'react';
import { KEYS, readLocal, readSession, urlFlag, writeLocal, writeSession } from './storage';

export type MotionSetting = 'system' | 'reduced' | 'full';

interface State {
  sound: boolean;
  motion: MotionSetting;
  systemReduced: boolean;
}

const listeners = new Set<() => void>();
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

function initialMotion(): MotionSetting {
  const forced = urlFlag('motion');
  if (forced === 'reduced' || forced === 'full') return forced;
  const stored = readLocal(KEYS.motion);
  return stored === 'reduced' || stored === 'full' ? stored : 'system';
}

let state: State = {
  // Sound is never on by default; it only persists for the current browsing session.
  sound: typeof window !== 'undefined' && readSession(KEYS.sound) === 'on',
  motion: typeof window !== 'undefined' ? initialMotion() : 'system',
  systemReduced: media?.matches ?? false,
};

media?.addEventListener('change', (e) => set({ systemReduced: e.matches }));

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const settings = {
  get: () => state,
  subscribe,
  setSound(on: boolean) {
    writeSession(KEYS.sound, on ? 'on' : 'off');
    set({ sound: on });
  },
  setMotion(motion: MotionSetting) {
    writeLocal(KEYS.motion, motion === 'system' ? null : motion);
    set({ motion });
  },
};

export function isReducedMotion(s: State = state) {
  return s.motion === 'reduced' || (s.motion === 'system' && s.systemReduced);
}

export function useSettings() {
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  return { ...s, reducedMotion: isReducedMotion(s) };
}
