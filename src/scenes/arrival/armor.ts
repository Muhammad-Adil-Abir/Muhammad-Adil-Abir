import {
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * The AETHER Frame — an original armored figure built procedurally.
 * Design signatures: a single horizontal visor line, a vertical sternum light,
 * and twin dorsal "Aether vanes" that give the silhouette its shape against the light.
 * Palette: titanium plates over a graphite under-structure with cobalt energy lines.
 */

export type JointName =
  | 'torso'
  | 'neck'
  | 'head'
  | 'shoulderL'
  | 'shoulderR'
  | 'elbowL'
  | 'elbowR'
  | 'wristL'
  | 'wristR'
  | 'hipL'
  | 'hipR'
  | 'kneeL'
  | 'kneeR'
  | 'ankleL'
  | 'ankleR';

export type Pose = Partial<Record<JointName, [number, number, number]>>;

const GLOW = new Color(0x4d82ff);

export function createArmorMaterials() {
  return {
    titanium: new MeshPhysicalMaterial({
      color: 0x7d848f,
      metalness: 1,
      roughness: 0.32,
      clearcoat: 0.55,
      clearcoatRoughness: 0.22,
      envMapIntensity: 1,
    }),
    plate: new MeshPhysicalMaterial({
      color: 0x2a2f37,
      metalness: 0.95,
      roughness: 0.36,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
    }),
    graphite: new MeshStandardMaterial({ color: 0x101216, metalness: 0.65, roughness: 0.6 }),
    glow: new MeshBasicMaterial({ color: GLOW.clone().multiplyScalar(0), toneMapped: false }),
    visor: new MeshBasicMaterial({ color: GLOW.clone().multiplyScalar(0), toneMapped: false }),
  };
}

type Mats = ReturnType<typeof createArmorMaterials>;

function mesh(
  geo: BufferGeometry,
  mat: Material,
  pos: [number, number, number] = [0, 0, 0],
  rot: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
) {
  const m = new Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  return m;
}

/** Tapered, slightly muscular limb hanging down from its joint (y = 0 to y = -length). */
function limb(rTop: number, rMid: number, rBottom: number, length: number, segments = 28) {
  const pts: Vector2[] = [
    new Vector2(0.001, 0),
    new Vector2(rTop * 0.75, -0.004),
    new Vector2(rTop, -length * 0.07),
    new Vector2(rMid, -length * 0.35),
    new Vector2((rMid + rBottom) / 2 + 0.004, -length * 0.62),
    new Vector2(rBottom, -length * 0.92),
    new Vector2(rBottom * 0.72, -length),
    new Vector2(0.001, -length),
  ];
  return new LatheGeometry(pts, segments);
}

const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, r);

function chestShape() {
  const s = new Shape();
  s.moveTo(-0.235, 0.12);
  s.lineTo(-0.07, 0.15);
  s.lineTo(0.07, 0.15);
  s.lineTo(0.235, 0.12);
  s.lineTo(0.215, -0.02);
  s.lineTo(0.09, -0.15);
  s.lineTo(-0.09, -0.15);
  s.lineTo(-0.215, -0.02);
  s.closePath();
  return new ExtrudeGeometry(s, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 3,
  });
}

function vaneShape() {
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(0.06, 0.02);
  s.lineTo(0.035, 0.5);
  s.lineTo(-0.004, 0.38);
  s.closePath();
  return new ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
}

export class ArmorFigure {
  readonly root = new Group();
  readonly pelvis = new Group();
  readonly joints = {} as Record<JointName, Group>;
  readonly materials: Mats;
  private contacts: Object3D[] = [];
  private tmp = new Vector3();

