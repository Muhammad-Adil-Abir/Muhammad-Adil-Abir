import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  PlaneGeometry,
  PointLight,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import { NOISE } from '../core/glsl';
import { PALETTE } from './atmosphere';
import { easeOutCubic, easeOutExpo, span } from '../../lib/motion';

const billboardVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec3 scale = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), 1.0);
    mv.xy += position.xy * scale.xy;
    gl_Position = projectionMatrix * mv;
  }
`;

/**
 * An original light event: a white-hot core that cools through ion blue into cobalt,
 * with a brief ember fringe, a shock ring, a floor ring and a spray of sparks.
 */
export class Ignition {
  readonly group = new Group();
  readonly light = new PointLight(0xe4ecff, 0, 22, 2);
  readonly origin: Vector3;
  private fireball: Mesh<IcosahedronGeometry, ShaderMaterial>;
  private flash: Mesh<PlaneGeometry, ShaderMaterial>;
  private shock: Mesh<PlaneGeometry, ShaderMaterial>;
  private floorRing: Mesh<PlaneGeometry, ShaderMaterial>;
  private sparks: Points<BufferGeometry, ShaderMaterial>;
  private beam: Mesh<PlaneGeometry, ShaderMaterial>;

  constructor(origin: Vector3, sparkCount: number, octaves: number) {
    this.origin = origin.clone();
    this.group.position.copy(origin);

    this.fireball = new Mesh(
      new IcosahedronGeometry(1, octaves > 2 ? 24 : 12),
      new ShaderMaterial({
        defines: { FBM_OCTAVES: octaves },
        uniforms: {
          uTime: { value: 0 },
          uAge: { value: 0 },
          uLife: { value: 3.2 },
          uHot: { value: PALETTE.hot },
          uIon: { value: PALETTE.ion },
          uCobalt: { value: PALETTE.cobalt },
          uEmber: { value: PALETTE.ember },
        },
        vertexShader: /* glsl */ `
          ${NOISE}
          uniform float uTime, uAge;
          varying float vHeat; varying vec3 vN; varying vec3 vV;
          void main() {
            float n = fbm(normal * 1.7 + vec3(0.0, -uAge * 0.9, uTime * 0.25));
            vHeat = n;
            vec3 p = position + normal * n * 0.42;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uAge, uLife;
          uniform vec3 uHot, uIon, uCobalt, uEmber;
          varying float vHeat; varying vec3 vN; varying vec3 vV;
          void main() {
            float life = clamp(uAge / uLife, 0.0, 1.0);
            float fres = pow(1.0 - abs(dot(vN, vV)), 1.6);
            float heat = clamp(vHeat * 0.95 + 0.62 - life * 1.0 - fres * 0.45, 0.0, 1.0);
            vec3 col = mix(uCobalt, uIon, smoothstep(0.15, 0.55, heat));
            col = mix(col, uHot, smoothstep(0.58, 0.95, heat));
            col = mix(col, uEmber, (1.0 - smoothstep(0.0, 0.28, life)) * smoothstep(0.5, 0.2, heat) * 0.55);
            float edge = pow(1.0 - fres, 2.2);
            float a = (1.0 - smoothstep(0.25, 1.0, life)) * (0.2 + heat * 0.6) * edge;
            gl_FragColor = vec4(col * (0.8 + heat * 2.2) * a, a);
          }
        `,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );

    this.flash = new Mesh(
      new PlaneGeometry(1, 1),
      new ShaderMaterial({
        uniforms: { uStrength: { value: 0 }, uColor: { value: PALETTE.hot } },
        vertexShader: billboardVertex,
        fragmentShader: /* glsl */ `
          uniform float uStrength; uniform vec3 uColor; varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            float g = (exp(-d * d * 9.0) * 2.0 + exp(-d * 3.2) * 0.45) * smoothstep(1.0, 0.6, d);
            gl_FragColor = vec4(uColor * g * uStrength, 1.0);
          }
        `,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.flash.scale.set(6, 6, 1);

    const ring = (inner: string) =>
      new ShaderMaterial({
        uniforms: { uRadius: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: PALETTE.ion } },
        vertexShader: inner,
        fragmentShader: /* glsl */ `
          uniform float uRadius, uAlpha; uniform vec3 uColor; varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            float w = 0.035 + uRadius * 0.06;
            float r = exp(-pow((d - uRadius) / w, 2.0)) * smoothstep(1.0, 0.9, d);
            gl_FragColor = vec4(uColor * r * uAlpha * 1.3, 1.0);
          }
        `,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });

    this.shock = new Mesh(new PlaneGeometry(1, 1), ring(billboardVertex));
    this.shock.scale.set(13, 13, 1);

    this.floorRing = new Mesh(
      new PlaneGeometry(1, 1),
      ring(/* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `),
    );
    this.floorRing.rotation.x = -Math.PI / 2;
    this.floorRing.scale.set(30, 30, 1);

    // Sparks: all motion is computed on the GPU from age, so they cost nothing on the CPU.
    const dir = new Float32Array(sparkCount * 3);
    const seed = new Float32Array(sparkCount);
    for (let i = 0; i < sparkCount; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(1 - Math.random() * 1.15);
      dir[i * 3] = Math.sin(v) * Math.cos(u);
      dir[i * 3 + 1] = Math.cos(v) * 0.9 + 0.15;
      dir[i * 3 + 2] = Math.sin(v) * Math.sin(u) * 0.7;
      seed[i] = Math.random();
    }
    const sg = new BufferGeometry();
    sg.setAttribute('position', new BufferAttribute(new Float32Array(sparkCount * 3), 3));
    sg.setAttribute('aDir', new BufferAttribute(dir, 3));
    sg.setAttribute('aSeed', new BufferAttribute(seed, 1));
    this.sparks = new Points(
      sg,
      new ShaderMaterial({
        uniforms: { uAge: { value: -1 }, uPixelRatio: { value: 1 }, uHot: { value: PALETTE.hot }, uCobalt: { value: PALETTE.cobalt } },
        vertexShader: /* glsl */ `
          attribute vec3 aDir; attribute float aSeed;
          uniform float uAge, uPixelRatio;
          varying float vLife;
          void main() {
            float speed = 4.0 + aSeed * 9.0;
            float k = 1.6;
            float t = max(uAge, 0.0);
            vec3 p = aDir * speed * (1.0 - exp(-k * t)) / k;
            p.y -= 1.4 * t * t;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            vLife = clamp(t / (1.2 + aSeed * 1.8), 0.0, 1.0);
            gl_PointSize = (1.0 - vLife) * (2.0 + aSeed * 3.0) * uPixelRatio * (14.0 / -mv.z);
            if (uAge < 0.0) gl_PointSize = 0.0;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uHot, uCobalt; varying float vLife;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d) * (1.0 - vLife);
            gl_FragColor = vec4(mix(uHot, uCobalt, vLife) * a * 2.2, a);
          }
        `,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.sparks.frustumCulled = false;

    this.light.position.y = 2.2;
    // The launch column: a cylindrical billboard that always faces the camera around its vertical axis.
    this.beam = new Mesh(
      new PlaneGeometry(1, 1, 1, 24),
      new ShaderMaterial({
        uniforms: { uHeight: { value: 0 }, uAlpha: { value: 0 }, uTime: { value: 0 }, uHot: { value: PALETTE.hot }, uIon: { value: PALETTE.ion }, uCobalt: { value: PALETTE.cobalt } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            vec3 toCam = cameraPosition - center; toCam.y = 0.0; toCam = normalize(toCam);
            vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
            vec3 scale = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), 1.0);
            vec3 world = center + right * position.x * scale.x + vec3(0.0, 1.0, 0.0) * (position.y + 0.5) * scale.y;
            gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uHeight, uAlpha, uTime; uniform vec3 uHot, uIon, uCobalt; varying vec2 vUv;
          void main() {
            float x = abs(vUv.x - 0.5) * 2.0;
            float core = exp(-x * x * 90.0);
            float sheath = exp(-x * 5.0);
            float head = smoothstep(uHeight, uHeight - 0.06, vUv.y);
            float base = 1.0 - smoothstep(0.0, 1.0, vUv.y) * 0.65;
            float flicker = 0.88 + 0.12 * sin(vUv.y * 60.0 - uTime * 40.0);
            vec3 col = uHot * core * 2.6 + mix(uCobalt, uIon, sheath) * sheath * 0.9;
            gl_FragColor = vec4(col * head * base * flicker * uAlpha * smoothstep(1.0, 0.85, x), 1.0);
          }
        `,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.beam.scale.set(0.9, 26, 1);
    this.beam.position.y = -1.05;
    this.beam.frustumCulled = false;
    this.beam.renderOrder = 1;

    this.light.position.y = 2.2;
    this.group.add(this.beam, this.fireball, this.flash, this.shock, this.sparks, this.light);
    this.fireball.renderOrder = 2;
    this.flash.renderOrder = 3;
  }

  /** Floor ring must live in world space at floor height under the blast. */
  attachFloorRing(parent: Group | Mesh | { add: (o: Mesh) => void }) {
    this.floorRing.position.set(this.origin.x, 0.01, this.origin.z);
    parent.add(this.floorRing);
  }

  setPixelRatio(pr: number) {
    this.sparks.material.uniforms.uPixelRatio!.value = pr;
  }

  /** age: seconds since ignition (negative = not yet). Returns the light energy for other systems. */
  update(age: number, time: number): number {
    const active = age >= 0;
    this.group.visible = active;
    this.floorRing.visible = active && age < 3;
    if (!active) {
      this.light.intensity = 0;
      return 0;
    }
    const fb = this.fireball.material.uniforms;
    fb.uAge!.value = age;
    fb.uTime!.value = time;
    const grow = easeOutExpo(span(age, 0, 1.8));
    this.fireball.scale.setScalar(0.2 + grow * 1.55);
    this.fireball.position.y = age * 0.32;
    this.fireball.visible = age < 3.4;

    const flash = age < 0.06 ? age / 0.06 : Math.exp(-(age - 0.06) * 4.2);
    this.flash.material.uniforms.uStrength!.value = flash * 0.55;
    this.flash.scale.setScalar(3.5 + grow * 3);

    const s = span(age, 0, 1.4);
    this.shock.material.uniforms.uRadius!.value = easeOutCubic(s) * 0.98;
    this.shock.material.uniforms.uAlpha!.value = (1 - s) * (age < 0.04 ? age / 0.04 : 1);
    this.shock.visible = age < 1.4;

    const f = span(age, 0.05, 2.6);
    this.floorRing.material.uniforms.uRadius!.value = easeOutCubic(f) * 0.98;
    this.floorRing.material.uniforms.uAlpha!.value = (1 - f) * 0.9;

    this.sparks.material.uniforms.uAge!.value = age;

    // Column: shoots up in ~0.5 s, holds, then thins and fades over a few seconds.
    const bu = this.beam.material.uniforms;
    bu.uHeight!.value = easeOutExpo(span(age, 0, 0.55)) * 1.06;
    bu.uAlpha!.value = (age < 0.05 ? age / 0.05 : 1) * (0.35 + 0.65 * Math.exp(-age * 1.1));
    bu.uTime!.value = time;
    this.beam.scale.x = 0.9 * (1 - span(age, 0.4, 4) * 0.55);

    // Light energy: sharp spike, long cooling tail, a faint remnant that never fully dies.
    const energy = flash * 1.0 + Math.exp(-age * 0.9) * 0.45 + 0.04;
    this.light.intensity = energy * 38;
    this.light.color.copy(PALETTE.hot).lerp(PALETTE.ion, Math.min(1, age * 0.6));
    return energy;
  }
}
