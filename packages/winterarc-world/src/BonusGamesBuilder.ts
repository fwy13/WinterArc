import { iceSpire, pennantGate } from './WinterLandmarks.js';
import { MapKit } from './MapKit.js';
import { BLOCK, VoxelWorld, type MapBuilder } from './VoxelWorld.js';

export const MELTDOWN_LAYERS = [26, 20, 14, 8] as const;
export const FROSTY_FINISH_Z = 47;
export const AVALANCHE_FINISH = { x: 0, y: 7, z: 65, radius: 9 } as const;

/** 1. Boom Gift (Hot Potato): Circular toy-workshop arena with speed ice ring, center dais, and destructible gift stacks. */
export class BoomGiftBuilder implements MapBuilder {
  build(): VoxelWorld {
    const world = new VoxelWorld('boomgift', {
      isPlayable: (x, z) => Math.hypot(x, z) < 28.5,
      spawn: (index) => {
        const a = ((index % 32) * Math.PI) / 16;
        return { x: Math.cos(a) * 18, y: 3, z: Math.sin(a) * 18 };
      },
    });
    world.loseY = 0.5;
    const kit = new MapKit(world);

    // Base water & circular workshop floor (r <= 28).
    kit.fill(-32, 0, -32, 32, 0, 32, BLOCK.STONE);
    kit.fill(-32, 1, -32, 32, 1, 32, BLOCK.WATER);
    for (let x = -28; x <= 28; x++) {
      for (let z = -28; z <= 28; z++) {
        const r = Math.hypot(x + 0.5, z + 0.5);
        if (r > 28) continue;
        const block =
          r < 5.5
            ? BLOCK.GOLD
            : r >= 10 && r <= 14.5
              ? BLOCK.ICE
              : (x + z) % 2 === 0
                ? BLOCK.SNOW
                : BLOCK.WOOD;
        kit.block(x, 2, z, block);
        if (r >= 26.8 && r <= 28) {
          kit.fill(x, 3, z, x, 4, z, (x + z) % 2 ? BLOCK.RED : BLOCK.SNOW);
        }
      }
    }

    // Center raised workshop stage (r <= 4, y = 3) with slab ramps on all 4 sides.
    kit.disc(0, 3, 0, 3.5, BLOCK.RED);
    kit.disc(0, 3, 0, 1.5, BLOCK.GOLD);
    for (const d of [-4, 4]) {
      kit.fill(-1, 3, d, 1, 3, d, BLOCK.WOOD_SLAB);
      kit.fill(d, 3, -1, d, 3, 1, BLOCK.WOOD_SLAB);
    }

    // 4 Destructible Gift Stacks at diagonal positions (r ≈ 12.7, well inside r = 18 spawns).
    for (const sx of [-9, 9]) {
      for (const sz of [-9, 9]) {
        const color = sx * sz > 0 ? BLOCK.RED : BLOCK.GREEN;
        kit.fill(sx - 1, 3, sz - 1, sx + 1, 4, sz + 1, color);
        kit.fill(sx - 1, 5, sz - 1, sx + 1, 5, sz + 1, BLOCK.RIBBON);
        kit.block(sx, 6, sz, BLOCK.GLOW);
        kit.fill(sx - 1, 3, sz - 2, sx + 1, 3, sz - 2, BLOCK.WOOD_SLAB);
      }
    }

    // 8 Festive lantern posts around the outer ring (r = 23, outside r = 18 spawns).
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      kit.lamp(Math.round(Math.cos(a) * 23), 3, Math.round(Math.sin(a) * 23), 3);
    }
    return world;
  }
}

