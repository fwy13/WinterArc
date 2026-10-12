import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { Snapshot, ShotEvent } from 'winterarc-protocol';
import type { GameMode, ModeContext } from './GameMode.js';

export class IceBreakMode implements GameMode {
  readonly id: 'icebreak' | 'knockout';
  private readonly warning: Mesh;
  private snapshot: Snapshot | null = null;
  constructor(private readonly context: ModeContext, id: 'icebreak' | 'knockout' = 'icebreak') {
    this.id = id;
    this.warning = CreateTorus('ice-warning', { diameter: 2, thickness: 0.055, tessellation: 64 }, context.meshes.scene);
    this.warning.material = context.meshes.material('#ffbb65', 0.8);
    this.warning.position.y = 9.04;
    this.warning.isPickable = false;
    this.warning.setEnabled(false);
    context.noa.rendering.addMeshToScene(this.warning);
  }
  sync(snapshot: Snapshot | null): void {
    this.snapshot = snapshot;
    this.context.map.applyBrokenIce(snapshot?.brokenIce ?? []);
  }
  render(_dt: number, time: number): void {
    const s = this.snapshot;
    const show = s?.phase === 'playing' && s.ice.shrinkIn > 0 && s.ice.shrinkIn <= 3;
    this.warning.setEnabled(!!show);
    if (!s || !show) return;
    const radius = Math.max(0.1, s.ice.radius - 1.5);
    this.warning.scaling.set(radius, 1, radius);
    this.warning.visibility = 0.55 + Math.sin(time * 14) * 0.35;
  }
  interaction(): null { return null; }
  onShot(event: ShotEvent): void { this.context.effects.shot(event); }
  dispose(): void { this.warning.dispose(); }
}
