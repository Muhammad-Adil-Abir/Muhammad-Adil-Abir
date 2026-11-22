/**
 * Launch Archive data model.
 *
 * Shared by the browser app, the GitHub sync script and the README SVG generator,
 * so every surface computes identical numbers from the same real data.
 *
 * Dates are calendar days in "YYYY-MM-DD" form exactly as GitHub reports them.
 * They are always parsed and formatted in UTC so a visitor's time zone can never
 * shift a contribution onto the wrong day.
 */

export type Level = 0 | 1 | 2 | 3 | 4;

export interface Day {
  date: string;
  count: number;
  level: Level;
}

export interface Calendar {
  /** "last-year" for the rolling window, otherwise the calendar year, e.g. "2025". */
  id: string;
  label: string;
  from: string;
  to: string;
  total: number;
  days: Day[];
}

export interface Repo {
  name: string;
  description: string | null;
  url: string;
  homepage: string | null;
  language: string | null;
  languageColor: string | null;
  stars: number;
  forks: number;
  topics: string[];
  pushedAt: string | null;
  pinned: boolean;
}

export interface Snapshot {
  schema: 1;
  username: string;
  profileUrl: string;
  displayName: string | null;
  generatedAt: string;
  source: 'graphql' | 'public-page';
  calendars: Calendar[];
  repositories: Repo[];
}

export interface Cell {
  day: Day;
  week: number;
  weekday: number; // 0 = Sunday, matching GitHub's calendar rows
  index: number; // chronological index within the calendar
}

export interface Streak {
  length: number;
  start: string;
  end: string;
}

export interface Stats {
  total: number;
  activeDays: number;
  dayCount: number;
  longestStreak: Streak | null;
  currentStreak: Streak | null;
  peak: Day | null;
  busiestWeekday: { weekday: number; total: number } | null;
  averagePerActiveDay: number;
}

export interface Layout {
  cells: Cell[];
  weekCount: number;
  months: { label: string; week: number; year: number }[];
  weekTotals: number[];
}

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const WEEKDAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

export function parseDate(date: string): number {
  if (!DATE_RE.test(date)) throw new Error(`Invalid date: ${date}`);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

export function toDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  return new Date(parseDate(date)).getUTCDay();
}

