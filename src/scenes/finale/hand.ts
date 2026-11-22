import {
  Color,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * An original mechanical hand: segmented titanium phalanges on a graphite
 * skeleton, exposed knuckle axles, forearm pistons and cobalt circuit lines.
 * The palm carries the AETHER mark — an open "A" drawn in light.
 */

const GLOW = new Color(0x4d82ff);

function m(geo: BufferGeometry, mat: Material, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0]) {
  const x = new Mesh(geo, mat);
  x.position.set(...pos);
  x.rotation.set(...rot);
  return x;
}
const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, r);

interface Finger {
  joints: Group[];
  open: number[];
  closed: number[];
}

export class MechanicalHand {
  readonly root = new Group();
  readonly glow: MeshBasicMaterial;
  readonly mark: MeshBasicMaterial;
  private fingers: Finger[] = [];
  private thumbBase: Group;
  private thumb: Finger;

  constructor() {
    const ti = new MeshPhysicalMaterial({ color: 0xa3aab4, metalness: 1, roughness: 0.26, clearcoat: 0.6, clearcoatRoughness: 0.18 });
    const plate = new MeshPhysicalMaterial({ color: 0x2b3038, metalness: 0.95, roughness: 0.34, clearcoat: 0.4 });
    const gr = new MeshStandardMaterial({ color: 0x0f1115, metalness: 0.7, roughness: 0.55 });
    this.glow = new MeshBasicMaterial({ color: GLOW.clone().multiplyScalar(2.2), toneMapped: false });
    this.mark = new MeshBasicMaterial({ color: GLOW.clone().multiplyScalar(1.6), toneMapped: false });

    // Palm: a graphite core under three titanium plates with visible seams.
    const palm = new Group();
    palm.add(
      m(rbox(0.84, 0.9, 0.17, 0.06), gr),
      m(rbox(0.5, 0.62, 0.06, 0.03), ti, [-0.06, 0.08, 0.085]),
      m(rbox(0.22, 0.62, 0.06, 0.03), plate, [-0.3, 0.08, 0.075], [0, 0.08, 0]),
      m(rbox(0.3, 0.34, 0.07, 0.035), ti, [0.24, -0.24, 0.08], [0, -0.1, -0.2]),
      m(rbox(0.74, 0.12, 0.08, 0.035), plate, [0, 0.39, 0.06]),
      m(rbox(0.6, 0.7, 0.05, 0.03), plate, [0, 0.02, -0.095]),
    );
    // The AETHER mark: an open "A" — two strokes and a floating crossbar.
    const stroke = (x: number, rot: number) => m(rbox(0.018, 0.34, 0.01, 0.004), this.mark, [x, 0.06, 0.12], [0, 0, rot]);
    palm.add(stroke(-0.105, -0.34), stroke(0.045, 0.34), m(rbox(0.1, 0.016, 0.01, 0.004), this.mark, [-0.03, 0.01, 0.12]));
    this.root.add(palm);

    // Wrist and forearm with pistons.
    const forearm = new LatheGeometry(
      [
        [0.001, 0],
        [0.24, 0],
        [0.26, -0.3],
        [0.3, -1.2],
        [0.32, -2.6],
        [0.001, -2.6],
      ].map(([r, y]) => new Vector2(r, y)),
      40,
    );
    const wrist = new Group();
    wrist.position.y = -0.47;
    wrist.add(
      m(new CylinderGeometry(0.2, 0.22, 0.14, 32), gr, [0, -0.02, 0]),
      m(forearm, ti, [0, -0.12, 0]),
      m(new TorusGeometry(0.27, 0.02, 10, 48), gr, [0, -0.5, 0], [Math.PI / 2, 0, 0]),
      m(new TorusGeometry(0.29, 0.02, 10, 48), gr, [0, -0.9, 0], [Math.PI / 2, 0, 0]),
      m(new TorusGeometry(0.275, 0.006, 8, 48), this.glow, [0, -0.7, 0], [Math.PI / 2, 0, 0]),
    );
    for (const x of [-0.17, 0.17]) {
      wrist.add(m(new CylinderGeometry(0.022, 0.022, 0.55, 12), plate, [x, 0.05, 0.2]), m(new CylinderGeometry(0.032, 0.032, 0.3, 12), gr, [x, -0.32, 0.22]));
    }
    this.root.add(wrist);

    // Fingers (viewer's right to left): index, middle, ring, little.
    const specs: { x: number; y: number; len: [number, number, number]; splay: number }[] = [
      { x: 0.3, y: 0.44, len: [0.34, 0.23, 0.19], splay: -0.07 },
      { x: 0.1, y: 0.47, len: [0.38, 0.25, 0.2], splay: -0.02 },
      { x: -0.1, y: 0.45, len: [0.35, 0.24, 0.19], splay: 0.03 },
      { x: -0.3, y: 0.4, len: [0.28, 0.2, 0.17], splay: 0.09 },
    ];
    for (const s of specs) {
      const f = this.buildFinger(s.len, 0.15, ti, plate, gr);
      f.joints[0]!.position.set(s.x, s.y, 0.02);
      f.joints[0]!.rotation.z = s.splay;
      this.root.add(f.joints[0]!);
      f.open = [0.06, 0.08, 0.06];
      f.closed = [1.5, 1.62, 1.15];
      this.fingers.push(f);
    }

    // Thumb.
    this.thumbBase = new Group();
    this.thumbBase.position.set(0.42, -0.2, 0.04);
    this.root.add(this.thumbBase);
    this.thumb = this.buildFinger([0.28, 0.22, 0.18], 0.16, ti, plate, gr);
    this.thumbBase.add(this.thumb.joints[0]!);
    this.thumb.open = [0.15, 0.12, 0.1];
    this.thumb.closed = [0.9, 0.75, 0.6];
  }