/** 2. Multi-Layer Meltdown (Hex-A-Freeze): 4 stacked destructible ice/tile arenas at y = 26, 20, 14, 8. */
export class MeltdownBuilder implements MapBuilder {
  build(): VoxelWorld {
    const world = new VoxelWorld('meltdown', {
      isPlayable: (x, z) => Math.hypot(x, z) < 19.5,
      spawn: (index) => {
        const a = ((index % 32) * Math.PI) / 16;
        return { x: Math.cos(a) * 12, y: MELTDOWN_LAYERS[0] + 1, z: Math.sin(a) * 12 };
      },
    });
    world.loseY = 2.05;
    const kit = new MapKit(world);

    kit.fill(-24, 0, -24, 24, 0, 24, BLOCK.STONE);
    kit.fill(-24, 1, -24, 24, 1, 24, BLOCK.WATER);

    const layerColors = [BLOCK.TILE_BLUE, BLOCK.TILE_VIOLET, BLOCK.TILE_GREEN, BLOCK.TILE_GOLD];
    MELTDOWN_LAYERS.forEach((y, idx) => {
      const accent = layerColors[idx];
      for (let x = -17; x <= 17; x++) {
        for (let z = -17; z <= 17; z++) {
          const r = Math.hypot(x + 0.5, z + 0.5);
          if (r > 17) continue;
          const ring = Math.floor(r / 4) % 2 === 0;
          kit.block(x, y, z, ring ? BLOCK.ICE : accent);
        }
      }
    });

    // Outer decorative candy pillars & ice spires outside playable radius (r = 22).
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const x = Math.round(Math.cos(a) * 22);
      const z = Math.round(Math.sin(a) * 22);
      for (let y = 2; y <= 28; y++) {
        kit.block(x, y, z, y % 6 === 0 ? BLOCK.GLOW : y % 2 ? BLOCK.RED : BLOCK.SNOW);
      }
    }
    return world;
  }
}

/** 3. Frosty Freeze (Red Light, Green Light): 110m courtyard with cover walls, ice patches, and Giant Snowman. */
export class FrostyBuilder implements MapBuilder {
  build(): VoxelWorld {
    const world = new VoxelWorld('frosty', {
      isPlayable: (x, z) => Math.abs(x) < 18.5 && z > -58 && z < 54,
      spawn: (i) => ({ x: ((i % 8) - 3.5) * 2.2, y: 3, z: -54 + Math.floor(i / 8) * 1.8 }),
    });
    world.loseY = 0.5;
    world.race = {
      checkpoints: [
        { x: 0, y: 3, z: -20, radius: 12 },
        { x: 0, y: 3, z: 16, radius: 12 },
      ],
      finish: { x: 0, y: 3, z: FROSTY_FINISH_Z, radius: 12 },
    };
    const kit = new MapKit(world);

    kit.fill(-20, 0, -60, 20, 1, 56, BLOCK.DIRT);
    kit.fill(-19, 2, -59, 19, 2, 55, BLOCK.SNOW);
    for (const side of [-19, 19]) {
      kit.fill(side, 3, -59, side, 4, 55, BLOCK.STONE);
    }

    // Slippery ice fields where stopping takes extra distance.
    kit.fill(-16, 2, -38, 16, 2, -24, BLOCK.ICE);
    kit.fill(-16, 2, 4, 16, 2, 20, BLOCK.ICE);
    kit.fill(-16, 2, 28, 16, 2, 40, BLOCK.ICE);

    // Shallow water hazard trench at z = -10..-8 with 4 wooden bridges.
    kit.fill(-18, 2, -10, 18, 2, -8, BLOCK.AIR);
    kit.fill(-18, 1, -10, 18, 1, -8, BLOCK.WATER);
    for (const bx of [-12, -4, 4, 12]) {
      kit.fill(bx - 1, 2, -11, bx + 1, 2, -7, BLOCK.WOOD);
    }

    // Staggered 2-block-tall cover walls: crouching/standing behind them blocks the Giant Snowman's scan ray!
    const coverRows = [
      { z: -42, xs: [-10, 0, 10], color: BLOCK.RED },
      { z: -30, xs: [-6, 6], color: BLOCK.GREEN },
      { z: -18, xs: [-11, 0, 11], color: BLOCK.GOLD },
      { z: -2, xs: [-7, 7], color: BLOCK.RED },
      { z: 12, xs: [-10, 0, 10], color: BLOCK.GREEN },
      { z: 24, xs: [-6, 6], color: BLOCK.RED },
      { z: 36, xs: [-9, 0, 9], color: BLOCK.GOLD },
    ];
    for (const row of coverRows) {
      for (const cx of row.xs) {
        kit.fill(cx - 1, 3, row.z, cx + 1, 4, row.z, row.color);
        kit.fill(cx - 1, 5, row.z, cx + 1, 5, row.z, BLOCK.SNOW);
      }
    }

    // Checkered Finish Line at z = 46..48.
    for (let x = -17; x <= 17; x++) {
      for (let z = 46; z <= 48; z++) {
        kit.block(x, 2, z, (x + z) % 2 ? BLOCK.DARK : BLOCK.GOLD);
      }
    }
    pennantGate(kit, 47, 17, 3, BLOCK.GOLD);
    for (const side of [-16, 16]) {
      for (const z of [-45, -18, 10, 38]) kit.lamp(side, 3, z, 3);
    }
    return world;
  }
}

