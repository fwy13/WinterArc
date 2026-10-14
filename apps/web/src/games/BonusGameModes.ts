import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { canReachPoint } from 'winterarc-gameplay';
import { AVALANCHE_FINISH, FROSTY_FINISH_Z, MELTDOWN_LAYERS, PALETTE } from 'winterarc-world';
import type { Motion } from 'winterarc-core';
import type { ShotEvent, Snapshot } from 'winterarc-protocol';
import type { GameMode, ModeContext } from './GameMode.js';

function syncVoxelDestruction(
  context: ModeContext,
  seen: Set<string>,
  broken: readonly string[],
  budget = 12,
): void {
  if (!broken.length) seen.clear();
  let remaining = budget;
  for (const entry of broken) {
    if (seen.has(entry)) continue;
    seen.add(entry);
    if (remaining > 0) {
      const [x, y, z] = entry.split(':').map(Number);
      const oldId = context.map.world.get(x, y, z);
      const color = PALETTE[oldId]?.[1] ?? '#78becb';
      if (y >= 2) {
        context.effects.burstDebris(x, y, z, color, 2);
        remaining--;
      }
    }
  }
  context.map.applyBrokenIce(broken);
}

/** 1. Boom Gift (Hot Potato): Renders pulsing 3D bomb-gifts above carriers + crater debris! */
export class BoomGiftMode implements GameMode {
  readonly id = 'boomgift' as const;
  private snapshot: Snapshot | null = null;
  private readonly root: TransformNode;
  private readonly markers = new Map<string, TransformNode>();
  private readonly seenBroken = new Set<string>();

  constructor(private readonly context: ModeContext) {
    this.root = new TransformNode('boomgift-root', context.meshes.scene);
  }

  private markerFor(id: string): TransformNode {
    let node = this.markers.get(id);
    if (node) return node;
    const m = this.context.meshes;
    node = new TransformNode(`bomb-gift-${id}`, m.scene);
    node.parent = this.root;
    m.cube(node, 'box', [0, 0, 0], [0.68, 0.68, 0.68], '#e63946', 0.45);
    m.cube(node, 'ribbon-x', [0, 0, 0], [0.72, 0.72, 0.16], '#ffd166', 0.6);
    m.cube(node, 'ribbon-z', [0, 0, 0], [0.16, 0.72, 0.72], '#ffd166', 0.6);
    m.cube(node, 'spark', [0, 0.48, 0], [0.22, 0.22, 0.22], '#fff3b0', 0.95);
    this.markers.set(id, node);
    return node;
  }

  sync(snapshot: Snapshot | null): void {
    this.snapshot = snapshot;
    syncVoxelDestruction(this.context, this.seenBroken, snapshot?.brokenIce ?? []);
  }

  render(dt: number, time: number): void {
    for (const marker of this.markers.values()) marker.setEnabled(false);
    const s = this.snapshot;
    if (!s || s.phase !== 'playing') return;
    const pulse = 1 + Math.sin(time * 14) * 0.16;
    for (const p of s.players) {
      if (p.out || p.observer || p.launchPower !== 1) continue;
      const marker = this.markerFor(p.id);
      marker.setEnabled(true);
      const yOffset = p.id === s.selfId ? 2.45 : 2.75;
      marker.position.set(p.x, p.y + yOffset + Math.sin(time * 8) * 0.08, p.z);
      marker.rotation.y += dt * 3.5;
      marker.scaling.setAll(pulse);
    }
  }

  interaction(): null {
    return null;
  }

  onShot(event: ShotEvent): void {
    this.context.effects.shot(event);
  }

  dispose(): void {
    this.root.dispose();
    this.markers.clear();
  }
}

/** 2. Multi-Layer Meltdown (Hex-A-Freeze): 4 stacked destructible floors with glowing rim rings. */
export class MeltdownMode implements GameMode {
  readonly id = 'meltdown' as const;
  private readonly root: TransformNode;
  private readonly rings: Mesh[] = [];
  private readonly seenBroken = new Set<string>();

