/**
 * AETHER motion language. CSS mirrors these values in tokens.css.
 * - cinematic: long, decelerating reveals (camera moves, titles)
 * - ignite: accelerating build-ups that end in an event
 * - drift: symmetrical ambient motion (smoke, idle camera)
 * - settle: UI responses
 */
export const EASE = {
  cinematic: 'cubic-bezier(0.16, 1, 0.3, 1)',
  ignite: 'cubic-bezier(0.7, 0, 0.84, 0)',
  drift: 'cubic-bezier(0.45, 0, 0.55, 1)',
  settle: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 before `a`, 1 after `b`, linear in between. */
export const span = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = span(x, a, b);
  return t * t * (3 - 2 * t);
};

export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInExpo = (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
