import { useEffect, useState } from 'react';
import { validateSnapshot, type Snapshot } from './archive';

export type DataStatus = 'loading' | 'ready' | 'offline';

let request: Promise<Snapshot | null> | null = null;

/**
 * Loads the static snapshot written by the GitHub Action (public/data/github.json).
 * The site never talks to the GitHub API from the browser, so no token is ever exposed.
 */
export function loadSnapshot(): Promise<Snapshot | null> {
  request ??= fetch(`${import.meta.env.BASE_URL}data/github.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((json: unknown) => {
      const s = validateSnapshot(json);
      return s && s.calendars.length + s.repositories.length > 0 ? s : null;
    })
    .catch(() => null);
  return request;
}

export function useGithub() {
  const [state, setState] = useState<{ status: DataStatus; snapshot: Snapshot | null }>({ status: 'loading', snapshot: null });
  useEffect(() => {
    let alive = true;
    void loadSnapshot().then((snapshot) => {
      if (alive) setState({ status: snapshot ? 'ready' : 'offline', snapshot });
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
