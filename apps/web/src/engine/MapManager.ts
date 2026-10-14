import { PartialBlockRenderer } from './PartialBlockRenderer';
import type { Engine } from './WinterVoxelEngine';
import { WorldFactory, BLOCK, ICE_BREAK } from 'winterarc-world';
import type { VoxelWorld } from 'winterarc-world';
import type { GameId } from 'winterarc-core';
import type { BlockChange } from 'winterarc-protocol';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { MeshFactory } from './MeshFactory.js';
import { TreeModels } from 'winterarc-rendering';

export class MapManager {
  world: VoxelWorld = WorldFactory.create('hunt');
  private changes = new Map<string, BlockChange>();
  private decorations: TransformNode;
  private trees: TreeModels;
  private revision = 0;
  private partials: PartialBlockRenderer;
  chunks = 0;

  constructor(
    private readonly noa: Engine,
    private readonly meshes: MeshFactory,
  ) {
    this.partials = new PartialBlockRenderer(noa);
    this.trees = new TreeModels(meshes.scene, (mesh) => noa.rendering.addMeshToScene(mesh));
    this.decorations = new TransformNode('decorations', meshes.scene);
    noa.worldName = 'hunt:0';
    this.decorate();
    this.chunks = 20;
  }

  switchTo(mode: GameId, force = false): void {
    if (this.world.id === mode && !force) return;
    this.world = WorldFactory.create(mode);
    this.changes.clear();
    this.noa.worldName = `${mode}:${++this.revision}`;
    this.decorations.dispose();
    this.decorations = new TransformNode('decorations', this.meshes.scene);
    this.decorate();
    this.chunks = 20;
  }

  syncBlocks(blocks: readonly BlockChange[]): void {
    const next = new Map(blocks.map((b) => [`${b.x}:${b.y}:${b.z}`, b]));
    const pristine = WorldFactory.get(this.world.id);
    const touched: BlockChange[] = [];
    const write = (b: BlockChange, block: number) => {
      touched.push(b);
      this.world.set(b.x, b.y, b.z, block);
    };
    for (const [key, b] of this.changes) if (!next.has(key)) write(b, pristine.get(b.x, b.y, b.z));
    for (const [key, b] of next) if (this.changes.get(key)?.block !== b.block) write(b, b.block);
    this.changes = next;
    if (touched.length) this.partials.update(touched);
  }

  updateChunks(cells: readonly { x: number; y: number; z: number }[]): void {
    if (cells.length) this.partials.update(cells);
  }

  applyBrokenIce(keys: readonly string[]): void {
    this.syncBlocks(
      keys.map((key) => {
        const parts = key.split(':').map(Number);
        if (parts.length === 2) {
          return { x: parts[0], y: ICE_BREAK.floorY, z: parts[1], block: BLOCK.AIR };
        }
        return { x: parts[0], y: parts[1], z: parts[2], block: parts[3] ?? BLOCK.AIR };
      }),
    );
  }

  private decorate(): void {
    this.partials.setWorld(this.world);
    for (const pos of this.world.lamps)
      this.meshes.cube(this.decorations, 'lantern', pos, [1.02, 1.02, 1.02], '#ffe2a5', 0.7);
    void this.trees.populate(this.world.trees, this.decorations);
  }

  dispose(): void {
    this.decorations.dispose();
    this.trees.dispose();
    this.partials.dispose();
  }
}
