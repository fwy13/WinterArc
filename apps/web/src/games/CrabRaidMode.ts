import { t } from '../i18n';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import type { AssetContainer } from '@babylonjs/core/assetContainer.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { BossSnapshot, Snapshot, ShotEvent } from 'winterarc-protocol';
import type { DangerZone } from 'winterarc-core';
import type { GameMode, ModeContext } from './GameMode.js';
interface Telegraph {
  root: TransformNode;
  fill: Mesh;
  zone: DangerZone;
  material: StandardMaterial;
}
export class CrabRaidMode implements GameMode {
  readonly id = 'crab' as const;
  private root: TransformNode;
  private container: AssetContainer | null = null;
  private limbs: {
    node: TransformNode;
    base: number;
    index: number;
    claw: boolean;
  }[] = [];
  private zones = new Map<string, Telegraph>();
  private boss: BossSnapshot = {
    x: 0,
    y: 3,
    z: 0,
    yaw: Math.PI,
    hp: 1800,
    maxHp: 1800,
    stage: 1,
    action: 'idle',
    flash: 0,
    progress: 0,
    shockRadius: 0,
    impactSerial: 0,
  };
  private disposed = false;
  private lastFlash = 0;
  private flashTime = 0;
  private shockwave: Mesh;
  private lastImpact = 0;
  private impactTime = 0;
  constructor(private readonly context: ModeContext) {
    this.root = new TransformNode('boss-controller', context.meshes.scene);
    this.root.position.set(0, 3, 0);
    this.shockwave = CreateTorus(
      'crab-shockwave',
      { diameter: 2, thickness: 0.2, tessellation: 80 },
      context.meshes.scene,
    );
    this.shockwave.material = context.meshes.material('#b8f5ff', 1);
    this.shockwave.position.y = 3.12;
    this.shockwave.isPickable = false;
    this.shockwave.setEnabled(false);
    context.noa.rendering.addMeshToScene(this.shockwave);
    void this.load();
  }
  private async load(): Promise<void> {
    try {
      this.container = await this.context.models.loadCrab(this.root);
      if (this.disposed) {
        this.container.dispose();
        return;
      }
      for (const node of [...this.container.transformNodes, ...this.container.meshes])
        if (/^leg-[LR]-\d$|^claw-[LR]$/.test(node.name)) {
          if (node.rotationQuaternion) {
            node.rotation.copyFrom(node.rotationQuaternion.toEulerAngles());
            node.rotationQuaternion = null;
          }
          this.limbs.push({
            node,
            base: node.rotation.z,
            index: this.limbs.length,
            claw: node.name.startsWith('claw'),
          });
        }
    } catch (error) {
      if (this.disposed) return;
      console.error(error);
      this.context.notice(t('notice.crabFallback'));
      const body = CreateSphere(
        'crab-fallback',
        { diameter: 6, segments: 12 },
        this.context.meshes.scene,
      );
      body.scaling.y = 0.5;
      body.position.y = 1.5;
      body.parent = this.root;
      body.material = this.context.meshes.material('#ca625f');
      this.context.noa.rendering.addMeshToScene(body);
    }
  }
  sync(snapshot: Snapshot | null): void {
    if (snapshot && snapshot.boss.maxHp > 0) this.boss = snapshot.boss;
    else
      this.boss = {
        x: 0,
        y: 3,
        z: 0,
        yaw: Math.PI,
        hp: 1800,
        maxHp: 1800,
        stage: 1,
        action: 'idle',
        flash: 0,
        progress: 0,
        shockRadius: 0,
        impactSerial: 0,
      };
    const keep = new Set<string>();
    for (const z of snapshot?.zones || []) {
      keep.add(z.id);
      let item = this.zones.get(z.id);
      if (!item) {
        item = this.telegraph(z);
        this.zones.set(z.id, item);
      }
      item.zone = z;
    }
    for (const [id, z] of this.zones)
      if (!keep.has(id)) {
        z.root.dispose();
        z.material.dispose();
        this.zones.delete(id);
      }
    if (this.boss.flash !== this.lastFlash) {
      this.lastFlash = this.boss.flash;
      this.flashTime = 0.16;
    }
  }
  private telegraph(z: DangerZone): Telegraph {
    const scene = this.context.meshes.scene,
      root = new TransformNode(z.id, scene);
    root.position.set(z.x, 3.035, z.z);
    const mat = new StandardMaterial(`${z.id}-danger`, scene);
    mat.diffuseColor = Color3.FromHexString('#ff7667');
    mat.emissiveColor = Color3.FromHexString('#cf4939');
    mat.alpha = 0.32;
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.depthFunction = 515;
    let fill: Mesh;
    if (z.kind === 'ring')
      fill = CreateTorus(
        `${z.id}-ring`,
        {
          diameter: z.radius + z.inner,
          thickness: z.radius - z.inner,
          tessellation: 64,
        },
        scene,
      );
    else
      fill = CreateCylinder(
        `${z.id}-circle`,
        { diameter: z.radius * 2, height: 0.04, tessellation: 64 },
        scene,
      );
    if (z.kind === 'ring') fill.scaling.y = 0.004;
    fill.parent = root;
    fill.material = mat;
    fill.isPickable = false;
    this.context.noa.rendering.addMeshToScene(fill);
    const border = CreateTorus(
      `${z.id}-border`,
      { diameter: z.radius * 2, thickness: 0.07, tessellation: 64 },
      scene,
    );
    border.parent = root;
    border.material = this.context.meshes.material('#ffc58c', 0.8);
    border.isPickable = false;
    this.context.noa.rendering.addMeshToScene(border);
    return { root, fill, zone: z, material: mat };
  }
  render(dt: number, time: number): void {
    const b = this.boss,
      dead = b.action === 'dead',
      windup = b.action === 'slam' || b.action === 'leap';
    const rate = 1 - Math.exp(-24 * dt);
    this.root.position.x = b.x;
    this.root.position.z = b.z;
    this.root.position.y += (b.y - this.root.position.y) * rate;
    if (b.impactSerial !== this.lastImpact) {
      this.lastImpact = b.impactSerial;
      this.impactTime = 0.35;
    }
    this.impactTime = Math.max(0, this.impactTime - dt);
    this.shockwave.setEnabled(b.action === 'shockwave');
    this.shockwave.position.set(b.x, 3.12, b.z);
    this.shockwave.scaling.set(Math.max(0.1, b.shockRadius), 1.4, Math.max(0.1, b.shockRadius));
    this.root.rotation.y +=
      (((b.yaw - this.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) *
      Math.min(1, dt * 4);
    this.root.rotation.z +=
      ((dead ? Math.PI * 0.35 : 0) - this.root.rotation.z) * Math.min(1, dt * 3);
    for (const l of this.limbs) {
      l.node.rotation.z = l.base + (dead ? 0 : Math.sin(time * (windup ? 10 : 3) + l.index) * 0.08);
      if (l.claw)
        l.node.rotation.x = dead ? 0 : windup ? -0.55 : Math.sin(time * 2 + l.index) * 0.08;
    }
    this.flashTime = Math.max(0, this.flashTime - dt);
    const scale = this.flashTime > 0 ? 1.015 : 1;
    const squash =
      b.action === 'slam'
        ? 1 - b.progress * 0.2
        : this.impactTime > 0
          ? 0.75 + 0.25 * (1 - this.impactTime / 0.35)
          : 1;
    this.root.scaling.set(scale * (2 - squash), scale * squash, scale * (2 - squash));
    for (const t of this.zones.values()) {
      const progress = 1 - t.zone.remaining / t.zone.duration;
      t.material.alpha = 0.22 + progress * 0.28 + Math.sin(time * 18) * 0.035;
    }
  }
  interaction(): null {
    return null;
  }
  onShot(event: ShotEvent): void {
    this.context.effects.shot(event);
  }
  dispose(): void {
    this.disposed = true;
    for (const z of this.zones.values()) {
      z.root.dispose();
      z.material.dispose();
    }
    this.zones.clear();
    this.shockwave.dispose();
    this.container?.dispose();
    this.root.dispose();
  }
}