  constructor(private readonly context: ModeContext) {
    this.root = new TransformNode('meltdown-root', context.meshes.scene);
    const colors = ['#7ce8ff', '#d0b6ff', '#91e5c5', '#ffd166'];
    MELTDOWN_LAYERS.forEach((y, idx) => {
      const ring = CreateTorus(
        `meltdown-ring-${idx}`,
        { diameter: 35, thickness: 0.12, tessellation: 64 },
        context.meshes.scene,
      );
      ring.parent = this.root;
      ring.position.y = y + 1.04;
      ring.material = context.meshes.material(colors[idx], 0.65);
      ring.isPickable = false;
      context.noa.rendering.addMeshToScene(ring);
      this.rings.push(ring);
    });
  }

  sync(snapshot: Snapshot | null): void {
    syncVoxelDestruction(this.context, this.seenBroken, snapshot?.brokenIce ?? [], 8);
  }

  render(_dt: number, time: number): void {
    this.rings.forEach((ring, i) => {
      ring.visibility = 0.65 + Math.sin(time * 4 + i) * 0.2;
    });
  }

  interaction(): null {
    return null;
  }

  onShot(event: ShotEvent): void {
    this.context.effects.shot(event);
  }

  dispose(): void {
    this.root.dispose();
  }
}

/** 3. Frosty Freeze (Red Light, Green Light): Giant rotating Snowman at z = 52 with scanning laser eyes! */
export class FrostyMode implements GameMode {
  readonly id = 'frosty' as const;
  private snapshot: Snapshot | null = null;
  private readonly root: TransformNode;
  private readonly snowman: TransformNode;
  private readonly eyes: Mesh[] = [];

  constructor(private readonly context: ModeContext) {
    const m = context.meshes;
    this.root = new TransformNode('frosty-root', m.scene);
    this.snowman = new TransformNode('giant-frosty', m.scene);
    this.snowman.parent = this.root;
    this.snowman.position.set(0, 3, 52);

    // Giant 8m tall Snowman sentinel.
    m.cube(this.snowman, 'base', [0, 1.4, 0], [3.4, 2.8, 3.0], '#f3f7ed');
    m.cube(this.snowman, 'torso', [0, 3.8, 0], [2.7, 2.2, 2.5], '#f3f7ed');
    m.cube(this.snowman, 'scarf', [0, 4.9, 0], [2.95, 0.45, 2.75], '#d74450', 0.35);
    m.cube(this.snowman, 'head', [0, 5.9, 0], [2.2, 2.0, 2.1], '#ffffff');
    m.cube(this.snowman, 'hat-brim', [0, 7.0, 0], [3.1, 0.35, 2.9], '#202b36');
    m.cube(this.snowman, 'hat-top', [0, 7.9, 0], [2.1, 1.5, 2.0], '#202b36');
    m.cube(this.snowman, 'nose', [0, 5.8, 1.35], [0.4, 0.4, 0.9], '#f77f00', 0.4);
    for (const sx of [-0.55, 0.55]) {
      const eye = m.cube(this.snowman, 'eye', [sx, 6.1, 1.08], [0.32, 0.32, 0.12], '#ff2a55', 0.95);
      this.eyes.push(eye);
    }
  }

  sync(snapshot: Snapshot | null): void {
    this.snapshot = snapshot;
  }

  interaction(pose: Motion): string | null {
    return pose.z >= FROSTY_FINISH_Z - 3.5 ? 'deliver' : null;
  }

  render(dt: number, time: number): void {
    const s = this.snapshot;
    const stage = s?.knockout.stage ?? 'green';
    const targetYaw = stage === 'red' ? Math.PI : stage === 'warn' ? Math.PI * 0.5 : 0;
    const rate = 1 - Math.exp(-10 * dt);
    this.snowman.rotation.y += (targetYaw - this.snowman.rotation.y) * rate;
    const eyeScale = stage === 'red' ? 1.35 + Math.sin(time * 24) * 0.25 : 0.75;
    for (const eye of this.eyes) eye.scaling.setAll(eyeScale);
  }

  onShot(event: ShotEvent): void {
    this.context.effects.shot(event);
  }

  dispose(): void {
    this.root.dispose();
  }
}