/** 4. Snowfort Siege: Two destructible snow/timber castles protecting Crystal Pine Cores across a frozen river. */
export class SnowfortBuilder implements MapBuilder {
  build(): VoxelWorld {
    const world = new VoxelWorld('snowfort', {
      isPlayable: (x, z) => Math.abs(x) < 21.5 && Math.abs(z) < 33.5,
      spawn: (index) => {
        const team = index % 2 === 0 ? -1 : 1;
        const slot = Math.floor(index / 2);
        return {
          x: ((slot % 8) - 3.5) * 2.2,
          y: 3,
          z: team * (28 + Math.floor(slot / 8) * 2),
        };
      },
    });
    world.loseY = 1.65;
    const kit = new MapKit(world);

    kit.fill(-23, 0, -35, 23, 0, 35, BLOCK.STONE);
    kit.fill(-23, 1, -35, 23, 1, 35, BLOCK.WATER);
    // North & South snow banks; river in z = -4..4.
    kit.fill(-22, 1, -34, 22, 1, -5, BLOCK.DIRT);
    kit.fill(-22, 2, -34, 22, 2, -5, BLOCK.SNOW);
    kit.fill(-22, 1, 5, 22, 1, 34, BLOCK.DIRT);
    kit.fill(-22, 2, 5, 22, 2, 34, BLOCK.SNOW);

    // 3 Bridges + ice stepping stones across the river (z = -4..4).
    for (const bx of [-13, 0, 13]) {
      kit.fill(bx - 2, 2, -5, bx + 2, 2, 5, BLOCK.WOOD);
      kit.fill(bx - 2, 3, -5, bx - 2, 3, 5, BLOCK.WOOD_SLAB);
      kit.fill(bx + 2, 3, -5, bx + 2, 3, 5, BLOCK.WOOD_SLAB);
    }
    for (const ix of [-6, 6]) kit.fill(ix - 1, 2, -2, ix + 1, 2, 2, BLOCK.ICE);

    // Build symmetrical South (-1) and North (+1) Destructible Fortresses.
    for (const dir of [-1, 1] as const) {
      const wallZ = dir * 13;
      const fortColor = dir < 0 ? BLOCK.RED : BLOCK.GREEN;
      // Front destructible fortress wall (x = -15..15, y = 3..5).
      kit.fill(-15, 3, wallZ, 15, 4, wallZ, BLOCK.SNOW);
      for (let x = -15; x <= 15; x += 2) {
        kit.block(x, 5, wallZ, fortColor);
      }
      // Side bunkers & firing steps.
      for (const sx of [-11, 0, 11]) {
        kit.fill(sx - 2, 3, wallZ + dir * 2, sx + 2, 3, wallZ + dir * 2, BLOCK.WOOD);
        kit.fill(sx - 2, 3, wallZ + dir * 3, sx + 2, 3, wallZ + dir * 3, BLOCK.WOOD_SLAB);
      }
      // Wing ice watchtowers at x = ±15, z = dir * 18.
      for (const wx of [-15, 15]) {
        kit.fill(wx - 1, 3, dir * 18 - 1, wx + 1, 6, dir * 18 + 1, BLOCK.ICE);
        kit.block(wx, 7, dir * 18, BLOCK.GLOW);
      }
      // Crystal Pine Core at (0, 3..8, dir * 22) surrounded by a low destructible shield wall.
      const coreZ = dir * 22;
      kit.fill(-3, 3, coreZ - 3, 3, 4, coreZ + 3, fortColor);
      kit.fill(-2, 3, coreZ - 2, 2, 4, coreZ + 2, BLOCK.AIR);
      kit.fill(-1, 3, coreZ - 1, 1, 7, coreZ + 1, BLOCK.GOLD);
      kit.fill(0, 4, coreZ, 0, 8, coreZ, BLOCK.GLOW);
      for (const lx of [-18, 18]) kit.lamp(lx, 3, dir * 25, 3);
    }
    return world;
  }
}

