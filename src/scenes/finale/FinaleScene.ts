import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DodecahedronGeometry,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Points,
  ShaderMaterial,
  SphereGeometry,
  TetrahedronGeometry,
  Vector3,
  type BufferGeometry as BG,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Stage } from '../core/stage';
import type { Tier } from '../core/quality';
import { MechanicalHand } from './hand';
import { FINALE } from './cues';
import { easeInCubic, easeInOutCubic, easeInOutSine, easeOutCubic, easeOutExpo, lerp, smoothstep, span } from '../../lib/motion';

const S = (ms: number) => ms / 1000;
const T = {
  emerge: S(FINALE.emerge),
  orbit: S(FINALE.orbit),
  converge: S(FINALE.converge),
  close: S(FINALE.close),
  pulse: S(FINALE.pulse),
  silence: S(FINALE.silence),
  end: S(FINALE.duration),
};

/** Five energy cores, each a different solid: a restrained cobalt-to-white family, never a rainbow. */
const CORE_SPECS: { geo: () => BG; color: number; radius: number; tilt: [number, number]; speed: number; phase: number }[] = [
  { geo: () => new OctahedronGeometry(0.1), color: 0x3d7bff, radius: 1.25, tilt: [0.35, 0.1], speed: 0.62, phase: 0 },
  { geo: () => new TetrahedronGeometry(0.11), color: 0xa9c6ff, radius: 1.55, tilt: [-0.5, 0.6], speed: -0.48, phase: 1.3 },
  { geo: () => new IcosahedronGeometry(0.095), color: 0xeaf1ff, radius: 1.1, tilt: [1.1, -0.3], speed: 0.74, phase: 2.6 },
  { geo: () => new DodecahedronGeometry(0.1), color: 0x5b8cff, radius: 1.8, tilt: [0.15, -0.9], speed: 0.4, phase: 3.9 },
  { geo: () => new OctahedronGeometry(0.085, 0), color: 0xc9d4e5, radius: 1.4, tilt: [-1.0, -0.2], speed: -0.66, phase: 5.1 },
];

interface Core {
  group: Group;
  solid: Mesh<BG, MeshBasicMaterial>;
  cage: LineSegments<EdgesGeometry, LineBasicMaterial>;
  ring: Line<BG, LineBasicMaterial>;
  orbit: Group;
  base: Color;
  spec: (typeof CORE_SPECS)[number];
}

export class FinaleScene {
  private stage: Stage;
  private hand = new MechanicalHand();
  private cores: Core[] = [];
  private center = new Vector3(0, 0.45, 0.62);
  private singularity: Mesh<SphereGeometry, MeshBasicMaterial>;
  private shell: Mesh<SphereGeometry, ShaderMaterial>;
  private ring: Mesh<PlaneGeometry, ShaderMaterial>;
  private motes: Points<BufferGeometry, ShaderMaterial>;
  private burst: Points<BufferGeometry, ShaderMaterial>;
  private pulseLight = new PointLight(0xdfe8ff, 0, 0, 2);
  private rimA = new DirectionalLight(0xa9c6ff, 0);
  private rimB = new DirectionalLight(0x3d7bff, 0);
  private key = new DirectionalLight(0xdfe6f2, 0);
  private env: Texture;
  private handPivot = new Group();

