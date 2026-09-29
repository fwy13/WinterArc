import { MapKit } from './MapKit.js';
import { BLOCK, VoxelWorld, type MapBuilder } from './VoxelWorld.js';
/** Flat arena at sea level, a natural coastline and decorative outlying icebergs. */
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
    // Four Christmas shrines around the arena, outside the main combat routes.
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
    return w;
  }
}