export function sortDays(days: readonly Day[]): Day[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Lays days out exactly like GitHub's calendar: one column per week, Sunday on top. */
export function layoutCalendar(input: readonly Day[]): Layout {
  const days = sortDays(input);
  if (days.length === 0) return { cells: [], weekCount: 0, months: [], weekTotals: [] };

  const first = parseDate(days[0]!.date);
  const gridStart = first - new Date(first).getUTCDay() * DAY_MS;

  const cells: Cell[] = days.map((day, index) => {
    const offset = Math.round((parseDate(day.date) - gridStart) / DAY_MS);
    return { day, index, week: Math.floor(offset / 7), weekday: offset % 7 };
  });

  const weekCount = cells[cells.length - 1]!.week + 1;
  const weekTotals = new Array<number>(weekCount).fill(0);
  for (const c of cells) weekTotals[c.week] = (weekTotals[c.week] ?? 0) + c.day.count;

  // Like GitHub: a month label sits on the first week column whose top day falls in a new month.
  // Labels closer than 3 columns to the previous one are dropped so they never collide.
  const months: Layout['months'] = [];
  let previousMonth = -1;
  for (let week = 0; week < weekCount; week++) {
    const top = cells.find((c) => c.week === week);
    if (!top) continue;
    const d = new Date(parseDate(top.day.date));
    const month = d.getUTCFullYear() * 12 + d.getUTCMonth();
    if (month !== previousMonth) {
      const last = months[months.length - 1];
      if (last && week - last.week < 3) months.pop();
      months.push({ label: MONTH_SHORT[d.getUTCMonth()]!, week, year: d.getUTCFullYear() });
      previousMonth = month;
    }
  }
  return { cells, weekCount, months, weekTotals };
}

function streaksOf(days: Day[]): Streak[] {
  const streaks: Streak[] = [];
  let run: Day[] = [];
  let prev = Number.NaN;
  const flush = () => {
    if (run.length) streaks.push({ length: run.length, start: run[0]!.date, end: run[run.length - 1]!.date });
    run = [];
  };
  for (const day of days) {
    const t = parseDate(day.date);
    const consecutive = t - prev === DAY_MS;
    if (day.count > 0) {
      if (!consecutive) flush();
      run.push(day);
    } else {
      flush();
    }
    prev = t;
  }
  flush();
  return streaks;
}

/**
 * Computes archive statistics.
 * The current streak follows GitHub's convention: it may end on the last day or,
 * if the last day has no contributions yet (the day is still in progress), on the day before.
 */
export function computeStats(input: readonly Day[]): Stats {
  const days = sortDays(input);
  const active = days.filter((d) => d.count > 0);
  const total = days.reduce((s, d) => s + d.count, 0);
  const streaks = streaksOf(days);

  let longestStreak: Streak | null = null;
  for (const s of streaks) if (!longestStreak || s.length > longestStreak.length) longestStreak = s;

  let currentStreak: Streak | null = null;
  const last = days[days.length - 1];
  if (last) {
    const lastT = parseDate(last.date);
    const candidate = streaks[streaks.length - 1];
    if (candidate) {
      const endT = parseDate(candidate.end);
      if (endT === lastT || (last.count === 0 && endT === lastT - DAY_MS)) currentStreak = candidate;
    }
  }

  let peak: Day | null = null;
  for (const d of active) if (!peak || d.count > peak.count) peak = d;

  const byWeekday = new Array<number>(7).fill(0);
  for (const d of days) byWeekday[weekdayOf(d.date)]! += d.count;
  let busiestWeekday: Stats['busiestWeekday'] = null;
  byWeekday.forEach((t, weekday) => {
    if (t > 0 && (!busiestWeekday || t > busiestWeekday.total)) busiestWeekday = { weekday, total: t };
  });

  return {
    total,
    activeDays: active.length,
    dayCount: days.length,
    longestStreak,
    currentStreak,
    peak,
    busiestWeekday,
    averagePerActiveDay: active.length ? total / active.length : 0,
  };
}

/** Observed count range for each intensity level, used for an honest legend. */
export function levelRanges(days: readonly Day[]): Record<1 | 2 | 3 | 4, { min: number; max: number } | null> {
  const out: Record<1 | 2 | 3 | 4, { min: number; max: number } | null> = { 1: null, 2: null, 3: null, 4: null };
  for (const d of days) {
    if (d.level === 0 || d.count === 0) continue;
    const r = out[d.level];
    out[d.level] = r ? { min: Math.min(r.min, d.count), max: Math.max(r.max, d.count) } : { min: d.count, max: d.count };
  }
  return out;
}

/** Index of the streak (if any) that contains the given day, with the day's position in it. */
export function streakContaining(input: readonly Day[], date: string): { streak: Streak; position: number } | null {
  const days = sortDays(input);
  for (const s of streaksOf(days)) {
    if (date >= s.start && date <= s.end) {
      return { streak: s, position: Math.round((parseDate(date) - parseDate(s.start)) / DAY_MS) + 1 };
    }
  }
  return null;
}

/** Share of active days with a strictly lower count (0–100), for "busier than X% of active days". */
export function percentileOf(input: readonly Day[], count: number): number {
  const active = input.filter((d) => d.count > 0);
  if (!active.length || count === 0) return 0;
  const lower = active.filter((d) => d.count < count).length;
  return Math.round((lower / active.length) * 100);
}

export function levelFromGraphql(value: string): Level {
  switch (value) {
    case 'FIRST_QUARTILE':
      return 1;
    case 'SECOND_QUARTILE':
      return 2;
    case 'THIRD_QUARTILE':
      return 3;
    case 'FOURTH_QUARTILE':
      return 4;
    default:
      return 0;
  }
}

export function formatDay(date: string, style: 'long' | 'short' = 'long', locale = 'en-GB'): string {
  const opts: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
      : { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' };
  return new Intl.DateTimeFormat(locale, opts).format(new Date(parseDate(date)));
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

/** Link to GitHub's own activity view for one day of this user's profile. */
export function activityUrl(username: string, date: string): string {
  const u = encodeURIComponent(username);
  return `https://github.com/${u}?tab=overview&from=${date}&to=${date}`;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isDay(v: unknown): v is Day {
  return (
    isObj(v) &&
    typeof v.date === 'string' &&
    DATE_RE.test(v.date) &&
    typeof v.count === 'number' &&
    Number.isInteger(v.count) &&
    v.count >= 0 &&
    typeof v.level === 'number' &&
    [0, 1, 2, 3, 4].includes(v.level)
  );
}

/** Runtime validation so a corrupt or partial data file degrades gracefully instead of crashing. */
export function validateSnapshot(v: unknown): Snapshot | null {
  if (!isObj(v) || v.schema !== 1 || typeof v.username !== 'string' || !Array.isArray(v.calendars)) return null;
  const calendars: Calendar[] = [];
  for (const c of v.calendars) {
    if (!isObj(c) || typeof c.id !== 'string' || typeof c.label !== 'string' || !Array.isArray(c.days)) continue;
    const days = c.days.filter(isDay);
    if (!days.length) continue;
    calendars.push({
      id: c.id,
      label: c.label,
      from: typeof c.from === 'string' ? c.from : days[0]!.date,
      to: typeof c.to === 'string' ? c.to : days[days.length - 1]!.date,
      total: days.reduce((s, d) => s + d.count, 0),
      days: sortDays(days),
    });
  }
  const repositories = Array.isArray(v.repositories)
    ? v.repositories.filter(
        (r): r is Repo => isObj(r) && typeof r.name === 'string' && typeof r.url === 'string' && /^https:\/\//.test(r.url),
      )
    : [];
  return {
    schema: 1,
    username: v.username,
    profileUrl: typeof v.profileUrl === 'string' ? v.profileUrl : `https://github.com/${v.username}`,
    displayName: typeof v.displayName === 'string' ? v.displayName : null,
    generatedAt: typeof v.generatedAt === 'string' ? v.generatedAt : '',
    source: v.source === 'public-page' ? 'public-page' : 'graphql',
    calendars,
    repositories,
  };
}
