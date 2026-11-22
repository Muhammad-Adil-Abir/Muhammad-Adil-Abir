import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { PROFILES, type Tier, type TierProfile } from './quality';

/** Film grain + vignette applied after tone mapping: the shared "lens" of every AETHER scene. */
const LensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.045 },
    uVignette: { value: 0.85 },
    uFade: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uFade;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 p = vUv - 0.5;
      float v = smoothstep(0.95, 0.2, length(p * vec2(1.0, 1.15)) * uVignette * 1.25);
      float g = (rand(vUv * vec2(1920.0, 1080.0) + fract(uTime * 0.37)) - 0.5) * uGrain;
      vec3 col = c.rgb * mix(1.0, v, 0.85) + g;
      gl_FragColor = vec4(col * uFade, 1.0);
    }
  `,
};

export interface StageOptions {
  bloom?: { strength: number; radius: number; threshold: number };
  exposure?: number;
  fov?: number;
  transparent?: boolean;
}

/**
 * Renderer, camera and post chain shared by the Arrival and the Final Protocol.
 * Owns adaptive quality: if frames are consistently slow it lowers resolution,
 * then switches off bloom, and tells the scene to shed particles.
 */
export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  profile: TierProfile;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private lens: ShaderPass | null = null;
  private bloomBase = { strength: 0.9, radius: 0.6, threshold: 0.8 };
  private dprScale = 1;
  private frameTimes: number[] = [];
  private width = 1;
  private height = 1;
  onDowngrade: ((p: TierProfile) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, tier: Tier, opts: StageOptions = {}) {
    this.profile = { ...PROFILES[tier] };
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: tier !== 'low',
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = opts.exposure ?? 1;
    this.renderer.setClearColor(0x030405, 1);
    this.camera = new PerspectiveCamera(opts.fov ?? 32, 1, 0.1, 200);
    if (opts.bloom) this.bloomBase = opts.bloom;
    this.buildComposer();
  }

  private buildComposer() {
    this.composer?.dispose();
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.profile.bloom) {
      this.bloom = new UnrealBloomPass(
        new Vector2(this.width, this.height),
        this.bloomBase.strength,
        this.bloomBase.radius,
        this.bloomBase.threshold,
      );
      composer.addPass(this.bloom);
    } else {
      this.bloom = null;
    }
    composer.addPass(new OutputPass());
    this.lens = new ShaderPass(LensShader);
    composer.addPass(this.lens);
    this.composer = composer;
    this.applySize();
  }

  get exposure() {
    return this.renderer.toneMappingExposure;
  }

  set exposure(v: number) {
    this.renderer.toneMappingExposure = v;
  }

  /** Multiplier on the base bloom strength (1 = resting). */
  setBloom(mult: number) {
    if (this.bloom) this.bloom.strength = this.bloomBase.strength * mult;
  }

  setFade(v: number) {
    if (this.lens) (this.lens.material as ShaderMaterial).uniforms.uFade!.value = v;
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.applySize();
  }

  private applySize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.profile.maxDpr) * this.dprScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.composer?.setPixelRatio(dpr);
    this.composer?.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  get aspect() {
    return this.width / this.height;
  }

  get pixelRatio() {
    return this.renderer.getPixelRatio();
  }

  render(timeSeconds: number, frameMs?: number) {
    if (this.lens) (this.lens.material as ShaderMaterial).uniforms.uTime!.value = timeSeconds;
    this.composer?.render();
    if (frameMs !== undefined) this.measure(frameMs);
  }

  private measure(ms: number) {
    this.frameTimes.push(ms);
    if (this.frameTimes.length < 90) return;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    this.frameTimes = [];
    if (median < 30) return;
    // Slow: step down one notch at a time.
    if (this.dprScale > 0.6) {
      this.dprScale = Math.max(0.6, this.dprScale - 0.2);
      this.applySize();
    } else if (this.profile.bloom) {
      this.profile = { ...this.profile, bloom: false };
      this.buildComposer();
    } else if (this.profile.tier !== 'low') {
      this.profile = { ...PROFILES.low };
      this.onDowngrade?.(this.profile);
    }
  }

  dispose() {
    this.composer?.dispose();
    this.scene.traverse((o) => {
      const m = o as unknown as { geometry?: { dispose(): void }; material?: { dispose(): void } | { dispose(): void }[] };
      m.geometry?.dispose();
      if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
      else m.material?.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
