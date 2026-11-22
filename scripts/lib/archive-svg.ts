/**
 * Renders the Launch Archive as a self-contained SVG for the GitHub README.
 * GitHub shows README images through <img>, so this uses no JavaScript and no web fonts:
 * only inline CSS animation (disabled under prefers-reduced-motion) and system font stacks.
 */
import { computeStats, formatDay, layoutCalendar, type Level, type Snapshot } from '../../src/lib/archive';
import { ALTITUDE, padPath, rocketPath, smoothLine } from '../../src/lib/launchGlyph';

export type Theme = 'dark' | 'light';

const THEMES = {
  dark: {
    bg: '#06070a',
    panel: '#0b0d11',
    line: '#1d2128',
    text: '#eef1f5',
    sub: '#8d95a1',
    accent: '#a9c6ff',
    cobalt: '#3d7bff',
    pad: '#2a2f37',
    levels: { 0: '#2a2f37', 1: '#2148b8', 2: '#3d7bff', 3: '#8fb2ff', 4: '#f3f7ff' } as Record<Level, string>,
  },
  light: {
    bg: '#f6f7f9',
    panel: '#ffffff',
    line: '#e1e4e9',
    text: '#14171c',
    sub: '#5d6570',
    accent: '#1f47c9',
    cobalt: '#3d7bff',
    pad: '#c3c8d0',
    levels: { 0: '#c3c8d0', 1: '#9db7ff', 2: '#3d7bff', 3: '#1f47c9', 4: '#0b1e66' } as Record<Level, string>,
  },
};

const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const n = (v: number) => Math.round(v * 10) / 10;
const fmt = (v: number) => v.toLocaleString('en-US');

