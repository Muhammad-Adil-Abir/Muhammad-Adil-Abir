/**
 * Deterministic capture hooks, active only with ?capture=1.
 * scripts/capture-previews.ts seeks each sequence frame by frame and screenshots it,
 * which is how the README animation and posters are rendered from the real scenes.
 */
export interface CaptureTarget {
  duration: number;
  seek: (ms: number) => void;
}

declare global {
  interface Window {
    __aether?: Record<string, CaptureTarget>;
  }
}

export function registerCapture(name: string, target: CaptureTarget) {
  window.__aether = { ...(window.__aether ?? {}), [name]: target };
}

export function unregisterCapture(name: string) {
  if (window.__aether) delete window.__aether[name];
}
