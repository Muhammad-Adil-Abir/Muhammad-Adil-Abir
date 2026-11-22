import { describe, expect, it } from 'vitest';
import {
  computeStats,
  formatDay,
  layoutCalendar,
  levelFromGraphql,
  levelRanges,
  percentileOf,
  streakContaining,
  validateSnapshot,
  weekdayOf,
  type Day,
} from '../src/lib/archive';
import { syntheticDays, syntheticSnapshot } from './fixtures/synthetic';

const d = (date: string, count: number): Day => ({ date, count, level: count === 0 ? 0 : count < 3 ? 1 : 2 });

describe('dates are timezone-proof', () => {
  it('reads weekdays in UTC', () => {
    expect(weekdayOf('2026-11-22')).toBe(0); // Sunday
    expect(weekdayOf('2024-02-29')).toBe(4); // Thursday, leap day
  });

  it('formats without shifting the day', () => {
    const f = formatDay('2026-01-01');
    expect(f).toMatch(/^Thursday/);
    expect(f).toContain('1 January 2026');
    expect(formatDay('2026-12-31', 'short')).toContain('31');
  });
});

describe('layoutCalendar', () => {
  it('places days like GitHub: Sunday rows, one column per week', () => {
    const days = [d('2026-11-18', 1), d('2026-11-19', 0), d('2026-11-22', 4), d('2026-11-21', 2), d('2026-11-20', 0)];
    const { cells, weekCount } = layoutCalendar(days);
    expect(cells.map((c) => c.day.date)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
    expect(cells[0]).toMatchObject({ week: 0, weekday: 3 }); // Wednesday
    expect(cells[3]).toMatchObject({ week: 0, weekday: 6 }); // Saturday
    expect(cells[4]).toMatchObject({ week: 1, weekday: 0 }); // next Sunday starts a new column
    expect(weekCount).toBe(2);
  });

  it('keeps every real day exactly once across a full year', () => {
    const days = syntheticDays('2026-11-21', 365);
    const { cells, weekCount, weekTotals } = layoutCalendar(days);
    expect(cells).toHaveLength(365);
    expect(new Set(cells.map((c) => `${c.week}:${c.weekday}`)).size).toBe(365);
    expect(weekCount).toBeGreaterThanOrEqual(53);
    expect(weekTotals.reduce((a, b) => a + b, 0)).toBe(days.reduce((s, x) => s + x.count, 0));
  });

  it('labels months without collisions', () => {
    const { months } = layoutCalendar(syntheticDays('2026-11-21', 365));
    for (let i = 1; i < months.length; i++) expect(months[i]!.week - months[i - 1]!.week).toBeGreaterThanOrEqual(3);
    expect(months.length).toBeGreaterThanOrEqual(11);
  });
});

describe('computeStats', () => {
  const days = [
    d('2026-11-10', 2),
    d('2026-11-11', 5),
    d('2026-11-12', 0),
    d('2026-11-13', 1),
    d('2026-11-14', 1),
    d('2026-11-15', 1),
    d('2026-11-16', 3),
    d('2026-11-17', 0),
  ];

  it('totals, active days and peak are exact', () => {
    const s = computeStats(days);
    expect(s.total).toBe(13);
    expect(s.activeDays).toBe(6);
    expect(s.dayCount).toBe(8);
    expect(s.peak).toEqual(days[1]);
  });

  it('finds the longest streak', () => {
    expect(computeStats(days).longestStreak).toEqual({ length: 4, start: '2026-11-13', end: '2026-11-16' });
  });

  it('keeps the current streak alive while today is still empty (GitHub convention)', () => {
    expect(computeStats(days).currentStreak).toEqual({ length: 4, start: '2026-11-13', end: '2026-11-16' });
    expect(computeStats([...days, d('2026-11-18', 0)]).currentStreak).toBeNull();
  });

  it('does not join streaks across gaps in the data', () => {
    const s = computeStats([d('2026-01-01', 1), d('2026-01-03', 1)]);
    expect(s.longestStreak?.length).toBe(1);
  });

  it('handles empty input', () => {
    const s = computeStats([]);
    expect(s).toMatchObject({ total: 0, activeDays: 0, longestStreak: null, currentStreak: null, peak: null });
  });
});

describe('helpers', () => {
  it('maps GraphQL levels', () => {
    expect(['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'].map(levelFromGraphql)).toEqual([0, 1, 2, 3, 4]);
  });

  it('reports observed count ranges per level', () => {
    const r = levelRanges([d('2026-01-01', 1), d('2026-01-02', 2), d('2026-01-03', 4)]);
    expect(r[1]).toEqual({ min: 1, max: 2 });
    expect(r[2]).toEqual({ min: 4, max: 4 });
    expect(r[3]).toBeNull();
  });

  it('locates a day inside its streak', () => {
    const days = [d('2026-01-01', 1), d('2026-01-02', 1), d('2026-01-03', 1)];
    expect(streakContaining(days, '2026-01-02')).toEqual({ streak: { length: 3, start: '2026-01-01', end: '2026-01-03' }, position: 2 });
  });

  it('computes percentiles among active days', () => {
    const days = [d('2026-01-01', 1), d('2026-01-02', 2), d('2026-01-03', 3), d('2026-01-04', 0)];
    expect(percentileOf(days, 3)).toBe(67);
    expect(percentileOf(days, 0)).toBe(0);
  });
});

describe('validateSnapshot', () => {
  it('accepts a well-formed snapshot', () => {
    const s = validateSnapshot(JSON.parse(JSON.stringify(syntheticSnapshot())));
    expect(s?.calendars).toHaveLength(2);
    expect(s?.repositories).toHaveLength(2);
  });

  it('rejects garbage and drops malformed days without inventing any', () => {
    expect(validateSnapshot(null)).toBeNull();
    expect(validateSnapshot({ schema: 2 })).toBeNull();
    const s = validateSnapshot({
      schema: 1,
      username: 'x',
      calendars: [{ id: 'a', label: 'A', days: [{ date: '2026-01-01', count: 2, level: 1 }, { date: 'bad', count: 1, level: 1 }, { date: '2026-01-02', count: -1, level: 0 }] }],
      repositories: [{ name: 'r', url: 'javascript:alert(1)' }],
    });
    expect(s?.calendars[0]?.days).toEqual([{ date: '2026-01-01', count: 2, level: 1 }]);
    expect(s?.calendars[0]?.total).toBe(2);
    expect(s?.repositories).toEqual([]);
  });
});