export function renderArchiveSvg(snapshot: Snapshot | null, theme: Theme): string {
  const t = THEMES[theme];
  const W = 880;
  const calendar = snapshot?.calendars[0];

  const style = `
    .m{font-family:${MONO};letter-spacing:.14em;text-transform:uppercase}
    .s{font-family:${SANS}}
    .v{animation:lift .9s cubic-bezier(.16,1,.3,1) both}
    .scan{animation:scan 2.6s cubic-bezier(.45,0,.55,1) .4s both}
    @keyframes lift{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
    @keyframes scan{0%{opacity:0;transform:translateX(0)}10%{opacity:.9}90%{opacity:.9}100%{opacity:0;transform:translateX(${W - 80}px)}}
    @media (prefers-reduced-motion: reduce){.v,.scan{animation:none}.scan{opacity:0}}`;

  if (!snapshot || !calendar || calendar.days.length === 0) {
    const H = 200;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="The Launch Archive — awaiting the first GitHub sync">
<style>${style}</style>
<rect width="${W}" height="${H}" rx="6" fill="${t.bg}"/>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="6" fill="none" stroke="${t.line}"/>
<text x="32" y="46" class="m" font-size="11" fill="${t.accent}">The Launch Archive</text>
<text x="32" y="104" class="s" font-size="22" font-weight="700" fill="${t.text}">Telemetry offline — awaiting the first GitHub sync.</text>
<text x="32" y="136" class="s" font-size="14" fill="${t.sub}">This panel is generated from real contribution data by a scheduled workflow. No data is shown until then.</text>
${[0, 1, 2].map((i) => `<path d="${padPath(3)}" transform="translate(${W - 120 + i * 30},46)" stroke="${t.pad}" stroke-width="1.3" fill="none"/>`).join('')}
</svg>
`;
  }

  const stats = computeStats(calendar.days);
  const { cells, weekCount, months, weekTotals } = layoutCalendar(calendar.days);
  const cell = Math.min(15, Math.floor((W - 80) / Math.max(weekCount, 1)));
  const left = 48;
  const tTop = 108;
  const tBottom = 150;
  const fieldTop = 178;
  const H = fieldTop + 7 * cell + 74;
  const cx = (w: number) => left + w * cell + cell / 2;
  const cy = (d: number) => fieldTop + d * cell + cell / 2;
  const maxWeek = Math.max(1, ...weekTotals);
  const pts = weekTotals.map((v, w) => [cx(w), tBottom - (v / maxWeek) * (tBottom - tTop)] as [number, number]);
  const thrust = smoothLine(pts);
  const area = pts.length ? `${thrust}L${n(pts[pts.length - 1]![0])},${tBottom}L${n(pts[0]![0])},${tBottom}Z` : '';
  const scale = cell / 17;

  const glyphs = cells
    .map((c) => {
      const x = n(cx(c.week));
      const y = n(cy(c.weekday));
      if (c.day.count === 0) {
        return `<path d="${padPath(2.2 * scale + 0.2)}" transform="translate(${x},${y})" stroke="${t.pad}" stroke-width="1" fill="none"/>`;
      }
      const L = (c.day.level === 0 ? 1 : c.day.level) as Level;
      const base = 4 * scale;
      const alt = ALTITUDE[L] * scale;
      const col = t.levels[L];
      const glow = L >= 3 ? `<circle cy="${n(base)}" r="${n((2.4 + L) * scale)}" fill="${col}" opacity=".3" filter="url(#g)"/>` : '';
      return `<g transform="translate(${x},${y})"><g class="v" style="animation-delay:${c.week * 18}ms">${glow}<path d="M0,${n(base)}V${n(base - alt)}" stroke="${col}" stroke-opacity=".45" stroke-width="1"/><path d="${rocketPath(L, scale)}" transform="translate(0,${n(base - alt)})" fill="${col}"/></g></g>`;
    })
    .join('\n');

  const monthLabels = months
    .map((m) => `<text x="${n(left + m.week * cell)}" y="${fieldTop - 8}" class="m" font-size="9" fill="${t.sub}">${m.label}</text>`)
    .join('');
  const weekdays = [
    [1, 'MON'],
    [3, 'WED'],
    [5, 'FRI'],
  ]
    .map(([r, l]) => `<text x="${left - 10}" y="${n(cy(r as number) + 3)}" text-anchor="end" class="m" font-size="8.5" fill="${t.sub}">${l}</text>`)
    .join('');

  const statItems: [string, string][] = [
    ['Contributions', fmt(stats.total)],
    ['Active days', fmt(stats.activeDays)],
    ['Longest streak', stats.longestStreak ? `${stats.longestStreak.length} d` : '—'],
    ['Current streak', stats.currentStreak ? `${stats.currentStreak.length} d` : '0 d'],
    ['Peak day', stats.peak ? fmt(stats.peak.count) : '—'],
  ];
  const colW = (W - 64) / statItems.length;
  const statSvg = statItems
    .map(
      ([label, value], i) =>
        `<text x="${n(32 + i * colW)}" y="62" class="m" font-size="9" fill="${t.sub}">${esc(label)}</text><text x="${n(32 + i * colW)}" y="84" class="s" font-size="20" font-weight="700" fill="${t.text}">${esc(value)}</text>`,
    )
    .join('');

  const legendY = H - 30;
  const legend = ([0, 1, 2, 3, 4] as Level[])
    .map((L, i) => {
      const x = 32 + i * 34;
      return L === 0
        ? `<path d="${padPath(2.4)}" transform="translate(${x + 6},${legendY})" stroke="${t.pad}" stroke-width="1" fill="none"/>`
        : `<path d="${rocketPath(L, 0.9)}" transform="translate(${x + 6},${legendY + 4 - ALTITUDE[L] * 0.6})" fill="${t.levels[L]}"/>`;
    })
    .join('');
  const synced = snapshot.generatedAt ? new Date(snapshot.generatedAt).toISOString().slice(0, 10) : 'unknown';
  const period = `${formatDay(calendar.from, 'short')} – ${formatDay(calendar.to, 'short')}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(
    `The Launch Archive: ${fmt(stats.total)} GitHub contributions by @${snapshot.username} across ${fmt(stats.activeDays)} active days, ${period}`,
  )}">
<style>${style}</style>
<defs>
<linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.cobalt}" stop-opacity=".32"/><stop offset="1" stop-color="${t.cobalt}" stop-opacity="0"/></linearGradient>
<linearGradient id="sc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.cobalt}" stop-opacity="0"/><stop offset="1" stop-color="${t.cobalt}" stop-opacity=".55"/></linearGradient>
<filter id="g" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="1.6"/></filter>
</defs>
<rect width="${W}" height="${H}" rx="6" fill="${t.bg}"/>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="6" fill="none" stroke="${t.line}"/>
<path d="M1 14V1h13M${W - 1} ${H - 14}V${H - 1}h-13" fill="none" stroke="${t.cobalt}"/>
<text x="32" y="34" class="m" font-size="10.5" fill="${t.accent}">The Launch Archive</text>
<text x="${W - 32}" y="34" text-anchor="end" class="m" font-size="10" fill="${t.sub}">@${esc(snapshot.username)} · ${esc(calendar.label)}</text>
${statSvg}
<line x1="${left}" x2="${W - 32}" y1="${tBottom}" y2="${tBottom}" stroke="${t.line}"/>
<path d="${area}" fill="url(#a)"/>
<path d="${thrust}" fill="none" stroke="${t.accent}" stroke-width="1.2"/>
${monthLabels}${weekdays}
${glyphs}
<rect class="scan" x="${left - 40}" y="${fieldTop - 4}" width="40" height="${7 * cell + 8}" fill="url(#sc)" opacity="0"/>
${legend}
<text x="${32 + 5 * 34 + 8}" y="${legendY + 3}" class="m" font-size="8.5" fill="${t.sub}">No activity → peak · GitHub quartiles</text>
<text x="${W - 32}" y="${legendY + 3}" text-anchor="end" class="m" font-size="8.5" fill="${t.sub}">${esc(period)} · synced ${synced}</text>
</svg>
`;
}
