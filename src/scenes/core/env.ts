import {
  BackSide,
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';

/**
 * A dark virtual studio used only for reflections: near-black walls, one soft
 * key panel behind and above, and thin cobalt strip lights at the sides.
 * Metal reflects mostly darkness with crisp light edges — the AETHER lighting language.
 */
export function createStudioEnvironment(renderer: WebGLRenderer): Texture {
  const scene = new Scene();
  const room = new Mesh(new BoxGeometry(20, 12, 20), new MeshBasicMaterial({ color: 0x030405, side: BackSide }));
  scene.add(room);

  const panel = (w: number, h: number, color: Color, pos: [number, number, number], rot: [number, number, number]) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color, side: 2 }));
    m.position.set(...pos);
    m.rotation.set(...rot);
    scene.add(m);
  };
  // Key: soft cool panel behind and above (the backlight's reflection).
  panel(8, 3, new Color(0xdfe8ff).multiplyScalar(3.2), [0, 4, -9.5], [0.3, 0, 0]);
  // Cobalt strips left and right: long, thin edge highlights.
  panel(0.25, 9, new Color(0x3d7bff).multiplyScalar(5), [-9.5, 1, -2], [0, Math.PI / 2, 0]);
  panel(0.25, 9, new Color(0x6f9bff).multiplyScalar(4), [9.5, 1, -3], [0, -Math.PI / 2, 0]);
  // A dim overhead and a faint floor bounce so tops and undersides are not pure black.
  panel(10, 10, new Color(0x1a2233).multiplyScalar(1.2), [0, 5.9, 0], [Math.PI / 2, 0, 0]);
  panel(14, 6, new Color(0x0d1220), [0, -5.9, 0], [-Math.PI / 2, 0, 0]);

  const pmrem = new PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.03).texture;
  pmrem.dispose();
  scene.traverse((o) => {
    const m = o as Mesh;
    m.geometry?.dispose();
    (m.material as MeshBasicMaterial | undefined)?.dispose();
  });
  return tex;
}
