import { Color, DirectionalLight, FogExp2, HemisphereLight, Vector3, type Texture } from 'three';
import { Stage } from '../core/stage';
import { createStudioEnvironment } from '../core/env';
import type { Tier, TierProfile } from '../core/quality';
import { ArmorFigure, POSE_LANDING, POSE_STANDING, type JointName } from './armor';
import { createBacklight, createDust, createGround, createGroundGlow, createSmoke } from './atmosphere';
import { Ignition } from './ignition';
import { ARRIVAL } from './cues';
import { clamp01, easeInOutCubic, easeInOutSine, easeOutCubic, lerp, smoothstep, span } from '../../lib/motion';

const S = (ms: number) => ms / 1000;
const T = {
  reveal: S(ARRIVAL.reveal),
  backlight: S(ARRIVAL.backlight),
  visor: S(ARRIVAL.visor),
  ignite: S(ARRIVAL.ignite),
  rise: S(ARRIVAL.rise),
  end: S(ARRIVAL.duration),
};

/** Stagger for the rise: legs drive, torso follows, the head lifts last. */
function riseWeight(t: number) {
  return (j: JointName) => {
    const [a, b] = j.startsWith('hip') || j.startsWith('knee') || j.startsWith('ankle')
      ? [0, 0.8]
      : j === 'torso'
        ? [0.08, 0.88]
        : j === 'neck' || j === 'head'
          ? [0.3, 1]
          : [0.12, 0.92];
    return easeInOutCubic(span(t, a, b));
  };
}

export class ArrivalScene {
  private stage: Stage;
  private figure: ArmorFigure;
  private backlight = createBacklight();
  private groundGlow = createGroundGlow();
  private ground = createGround();
  private smoke: ReturnType<typeof createSmoke>;
  private dust: ReturnType<typeof createDust>;
  private ignition: Ignition;
  private env: Texture;
  private rimL = new DirectionalLight(0xa9c6ff, 0);
  private rimR = new DirectionalLight(0xe2eaff, 0);
  private hair = new DirectionalLight(0x3d7bff, 0);
  private fill = new DirectionalLight(0x7f8ba3, 0);
  private hemi = new HemisphereLight(0x1a2438, 0x000000, 0.1);
  private figureX = 0;
  private portrait = false;
  private lightWorld = new Vector3();
  private tmp = new Vector3();

  constructor(canvas: HTMLCanvasElement, tier: Tier) {
    this.stage = new Stage(canvas, tier, { bloom: { strength: 0.72, radius: 0.55, threshold: 0.9 }, fov: 30, exposure: 0 });
    const { scene } = this.stage;
    const p = this.stage.profile;
    scene.background = new Color(0x030405);
    scene.fog = new FogExp2(0x040507, 0.042);

    this.env = createStudioEnvironment(this.stage.renderer);
    scene.environment = this.env;
    scene.environmentIntensity = 0;

    this.figure = new ArmorFigure();
    scene.add(this.figure.root);

    this.backlight.mesh.position.set(0, 3, -24);
    scene.add(this.backlight.mesh);
    this.groundGlow.mesh.position.set(0, 0.004, -7);
    scene.add(this.ground.mesh, this.groundGlow.mesh);

    this.smoke = createSmoke(p.smoke, p.fbmOctaves);
    this.dust = createDust(p.dust);
    scene.add(this.smoke.mesh, this.dust.points);

    this.ignition = new Ignition(new Vector3(2.0, 1.05, -12), p.sparks, p.fbmOctaves);
    scene.add(this.ignition.group);
    this.ignition.attachFloorRing(scene);

    this.rimL.position.set(-4, 4, -6);
    this.rimR.position.set(5, 3, -7);
    this.hair.position.set(0, 7, -3);
    this.fill.position.set(2.5, 2, 8);
    for (const l of [this.rimL, this.rimR, this.hair, this.fill]) {
      l.target = this.figure.root;
      scene.add(l);
    }
    scene.add(this.hemi);

    this.stage.onDowngrade = (profile) => this.applyProfile(profile);
  }

  private applyProfile(p: TierProfile) {
    this.smoke.geometry.instanceCount = Math.min(this.smoke.count, p.smoke);
    this.dust.geometry.setDrawRange(0, Math.min(this.dust.count, p.dust));
  }

  resize(width: number, height: number) {
    this.stage.resize(width, height);
    const aspect = this.stage.aspect;
    this.portrait = aspect < 1;
    // Landscape: the figure stands right of centre so the title owns the left.
    this.figureX = aspect > 1.2 ? lerp(0.35, 1.15, clamp01((aspect - 1.2) / 0.65)) : 0;
    this.figure.root.position.x = this.figureX;
    const blastX = this.figureX + (this.portrait ? 1.5 : 2.1);
    this.ignition.group.position.x = blastX;
    this.ignition.origin.x = blastX;
    this.ignition.attachFloorRing(this.stage.scene);
    this.groundGlow.mesh.position.x = this.figureX * 0.6;
    // The light sits behind the figure's upper chest from the final camera position.
    this.lightWorld.set(this.figureX - 0.7, this.portrait ? 4.4 : 3.5, -24);
    this.backlight.mesh.position.x = this.figureX * 0.6;
    const uv = this.backlight.material.uniforms.uCenter!.value;
    uv.set(
      (this.lightWorld.x - this.backlight.mesh.position.x) / this.backlight.width + 0.5,
      (this.lightWorld.y - this.backlight.mesh.position.y) / this.backlight.height + 0.5,
    );
    const pr = this.stage.pixelRatio;
    this.dust.material.uniforms.uPixelRatio!.value = pr;
    this.ignition.setPixelRatio(pr);
    this.smoke.material.uniforms.uAspect!.value = aspect;
    this.dust.material.uniforms.uAspect!.value = aspect;
  }

