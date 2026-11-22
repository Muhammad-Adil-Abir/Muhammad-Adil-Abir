/** Storage access that never throws (private mode, disabled storage, sandboxed frames). */

export function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the experience still works, it just won't remember */
  }
}

export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  arrivalSeen: 'aether:arrival-seen',
  sound: 'aether:sound',
  motion: 'aether:motion',
} as const;

/** URL flags used by the capture tooling and for debugging: ?capture=1&quality=high&chrome=0 */
export function urlFlag(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}
