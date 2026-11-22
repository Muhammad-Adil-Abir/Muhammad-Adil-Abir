import {
  AdditiveBlending,
  BufferAttribute,
  DataTexture,
  BufferGeometry,
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshStandardMaterial,
  NormalBlending,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector2,
} from 'three';
import { NOISE } from '../core/glsl';

export const PALETTE = {
  obsidian: new Color(0x050608),
  graphite: new Color(0x1a1d22),
  cobalt: new Color(0x2f66ff),
  ion: new Color(0xa9c6ff),
  hot: new Color(0xf3f7ff),
  ember: new Color(0xff8a4c),
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The great light behind the figure: core, halo, anamorphic streak and slowly turning rays. */
export function createBacklight() {
  const width = 74;
  const height = 42;
  const material = new ShaderMaterial({
    uniforms: {
      uIntensity: { value: 0 },
      uFlash: { value: 0 },
      uTime: { value: 0 },
      uCenter: { value: new Vector2(0.5, 0.45) },
      uAspect: { value: width / height },
      uCobalt: { value: PALETTE.cobalt },
      uIon: { value: PALETTE.ion },
      uHot: { value: PALETTE.hot },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      #define FBM_OCTAVES 2
      ${NOISE}
      uniform float uIntensity, uFlash, uTime, uAspect;
      uniform vec2 uCenter;
      uniform vec3 uCobalt, uIon, uHot;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - uCenter) * vec2(uAspect, 1.0);
        float d = length(p);
        float core = exp(-d * d * 220.0);
        float glow = exp(-d * 7.0);
        float halo = exp(-d * 1.7) * 0.32;
        float streak = exp(-abs(p.y) * 70.0) * exp(-abs(p.x) * 1.4);
        float ang = atan(p.y, p.x);
        float r = simplex3(vec3(cos(ang) * 3.2, sin(ang) * 3.2, uTime * 0.035)) * 0.5 + 0.5;
        float rays = pow(r, 3.5) * exp(-d * 1.9) * smoothstep(0.03, 0.3, d);
        vec3 col = uHot * core * 3.0
                 + mix(uCobalt, uIon, glow) * glow * 1.05
                 + uCobalt * halo * 0.75
                 + uIon * streak * 0.7
                 + mix(uCobalt, uIon, 0.4) * rays * 1.1;
        col *= uIntensity;
        col += mix(uIon, uHot, 0.5) * uFlash * exp(-d * 3.0) * 1.6;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const mesh = new Mesh(new PlaneGeometry(width, height), material);
  mesh.renderOrder = -10;
  return { mesh, material, width, height };
}

/** Light pool on the floor and its streak toward the camera. */
export function createGroundGlow() {
  const material = new ShaderMaterial({
    uniforms: { uIntensity: { value: 0 }, uCobalt: { value: PALETTE.cobalt }, uHot: { value: PALETTE.ion } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIntensity; uniform vec3 uCobalt, uHot; varying vec2 vUv;
      void main() {
        vec2 p = vUv - vec2(0.5, 0.5);
        float d = length(p * vec2(1.0, 0.42));
        float g = exp(-d * 6.5);
        float c = exp(-length(p * vec2(1.0, 0.3)) * 26.0);
        gl_FragColor = vec4((uCobalt * g * 0.75 + uHot * c * 0.8) * uIntensity, 1.0);
      }
    `,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const mesh = new Mesh(new PlaneGeometry(30, 30), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.004;
  return { mesh, material };
}

export function createGround() {
  // Radial alpha so the floor dissolves into the haze instead of ending at a hard horizon.
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x / (size - 1)) * 2 - 1;
      const dy = (y / (size - 1)) * 2 - 1;
      const r = Math.sqrt(dx * dx + dy * dy);
      const a = Math.max(0, Math.min(1, (0.95 - r) / 0.55));
      const v = Math.round(a * a * (3 - 2 * a) * 255);
      data.set([v, v, v, 255], (y * size + x) * 4);
    }
  }
  const alpha = new DataTexture(data, size, size);
  alpha.needsUpdate = true;
  // depthWrite off: floor-hugging smoke may dip below y = 0 without being cut by a hard edge.
  const material = new MeshStandardMaterial({ color: 0x08090b, roughness: 0.3, metalness: 0.85, alphaMap: alpha, transparent: true, depthWrite: false });
  const mesh = new Mesh(new PlaneGeometry(44, 44), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.z = -4;
  mesh.renderOrder = -5;
  return { mesh, material };
}

/**
 * Procedural smoke: camera-facing cards whose shape is fbm noise evolving over time.
 * Each card is lit by its screen-space distance to the light source, which reads as
 * light scattering through a volume at a fraction of the cost of ray marching.
 */
export function createSmoke(count: number, octaves: number) {
  const rand = rng(1337);
  type Card = { x: number; y: number; z: number; s: number; seed: number; a: number };
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) {
    const layer = i / count;
    if (layer < 0.42) cards.push({ x: (rand() - 0.5) * 26, y: 0.4 + rand() * 4.2, z: -15 + rand() * 10, s: 5 + rand() * 6, seed: rand(), a: 0.55 + rand() * 0.35 });
    else if (layer < 0.78) cards.push({ x: (rand() - 0.5) * 13, y: 0.3 + rand() * 1.7, z: -5 + rand() * 5.5, s: 2.6 + rand() * 3, seed: rand(), a: 0.32 + rand() * 0.28 });
    else cards.push({ x: (rand() - 0.5) * 10, y: 0.15 + rand() * 0.4, z: 1.2 + rand() * 3.6, s: 1.8 + rand() * 2.4, seed: rand(), a: 0.22 + rand() * 0.2 });
  }
  // Back to front so overlapping cards composite correctly.
  cards.sort((a, b) => a.z - b.z);

  const base = new PlaneGeometry(1, 1);
  const geo = new InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.setAttribute('uv', base.getAttribute('uv'));
  geo.setAttribute('aOffset', new InstancedBufferAttribute(new Float32Array(cards.flatMap((c) => [c.x, c.y, c.z])), 3));
  geo.setAttribute('aScale', new InstancedBufferAttribute(new Float32Array(cards.map((c) => c.s)), 1));
  geo.setAttribute('aSeed', new InstancedBufferAttribute(new Float32Array(cards.map((c) => c.seed)), 1));
  geo.setAttribute('aAlpha', new InstancedBufferAttribute(new Float32Array(cards.map((c) => c.a)), 1));
  geo.instanceCount = count;

  const material = new ShaderMaterial({
    defines: { FBM_OCTAVES: octaves },
    uniforms: {
      uTime: { value: 0 },
      uDensity: { value: 0 },
      uLight: { value: 0 },
      uFlash: { value: 0 },
      uAspect: { value: 1 },
      uLightPos: { value: new Vector2(0, 0.2) },
      uFlashPos: { value: new Vector2(0.2, 0.1) },
      uShadow: { value: new Color(0x07080b) },
      uLit: { value: new Color(0x4565ad) },
      uFlashColor: { value: new Color(0x9fb9ff) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aOffset; attribute float aScale, aSeed, aAlpha;
      uniform float uTime;
      varying vec2 vUv; varying float vSeed, vAlpha, vFront; varying vec2 vScreen;
      void main() {
        vec3 c = aOffset;
        vFront = smoothstep(-1.0, 1.5, aOffset.z);
        c.x += sin(uTime * 0.05 + aSeed * 12.0) * 0.8 + uTime * 0.035 * (aSeed - 0.35);
        c.y += sin(uTime * 0.07 + aSeed * 7.0) * 0.14;
        vec4 mv = modelViewMatrix * vec4(c, 1.0);
        float r = aSeed * 6.2831 + uTime * 0.02 * (aSeed - 0.5);
        vec2 q = vec2(position.x * cos(r) - position.y * sin(r), position.x * sin(r) + position.y * cos(r));
        mv.xy += q * aScale;
        gl_Position = projectionMatrix * mv;
        vUv = uv; vSeed = aSeed; vAlpha = aAlpha;
        vScreen = gl_Position.xy / gl_Position.w;
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uTime, uDensity, uLight, uFlash, uAspect;
      uniform vec2 uLightPos, uFlashPos;
      uniform vec3 uShadow, uLit, uFlashColor;
      varying vec2 vUv; varying float vSeed, vAlpha, vFront; varying vec2 vScreen;
      void main() {
        vec2 p = vUv - 0.5;
        float m = smoothstep(0.5, 0.06, length(p));
        float n = fbm(vec3(vUv * 2.1 + vSeed * 17.0, uTime * 0.025 + vSeed * 3.0)) * 0.5 + 0.5;
        float a = m * smoothstep(0.38, 0.95, n) * vAlpha * uDensity;
        if (a < 0.004) discard;
        float dl = length((vScreen - uLightPos) * vec2(uAspect, 1.0));
        // Smoke between the figure and the camera is backlit from behind: it stays dark, keeping the silhouette crisp.
        float lit = exp(-dl * 1.45) * uLight * mix(1.0, 0.28, vFront);
        float df = length((vScreen - uFlashPos) * vec2(uAspect, 1.0));
        vec3 col = mix(uShadow, uLit, clamp(lit, 0.0, 1.0)) * (0.22 + lit * 1.05);
        col += uFlashColor * uFlash * exp(-df * 2.6) * 1.1;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });
  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return { mesh, material, geometry: geo, count };
}

/** Drifting dust motes that catch the light. */
export function createDust(count: number) {
  const rand = rng(4242);
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * 20;
    pos[i * 3 + 1] = rand() * 5;
    pos[i * 3 + 2] = -10 + rand() * 15;
    seed[i] = rand();
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new BufferAttribute(seed, 1));
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 2.2 },
      uPixelRatio: { value: 1 },
      uLight: { value: 0 },
      uFlash: { value: 0 },
      uReveal: { value: 0 },
      uAspect: { value: 1 },
      uLightPos: { value: new Vector2(0, 0.2) },
      uFlashPos: { value: new Vector2(0.3, 0.1) },
      uColor: { value: new Color(0xc9d8ff) },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime, uSize, uPixelRatio, uLight, uFlash, uAspect;
      uniform vec2 uLightPos, uFlashPos;
      varying float vBright, vAlpha;
      void main() {
        vec3 p = position;
        p.x = mod(p.x + uTime * (0.025 + aSeed * 0.04) + sin(uTime * 0.11 * (0.5 + aSeed) + aSeed * 40.0) * 0.35 + 10.0, 20.0) - 10.0;
        p.y += sin(uTime * 0.07 + aSeed * 20.0) * 0.25;
        p.z += cos(uTime * 0.09 + aSeed * 30.0) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (0.35 + aSeed) * uPixelRatio * (9.0 / -mv.z);
        vec2 s = gl_Position.xy / gl_Position.w;
        float dl = length((s - uLightPos) * vec2(uAspect, 1.0));
        float df = length((s - uFlashPos) * vec2(uAspect, 1.0));
        vBright = exp(-dl * 2.1) * uLight * 1.8 + 0.06 + uFlash * exp(-df * 3.0) * 1.2;
        vAlpha = smoothstep(0.6, 2.6, -mv.z) * (0.4 + 0.6 * fract(aSeed * 13.7));
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uReveal;
      varying float vBright, vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha * uReveal;
        gl_FragColor = vec4(uColor * vBright * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 6;
  return { points, material, geometry: geo, count };
}