  private screenOf(world: Vector3, out: { set(x: number, y: number): unknown }) {
    this.tmp.copy(world).project(this.stage.camera);
    out.set(this.tmp.x, this.tmp.y);
  }

  /**
   * @param seq sequence time in seconds (clamped to the end once settled)
   * @param ambient free-running time in seconds for smoke, dust and idle motion
   */
  update(seq: number, ambient: number) {
    const t = Math.min(seq, T.end);
    const settled = seq >= T.end;
    const age = t - T.ignite;

    // Exposure: from black to a low-key night.
    this.stage.exposure = lerp(0, 0.92, easeOutCubic(span(t, 0.15, 2.6)));
    this.stage.setFade(smoothstep(0, 0.9, t));

    // Figure pose: landing until the rise, then up.
    const rise = span(t, T.rise, T.rise + 1.7);
    this.figure.blend(POSE_LANDING, POSE_STANDING, riseWeight(rise));
    if (settled) {
      // Idle: breathing and a slow, alive head.
      const j = this.figure.joints;
      j.torso.rotation.x += Math.sin(ambient * 1.15) * 0.008;
      j.head.rotation.y += Math.sin(ambient * 0.23) * 0.06;
      j.head.rotation.x += Math.sin(ambient * 0.31 + 1) * 0.015;
    }
    this.figure.plant();

    // Energy lines.
    const visor = smoothstep(T.visor, T.visor + 0.3, t) * (t < T.visor + 0.45 ? 0.55 + 0.45 * Math.sin(t * 90) ** 2 : 1);
    this.figure.setVisor(visor * (5 + Math.sin(ambient * 2.1) * 0.4));
    this.figure.setGlow(smoothstep(T.ignite - 0.1, T.ignite + 1.2, t) * 3.2);

    // The light behind.
    const energy = this.ignition.update(age, ambient);
    const back = smoothstep(T.backlight, T.backlight + 2.2, t) * 0.85 * (1 + Math.sin(ambient * 0.6) * 0.04 * (settled ? 1 : 0));
    const bu = this.backlight.material.uniforms;
    bu.uIntensity!.value = back + energy * 0.12;
    bu.uFlash!.value = age > 0 ? Math.exp(-age * 3.5) * 0.18 : 0;
    bu.uTime!.value = ambient;
    this.groundGlow.material.uniforms.uIntensity!.value = back * 0.75 + energy * 0.2;

    // Lights: rims rise with the backlight, the event kicks everything, a faint fill reveals the armor.
    this.rimL.intensity = back * 3.4 + energy * 1.6;
    this.rimR.intensity = back * 2.6 + energy * 2.2;
    this.hair.intensity = back * 1.4;
    this.fill.intensity = smoothstep(T.ignite, T.ignite + 2.5, t) * 0.18;
    this.stage.scene.environmentIntensity = 0.15 + smoothstep(T.ignite - 0.2, T.ignite + 2, t) * 0.45 + energy * 0.25;
    this.stage.setBloom(1 + energy * 0.25);

    // Camera: a slow push from wide and low, ending on a heroic upward angle.
    const cam = this.stage.camera;
    const k = easeInOutSine(span(t, 0, T.end - 0.4));
    const dist = this.portrait ? 1 + (1 - this.stage.aspect) * 1.25 : 1;
    const lookX = this.figureX * (this.portrait ? 1 : 0.42);
    cam.position.set(lerp(lookX - 0.9, lookX + 0.15, k), lerp(0.62, 0.86, k), lerp(11.2, 6.7, k) * dist);
    const look = new Vector3(lookX, lerp(0.85, 1.15, easeInOutSine(span(t, T.rise, T.rise + 2))) - (this.portrait ? 0.55 : 0), 0);
    if (settled) {
      cam.position.x += Math.sin(ambient * 0.09) * 0.14;
      cam.position.y += Math.sin(ambient * 0.13) * 0.035;
    }
    // Event shake, decaying fast.
    if (age > 0 && age < 1.6) {
      const a = Math.exp(-age * 3.2) * 0.055;
      cam.position.x += Math.sin(age * 63) * a;
      cam.position.y += Math.sin(age * 71 + 1.3) * a * 0.8;
    }
    look.x += Math.sin(ambient * 0.7) * 0.004;
    look.y += Math.sin(ambient * 0.9) * 0.003;
    cam.lookAt(look);
    cam.updateMatrixWorld();

    // Screen-space anchors for the volumetric shaders.
    const su = this.smoke.material.uniforms;
    this.screenOf(this.lightWorld, su.uLightPos!.value);
    this.screenOf(this.ignition.origin, su.uFlashPos!.value);
    su.uTime!.value = ambient;
    su.uDensity!.value = smoothstep(0.2, 2.4, t) * 0.8;
    su.uLight!.value = back * 0.85 + energy * 0.12;
    su.uFlash!.value = energy * 0.16;
    const du = this.dust.material.uniforms;
    this.screenOf(this.lightWorld, du.uLightPos!.value);
    this.screenOf(this.ignition.origin, du.uFlashPos!.value);
    du.uTime!.value = ambient;
    du.uLight!.value = back + energy * 0.5;
    du.uFlash!.value = age > 0 ? Math.exp(-age * 2) * 0.6 : 0;
    du.uReveal!.value = smoothstep(T.reveal - 0.2, T.reveal + 1.4, t);
  }

  render(ambient: number, frameMs?: number) {
    this.stage.render(ambient, frameMs);
  }

  dispose() {
    this.env.dispose();
    this.stage.dispose();
  }
}
