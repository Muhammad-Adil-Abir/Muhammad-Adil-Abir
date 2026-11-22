/**
 * SINGULARITY — a README banner where a black hole's accretion disk is built from
 * real contribution data: exactly one particle per day of the period, oldest days on
 * the outer edge spiralling in toward the newest at the event horizon.
 *
 * Quiet days are faint dust; active days burn brighter and larger by GitHub's level.
 * Pure SVG + CSS (GitHub renders README images through <img>: no scripts, no web fonts).
 * The disk is drawn twice — once behind the horizon and once, clipped, in front of it —
 * so the orbiting particles pass behind and in front of the black hole.
 */
import { computeStats, sortDays, type Level, type Snapshot } from '../../src/lib/archive';
import { esc } from './archive-svg';

export type SingularityPalette = 'ember' | 'cobalt';

interface Options {
  name: string;
  tagline: string;
  palette?: SingularityPalette;
}

const PALETTES = {
  ember: {
    hot: '#fff6ea',
    levels: { 1: '#ff9f5a', 2: '#ffb878', 3: '#ffd6a3', 4: '#fff6ea' } as Record<1 | 2 | 3 | 4, string>,
    dust: '#c98654',
    disk: ['#fff1dc', '#ffc07a', '#ff8a4c', '#7a3416'],
    ring: '#ffc58a',
    accent: '#ff8a4c',
  },
  cobalt: {
    hot: '#f3f7ff',
    levels: { 1: '#3d7bff', 2: '#6f9bff', 3: '#a9c6ff', 4: '#f3f7ff' } as Record<1 | 2 | 3 | 4, string>,
    dust: '#5a7fd1',
    disk: ['#eef4ff', '#a9c6ff', '#3d7bff', '#14265e'],
    ring: '#a9c6ff',
    accent: '#3d7bff',
  },
};

const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";
const SANS = "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const W = 1200;
const H = 560;
const CX = 600;
const CY = 236;
const TILT = -7; // degrees
const FLAT = 0.26; // disk seen nearly edge-on
const R_IN = 96;
const R_OUT = 470;
const HOLE = 58;
const BANDS = 10;

