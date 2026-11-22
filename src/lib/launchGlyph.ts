import type { Level } from './archive';

/**
 * The Launch Archive's visual vocabulary, shared by the website and the README SVG:
 *  - an empty day is a launch pad: a small cartographic crosshair
 *  - an active day is a vehicle on its pad; intensity raises altitude, size and glow
 */

export const LEVEL_COLOR: Record<Level, string> = {
  0: '#2a2f37',
  1: '#2148b8',
  2: '#3d7bff',
  3: '#8fb2ff',
  4: '#f3f7ff',
};

/** Height above the pad (px) — "higher counts fly higher". */
export const ALTITUDE: Record<Level, number> = { 0: 0, 1: 0.6, 2: 2.2, 3: 3.8, 4: 5.4 };

/** Vehicle silhouette with its base at (0, 0), nose pointing up. */
export function rocketPath(level: Level, scale = 1): string {
  const w = (3 + level * 0.25) * scale;
  const h = (4.6 + level * 1.35) * scale;
  const a = w / 2;
  const b = h * 0.6;
  const f = 1.05 * scale;
  const n = (v: number) => Math.round(v * 100) / 100;
  return `M${n(-a)},0L${n(-a)},${n(-b)}Q${n(-a)},${n(-h)} 0,${n(-h)}Q${n(a)},${n(-h)} ${n(a)},${n(-b)}L${n(a)},0L${n(a + f)},${n(f * 1.5)}L${n(-a - f)},${n(f * 1.5)}Z`;
}

/** Crosshair pad mark centred on (0, 0). */
export function padPath(size = 2.4): string {
  return `M${-size},0H${size}M0,${-size}V${size}`;
}

/** Smooth path through points (Catmull-Rom converted to cubic Béziers). */
export function smoothLine(points: [number, number][]): string {
  if (points.length < 2) return '';
  const n = (v: number) => Math.round(v * 10) / 10;
  let d = `M${n(points[0]![0])},${n(points[0]![1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${n(c1x)},${n(c1y)} ${n(c2x)},${n(c2y)} ${n(p2[0])},${n(p2[1])}`;
  }
  return d;
}
