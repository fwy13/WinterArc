import { MapKit } from './MapKit.js';
import { BLOCK, VoxelWorld, type MapBuilder } from './VoxelWorld.js';
/** 16 two-exit houses, connected alleys, market and opaque courtyard cover. */
export class CodeHuntBuilder implements MapBuilder {
  build(): VoxelWorld {
    const world = new VoxelWorld('codehunt', {
      isPlayable: (x, z) => Math.abs(x) < 39 && Math.abs(z) < 39,
      spawn: i => {
        const house = Math.floor(i / 2) % 16;
        return { x: -30 + (house % 4) * 18 + 3.5, y: 2, z: -30 + Math.floor(house / 4) * 18 + (i % 2 ? 5.5 : 2.5) };
      },
    });
    const kit = new MapKit(world);
    kit.fill(-40, 0, -40, 40, 1, 40, BLOCK.SNOW);
    for (const side of [-40, 40]) {
      kit.fill(side, 2, -40, side, 7, 40, BLOCK.STONE);
      kit.fill(-40, 2, side, 40, 7, side, BLOCK.STONE);
    }
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const x = -30 + col * 18, z = -30 + row * 18;
      const h = kit.at(x, 0, z);
      h.hollow(0, 1, 0, 8, 6, 8, (row + col) % 2 ? BLOCK.WOOD : BLOCK.STONE);
      h.fill(2, 2, 0, 4, 4, 0, BLOCK.AIR);
      h.fill(7, 2, 3, 7, 4, 5, BLOCK.AIR);
      // Interior divider breaks sightlines without blocking either exit.
      h.fill(4, 2, 4, 4, 4, 5, BLOCK.WOOD);
      h.fill(-1, 7, -1, 8, 7, 8, BLOCK.RED);
      h.fill(0, 8, 0, 7, 8, 7, BLOCK.SNOW);
      h.block(1, 4, 0, BLOCK.GLOW);
      kit.lamp(x + 10, 2, z + 9, 3);
    }
    // Staggered stalls and L-shaped walls in the ten-metre-wide alleys.
    for (const x of [-17, 1, 19]) for (const z of [-22, -4, 14, 32]) {
      kit.fill(x, 2, z, x + 2, 4, z, BLOCK.WOOD);
      kit.fill(x, 2, z, x, 4, z + 3, BLOCK.WOOD);
      kit.fill(x - 1, 5, z - 1, x + 3, 5, z + 4, BLOCK.GREEN);
    }
    for (const x of [-26, -8, 10, 28]) for (const z of [-17, 1, 19]) {
      kit.fill(x, 2, z, x + 2, 3, z + 1, BLOCK.GREEN);
      kit.fill(x + 5, 2, z + 3, x + 6, 4, z + 4, BLOCK.WOOD);
    }
    world.loseY = -2;
    return world;
  }
}