/** Deterministic 0–1 hash so the same day always lands in the same place. */
function hash(s: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const n1 = (v: number) => Math.round(v * 10) / 10;
const fmt = (v: number) => v.toLocaleString('en-US');

export function renderSingularitySvg(snapshot: Snapshot | null, opts: Options): string {
  const p = PALETTES[opts.palette ?? 'ember'];
  const calendar = snapshot?.calendars[0];
  const days = calendar ? sortDays(calendar.days) : [];
  const stats = computeStats(days);
  const user = snapshot?.username ?? '';

  // ---------------------------------------------------------------- particles (one per day)
  type P = { x: number; y: number; r: number; arc: string; band: number; level: Level; active: boolean };
  const particles: P[] = days.map((d, i) => {
    const t = days.length > 1 ? i / (days.length - 1) : 0;
    const radius = R_OUT * 0.97 - t * (R_OUT * 0.97 - R_IN * 1.12) + (hash(d.date, 1) - 0.5) * 26;
    const angle = i * 2.39996323 + (hash(d.date, 2) - 0.5) * 0.4; // golden-angle phyllotaxis
    const r = Math.max(R_IN, Math.min(R_OUT, radius));
    const active = d.count > 0;
    const level = (active && d.level === 0 ? 1 : d.level) as Level;
    // Trail behind the direction of travel; inner particles move faster, so their trails are longer.
    const trail = (active ? 0.16 + level * 0.03 : 0.05 + hash(d.date, 4) * 0.07) * (1.4 - (r - R_IN) / (R_OUT - R_IN) * 0.6);
    const a0 = angle - trail;
    const arc = `M${n1(Math.cos(a0) * r)} ${n1(Math.sin(a0) * r)}A${n1(r)} ${n1(r)} 0 0 1 ${n1(Math.cos(angle) * r)} ${n1(Math.sin(angle) * r)}`;
    return {
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      arc,
      r: active ? 2.4 + level * 1.5 : 1.3 + hash(d.date, 3) * 1.1,
      band: Math.min(BANDS - 1, Math.floor(((r - R_IN) / (R_OUT - R_IN)) * BANDS)),
      level,
      active,
    };
  });

  // Keplerian shear: inner bands orbit faster (period ∝ r^1.5).
  const period = (band: number) => {
    const rMid = R_IN + ((band + 0.5) / BANDS) * (R_OUT - R_IN);
    return Math.max(16, 150 * Math.pow(rMid / R_OUT, 1.5));
  };

  const bandMarkup = () => {
    let out = '';
    for (let b = 0; b < BANDS; b++) {
      const ps = particles.filter((q) => q.band === b);
      if (!ps.length) continue;
      const dust = ps
        .filter((q) => !q.active)
        .map((q) => `<path d="${q.arc}" stroke-width="${n1(q.r * 1.6)}"/>`)
        .join('');
      const lit = ps
        .filter((q) => q.active)
        .map((q) => {
          const c = p.levels[q.level as 1 | 2 | 3 | 4];
          return (
            `<path d="${q.arc}" stroke="${c}" stroke-width="${n1(q.r * 1.5)}" stroke-linecap="round" fill="none" opacity=".75"/>` +
            `<circle cx="${n1(q.x)}" cy="${n1(q.y)}" r="${n1(q.r * 2.4)}" fill="${c}" opacity=".28"/>` +
            `<circle cx="${n1(q.x)}" cy="${n1(q.y)}" r="${n1(q.r)}" fill="${p.hot}"/>`
          );
        })
        .join('');
      out += `<g class="s b${b}"><g class="dust">${dust}</g>${lit ? `<g filter="url(#glow)">${lit}</g>` : ''}</g>`;
    }
    return out;
  };

  // Decorative gas lanes (texture only — never counted as data).
  const lanes = Array.from({ length: 7 }, (_, k) => {
    const r = R_IN + 30 + k * ((R_OUT - R_IN - 60) / 6);
    const dash = `${n1(18 + hash(String(k), 9) * 60)} ${n1(30 + hash(String(k), 7) * 90)}`;
    return `<g class="s lane${k}"><circle r="${n1(r)}" fill="none" stroke="${p.disk[1]}" stroke-opacity="${n1(0.025 + (6 - k) * 0.006)}" stroke-width="${n1(3 + k * 0.6)}" stroke-dasharray="${dash}"/></g>`;
  }).join('');

  const disk = () =>
    `<g transform="translate(${CX} ${CY}) rotate(${TILT}) scale(1 ${FLAT})">` +
    `<circle r="${R_OUT}" fill="url(#body)"/>${lanes}${bandMarkup()}</g>`;

  // ---------------------------------------------------------------- starfield (decor)
  const stars = Array.from({ length: 150 }, (_, i) => {
    const x = hash(`${user}x${i}`) * W;
    const y = hash(`${user}y${i}`) * H;
    const r = 0.35 + hash(`${user}r${i}`) * 0.9;
    const tw = i % 9 === 0 ? ` class="tw" style="animation-delay:${n1(hash(String(i), 5) * 6)}s"` : '';
    return `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}"${tw} opacity="${n1(0.25 + hash(`${user}o${i}`) * 0.55)}"/>`;
  }).join('');

  const bandCss = Array.from({ length: BANDS }, (_, b) => `.b${b}{animation-duration:${n1(period(b))}s}`).join('');
  const laneCss = Array.from({ length: 7 }, (_, k) => {
    const r = R_IN + 30 + k * ((R_OUT - R_IN - 60) / 6);
    return `.lane${k}{animation-duration:${n1(Math.max(18, 150 * Math.pow(r / R_OUT, 1.5)) * 1.1)}s}`;
  }).join('');

  const style = `
    .s{transform-box:view-box;transform-origin:0 0;animation:spin linear infinite}
    ${bandCss}${laneCss}
    .dust{fill:none;stroke:${p.dust};stroke-linecap:round;opacity:.62}
    .tw{animation:tw 5s ease-in-out infinite}
    .fade{animation:fade 1.6s cubic-bezier(.16,1,.3,1) both}
    .d1{animation-delay:.35s}.d2{animation-delay:.7s}
    .m{font-family:${MONO};letter-spacing:.16em;text-transform:uppercase}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes tw{0%,100%{opacity:.15}50%{opacity:.95}}
    @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion: reduce){.s,.tw,.fade{animation:none}}`;

  const name = opts.name.toUpperCase();
  const statsLine = calendar
    ? `<tspan fill="${p.ring}">${fmt(stats.total)}</tspan> CONTRIBUTIONS  ·  <tspan fill="${p.ring}">${fmt(stats.activeDays)}</tspan> DAYS IN ORBIT  ·  LONGEST STREAK <tspan fill="${p.ring}">${stats.longestStreak?.length ?? 0}</tspan> ${stats.longestStreak?.length === 1 ? 'DAY' : 'DAYS'}`
    : 'AWAITING THE FIRST GITHUB SYNC — NO DATA SHOWN UNTIL THEN';
  const synced = snapshot?.generatedAt ? new Date(snapshot.generatedAt).toISOString().slice(0, 10) : '';

  const label = calendar
    ? `Singularity: a black hole whose accretion disk holds one particle for each of the ${days.length} days from ${calendar.from} to ${calendar.to}. ${opts.name} made ${fmt(stats.total)} contributions on ${fmt(stats.activeDays)} of those days.`
    : `Singularity: ${opts.name}'s accretion disk is waiting for the first GitHub sync.`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
<style>${style}</style>
<defs>
<radialGradient id="body"><stop offset=".19" stop-color="${p.disk[0]}" stop-opacity="0"/><stop offset=".22" stop-color="${p.disk[0]}" stop-opacity=".55"/><stop offset=".3" stop-color="${p.disk[1]}" stop-opacity=".42"/><stop offset=".5" stop-color="${p.disk[2]}" stop-opacity=".2"/><stop offset=".78" stop-color="${p.disk[3]}" stop-opacity=".08"/><stop offset="1" stop-color="${p.disk[3]}" stop-opacity="0"/></radialGradient>
<radialGradient id="halo"><stop offset=".3" stop-color="${p.disk[1]}" stop-opacity=".28"/><stop offset="1" stop-color="${p.disk[2]}" stop-opacity="0"/></radialGradient>
<radialGradient id="vig" cx=".5" cy=".42" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
<linearGradient id="ring" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.hot}"/><stop offset=".55" stop-color="${p.ring}"/><stop offset="1" stop-color="${p.accent}" stop-opacity=".5"/></linearGradient>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>
<clipPath id="front"><rect x="-200" y="${CY}" width="${W + 400}" height="${H}" transform="rotate(${TILT} ${CX} ${CY})"/></clipPath>
<clipPath id="back"><rect x="-200" y="${CY - H}" width="${W + 400}" height="${H}" transform="rotate(${TILT} ${CX} ${CY})"/></clipPath>
</defs>
<rect width="${W}" height="${H}" rx="10" fill="#040507"/>
<g fill="#dfe8ff">${stars}</g>
<circle cx="${CX}" cy="${CY}" r="190" fill="url(#halo)"/>
<g clip-path="url(#back)"><g class="fade">${disk()}</g></g>
<circle cx="${CX}" cy="${CY}" r="${HOLE + 24}" fill="none" stroke="${p.ring}" stroke-width="7" opacity=".35" filter="url(#soft)"/>
<circle cx="${CX}" cy="${CY}" r="${HOLE + 21}" fill="none" stroke="url(#ring)" stroke-width="2.6" opacity=".95"/>
<circle cx="${CX}" cy="${CY}" r="${HOLE}" fill="#000"/>
<circle cx="${CX}" cy="${CY}" r="${HOLE + 3}" fill="none" stroke="${p.hot}" stroke-width="1.4" opacity=".85"/>
<g clip-path="url(#front)"><g class="fade">${disk()}</g></g>
<rect width="${W}" height="${H}" rx="10" fill="url(#vig)"/>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="10" fill="none" stroke="#1d2128"/>
<text x="36" y="42" class="m" font-size="12" fill="#a9c6ff">Mission log <tspan fill="${p.accent}">//</tspan> Aether · Singularity</text>
<text x="${W - 36}" y="42" text-anchor="end" class="m" font-size="12" fill="#a9c6ff">${user ? `@${esc(user)}` : ''}${calendar ? ` <tspan fill="${p.accent}">·</tspan> ${esc(calendar.label)}` : ''}</text>
<g class="fade d1"><text x="${CX}" y="436" text-anchor="middle" font-family="${SANS}" font-size="50" font-weight="300" letter-spacing="17" fill="#eef1f5">${esc(name)}</text>
<text x="${CX}" y="470" text-anchor="middle" font-family="${SANS}" font-size="16" fill="#8d95a1" font-style="italic">${esc(opts.tagline)}</text></g>
<g class="fade d2"><line x1="${CX - 330}" x2="${CX + 330}" y1="498" y2="498" stroke="#1d2128"/>
<text x="${CX}" y="526" text-anchor="middle" class="m" font-size="12.5" fill="#c9ced6" xml:space="preserve">${statsLine}</text>
<text x="${W - 36}" y="${H - 18}" text-anchor="end" class="m" font-size="9.5" fill="#5d6570">One particle per day${synced ? ` · synced ${synced}` : ''}</text></g>
</svg>
`;
}
