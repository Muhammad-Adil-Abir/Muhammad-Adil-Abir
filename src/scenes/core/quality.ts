export type Tier = 'high' | 'medium' | 'low';

export interface TierProfile {
  tier: Tier;
  maxDpr: number;
  bloom: boolean;
  smoke: number;
  dust: number;
  sparks: number;
  fbmOctaves: number;
}

export const PROFILES: Record<Tier, TierProfile> = {
  high: { tier: 'high', maxDpr: 1.75, bloom: true, smoke: 84, dust: 2200, sparks: 700, fbmOctaves: 4 },
  medium: { tier: 'medium', maxDpr: 1.25, bloom: true, smoke: 52, dust: 1200, sparks: 420, fbmOctaves: 3 },
  low: { tier: 'low', maxDpr: 1, bloom: false, smoke: 30, dust: 500, sparks: 200, fbmOctaves: 2 },
};

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Chooses a starting quality tier from cheap signals. The stage then adapts at
 * runtime from measured frame times, so this only has to be a sensible guess.
 */
export function detectTier(): Tier {
  const forced = new URLSearchParams(window.location.search).get('quality');
  if (forced === 'high' || forced === 'medium' || forced === 'low') return forced;

  let renderer = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  } catch {
    /* ignore */
  }
  if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return 'low';

  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 8;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;

  if (cores <= 2 || memory <= 2) return 'low';
  if (coarse || small || cores <= 4 || memory <= 4) return 'medium';
  return 'high';
}
