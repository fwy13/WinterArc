import { iceSpire, pennantGate } from './WinterLandmarks.js';
import { MapKit } from './MapKit.js';
import { BLOCK, VoxelWorld, type MapBuilder } from './VoxelWorld.js';
/** Flat arena at sea level, destructible ice/gift bastions, a natural coastline and outlying icebergs. */
export class SnowIslandBuilder implements MapBuilder {
  build(): VoxelWorld {
    const w = new VoxelWorld('crab', {
      isPlayable: (x, z) => Math.hypot(x, z) < 30.5,
      spawn: (index) => ({
        x: Math.sin((index * Math.PI * 2) / 32) * 20,
        y: 3,
        z: -Math.cos((index * Math.PI * 2) / 32) * 20,
      }),
    });
    const kit = new MapKit(w);
    w.obstacles.push({ x: 0, y: 3, z: 0, radius: 3.1, height: 4.5 });
    for (let x = -48; x < 48; x++)
      for (let z = -48; z < 48; z++) {
        const r = Math.hypot(x, z),
          angle = Math.atan2(z, x),
          shore = 33 + Math.sin(angle * 5) * 1.7 + Math.cos(angle * 9) * 0.7;
        if (r < shore) {
          for (let y = 0; y <= 2; y++)
            kit.block(x, y, z, y === 2 ? (r < 7 ? BLOCK.ICE : BLOCK.SNOW) : BLOCK.DIRT);
        } else kit.block(x, 0, z, BLOCK.ICE);
        if (r > 40 && Math.sin(x * 0.61) + Math.cos(z * 0.39) > 1.6) {
          const h = Math.floor((Math.sin(x * 0.61) + Math.cos(z * 0.39) - 1.55) * 18);
          kit.fill(x, 1, z, x, h, z, BLOCK.ICE);
          kit.block(x, h + 1, z, BLOCK.SNOW);
        }
      }

    // 4 Destructible Gift & Timber Bastions at r = 13 (inside the r = 20 spawn ring) for players to climb or take cover behind.
    for (const [bx, bz, color] of [
      [-13, 0, BLOCK.RED],
      [13, 0, BLOCK.GREEN],
      [0, -13, BLOCK.GREEN],
      [0, 13, BLOCK.RED],
    ] as const) {
      kit.fill(bx - 1, 3, bz - 1, bx + 1, 4, bz + 1, color);
      kit.fill(bx - 1, 5, bz - 1, bx + 1, 5, bz + 1, BLOCK.RIBBON);
      kit.block(bx, 6, bz, BLOCK.GOLD);
      // Step-up slabs around each bastion so players can climb onto the roof to dodge shockwaves.
      kit.fill(bx - 1, 3, bz - 2, bx + 1, 3, bz - 2, BLOCK.WOOD_SLAB);
      kit.fill(bx - 1, 4, bz - 1, bx + 1, 4, bz - 1, BLOCK.WOOD_STAIRS_PZ);
    }

    // 4 Destructible Ice Crystal Watchtowers at diagonal positions (r ≈ 15.5).
    for (const sx of [-11, 11]) {
      for (const sz of [-11, 11]) {
        kit.fill(sx - 1, 3, sz - 1, sx + 1, 3, sz + 1, BLOCK.STONE);
        kit.fill(sx, 4, sz, sx, 6, sz, BLOCK.ICE);
        kit.block(sx, 7, sz, BLOCK.GLOW);
        kit.block(sx + Math.sign(sx), 3, sz, BLOCK.WOOD_SLAB);
        kit.block(sx, 3, sz + Math.sign(sz), BLOCK.WOOD_SLAB);
      }
    }

    // Four Christmas shrines around the outer arena.
    for (const [x, z] of [
      [-23, -11],
      [23, -11],
      [-22, 15],
      [22, 15],
    ]) {
      w.trees.push({ x: x + 0.5, y: 3, z: z + 0.5, scale: 1.5 });
      w.obstacles.push({ x: x + 0.5, y: 3, z: z + 0.5, radius: 0.45, height: 10 });
      kit.fill(x + 3, 3, z - 2, x + 4, 4, z - 1, BLOCK.RED);
      kit.fill(x + 3, 5, z - 2, x + 4, 5, z - 1, BLOCK.RIBBON);
    }
    for (const x of [-8, 8])
      for (const z of [-23, 23]) {
        kit.fill(x, 3, z, x, 6, z, BLOCK.DARK);
        kit.block(x, 7, z, BLOCK.GLOW);
        kit.block(x, 8, z, BLOCK.SNOW);
        w.lamps.push([x + 0.5, 7.5, z + 0.5]);
      }
    // Spawn dock and candy-cane entrance.
    kit.fill(-5, 2, -29, 5, 2, -25, BLOCK.WOOD);
    for (const x of [-5, 5])
      for (let y = 3; y < 8; y++) kit.block(x, y, -27, y % 2 ? BLOCK.RED : BLOCK.SNOW);
    // Embedded rings aid orientation without catching players dodging shockwaves.
    for (let x = -29; x <= 29; x++) for (let z = -29; z <= 29; z++) {
      const r = Math.hypot(x + .5, z + .5);
      if (Math.abs(r - 12) < .4 || Math.abs(r - 28) < .4) kit.block(x, 2, z, BLOCK.STONE);
      if ((Math.abs(x) <= 1 || Math.abs(z) <= 1) && r > 8 && r < 29) kit.block(x, 2, z, BLOCK.ICE);
    }
    // Distant glacier silhouettes remain beyond the combat boundary.
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5;
      iceSpire(kit, Math.round(Math.cos(angle) * 39), 1, Math.round(Math.sin(angle) * 39), 7 + i % 4 * 2);
    }
    pennantGate(kit, -32, 7, 3, BLOCK.RED);
    kit.fill(-4, 2, -35, 4, 2, -30, BLOCK.WOOD);
    return w;
  }
}