/** 5. Avalanche Escape: Downhill mountain ski/parkour run from (z = -70, y = 25) to (z = +65, y = 7). */
export class AvalancheBuilder implements MapBuilder {
  build(): VoxelWorld {
    const world = new VoxelWorld('avalanche', {
      isPlayable: (x, z) => Math.abs(x) < 18.5 && z > -74 && z < 73,
      spawn: (i) => ({ x: ((i % 8) - 3.5) * 2.1, y: 25, z: -70 + Math.floor(i / 8) * 1.8 }),
    });
    world.loseY = 2;
    world.race = {
      checkpoints: [
        { x: 0, y: 19, z: -30, radius: 12 },
        { x: 0, y: 13, z: 6, radius: 12 },
      ],
      finish: { ...AVALANCHE_FINISH },
    };
    const kit = new MapKit(world);

    // Helper for computing the downhill floor elevation yFloor(z) from 24 down to 6.
    const floorYAt = (z: number): number => {
      if (z <= -58) return 24;
      if (z <= -35) return 24 - Math.floor((z + 58) / 4); // 24 -> 19
      if (z <= -27) return 18; // Checkpoint 1 terrace
      if (z <= 2) return 18 - Math.floor((z + 27) / 5); // 18 -> 13
      if (z <= 8) return 12; // Checkpoint 2 terrace
      if (z <= 55) return 12 - Math.floor((z - 8) / 8); // 12 -> 7
      return 6; // Sanctuary finish terrace (z = 56..72)
    };

    for (let z = -73; z <= 72; z++) {
      const y = floorYAt(z);
      // Chasm jump gaps at z = -16 and z = 34.
      if (z === -16 || z === 34) continue;

      // Split into twin canyon chutes in z = -22..-4 (central gap x = -2..2).
      const splitCanyon = z >= -22 && z <= -4;
      for (let x = -15; x <= 15; x++) {
        if (splitCanyon && Math.abs(x) <= 2) continue;
        const isIce =
          (z >= -55 && z <= -36 && Math.abs(x) <= 10) ||
          (z >= -24 && z <= 0 && Math.abs(x) >= 5 && Math.abs(x) <= 11) ||
          (z >= 12 && z <= 52 && Math.abs(x) <= 11);
        kit.fill(x, y - 1, z, x, y, z, isIce ? BLOCK.ICE : BLOCK.SNOW);
      }
      // Side guard rails along the slope.
      for (const side of [-16, 16]) {
        kit.fill(side, y, z, side, y + 1, z, BLOCK.STONE);
      }
    }

    // Launch-lip slabs before the two chasm jumps (z = -17 and z = 33).
    for (const x of [-12, -11, -10, -9, -8, -7, -6, 6, 7, 8, 9, 10, 11, 12]) {
      kit.block(x, floorYAt(-17) + 1, -17, BLOCK.WOOD_SLAB);
    }
    kit.fill(-10, floorYAt(33) + 1, 33, 10, floorYAt(33) + 1, 33, BLOCK.WOOD_SLAB);

    // Slalom ice boulders & gates along the downhill run.
    for (const [z, xs] of [
      [-48, [-8, 0, 8]],
      [-40, [-4, 4]],
      [16, [-7, 0, 7]],
      [26, [-4, 4]],
      [44, [-8, 0, 8]],
    ] as const) {
      const y = floorYAt(z);
      for (const bx of xs) {
        kit.fill(bx, y + 1, z, bx, y + 3, z, BLOCK.ICE);
        kit.block(bx, y + 4, z, BLOCK.GLOW);
      }
    }

    // Checkpoint banners & Sanctuary Finish Lodge (z = 56..72, y = 6).
    pennantGate(kit, -30, 15, 19, BLOCK.ICE);
    pennantGate(kit, 6, 15, 13, BLOCK.GREEN);
    for (let x = -12; x <= 12; x++) {
      for (let z = 58; z <= 60; z++) {
        kit.block(x, 6, z, (x + z) % 2 ? BLOCK.DARK : BLOCK.GOLD);
      }
    }
    kit.fill(-3, 6, 61, 3, 6, 69, BLOCK.CARPET);
    kit.fill(-1, 6, 64, 1, 6, 66, BLOCK.GOLD);
    pennantGate(kit, 68, 12, 7, BLOCK.GOLD);
    for (const side of [-12, 12]) {
      kit.tree(side, 7, 66, 1.2);
      kit.lamp(side, 7, 60, 3);
    }
    return world;
  }
}