  constructor(materials: Mats = createArmorMaterials()) {
    this.materials = materials;
    const { titanium: ti, plate, graphite: gr, glow, visor } = materials;
    const J = (name: JointName, parent: Object3D, pos: [number, number, number]) => {
      const g = new Group();
      g.name = name;
      g.position.set(...pos);
      parent.add(g);
      this.joints[name] = g;
      return g;
    };
    const contact = (parent: Object3D, pos: [number, number, number]) => {
      const o = new Object3D();
      o.position.set(...pos);
      parent.add(o);
      this.contacts.push(o);
    };

    this.root.add(this.pelvis);
    this.pelvis.position.y = 1.06;

    // Pelvis
    this.pelvis.add(
      mesh(rbox(0.34, 0.16, 0.21, 0.05), gr),
      mesh(rbox(0.16, 0.12, 0.05, 0.02), ti, [0, -0.04, 0.1]),
      mesh(rbox(0.08, 0.17, 0.19, 0.03), plate, [-0.19, -0.03, 0], [0, 0, 0.16]),
      mesh(rbox(0.08, 0.17, 0.19, 0.03), plate, [0.19, -0.03, 0], [0, 0, -0.16]),
      mesh(rbox(0.012, 0.06, 0.012, 0.004), glow, [-0.235, -0.03, 0.04]),
      mesh(rbox(0.012, 0.06, 0.012, 0.004), glow, [0.235, -0.03, 0.04]),
    );

    // Torso
    const torso = J('torso', this.pelvis, [0, 0.06, 0]);
    torso.add(
      mesh(new CylinderGeometry(0.12, 0.13, 0.14, 24), gr, [0, 0.06, 0]),
      mesh(new SphereGeometry(0.16, 28, 20), gr, [0, 0.26, -0.005], [0, 0, 0], [1.12, 1.05, 0.72]),
      mesh(rbox(0.2, 0.06, 0.06, 0.02), ti, [0, 0.12, 0.095]),
      mesh(rbox(0.21, 0.06, 0.06, 0.02), ti, [0, 0.19, 0.1]),
      mesh(rbox(0.22, 0.06, 0.06, 0.02), ti, [0, 0.26, 0.105]),
      mesh(rbox(0.46, 0.27, 0.27, 0.09), gr, [0, 0.43, -0.01]),
      mesh(chestShape(), ti, [0, 0.43, 0.08]),
      mesh(rbox(0.012, 0.17, 0.012, 0.004), glow, [0, 0.41, 0.165]),
      mesh(rbox(0.38, 0.29, 0.06, 0.03), plate, [0, 0.43, -0.13]),
      mesh(new TorusGeometry(0.095, 0.03, 12, 32), gr, [0, 0.57, 0], [Math.PI / 2, 0, 0]),
    );

    // Dorsal Aether vanes
    for (const side of [-1, 1]) {
      const v = new Group();
      v.position.set(side * 0.1, 0.46, -0.16);
      v.rotation.set(-0.95, side * 0.25, side * -0.85);
      const blade = mesh(vaneShape(), plate, [0, 0, -0.007]);
      blade.scale.x = side;
      v.add(blade, mesh(rbox(0.007, 0.38, 0.007, 0.002), glow, [side * 0.036, 0.25, 0.012], [0, 0, side * -0.05]));
      torso.add(v);
    }

    // Neck + head
    const neck = J('neck', torso, [0, 0.585, 0]);
    neck.add(mesh(new CylinderGeometry(0.05, 0.06, 0.09, 20), gr, [0, 0.04, 0]));
    const head = J('head', neck, [0, 0.08, 0.01]);
    const visorArc = mesh(new TorusGeometry(0.119, 0.0065, 8, 48, Math.PI * 0.62), visor, [0, 0.118, 0], [Math.PI / 2, 0, Math.PI * 0.19]);
    head.add(
      mesh(new SphereGeometry(0.115, 36, 28), ti, [0, 0.12, 0], [0, 0, 0], [1, 1.18, 1.08]),
      mesh(rbox(0.175, 0.13, 0.07, 0.03), plate, [0, 0.088, 0.083]),
      mesh(rbox(0.06, 0.085, 0.11, 0.02), plate, [-0.085, 0.05, 0.03]),
      mesh(rbox(0.06, 0.085, 0.11, 0.02), plate, [0.085, 0.05, 0.03]),
      mesh(rbox(0.018, 0.05, 0.17, 0.008), ti, [0, 0.248, -0.01]),
      visorArc,
    );

    // Arms
    for (const [side, s] of [
      ['L', -1],
      ['R', 1],
    ] as const) {
      const shoulder = J(`shoulder${side}`, torso, [s * 0.255, 0.5, 0]);
      shoulder.add(
        mesh(new SphereGeometry(0.112, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), ti, [s * 0.02, 0.02, 0], [0, 0, s * -0.2], [1.15, 0.92, 1.02]),
        mesh(new TorusGeometry(0.107, 0.012, 8, 32), gr, [s * 0.015, 0.0, 0], [Math.PI / 2, s * -0.2, 0]),
        mesh(limb(0.064, 0.07, 0.054, 0.32), gr),
        mesh(rbox(0.05, 0.18, 0.1, 0.02), ti, [s * 0.056, -0.17, 0]),
      );
      const elbow = J(`elbow${side}`, shoulder, [0, -0.32, 0]);
      elbow.add(
        mesh(new SphereGeometry(0.056, 20, 14), gr),
        mesh(limb(0.058, 0.071, 0.05, 0.3), ti),
        mesh(new TorusGeometry(0.05, 0.0075, 8, 28), glow, [0, -0.272, 0], [Math.PI / 2, 0, 0]),
      );
      const wrist = J(`wrist${side}`, elbow, [0, -0.3, 0]);
      wrist.add(mesh(rbox(0.086, 0.115, 0.1, 0.03), gr, [0, -0.06, 0.005]), mesh(rbox(0.092, 0.035, 0.106, 0.012), ti, [0, -0.035, 0.008]));
      contact(wrist, [0, -0.12, 0]);
    }

    // Legs
    for (const [side, s] of [
      ['L', -1],
      ['R', 1],
    ] as const) {
      const hip = J(`hip${side}`, this.pelvis, [s * 0.11, -0.05, 0]);
      hip.add(mesh(limb(0.086, 0.092, 0.066, 0.46), ti), mesh(rbox(0.032, 0.23, 0.12, 0.012), plate, [s * 0.082, -0.2, 0]));
      const knee = J(`knee${side}`, hip, [0, -0.46, 0]);
      knee.add(
        mesh(new SphereGeometry(0.062, 20, 14), gr),
        mesh(rbox(0.105, 0.125, 0.06, 0.025), ti, [0, 0.0, 0.066]),
        mesh(limb(0.066, 0.076, 0.05, 0.45), ti),
        mesh(rbox(0.072, 0.3, 0.045, 0.018), plate, [0, -0.2, 0.06]),
        mesh(rbox(0.01, 0.08, 0.01, 0.003), glow, [s * 0.072, -0.22, -0.02]),
      );
      contact(knee, [0, -0.02, 0.095]);
      const ankle = J(`ankle${side}`, knee, [0, -0.46, 0]);
      ankle.add(
        mesh(new SphereGeometry(0.046, 16, 12), gr),
        mesh(rbox(0.11, 0.08, 0.25, 0.03), plate, [0, -0.05, 0.05]),
        mesh(rbox(0.106, 0.05, 0.085, 0.02), ti, [0, -0.064, 0.155]),
      );
      contact(ankle, [0, -0.09, -0.07]);
      contact(ankle, [0, -0.09, 0.18]);
    }
  }

