import { pennantGate } from './WinterLandmarks.js';
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
    // Three readable stages; all paths return to the original checkpoint elevation.
    for (let z = -41; z <= 48; z++) {
      if (z < -14) {
        // Gift steps: broad platforms, one-block gaps and at most a one-block rise.
        const segment = Math.floor((z + 41) / 6);
        if ((z + 41) % 6 === 5) continue;
        const y = 8 + (segment % 2);
        for (const lane of [-10, 0, 10]) {
          kit.fill(lane - 2, y, z, lane + 2, y, z, segment % 2 ? BLOCK.GREEN : BLOCK.RED);
          if ((z + 41) % 6 === 2) kit.fill(lane - 2, y, z, lane + 2, y, z, BLOCK.RIBBON);
        }
      } else if (z < 14) {
        // Serpentine ice lanes; one-voxel sideways steps still overlap by four voxels.
        const offset = Math.round(Math.sin((z + 12) * Math.PI / 14) * 2);
        if (z === -2 || z === 9) continue;
        for (const lane of [-10, 0, 10]) kit.fill(lane + offset - 1, 8, z, lane + offset + 1, 8, z, BLOCK.ICE);
      } else {
        // Alternating bridges with crossovers for changing lanes.
        if ((z - 18) % 8 === 7) continue;
        for (const lane of [-10, 0, 10]) kit.fill(lane - 2, 8, z, lane + 2, 8, z, BLOCK.WOOD);
        if (z === 26 || z === 34) kit.fill(-12, 8, z, 12, 8, z + 1, BLOCK.SNOW);
      }
    }
    // Tall alternating half-lane walls force steering on the slippery section.
    for (const lane of [-10, 0, 10]) for (const z of [-6, 4]) {
      const offset = Math.round(Math.sin((z + 12) * Math.PI / 14) * 2);
      const edge = lane + offset + (z < 0 ? -1 : 1);
      kit.fill(edge, 9, z, edge, 11, z, BLOCK.RED);
    }
    // One-block hurdles require timed jumps; leave landing room before gaps.
    for (const lane of [-10, 0, 10]) for (const z of [23, 31, 39])
      kit.fill(lane - 2, 9, z, lane + 2, 9, z, BLOCK.RIBBON);
    // Final stretch: alternate left/right openings, with no straight sprint line.
    for (const z of [49, 52]) {
      const left = z === 49;
      kit.fill(left ? -18 : -5, 9, z, left ? 5 : 18, 12, z, BLOCK.RED);
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
    // Stage markers stay above head height; border lights sit outside the lanes.
    for (const z of [-27, 2, 30]) pennantGate(kit, z, 17, 9, z < -12 ? BLOCK.GREEN : z < 16 ? BLOCK.ICE : BLOCK.GOLD);
    for (const x of [-16, 16]) for (const z of [-53, -34, -5, 23, 52]) kit.lamp(x, 9, z, 3);
    // Checkered finish is flush with the landing platform.
    for (let x = -12; x <= 12; x++) for (let z = 53; z <= 55; z++) kit.block(x, 8, z, (x + z) % 2 ? BLOCK.DARK : BLOCK.SNOW);
    pennantGate(kit, 59, 10, 9, BLOCK.GOLD);
    return world;
  }
}