  constructor(canvas: HTMLCanvasElement, tier: Tier) {
    this.stage = new Stage(canvas, tier, { bloom: { strength: 0.75, radius: 0.55, threshold: 0.88 }, fov: 30, exposure: 0 });
    const { scene } = this.stage;
    const p = this.stage.profile;
    scene.background = new Color(0x020203);
    const pmrem = new PMREMGenerator(this.stage.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = this.env;
    scene.environmentIntensity = 0;

    this.handPivot.add(this.hand.root);
    this.hand.root.position.y = -0.1;
    scene.add(this.handPivot);

    for (const spec of CORE_SPECS) {
      const orbit = new Group();
      orbit.rotation.set(spec.tilt[0], 0, spec.tilt[1]);
      orbit.position.copy(this.center);
      const group = new Group();
      const base = new Color(spec.color);
      const solid = new Mesh(spec.geo(), new MeshBasicMaterial({ color: base.clone().multiplyScalar(3), toneMapped: false, transparent: true }));
      const cage = new LineSegments(
        new EdgesGeometry(spec.geo().scale(1.9, 1.9, 1.9)),
        new LineBasicMaterial({ color: base.clone().multiplyScalar(1.4), transparent: true, opacity: 0.8, toneMapped: false }),
      );
      group.add(solid, cage);
      const ringPts: Vector3[] = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        ringPts.push(new Vector3(Math.cos(a) * spec.radius, 0, Math.sin(a) * spec.radius));
      }
      const ring = new Line(
        new BufferGeometry().setFromPoints(ringPts),
        new LineBasicMaterial({ color: new Color(0x3d7bff), transparent: true, opacity: 0, depthWrite: false }),
      );
      orbit.add(ring, group);
      scene.add(orbit);
      this.cores.push({ group, solid, cage, ring, orbit, base, spec });
    }

    this.singularity = new Mesh(new SphereGeometry(0.12, 24, 16), new MeshBasicMaterial({ color: new Color(0xeaf1ff).multiplyScalar(3), toneMapped: false }));
    this.singularity.position.copy(this.center);
    scene.add(this.singularity);

    this.shell = new Mesh(
      new SphereGeometry(1, 48, 32),
      new ShaderMaterial({
        uniforms: { uAlpha: { value: 0 }, uColor: { value: new Color(0xa9c6ff) } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uAlpha; uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
          void main() {
            float f = pow(1.0 - abs(dot(vN, vV)), 2.4);
            gl_FragColor = vec4(uColor * f * uAlpha * 1.1, 1.0);
          }
        `,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.shell.position.copy(this.center);
    scene.add(this.shell);

    this.ring = new Mesh(
      new PlaneGeometry(1, 1),
      new ShaderMaterial({
        uniforms: { uRadius: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: new Color(0xdfe8ff) } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            mv.xy += position.xy * length(modelMatrix[0].xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uRadius, uAlpha; uniform vec3 uColor; varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            float r = exp(-pow((d - uRadius) / (0.015 + uRadius * 0.05), 2.0));
            gl_FragColor = vec4(uColor * r * uAlpha * 2.0, 1.0);
          }
        `,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.ring.position.copy(this.center);
    this.ring.scale.setScalar(14);
    scene.add(this.ring);

    this.motes = this.createMotes(Math.round(p.dust * 0.5));
    this.burst = this.createBurst(p.sparks);
    scene.add(this.motes, this.burst);

    this.pulseLight.position.copy(this.center);
    this.rimA.position.set(-3, 3, -4);
    this.rimB.position.set(4, -1, -3);
    this.key.position.set(2, 2.5, 5);
    scene.add(this.pulseLight, this.rimA, this.rimB, this.key);
  }

  private createMotes(count: number) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 1.2 + Math.random() * 4.5;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 5;
      pos[i * 3 + 2] = Math.sin(a) * r - 1;
      seed[i] = Math.random();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    const p = new Points(
      g,
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uPixelRatio: { value: 1 }, uColor: { value: new Color(0xa9c6ff) } },
        vertexShader: /* glsl */ `
          attribute float aSeed; uniform float uTime, uPixelRatio; varying float vA;
          void main() {
            vec3 p = position;
            float a = uTime * (0.04 + aSeed * 0.05);
            p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
            p.y += sin(uTime * 0.2 + aSeed * 30.0) * 0.15;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (1.2 + aSeed * 2.4) * uPixelRatio * (6.0 / -mv.z);
            vA = 0.35 + 0.65 * fract(aSeed * 7.3);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uAlpha; uniform vec3 uColor; varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d) * vA * uAlpha;
            gl_FragColor = vec4(uColor * a, a);
          }
        `,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    p.frustumCulled = false;
    return p;
  }

  private createBurst(count: number) {
    const dir = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const v = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      dir.set([v.x, v.y, v.z], i * 3);
      seed[i] = Math.random();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aDir', new BufferAttribute(dir, 3));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    const p = new Points(
      g,
      new ShaderMaterial({
        uniforms: { uAge: { value: -1 }, uPixelRatio: { value: 1 }, uCenter: { value: this.center } },
        vertexShader: /* glsl */ `
          attribute vec3 aDir; attribute float aSeed; uniform float uAge, uPixelRatio; uniform vec3 uCenter;
          varying float vL;
          void main() {
            float t = max(uAge, 0.0);
            float speed = 2.5 + aSeed * 6.0;
            vec3 p = uCenter + aDir * speed * (1.0 - exp(-2.2 * t)) / 2.2;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            vL = clamp(t / (1.0 + aSeed * 2.5), 0.0, 1.0);
            gl_PointSize = uAge < 0.0 ? 0.0 : (1.0 - vL) * (1.5 + aSeed * 3.0) * uPixelRatio * (8.0 / -mv.z);
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vL;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d) * (1.0 - vL);
            gl_FragColor = vec4(mix(vec3(0.95, 0.97, 1.0), vec3(0.24, 0.48, 1.0), vL) * a * 2.0, a);
          }
        `,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    p.frustumCulled = false;
    return p;
  }

  resize(width: number, height: number) {
    this.stage.resize(width, height);
    const pr = this.stage.pixelRatio;
    this.motes.material.uniforms.uPixelRatio!.value = pr;
    this.burst.material.uniforms.uPixelRatio!.value = pr;
  }

  /** seq: sequence seconds (clamped at the end); ambient: free-running seconds. */
  update(seq: number, ambient: number) {
    const t = Math.min(seq, T.end);
    const portrait = this.stage.aspect < 1;
    const pulseAge = t - T.pulse;

    // Exposure: emerge from darkness, then fall quiet after the pulse.
    const emerge = easeOutCubic(span(t, 0, 2));
    const quiet = smoothstep(T.silence, T.silence + 1.8, t);
    this.stage.exposure = lerp(0, 1, emerge) * lerp(1, 0.55, quiet);
    this.stage.setFade(smoothstep(0, 0.8, t));

    // Hand: turns toward the camera while the cores orbit, then grips.
    const closure = easeInOutCubic(span(t, T.close, T.pulse + 0.05));
    this.hand.setClosure(closure);
    this.handPivot.rotation.y = lerp(0.62, 0.12, easeInOutSine(span(t, 0, T.close))) + Math.sin(ambient * 0.25) * 0.02 * quiet;
    this.handPivot.rotation.x = lerp(-0.05, 0.06, easeInOutSine(span(t, 0, T.pulse)));
    this.hand.setGlow(lerp(0.6, 2.4, smoothstep(T.converge, T.pulse, t)) * lerp(1, 0.45, quiet) * (1 + Math.sin(ambient * 1.6) * 0.08 * quiet));
    this.hand.setMark(lerp(0.4, 2.2, smoothstep(T.orbit, T.converge, t)) * (1 - smoothstep(T.close, T.pulse, t) * 0.7));

    // Cores: orbit, then spiral inward and vanish into the grip.
    const conv = easeInCubic(span(t, T.converge, T.close + 0.55));
    const appear = smoothstep(T.emerge, T.orbit + 0.8, t);
    this.cores.forEach((c, i) => {
      const angle = c.spec.phase + ambient * c.spec.speed + conv * conv * 9 * Math.sign(c.spec.speed);
      const r = c.spec.radius * (1 - conv);
      c.group.position.set(Math.cos(angle) * r, Math.sin(ambient * 0.8 + i) * 0.04 * (1 - conv), Math.sin(angle) * r);
      c.group.rotation.set(ambient * (0.6 + i * 0.13), ambient * (0.4 + i * 0.17), 0);
      const scale = appear * (1 - smoothstep(0.75, 1, conv)) * (1 + conv * 0.5);
      c.group.scale.setScalar(Math.max(scale, 0.0001));
      c.group.visible = scale > 0.001;
      c.solid.material.color.copy(c.base).multiplyScalar(2.2 + conv * 1.8);
      c.cage.material.opacity = 0.75 * (1 - conv);
      c.ring.material.opacity = appear * 0.22 * (1 - smoothstep(0, 0.6, conv));
      // Rings flatten toward a shared plane as the cores converge.
      c.orbit.rotation.set(c.spec.tilt[0] * (1 - conv * 0.6), 0, c.spec.tilt[1] * (1 - conv * 0.6));
    });

    // Singularity: forms as the cores meet, held inside the fist until the pulse.
    const sing = smoothstep(T.close + 0.2, T.close + 0.7, t) * (1 - smoothstep(T.pulse, T.pulse + 0.25, t));
    this.singularity.scale.setScalar(Math.max(0.0001, sing * (1 + Math.sin(ambient * 30) * 0.08)));
    this.singularity.visible = sing > 0.001;

    // Pulse.
    const pa = pulseAge;
    const shellK = easeOutExpo(span(pa, 0, 1.6));
    this.shell.visible = pa > 0 && pa < 1.8;
    this.shell.scale.setScalar(0.2 + shellK * 7);
    this.shell.material.uniforms.uAlpha!.value = pa > 0 ? 1 - span(pa, 0.1, 1.6) : 0;
    this.ring.visible = pa > 0 && pa < 1.4;
    this.ring.material.uniforms.uRadius!.value = easeOutCubic(span(pa, 0, 1.3)) * 0.98;
    this.ring.material.uniforms.uAlpha!.value = pa > 0 ? 1 - span(pa, 0, 1.3) : 0;
    this.burst.material.uniforms.uAge!.value = pa;
    const energy = pa > 0 ? (pa < 0.05 ? pa / 0.05 : Math.exp(-(pa - 0.05) * 3.5)) : 0;
    const ember = smoothstep(T.pulse + 0.6, T.silence + 1.5, t) * (0.55 + Math.sin(ambient * 1.5) * 0.18);
    this.pulseLight.intensity = energy * 28 + sing * 5 + ember * 1.6;
    this.stage.setBloom(1 + energy * 0.6 + sing * 0.25);

    // Lights.
    this.rimA.intensity = emerge * 3.2 * lerp(1, 0.4, quiet);
    this.rimB.intensity = emerge * 2.2 * lerp(1, 0.5, quiet);
    this.key.intensity = emerge * 0.6 * lerp(1, 0.2, quiet);
    this.stage.scene.environmentIntensity = emerge * 0.28 * lerp(1, 0.35, quiet);

    // Motes slow almost to stillness in the silence.
    const mu = this.motes.material.uniforms;
    mu.uTime!.value = ambient * lerp(1, 0.25, quiet);
    mu.uAlpha!.value = emerge * lerp(1, 0.5, quiet) + energy * 0.5;

    // Camera: wide three-quarter view into a frontal close-up; eases back slightly in the silence.
    const cam = this.stage.camera;
    const k = easeInOutSine(span(t, 0, T.pulse));
    const back = easeOutCubic(quiet) * 0.6;
    const dist = (portrait ? 1.45 : 1) * (lerp(7.2, 3.7, k) + back);
    const sideX = portrait ? 0 : -0.95 - quiet * 0.95;
    cam.position.set(lerp(2.3, 0.45, k) + sideX * 0.4, lerp(0.5, 0.42, k), dist);
    const look = new Vector3(lerp(0.2, 0, k) + sideX * 0.5, (portrait ? -0.35 : 0.32) - quiet * 0.2, 0);
    if (pa > 0 && pa < 1.2) {
      const a = Math.exp(-pa * 4) * 0.03;
      cam.position.x += Math.sin(pa * 70) * a;
      cam.position.y += Math.sin(pa * 83) * a;
    }
    cam.lookAt(look);
  }

  render(ambient: number, frameMs?: number) {
    this.stage.render(ambient, frameMs);
  }

  dispose() {
    this.env.dispose();
    this.stage.dispose();
  }
}