  /** Writes a blend of two poses; `weight(name)` gives each joint its own progress for staggered motion. */
  blend(a: Pose, b: Pose, weight: (j: JointName) => number) {
    for (const name of Object.keys(this.joints) as JointName[]) {
      const ra = a[name] ?? [0, 0, 0];
      const rb = b[name] ?? [0, 0, 0];
      const w = weight(name);
      this.joints[name].rotation.set(ra[0] + (rb[0] - ra[0]) * w, ra[1] + (rb[1] - ra[1]) * w, ra[2] + (rb[2] - ra[2]) * w);
    }
  }

  /** Lowers or raises the pelvis so the lowest contact point rests exactly on the floor (y = 0). */
  plant() {
    this.pelvis.position.y = 1.06;
    this.root.updateMatrixWorld(true);
    const rootY = this.root.getWorldPosition(this.tmp).y;
    let min = Infinity;
    for (const c of this.contacts) min = Math.min(min, c.getWorldPosition(this.tmp).y - rootY);
    this.pelvis.position.y -= min;
  }

  setGlow(intensity: number) {
    this.materials.glow.color.copy(GLOW).multiplyScalar(intensity);
  }

  setVisor(intensity: number) {
    this.materials.visor.color.copy(GLOW).lerp(new Color(0xdfe8ff), 0.25).multiplyScalar(intensity);
  }
}

/** Landing: one knee down, one fist on the ground, head lowered. */
export const POSE_LANDING: Pose = {
  torso: [0.82, 0.05, 0.04],
  neck: [0.15, 0, 0],
  head: [0.42, -0.08, 0],
  hipL: [0.62, 0, -0.06],
  kneeL: [1.15, 0, 0],
  ankleL: [-0.3, 0, 0.06],
  hipR: [-1.38, 0.12, 0.12],
  kneeR: [2.38, 0, 0],
  ankleR: [-1.0, 0, -0.1],
  shoulderL: [-0.86, 0, -0.32],
  elbowL: [-0.12, 0, 0],
  wristL: [0.1, 0, 0],
  shoulderR: [-1.05, -0.2, 0.32],
  elbowR: [-0.85, 0, 0],
  wristR: [0.2, 0, 0],
};

/** Standing: grounded, open, ready. */
export const POSE_STANDING: Pose = {
  torso: [0.02, 0, 0],
  neck: [-0.02, 0, 0],
  head: [-0.07, 0.02, 0],
  hipL: [0.02, 0, -0.085],
  kneeL: [0.05, 0, 0],
  ankleL: [-0.07, 0, 0.085],
  hipR: [-0.03, 0, 0.085],
  kneeR: [0.06, 0, 0],
  ankleR: [-0.03, 0, -0.085],
  shoulderL: [0.06, 0, -0.13],
  elbowL: [-0.28, 0, 0],
  wristL: [0.05, 0, 0.05],
  shoulderR: [0.04, 0, 0.13],
  elbowR: [-0.3, 0, 0],
  wristR: [0.05, 0, -0.05],
};
