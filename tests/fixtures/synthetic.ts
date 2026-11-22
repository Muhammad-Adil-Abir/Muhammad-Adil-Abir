/**
 * TEST FIXTURE ONLY — deterministic synthetic data for unit and browser tests.
 * It uses a username that is obviously not a real account and is never written
 * to public/ or shipped with the site.
 */
import { toDateString, type Day, type Level, type Snapshot } from '../../src/lib/archive';

export const FIXTURE_USER = 'aether-test-fixture';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return (s >>> 8) / 16777216;
  };
}

export function syntheticDays(end: string, length: number, seed = 7): Day[] {
  const r = rng(seed);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  const days: Day[] = [];
  for (let i = length - 1; i >= 0; i--) {
    const date = toDateString(endMs - i * 86_400_000);
    const active = r() < 0.55;
    const count = active ? 1 + Math.floor(Math.pow(r(), 2.2) * 18) : 0;
    const level = (count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4) as Level;
    days.push({ date, count, level });
  }
  return days;
}

export function syntheticSnapshot(end = '2026-11-21'): Snapshot {
  const days = syntheticDays(end, 365);
  return {
    schema: 1,
    username: FIXTURE_USER,
    profileUrl: `https://github.com/${FIXTURE_USER}`,
    displayName: 'Test Fixture',
    generatedAt: '2026-11-21T06:00:00.000Z',
    source: 'graphql',
    calendars: [
      { id: 'last-year', label: 'Last 12 months', from: days[0]!.date, to: days[days.length - 1]!.date, total: days.reduce((s, d) => s + d.count, 0), days },
      (() => {
        const y = syntheticDays('2025-12-31', 365, 11);
        return { id: '2025', label: '2025', from: y[0]!.date, to: y[y.length - 1]!.date, total: y.reduce((s, d) => s + d.count, 0), days: y };
      })(),
    ],
    repositories: [
      {
        name: 'fixture-orbital-dashboard',
        description: 'Fixture repository used by automated tests.',
        url: `https://github.com/${FIXTURE_USER}/fixture-orbital-dashboard`,
        homepage: 'https://example.com',
        language: 'TypeScript',
        languageColor: '#3178c6',
        stars: 3,
        forks: 0,
        topics: ['fixture', 'test'],
        pushedAt: '2026-11-20T10:00:00Z',
        pinned: true,
      },
      {
        name: 'fixture-agent-runner',
        description: 'Second fixture repository.',
        url: `https://github.com/${FIXTURE_USER}/fixture-agent-runner`,
        homepage: null,
        language: 'Python',
        languageColor: '#3572A5',
        stars: 0,
        forks: 0,
        topics: [],
        pushedAt: '2026-10-02T10:00:00Z',
        pinned: false,
      },
    ],
  };
}
