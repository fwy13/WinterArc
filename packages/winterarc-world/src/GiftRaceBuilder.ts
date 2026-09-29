import { MapKit } from './MapKit.js';
import { BLOCK, VoxelWorld, type MapBuilder } from './VoxelWorld.js';
export const GIFT_RACE = {
  checkpoints: [-40, -12, 16, 44],
  finish: { x: 0, y: 9, z: 57 },
  floorY: 8,
} as const;
export class GiftRaceBuilder implements MapBuilder {
  build(): VoxelWorld {
    const world = new VoxelWorld('giftrace', {
      isPlayable: (x, z) => Math.abs(x) < 18 && z > -63 && z < 63,
      spawn: (i) => ({ x: ((i % 8) - 3.5) * 2, y: 9, z: -58 + Math.floor(i / 8) * 2 }),
    });
    const kit = new MapKit(world);
    kit.fill(-19, 0, -64, 19, 0, 64, BLOCK.ICE);
    kit.fill(-18, 8, -63, 18, 8, -42, BLOCK.SNOW);
    for (let z = -41; z <= 48; z++) {
      const segment = Math.floor((z + 41) / 7);
      // One-block gaps between platforms; sideways variation creates three broad routes.
      if ((z + 41) % 7 === 6) continue;
      for (const lane of [-10, 0, 10]) {
        const center = lane + (segment % 2 ? 1 : -1);
        kit.fill(center - 2, 8, z, center + 2, 8, z, segment % 3 ? BLOCK.SNOW : BLOCK.WOOD);
      }
    }
    for (const z of GIFT_RACE.checkpoints) {
      kit.fill(-17, 8, z - 2, 17, 8, z + 2, BLOCK.GOLD);
      for (const x of [-17, 17]) kit.fill(x, 9, z, x, 14, z, BLOCK.RED);
      kit.fill(-17, 14, z, 17, 14, z, BLOCK.RIBBON);
    }
    kit.fill(-18, 8, 46, 18, 8, 62, BLOCK.SNOW);
    for (const x of [-14, 14]) world.trees.push({ x, y: 9, z: 56, scale: 1.1 });
    world.loseY = 3;
    for (const z of [-50, -20, 10, 40]) kit.candyCane(17, 9, z);
    return world;
  }
}