/** 4. Snowfort Siege: Destructible castles + glowing rotating Crystal Pine Star above each fort core. */
export class SnowfortMode implements GameMode {
  readonly id = 'snowfort' as const;
  private readonly root: TransformNode;
  private readonly stars: TransformNode[] = [];
  private readonly seenBroken = new Set<string>();

  constructor(private readonly context: ModeContext) {
    const m = context.meshes;
    this.root = new TransformNode('snowfort-root', m.scene);
    for (const [z, color] of [
      [-22, '#ff6b6b'],
      [22, '#64dfdf'],
    ] as const) {
      const star = new TransformNode(`fort-star-${z}`, m.scene);
      star.parent = this.root;
      star.position.set(0, 9.5, z);
      const box = m.cube(star, 'core-gem', [0, 0, 0], [1.1, 1.1, 1.1], color, 0.85);
      box.rotation.z = Math.PI / 4;
      box.rotation.x = Math.PI / 4;
      this.stars.push(star);
    }
  }

  sync(snapshot: Snapshot | null): void {
    syncVoxelDestruction(this.context, this.seenBroken, snapshot?.brokenIce ?? [], 16);
  }

  render(dt: number, time: number): void {
    this.stars.forEach((star, idx) => {
      star.rotation.y += dt * 2.2;
      star.position.y = 9.5 + Math.sin(time * 3 + idx) * 0.25;
    });
  }

  interaction(): null {
    return null;
  }

  onShot(event: ShotEvent): void {
    this.context.effects.shot(event);
  }

  dispose(): void {
    this.root.dispose();
  }
}

/** 5. Avalanche Escape: Renders the roaring 3D Snow Wave advancing behind racers + Sanctuary Beacon! */
export class AvalancheMode implements GameMode {
  readonly id = 'avalanche' as const;
  private snapshot: Snapshot | null = null;
  private readonly root: TransformNode;
  private readonly wave: TransformNode;
  private readonly beacon: TransformNode;
  private readonly seenBroken = new Set<string>();

  constructor(private readonly context: ModeContext) {
    const m = context.meshes;
    this.root = new TransformNode('avalanche-root', m.scene);
    this.wave = new TransformNode('avalanche-wave', m.scene);
    this.wave.parent = this.root;
    this.wave.position.set(0, 24, -74);

    // Towering 30m wide rolling snow wall.
    m.cube(this.wave, 'snow-wall', [0, 3.5, 0], [31, 8, 3.5], '#e4f2f7', 0.45);
    m.cube(this.wave, 'crest', [0, 7.8, 1.2], [31, 2.4, 2.8], '#ffffff', 0.75);

    this.beacon = new TransformNode('sanctuary-beacon', m.scene);
    this.beacon.parent = this.root;
    this.beacon.position.set(AVALANCHE_FINISH.x, AVALANCHE_FINISH.y + 2.5, AVALANCHE_FINISH.z);
    const gem = m.cube(this.beacon, 'beacon-star', [0, 0, 0], [1.2, 1.2, 0.35], '#ffd166', 0.85);
    gem.rotation.z = Math.PI / 4;
  }

  sync(snapshot: Snapshot | null): void {
    this.snapshot = snapshot;
    syncVoxelDestruction(this.context, this.seenBroken, snapshot?.brokenIce ?? [], 10);
  }

  interaction(pose: Motion): string | null {
    return canReachPoint(pose, AVALANCHE_FINISH.x, AVALANCHE_FINISH.y + 1, AVALANCHE_FINISH.z, AVALANCHE_FINISH.radius)
      ? 'deliver'
      : null;
  }

  render(dt: number, time: number): void {
    this.beacon.rotation.y += dt * 2;
    const z = this.snapshot?.ice.radius ?? -74;
    const y = z <= -35 ? 21 : z <= 2 ? 15 : 9;
    const rate = 1 - Math.exp(-12 * dt);
    this.wave.position.z += (z - this.wave.position.z) * rate;
    this.wave.position.y += (y - this.wave.position.y) * rate;
    this.wave.rotation.x = Math.sin(time * 10) * 0.08;
  }

  onShot(event: ShotEvent): void {
    this.context.effects.shot(event);
  }

  dispose(): void {
    this.root.dispose();
  }
}
