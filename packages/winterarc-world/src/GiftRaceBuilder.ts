import { pennantGate } from './WinterLandmarks.js';
import { MapKit } from './MapKit.js';
import { BLOCK, VoxelWorld, type MapBuilder } from './VoxelWorld.js';
export const GIFT_RACE = {
  checkpoints: [
    { x: 0, y: 10, z: -34, radius: 12 },
    { x: 0, y: 10, z: -9, radius: 12 },
    { x: 0, y: 13, z: 18, radius: 12 },
    { x: 0, y: 13, z: 45, radius: 12 },
    { x: 0, y: 13, z: 58, radius: 12 },
  ],
  finish: { x: 0, y: 15, z: 70, radius: 4 },
  floorY: 8,
} as const;
export class GiftRaceBuilder implements MapBuilder {
  build(): VoxelWorld {
    const world = new VoxelWorld('giftrace', {
      isPlayable: (x, z) => Math.abs(x) < 20 && z > -75 && z < 75,
      spawn: (i) => ({ x: ((i % 8) - 3.5) * 2.2, y: 9, z: -70 + Math.floor(i / 8) * 2.2 }),
    });
    world.race = {
      checkpoints: GIFT_RACE.checkpoints.map((p) => ({ ...p })),
      finish: { ...GIFT_RACE.finish },
    };
    world.loseY = 3;
    const kit = new MapKit(world);

    // Frozen canyon floor and outer snow banks below loseY.
    kit.fill(-21, 0, -76, 21, 0, 76, BLOCK.ICE);
    for (const side of [-20, 20]) {
      kit.fill(side, 1, -76, side, 2, 76, BLOCK.SNOW);
    }

    // Helper for checkpoint plazas with side archway pillars and torches.
    const buildCheckpoint = (zCenter: number, yFloor: number, bannerColor: number) => {
      kit.fill(-12, yFloor, zCenter - 2, 12, yFloor, zCenter + 2, BLOCK.SNOW);
      kit.fill(-12, yFloor, zCenter - 2, 12, yFloor, zCenter - 2, BLOCK.GOLD);
      kit.fill(-12, yFloor, zCenter + 2, 12, yFloor, zCenter + 2, BLOCK.GOLD);
      kit.fill(-12, yFloor, zCenter, 12, yFloor, zCenter, BLOCK.GOLD);
      for (const x of [-13, 13]) {
        kit.fill(x, yFloor, zCenter - 1, x, yFloor + 5, zCenter + 1, BLOCK.RED);
        kit.block(x, yFloor + 3, zCenter - 2, BLOCK.TORCH_WALL_PZ);
        kit.block(x, yFloor + 3, zCenter + 2, BLOCK.TORCH_WALL_NZ);
      }
      kit.fill(-13, yFloor + 6, zCenter, 13, yFloor + 6, zCenter, BLOCK.RIBBON);
      for (let x = -10; x <= 10; x += 4) kit.block(x, yFloor + 5, zCenter, bannerColor);
      for (const x of [-12, 12]) kit.lamp(x, yFloor + 1, zCenter - 2, 3);
    };

    // Start Plaza (z = -73..-57, yFloor = 8).
    kit.fill(-16, 8, -73, 16, 8, -57, BLOCK.SNOW);
    kit.fill(-4, 8, -72, 4, 8, -58, BLOCK.CARPET);
    kit.fill(-15, 8, -57, 15, 8, -57, BLOCK.GOLD);
    for (const side of [-16, 16]) kit.fill(side, 9, -73, side, 9, -58, BLOCK.WOOD_SLAB);
    for (const side of [-14, 14]) {
      kit.tree(side, 9, -71, 1.1);
      kit.lamp(side, 9, -60, 3);
    }
    pennantGate(kit, -57, 15, 9, BLOCK.RED);

    // STAGE 1 (z = -56..-37): Floating Gift Valley (y climbs 8 -> 10 -> 9, 6-block jump rhythm).
    const stage1Steps = [
      { z1: -56, z2: -52, y: 8, shift: 0, color: BLOCK.RED },
      { z1: -50, z2: -46, y: 9, shift: -1, color: BLOCK.GREEN },
      { z1: -44, z2: -40, y: 10, shift: 1, color: BLOCK.RED },
      { z1: -38, z2: -37, y: 9, shift: 0, color: BLOCK.GREEN },
    ];
    for (const lane of [-9, 9]) {
      const dir = Math.sign(lane);
      for (const [idx, s] of stage1Steps.entries()) {
        const cx = lane + dir * s.shift;
        kit.fill(cx - 2, s.y, s.z1, cx + 2, s.y, s.z2, s.color);
        kit.fill(cx - 2, s.y, s.z1 + 1, cx + 2, s.y, s.z1 + 1, BLOCK.RIBBON);
        if (idx === 1) {
          // Half-lane wall forcing inward/outward weave.
          kit.fill(cx, s.y + 1, s.z1 + 2, cx + 2 * dir, s.y + 2, s.z1 + 2, BLOCK.SNOW);
        } else if (idx === 2) {
          // Center gift pillar on platform.
          kit.fill(cx, s.y + 1, s.z1 + 2, cx, s.y + 2, s.z1 + 2, BLOCK.GOLD);
        }
      }
    }
    // Stage 1 Center Express Shortcut (high-speed pads with launch slabs).
    for (const [z1, z2, y, color] of [
      [-56, -52, 8, BLOCK.GOLD],
      [-50, -46, 9, BLOCK.RIBBON],
      [-44, -40, 10, BLOCK.GOLD],
      [-38, -37, 9, BLOCK.RIBBON],
    ] as const) {
      kit.fill(-1, y, z1, 1, y, z2, color);
    }
    kit.fill(-1, 10, -46, 1, 10, -46, BLOCK.WOOD_SLAB);

    // CHECKPOINT 1 (z = -34, yFloor = 9).
    buildCheckpoint(-34, 9, BLOCK.GREEN);

    // STAGE 2 (z = -31..-12): Serpentine Ice Canyon & Slalom Barriers (yFloor = 9).
    for (let z = -31; z <= -12; z++) {
      const wave = Math.round(Math.sin(((z + 31) * Math.PI) / 6) * 2);
      if (z !== -26 && z !== -19) {
        kit.fill(-9 + wave, 9, z, -5 + wave, 9, z, BLOCK.ICE);
        kit.fill(5 - wave, 9, z, 9 - wave, 9, z, BLOCK.ICE);
        const pad = [-30, -23, -15].includes(z) ? 2 : 1;
        kit.fill(-pad, 9, z, pad, 9, z, BLOCK.ICE);
      }
    }
    // Crossover snow bridges between left, center, and right ice lanes.
    for (const z of [-23, -16]) kit.fill(-8, 9, z, 8, 9, z + 1, BLOCK.SNOW);
    // Sweeping slalom walls on the winding ice lanes.
    for (const [z, inward] of [
      [-29, true],
      [-23, false],
      [-15, true],
    ] as const) {
      const wave = Math.round(Math.sin(((z + 31) * Math.PI) / 6) * 2);
      const lx = inward ? -6 + wave : -9 + wave;
      const rx = inward ? 5 - wave : 8 - wave;
      kit.fill(lx, 10, z, lx + 1, 12, z, BLOCK.RED);
      kit.fill(rx, 10, z, rx + 1, 12, z, BLOCK.RED);
    }
    // Launch-lip slabs right before the gaps on the center tightrope.
    for (const z of [-27, -20]) kit.fill(-1, 10, z, 1, 10, z, BLOCK.WOOD_SLAB);
    pennantGate(kit, -22, 15, 10, BLOCK.ICE);

    // CHECKPOINT 2 (z = -9, yFloor = 9).
    buildCheckpoint(-9, 9, BLOCK.ICE);

    // STAGE 3 (z = -6..15): Alpine Staircase Climb & Hedge Terrace (y climbs 9 -> 12).
    for (const lane of [-8, 0, 8]) {
      kit.fill(lane - 2, 9, -6, lane + 2, 9, -4, BLOCK.WOOD);
      kit.fill(lane - 2, 10, -4, lane + 2, 10, -4, BLOCK.WOOD_STAIRS_PZ);
      kit.fill(lane - 2, 10, -3, lane + 2, 10, -1, BLOCK.WOOD);
      kit.fill(lane - 2, 11, -1, lane + 2, 11, -1, BLOCK.WOOD_SLAB);
      // 1-block chasm at z = 0.
      kit.fill(lane - 2, 10, 1, lane + 2, 10, 4, BLOCK.WOOD);
      kit.fill(lane - 2, 11, 4, lane + 2, 11, 4, BLOCK.WOOD_STAIRS_PZ);
    }
    // Mid-climb Hedge Terrace (z = 5..11, yFloor = 11) with central void trench at z = 7.
    kit.fill(-11, 11, 5, 11, 11, 11, BLOCK.SNOW);
    kit.fill(-5, 11, 7, 5, 11, 7, BLOCK.AIR);
    // Outer hedge chicanes around the trench.
    for (const side of [-1, 1]) {
      const base = side * 8;
      kit.fill(base - 2, 12, 6, base, 13, 6, BLOCK.LEAVES);
      kit.fill(base, 12, 9, base + 2, 13, 9, BLOCK.LEAVES);
    }
    // Final ascent to Checkpoint 3 (z = 12..15, y climbs 11 -> 12).
    for (const lane of [-8, 0, 8]) {
      kit.fill(lane - 2, 11, 12, lane + 2, 11, 12, BLOCK.WOOD);
      kit.fill(lane - 2, 12, 12, lane + 2, 12, 12, BLOCK.WOOD_STAIRS_PZ);
      kit.fill(lane - 2, 12, 13, lane + 2, 12, 15, lane === 0 ? BLOCK.RED : BLOCK.GREEN);
      if (lane === 0) kit.fill(-2, 13, 14, 2, 13, 14, BLOCK.WOOD_SLAB);
      else kit.fill(lane, 13, 14, lane, 14, 14, BLOCK.LOG);
    }

    // CHECKPOINT 3 (z = 18, yFloor = 12).
    buildCheckpoint(18, 12, BLOCK.GREEN);

    // STAGE 4 (z = 21..42): Broken Suspension Bridges & Frost Pillar Gauntlet (yFloor = 12).
    for (let z = 21; z <= 31; z++) {
      const sideGap = z === 23 || z === 30;
      const centerGap = z === 26;
      for (const lane of [-8, 8]) {
        if (!sideGap) kit.fill(lane - 2, 12, z, lane + 2, 12, z, BLOCK.WOOD);
      }
      if (!centerGap) kit.fill(-2, 12, z, 2, 12, z, BLOCK.WOOD);
    }
    // Cross-beams allowing lane swaps across the suspension bridges.
    for (const z of [24, 28]) kit.fill(-10, 12, z, 10, 12, z + 1, BLOCK.SNOW);
    // Launch-lip slabs right before bridge gaps.
    kit.fill(-2, 13, 25, 2, 13, 25, BLOCK.WOOD_SLAB);
    for (const lane of [-8, 8]) {
      kit.fill(lane - 2, 13, 22, lane + 2, 13, 22, BLOCK.WOOD_SLAB);
      kit.fill(lane - 2, 13, 29, lane + 2, 13, 29, BLOCK.WOOD_SLAB);
    }

    // Frost Pillar & Ice Floe Gauntlet (z = 32..42, yFloor = 12).
    for (let z = 32; z <= 42; z++) {
      if (z === 35 || z === 41) continue;
      for (const lane of [-8, 0, 8]) {
        kit.fill(lane - 2, 12, z, lane + 2, 12, z, BLOCK.ICE);
      }
    }
    kit.fill(-10, 12, 37, 10, 12, 38, BLOCK.SNOW);
    for (const lane of [-8, 0, 8]) {
      // Center frost pillar at z = 33 before the jump at z = 35.
      kit.fill(lane, 13, 33, lane, 15, 33, BLOCK.ICE);
      kit.block(lane, 16, 33, BLOCK.GLOW);
      // Side pinch pillars at z = 39 before the jump at z = 41.
      for (const dx of [-2, 2]) kit.fill(lane + dx, 13, 39, lane + dx, 15, 39, BLOCK.ICE);
      kit.fill(lane - 2, 13, 40, lane + 2, 13, 40, BLOCK.WOOD_SLAB);
    }
    pennantGate(kit, 32, 15, 13, BLOCK.GOLD);

    // CHECKPOINT 4 (z = 45, yFloor = 12).
    buildCheckpoint(45, 12, BLOCK.GOLD);

    // STAGE 5 (z = 48..55): Final Chicane Maze & Hurdle Windows (yFloor = 12).
    kit.fill(-11, 12, 48, 11, 12, 55, BLOCK.SNOW);
    kit.fill(-5, 12, 48, 5, 12, 55, BLOCK.ICE);
    for (const side of [-12, 12]) kit.fill(side, 12, 48, side, 14, 55, BLOCK.DARK);
    // Wall 1 (z = 49): open doors on left/right (-9..-6, 6..9) + center slab window (-2..2).
    kit.fill(-11, 13, 49, 11, 15, 49, BLOCK.RED);
    kit.fill(-9, 13, 49, -6, 15, 49, BLOCK.AIR);
    kit.fill(6, 13, 49, 9, 15, 49, BLOCK.AIR);
    kit.fill(-2, 13, 49, 2, 15, 49, BLOCK.AIR);
    kit.fill(-2, 13, 49, 2, 13, 49, BLOCK.WOOD_SLAB);
    // Wall 2 (z = 52): twin center doors (-3..-1, 1..3) + outer slab windows (-9..-7, 7..9).
    kit.fill(-11, 13, 52, 11, 15, 52, BLOCK.RED);
    kit.fill(-3, 13, 52, -1, 15, 52, BLOCK.AIR);
    kit.fill(1, 13, 52, 3, 15, 52, BLOCK.AIR);
    kit.fill(0, 13, 52, 0, 15, 52, BLOCK.GOLD);
    for (const side of [-8, 8]) {
      kit.fill(side - 1, 13, 52, side + 1, 15, 52, BLOCK.AIR);
      kit.fill(side - 1, 13, 52, side + 1, 13, 52, BLOCK.WOOD_SLAB);
    }
    // Wall 3 (z = 54): outer doors (-10..-6, 6..10) + center slab window (-2..2).
    kit.fill(-11, 13, 54, 11, 15, 54, BLOCK.RED);
    kit.fill(-10, 13, 54, -6, 15, 54, BLOCK.AIR);
    kit.fill(6, 13, 54, 10, 15, 54, BLOCK.AIR);
    kit.fill(-2, 13, 54, 2, 15, 54, BLOCK.AIR);
    kit.fill(-2, 13, 54, 2, 13, 54, BLOCK.WOOD_SLAB);

    // CHECKPOINT 5 (z = 58, yFloor = 12).
    buildCheckpoint(58, 12, BLOCK.RED);

    // STAGE 6 (z = 60..73): Grand Summit Staircase & Santa's Finish Citadel (y climbs 12 -> 14).
    kit.fill(-9, 12, 60, 9, 12, 60, BLOCK.WOOD);
    kit.fill(-9, 13, 60, 9, 13, 60, BLOCK.WOOD_STAIRS_PZ);
    kit.fill(-9, 13, 61, 9, 13, 62, BLOCK.SNOW);
    kit.fill(-3, 13, 61, 3, 13, 62, BLOCK.CARPET);
    // z = 63 is a 1-block summit leap gap!
    kit.fill(-9, 13, 64, 9, 13, 65, BLOCK.SNOW);
    kit.fill(-3, 13, 64, 3, 13, 65, BLOCK.CARPET);
    kit.fill(-9, 13, 66, 9, 13, 66, BLOCK.WOOD);
    kit.fill(-9, 14, 66, 9, 14, 66, BLOCK.WOOD_STAIRS_PZ);

    // Summit Finish Plaza (z = 67..73, yFloor = 14).
    kit.fill(-14, 14, 67, 14, 14, 73, BLOCK.SNOW);
    for (let x = -11; x <= 11; x++) {
      for (let z = 67; z <= 68; z++) {
        kit.block(x, 14, z, (x + z) % 2 ? BLOCK.DARK : BLOCK.SNOW);
      }
    }
    kit.fill(-3, 14, 69, 3, 14, 72, BLOCK.CARPET);
    kit.fill(-1, 14, 69, 1, 14, 71, BLOCK.GOLD);
    kit.gift(-8, 15, 69, 2, BLOCK.GREEN).gift(7, 15, 69, 2, BLOCK.RED);
    for (const side of [-11, 11]) {
      kit.tree(side, 15, 70, 1.1);
      kit.lamp(side, 15, 67, 3);
    }
    pennantGate(kit, 72, 10, 15, BLOCK.GOLD);

    // Festive candy canes along the outer canyon rim.
    for (const [z, y] of [
      [-46, 9],
      [-20, 9],
      [6, 11],
      [28, 12],
      [51, 12],
      [69, 14],
    ] as const) {
      kit.candyCane(-15, y + 1, z);
      kit.candyCane(13, y + 1, z);
    }

    return world;
  }
}
