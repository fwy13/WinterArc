import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { canReachPoint } from 'winterarc-gameplay';
import { type Motion } from 'winterarc-core';
import { type Snapshot } from 'winterarc-protocol';
import type { GameMode, ModeContext } from './GameMode.js';
export class GiftRaceMode implements GameMode {
  readonly id = 'giftrace' as const;
  private readonly root: TransformNode;
  private readonly markers: TransformNode[] = [];
  private snapshot: Snapshot | null = null;
  constructor(private readonly context: ModeContext) {
    const m = context.meshes;
    this.root = new TransformNode('gift-race-decoration', m.scene);
    for (const point of context.map.world.race.checkpoints) {
      const marker = new TransformNode('checkpoint-star', m.scene);
      marker.parent = this.root;
      marker.position.set(point.x, point.y + 3, point.z);
      const star = m.cube(marker, 'star', [0, 0, 0], [0.8, 0.8, 0.2], '#ffdf7a', 0.7);
      star.rotation.z = Math.PI / 4;
      this.markers.push(marker);
    }
    const santa = new TransformNode('santa-finish', m.scene);
    santa.parent = this.root;
    const finish = context.map.world.race.finish;
    santa.position.set(finish.x, finish.y, finish.z);
    m.cube(santa, 'boots', [0, 0.2, 0], [1, 0.4, 0.7], '#202b36');
    m.cube(santa, 'coat', [0, 1, 0], [1.2, 1.4, 0.8], '#d74450');
    m.cube(santa, 'belt', [0, 0.8, 0], [1.23, 0.16, 0.83], '#202b36');
    m.cube(santa, 'head', [0, 2, 0], [0.85, 0.8, 0.8], '#f1c4a3');
    m.cube(santa, 'beard', [0, 1.75, -0.43], [0.88, 0.7, 0.15], '#fff3e6');
    m.cube(santa, 'hat', [0, 2.6, 0], [1, 0.4, 0.9], '#d74450');
    m.cube(santa, 'pom', [0.4, 2.9, 0], [0.3, 0.3, 0.3], '#fff3e6');
    for (const x of [-2, 2]) {
      m.cube(santa, 'gift', [x, 0.6, 0], [0.9, 1.2, 0.9], x < 0 ? '#7bd8b3' : '#d74450');
      m.cube(santa, 'ribbon', [x, 0.6, 0], [0.15, 1.24, 0.94], '#fff0bc');
    }
  }
  sync(snapshot: Snapshot | null): void {
    this.snapshot = snapshot;
  }
  interaction(pose: Motion): string | null {
    const me = this.snapshot?.players.find((p) => p.id === this.snapshot?.selfId);
    return me?.checkpoint === this.context.map.world.race.checkpoints.length && canReachPoint(pose, this.context.map.world.race.finish.x, this.context.map.world.race.finish.y + 1, this.context.map.world.race.finish.z, this.context.map.world.race.finish.radius)
      ? 'deliver'
      : null;
  }
  render(dt: number): void {
    const checkpoint = this.snapshot?.players.find(p => p.id === this.snapshot?.selfId)?.checkpoint ?? 0;
    this.markers.forEach((marker, index) => {
      marker.rotation.y += dt;
      marker.setEnabled(index >= checkpoint);
      marker.scaling.setAll(index === checkpoint ? 1.5 : 0.65);
    });
  }
  onShot(): void {}
  dispose(): void {
    this.root.dispose();
  }
}
