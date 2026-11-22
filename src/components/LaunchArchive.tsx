import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  activityUrl,
  computeStats,
  formatDay,
  layoutCalendar,
  levelRanges,
  percentileOf,
  pluralize,
  streakContaining,
  WEEKDAY_SHORT,
  type Calendar,
  type Cell,
  type Level,
  type Snapshot,
} from '../lib/archive';
import { ALTITUDE, LEVEL_COLOR, padPath, rocketPath, smoothLine } from '../lib/launchGlyph';
import { useGithub } from '../lib/useGithub';
import { site } from '../content/site';
import { ChapterHead } from './ChapterHead';
import { Reveal } from './Reveal';

const GEO = {
  wide: { cell: 17, left: 40, telemetry: 76, gap: 34, month: 16, bottom: 10, scale: 1 },
  compact: { cell: 15, left: 34, telemetry: 62, gap: 30, month: 14, bottom: 8, scale: 0.9 },
};

function useCompact() {
  const query = '(max-width: 719px)';
  const [compact, setCompact] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setCompact(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return compact;
}

const fmt = (n: number) => n.toLocaleString('en-US');
const shortDate = (d: string) => formatDay(d, 'short');
const dateRange = (a: string, b: string) => (a === b ? shortDate(a) : `${shortDate(a)} – ${shortDate(b)}`);

export function LaunchArchive() {
  const { status, snapshot } = useGithub();
  const ready = status === 'ready' && snapshot && snapshot.calendars.length > 0;
  return (
    <section id="archive" className="chapter archive" aria-labelledby="archive-title">
      <div className="wrap">
        <ChapterHead index="CH.04" name="The Launch Archive" id="archive-title">
          Every commit, <em>a launch.</em>
        </ChapterHead>
        <Reveal as="p" className="archive__intro">
          A mission log of real activity on GitHub. Each column is a week, each mark a day: empty pads are quiet days, vehicles are
          days with contributions — the busier the day, the higher and brighter it flies.
        </Reveal>
        {status === 'loading' && <div className="archive__console archive__console--loading" aria-busy="true" aria-label="Loading the archive" />}
        {ready && <Console snapshot={snapshot} />}
        {status !== 'loading' && !ready && <Offline />}
      </div>
    </section>
  );
}

function Offline() {
  const url = `https://github.com/${site.githubUsername}`;
  return (
    <div className="archive__console archive__offline" role="status">
      <svg viewBox="0 0 240 60" className="archive__offline-art" aria-hidden="true">
        {Array.from({ length: 4 }, (_, r) =>
          Array.from({ length: 16 }, (_, c) => <path key={`${r}-${c}`} d={padPath(2.2)} transform={`translate(${12 + c * 14.5},${10 + r * 13})`} />),
        )}
      </svg>
      <p className="label label--cobalt">Telemetry offline</p>
      <p className="archive__offline-text">
        The archive is generated from GitHub by a scheduled workflow and has not synced yet. Nothing is shown rather than anything
        invented — the real history appears here after the first sync.
      </p>
      <a className="btn" href={url}>
        View contributions on GitHub ↗
      </a>
    </div>
  );
}

function Console({ snapshot }: { snapshot: Snapshot }) {
  const [calId, setCalId] = useState(snapshot.calendars[0]!.id);
  const calendar = snapshot.calendars.find((c) => c.id === calId) ?? snapshot.calendars[0]!;
  const stats = useMemo(() => computeStats(calendar.days), [calendar]);
  const [selected, setSelected] = useState<number | null>(null);
  const layout = useMemo(() => layoutCalendar(calendar.days), [calendar]);

  useEffect(() => setSelected(null), [calId]);
  const sel = selected !== null ? layout.cells[selected] : undefined;

  return (
    <Reveal className="archive__console">
      <div className="archive__bar">
        <p className="label">
          Mission log · <span className="archive__user">@{snapshot.username}</span>
        </p>
        <div className="archive__periods" role="group" aria-label="Period">
          {snapshot.calendars.map((c) => (
            <button key={c.id} type="button" className="archive__period" aria-pressed={c.id === calendar.id} onClick={() => setCalId(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <dl className="archive__stats">
        <Stat label="Contributions" value={fmt(stats.total)} note={`${shortDate(calendar.from)} – ${shortDate(calendar.to)}`} />
        <Stat label="Active days" value={fmt(stats.activeDays)} note={`of ${fmt(stats.dayCount)} days`} />
        <Stat
          label="Longest streak"
          value={stats.longestStreak ? pluralize(stats.longestStreak.length, 'day', 'days') : '—'}
          note={stats.longestStreak ? dateRange(stats.longestStreak.start, stats.longestStreak.end) : 'No streak yet'}
        />
        <Stat
          label="Current streak"
          value={stats.currentStreak ? pluralize(stats.currentStreak.length, 'day', 'days') : '0 days'}
          note={stats.currentStreak ? `since ${shortDate(stats.currentStreak.start)}` : 'Next launch pending'}
        />
        <Stat label="Peak day" value={stats.peak ? fmt(stats.peak.count) : '—'} note={stats.peak ? shortDate(stats.peak.date) : 'No activity'} />
      </dl>

      <Field calendar={calendar} username={snapshot.username} cells={layout} selected={selected} onSelect={setSelected} />
      <Legend calendar={calendar} />
      <Detail cell={sel} calendar={calendar} weekTotal={sel ? (layout.weekTotals[sel.week] ?? 0) : 0} username={snapshot.username} />

      <p className="archive__source label">
        Source: GitHub public contribution calendar ·{' '}
        {snapshot.generatedAt ? `synced ${new Date(snapshot.generatedAt).toUTCString().slice(5, 22)} UTC` : 'sync time unknown'} ·{' '}
        <a href={snapshot.profileUrl}>Profile ↗</a>
      </p>
    </Reveal>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="archive__stat">
      <dt className="label">{label}</dt>
      <dd>
        <span className="archive__stat-value">{value}</span>
        <span className="archive__stat-note">{note}</span>
      </dd>
    </div>
  );
}

interface FieldProps {
  calendar: Calendar;
  username: string;
  cells: ReturnType<typeof layoutCalendar>;
  selected: number | null;
  onSelect: (i: number | null) => void;
}

function Field({ calendar, cells: layout, selected, onSelect }: FieldProps) {
  const compact = useCompact();
  const { cells, weekCount, months, weekTotals } = layout;
  const [avail, setAvail] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const base = compact ? GEO.compact : GEO.wide;
  const fit = avail ? Math.floor((avail - base.left - 48) / Math.max(1, weekCount)) : base.cell;
  const cellSize = compact ? base.cell : Math.max(14, Math.min(22, fit));
  const g = { ...base, cell: cellSize, scale: cellSize / 17 };
  const fieldTop = g.telemetry + g.gap + g.month;
  const W = g.left + weekCount * g.cell + 10;
  const H = fieldTop + 7 * g.cell + g.bottom;
  const cx = (c: Cell) => g.left + c.week * g.cell + g.cell / 2;
  const cy = (c: Cell) => fieldTop + c.weekday * g.cell + g.cell / 2;

  const [hover, setHover] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState<number>(() => Math.max(0, cells.length - 1));
  const [kbd, setKbd] = useState(false);
  const [launched, setLaunched] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setFocusIdx(Math.max(0, cells.length - 1));
    const s = scroller.current;
    if (s) s.scrollLeft = s.scrollWidth;
  }, [cells, compact]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) {
        setLaunched(true);
        io.disconnect();
      }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const maxWeek = Math.max(1, ...weekTotals);
  const tTop = 16;
  const tBottom = g.telemetry;
  const ty = (v: number) => tBottom - (v / maxWeek) * (tBottom - tTop);
  const pts: [number, number][] = weekTotals.map((v, w) => [g.left + w * g.cell + g.cell / 2, ty(v)]);
  const line = smoothLine(pts);
  const area = pts.length ? `${line}L${pts[pts.length - 1]![0]},${tBottom}L${pts[0]![0]},${tBottom}Z` : '';

  const active = hover ?? (kbd ? focusIdx : null);
  const activeCell = active !== null ? cells[active] : undefined;

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const t = (e.target as Element).closest('[data-i]');
    return t ? Number(t.getAttribute('data-i')) : null;
  };

  const move = (i: number) => {
    const next = Math.min(cells.length - 1, Math.max(0, i));
    setFocusIdx(next);
    setKbd(true);
    const el = svgRef.current?.querySelector<SVGGElement>(`[data-i="${next}"]`);
    el?.focus();
    // Keep the focused day visible inside the horizontal scroller.
    const s = scroller.current;
    const c = cells[next];
    if (s && c) {
      const x = cx(c);
      if (x < s.scrollLeft + 40) s.scrollLeft = x - 40;
      else if (x > s.scrollLeft + s.clientWidth - 40) s.scrollLeft = x - s.clientWidth + 40;
    }
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const map: Record<string, number> = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 };
    if (e.key in map) {
      e.preventDefault();
      move(focusIdx + map[e.key]!);
    } else if (e.key === 'Home') {
      e.preventDefault();
      move(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      move(cells.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(focusIdx);
    } else if (e.key === 'Escape') {
      onSelect(null);
    }
  };

  const rows: Cell[][] = Array.from({ length: 7 }, () => []);
  for (const c of cells) rows[c.weekday]!.push(c);

  const tipLeft = activeCell ? Math.min(W - 92, Math.max(92, cx(activeCell))) : 0;

  return (
    <div className="archive__field">
      <div className="archive__scroller" ref={scroller}>
        <div className="archive__canvas" style={{ width: W, height: H }}>
          <svg
            ref={svgRef}
            className={`archive__svg${launched ? ' is-launched' : ''}`}
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            role="grid"
            aria-label={`Contribution launch field, ${calendar.label}. Use arrow keys to move between days and Enter to open a day.`}
            aria-rowcount={7}
            aria-colcount={weekCount}
            onPointerMove={(e) => {
              setKbd(false);
              setHover(pick(e));
            }}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => {
              const t = (e.target as Element).closest('[data-i]');
              if (t) {
                const i = Number(t.getAttribute('data-i'));
                setFocusIdx(i);
                onSelect(i === selected ? null : i);
              }
            }}
            onKeyDown={onKey}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setKbd(false);
            }}
          >
            <defs>
              <linearGradient id="thrust" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3d7bff" stopOpacity="0.35" />
                <stop offset="1" stopColor="#3d7bff" stopOpacity="0" />
              </linearGradient>
              <filter id="exhaust" x="-150%" y="-150%" width="400%" height="400%">
                <feGaussianBlur stdDeviation="1.8" />
              </filter>
            </defs>

            {/* Telemetry: weekly totals drawn as an ascent profile on the same x-axis as the field */}
            <g className="archive__telemetry" aria-hidden="true">
              <text x={g.left} y={9} className="archive__tlabel">
                WEEKLY CONTRIBUTIONS
              </text>
              <text x={W - 10} y={9} textAnchor="end" className="archive__tlabel">
                PEAK WEEK {fmt(Math.max(0, ...weekTotals))}
              </text>
              {[0.33, 0.66].map((f) => (
                <line key={f} x1={g.left} x2={W - 10} y1={tBottom - f * (tBottom - tTop)} y2={tBottom - f * (tBottom - tTop)} className="archive__grid" />
              ))}
              <line x1={g.left} x2={W - 10} y1={tBottom} y2={tBottom} className="archive__baseline" />
              <path d={area} fill="url(#thrust)" />
              <path d={line} className="archive__thrust" />
              {activeCell && (
                <g>
                  <line x1={cx(activeCell)} x2={cx(activeCell)} y1={tTop - 4} y2={fieldTop - 4} className="archive__probe" />
                  <circle cx={cx(activeCell)} cy={ty(weekTotals[activeCell.week] ?? 0)} r={3} className="archive__probe-dot" />
                </g>
              )}
            </g>

            <g aria-hidden="true">
              {months.map((m) => (
                <text key={`${m.year}-${m.label}-${m.week}`} x={g.left + m.week * g.cell} y={g.telemetry + g.gap + 4} className="archive__month">
                  {m.label === 'JAN' ? `JAN ’${String(m.year).slice(2)}` : m.label}
                </text>
              ))}
              {[1, 3, 5].map((r) => (
                <text key={r} x={g.left - 9} y={fieldTop + r * g.cell + g.cell / 2 + 3} textAnchor="end" className="archive__weekday">
                  {WEEKDAY_SHORT[r]}
                </text>
              ))}
            </g>

            {activeCell && (
              <g aria-hidden="true">
                <rect x={g.left + activeCell.week * g.cell} y={fieldTop - 3} width={g.cell} height={7 * g.cell + 6} className="archive__xhair" />
                <rect x={g.left - 2} y={fieldTop + activeCell.weekday * g.cell} width={W - g.left - 8} height={g.cell} className="archive__xhair" />
              </g>
            )}

            {rows.map((row, r) => (
              <g key={r} role="row" aria-rowindex={r + 1}>
                {row.map((c) => {
                  const L = c.day.level as Level;
                  const lit = c.day.count > 0;
                  const lvl = (lit && L === 0 ? 1 : L) as Level;
                  const label = `${c.day.count === 0 ? 'No contributions' : pluralize(c.day.count, 'contribution', 'contributions')} on ${formatDay(c.day.date)}`;
                  return (
                    <g
                      key={c.day.date}
                      data-i={c.index}
                      role="gridcell"
                      aria-colindex={c.week + 1}
                      aria-label={label}
                      aria-selected={selected === c.index}
                      tabIndex={c.index === focusIdx ? 0 : -1}
                      className={`lg${lit ? ' lg--lit' : ''} lg--l${lvl}`}
                      transform={`translate(${cx(c)},${cy(c)})`}
                      onFocus={() => setFocusIdx(c.index)}
                    >
                      <rect x={-g.cell / 2} y={-g.cell / 2} width={g.cell} height={g.cell} className="lg-hit" />
                      {lit ? (
                        <g className="lg-vehicle" style={{ ['--w' as string]: c.week }}>
                          {lvl >= 3 && <circle cy={4} r={2.4 + lvl} fill={LEVEL_COLOR[lvl]} opacity={0.35} filter="url(#exhaust)" />}
                          <line x1={0} x2={0} y1={4.5} y2={4.5 - ALTITUDE[lvl]} stroke={LEVEL_COLOR[lvl]} strokeOpacity={0.45} strokeWidth={1} />
                          <path d={rocketPath(lvl, g.scale)} transform={`translate(0,${4.5 - ALTITUDE[lvl]})`} fill={LEVEL_COLOR[lvl]} />
                        </g>
                      ) : (
                        <path d={padPath(compact ? 2 : 2.4 * Math.min(1.15, g.scale))} className="lg-pad" />
                      )}
                    </g>
                  );
                })}
              </g>
            ))}

            {selected !== null && cells[selected] && (
              <circle cx={cx(cells[selected]!)} cy={cy(cells[selected]!)} r={g.cell * 0.56} className="archive__selected" aria-hidden="true" />
            )}
            {kbd && cells[focusIdx] && (
              <rect
                x={cx(cells[focusIdx]!) - g.cell / 2}
                y={cy(cells[focusIdx]!) - g.cell / 2}
                width={g.cell}
                height={g.cell}
                className="archive__focus"
                aria-hidden="true"
              />
            )}
          </svg>

          {activeCell && (
            <div className="archive__tip" style={{ left: tipLeft, top: cy(activeCell) - g.cell * 0.9 }} aria-hidden="true">
              <span className="archive__tip-date">{formatDay(activeCell.day.date, 'short')}</span>
              <span className="archive__tip-count">
                {activeCell.day.count === 0 ? 'No launch' : pluralize(activeCell.day.count, 'contribution', 'contributions')}
              </span>
            </div>
          )}
        </div>
      </div>
      {compact && <p className="archive__hint label">Swipe to explore earlier weeks · tap a day</p>}
    </div>
  );
}

function Legend({ calendar }: { calendar: Calendar }) {
  const ranges = levelRanges(calendar.days);
  const range = (l: 1 | 2 | 3 | 4) => {
    const r = ranges[l];
    if (!r) return '—';
    return r.min === r.max ? fmt(r.min) : `${fmt(r.min)}–${fmt(r.max)}`;
  };
  return (
    <div className="archive__legend">
      <ul aria-label="Legend">
        <li>
          <svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true">
            <path d={padPath(2.4)} className="lg-pad" />
          </svg>
          <span>No activity</span>
        </li>
        {([1, 2, 3, 4] as const).map((l) => (
          <li key={l}>
            <svg width="18" height="22" viewBox="-9 -15 18 22" aria-hidden="true">
              <path d={rocketPath(l)} transform={`translate(0,${4.5 - ALTITUDE[l]})`} fill={LEVEL_COLOR[l]} />
            </svg>
            <span>
              Level {l} <b>{range(l)}</b>
            </span>
          </li>
        ))}
      </ul>
      <p className="label">Levels are GitHub's own quartiles for this period; ranges show the real counts observed.</p>
    </div>
  );
}

function Detail({ cell, calendar, weekTotal, username }: { cell: Cell | undefined; calendar: Calendar; weekTotal: number; username: string }) {
  if (!cell) {
    return (
      <div className="archive__detail archive__detail--empty" aria-live="polite">
        <p className="label">Launch log</p>
        <p>Select any day — click, tap, or use the arrow keys and Enter — to open its record.</p>
      </div>
    );
  }
  const { day } = cell;
  const streak = streakContaining(calendar.days, day.date);
  const pct = percentileOf(calendar.days, day.count);
  return (
    <div className="archive__detail" aria-live="polite">
      <p className="label label--cobalt">Launch log · {formatDay(day.date, 'short')}</p>
      <p className="archive__detail-count">
        <span>{fmt(day.count)}</span> {day.count === 1 ? 'contribution' : 'contributions'}
      </p>
      <dl className="archive__detail-facts">
        <div>
          <dt>Date</dt>
          <dd>{formatDay(day.date)}</dd>
        </div>
        <div>
          <dt>Intensity</dt>
          <dd>{day.count === 0 ? 'No activity' : `Level ${day.level} of 4`}</dd>
        </div>
        <div>
          <dt>That week</dt>
          <dd>{pluralize(weekTotal, 'contribution', 'contributions')}</dd>
        </div>
        {day.count > 0 && (
          <div>
            <dt>Rank</dt>
            <dd>{pct > 0 ? `Busier than ${pct}% of active days` : 'Among the quieter active days'}</dd>
          </div>
        )}
        {streak && (
          <div>
            <dt>Streak</dt>
            <dd>
              Day {streak.position} of {streak.streak.length} ({dateRange(streak.streak.start, streak.streak.end)})
            </dd>
          </div>
        )}
      </dl>
      <a className="btn" href={activityUrl(username, day.date)}>
        Open this day on GitHub ↗
      </a>
    </div>
  );
}
