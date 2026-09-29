import { MapKit } from './MapKit.js';
import { BLOCK, VoxelWorld, type MapBuilder } from './VoxelWorld.js';
export const COLOR_FLOOR = { half: 18, y: 8, tileSize: 3, blocks: [17, 18, 19, 20, 21] } as const;
export function floorBlock(x: number, z: number, cycle: number): number {
  const tx = Math.floor((x + COLOR_FLOOR.half) / COLOR_FLOOR.tileSize);
  const tz = Math.floor((z + COLOR_FLOOR.half) / COLOR_FLOOR.tileSize);
  return COLOR_FLOOR.blocks[(((tx * 3 + tz * 2 + cycle) % 5) + 5) % 5];
}
/** Identical formula on server/client; only cycle, target and phase cross the network. */
export function updateColorFloor(
  world: VoxelWorld,
  cycle: number,
  safe: number,
  dropped: boolean,
  write = world.set,
): void {
  for (let x = -COLOR_FLOOR.half; x < COLOR_FLOOR.half; x++) {
    for (let z = -COLOR_FLOOR.half; z < COLOR_FLOOR.half; z++) {
      const block = floorBlock(x, z, cycle);
      write(x, COLOR_FLOOR.y, z, dropped && block !== safe ? BLOCK.AIR : block);
    }
  }
}
export class ColorFallBuilder implements MapBuilder {
  build(): VoxelWorld {
    const world = new VoxelWorld('colorfall', {
      isPlayable: (x, z) => Math.abs(x) < 18.5 && Math.abs(z) < 18.5,
      spawn: (i) => ({ x: ((i % 8) - 3.5) * 3, y: 9, z: (Math.floor(i / 8) - 1.5) * 3 }),
    });
    const kit = new MapKit(world);
    kit.fill(-22, 0, -22, 22, 0, 22, BLOCK.STONE);
    kit.fill(-22, 1, -22, 22, 1, 22, BLOCK.WATER);
    updateColorFloor(world, 0, 17, false);
    for (const x of [-22, 22])
      for (const z of [-22, 22]) {
        kit.fill(x, 2, z, x, 11, z, BLOCK.RED);
        kit.block(x, 12, z, BLOCK.GLOW);
      }
    return world;
  }
}
