import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { Snapshot } from 'winterarc-protocol';
import type { Target, Motion } from 'winterarc-core';
import { canFind } from 'winterarc-gameplay';
import type { GameMode, ModeContext } from './GameMode.js';
interface Snowman {
  root: TransformNode;
  body: Mesh;
  scarf: Mesh;
  target: Target;
  found: boolean;
}
export class SnowHuntMode implements GameMode {
  readonly id = 'hunt' as const;
  private snowmen = new Map<string, Snowman>();
  constructor(private readonly context: ModeContext) {}
  sync(snapshot: Snapshot | null): void {
    const found = snapshot?.players.find((p) => p.id === snapshot.selfId)?.found || [],
      keep = new Set<string>();

    for (const t of snapshot?.targets || []) {
      keep.add(t.id);
      let s = this.snowmen.get(t.id);
      if (s && (s.target.x !== t.x || s.target.y !== t.y || s.target.z !== t.z)) {
        s.root.dispose();
        s = undefined;
      }
      if (!s) {
        s = this.create(t);
        this.snowmen.set(t.id, s);
      }
      const done = found.includes(t.id);
      if (done !== s.found) {
        s.found = done;
        s.scarf.material = this.context.meshes.material(done ? '#e8c16f' : '#ca626b');
        s.body.material = this.context.meshes.material(done ? '#cce9cf' : '#f3f7ed');
      }
    }
    for (const [id, s] of this.snowmen)
      if (!keep.has(id)) {
        s.root.dispose();
        this.snowmen.delete(id);
      }
  }
  interaction(pose: Motion): string | null {
    let id: string | null = null,
      best = Infinity;
    for (const s of this.snowmen.values()) {
      if (s.found || !canFind(pose, s.target, this.context.map.world)) continue;
      const d = Math.hypot(pose.x - s.target.x, pose.z - s.target.z);
      if (d < best) {
        best = d;
        id = s.target.id;
      }
    }
    return id;
  }
  render(): void {}
  onShot(): void {}
  private create(t: Target): Snowman {
    const m = this.context.meshes,
      root = new TransformNode(t.id, m.scene);
    root.position.set(t.x, t.y, t.z);
    root.rotation.y = (t.x * 0.41 + t.z * 0.13) % 6.28;
    const body = m.cube(root, 'base', [0, 0.45, 0], [1.05, 0.9, 0.9], '#f3f7ed');
    m.cube(root, 'torso', [0, 1.23, 0], [0.85, 0.68, 0.76], '#f3f7ed');
    m.cube(root, 'head', [0, 1.91, 0], [0.7, 0.66, 0.67], '#f3f7ed');
    m.cube(root, 'hat-brim', [0, 2.3, 0], [1.04, 0.16, 0.92], '#251e23');
    m.cube(root, 'hat-top', [0, 2.58, 0], [0.76, 0.44, 0.72], '#251e23');
    m.cube(root, 'hat-band', [0, 2.42, 0], [0.78, 0.1, 0.74], '#c02f3e');
    const scarf = m.cube(root, 'scarf', [0, 1.6, 0], [0.98, 0.17, 0.86], '#d53b49');
    m.cube(root, 'scarf-tail', [-0.17, 1.25, 0.43], [0.22, 0.65, 0.07], '#d53b49');
    for (const x of [-0.18, 0.18])
      m.cube(root, 'eye', [x, 2.02, 0.35], [0.09, 0.1, 0.025], '#241e27');
    m.cube(root, 'carrot', [0, 1.91, 0.48], [0.16, 0.12, 0.28], '#e98c24');
    for (const x of [-0.17, 0, 0.17])
      m.cube(root, 'smile', [x, 1.76 + Math.abs(x) * 0.3, 0.35], [0.085, 0.07, 0.025], '#241e27');
    for (const y of [0.25, 0.64, 1.12, 1.4])
      m.cube(root, 'button', [0, y, y < 0.9 ? 0.46 : 0.39], [0.12, 0.13, 0.025], '#241e27');
    for (const side of [-1, 1]) {
      const arm = m.cube(root, 'twig', [side * 0.7, 1.5, 0], [0.18, 0.95, 0.17], '#99512b');
      arm.rotation.z = side === -1 ? -0.65 : 0.65;
    }
    return { root, body, scarf, target: t, found: false };
  }
  dispose(): void {
    for (const s of this.snowmen.values()) s.root.dispose();
    this.snowmen.clear();
  }
}
