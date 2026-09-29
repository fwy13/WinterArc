import { PartialBlockRenderer } from './PartialBlockRenderer';
import type { Engine, ChunkArray } from 'noa-engine';
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
    noa.world.on('worldDataNeeded', (id, array, x, y, z, worldName) =>
      this.fill(id, array, x, y, z, worldName),
    );
    this.decorate();
  }
  switchTo(mode: GameId, force = false): void {
    if (this.world.id === mode && !force) return;
    this.world = WorldFactory.create(mode);
    this.changes.clear();
    this.chunks = 0;
    this.noa.worldName = `${mode}:${++this.revision}`;
    this.decorations.dispose();
    this.decorations = new TransformNode('decorations', this.meshes.scene);
    this.decorate();
  }
  syncBlocks(blocks: readonly BlockChange[]): void {
    const next = new Map(blocks.map((b) => [`${b.x}:${b.y}:${b.z}`, b]));
    const pristine = WorldFactory.get(this.world.id);
    const touched: BlockChange[] = [];
    const write = (b: BlockChange, block: number) => {
      touched.push(b);
      this.world.set(b.x, b.y, b.z, block);
      this.noa.setBlock(block, b.x, b.y, b.z);
    };
    for (const [key, b] of this.changes) if (!next.has(key)) write(b, pristine.get(b.x, b.y, b.z));
    for (const [key, b] of next) if (this.changes.get(key)?.block !== b.block) write(b, b.block);
    this.changes = next;
    if (touched.length) this.partials.update(touched);
  }
  applyBrokenIce(keys: readonly string[]): void {
    this.syncBlocks(
      keys.map((key) => {
        const [x, z] = key.split(':').map(Number);
        return { x, y: ICE_BREAK.floorY, z, block: BLOCK.AIR };
      }),
    );
  }
  private fill(
    id: string,
    array: ChunkArray,
    x: number,
    y: number,
    z: number,
    worldName: string,
  ): void {
    if (worldName !== this.noa.worldName) return;
    for (let i = 0; i < array.shape[0]; i++)
      for (let j = 0; j < array.shape[1]; j++)
        for (let k = 0; k < array.shape[2]; k++)
          array.set(i, j, k, this.world.get(x + i, y + j, z + k));
    this.noa.world.setChunkData(id, array);
    this.chunks++;
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