  private buildFinger(len: [number, number, number], w: number, ti: Material, plate: Material, gr: Material): Finger {
    const joints: Group[] = [];
    let parent: Group | null = null;
    len.forEach((L, i) => {
      const j = new Group();
      if (parent) {
        j.position.y = len[i - 1]!;
        parent.add(j);
      }
      const wi = w * (1 - i * 0.07);
      j.add(
        m(new CylinderGeometry(0.055, 0.055, wi * 0.95, 18), gr, [0, 0, 0], [0, 0, Math.PI / 2]),
        m(rbox(wi, L * 0.9, 0.15, 0.04), i === 1 ? plate : ti, [0, L * 0.5, 0]),
        m(rbox(wi * 0.6, L * 0.5, 0.03, 0.012), gr, [0, L * 0.5, 0.075]),
        m(rbox(0.012, L * 0.42, 0.006, 0.003), this.glow, [0, L * 0.5, 0.092]),
      );
      if (i === 2) j.add(m(new SphereGeometry(wi * 0.5, 16, 12), ti, [0, L * 0.88, 0], [0, 0, 0]));
      joints.push(j);
      parent = j;
    });
    return { joints, open: [0, 0, 0], closed: [0, 0, 0] };
  }

  /** 0 = open, 1 = closed fist. Fingers close slightly out of phase like a real grip. */
  setClosure(c: number) {
    this.fingers.forEach((f, fi) => {
      const lag = fi * 0.05;
      f.joints.forEach((j, i) => {
        const k = Math.min(1, Math.max(0, (c - lag - i * 0.04) / (1 - lag - i * 0.04)));
        j.rotation.x = f.open[i]! + (f.closed[i]! - f.open[i]!) * k;
      });
    });
    const tc = Math.min(1, Math.max(0, (c - 0.18) / 0.82));
    this.thumbBase.rotation.set(0.2 + tc * 0.75, 0, -0.78 + tc * 1.05);
    this.thumb.joints.forEach((j, i) => {
      j.rotation.x = this.thumb.open[i]! + (this.thumb.closed[i]! - this.thumb.open[i]!) * tc;
    });
  }

  setGlow(v: number) {
    this.glow.color.copy(GLOW).multiplyScalar(v);
  }

  setMark(v: number) {
    this.mark.color.copy(GLOW).lerp(new Color(0xdfe8ff), 0.2).multiplyScalar(v);
  }
}
