import { BLOCK, VoxelWorld, type MapBuilder } from './VoxelWorld.js';
import { MapKit } from './MapKit.js';
export class KnockoutBuilder implements MapBuilder {
  build(): VoxelWorld {
    const world = new VoxelWorld('knockout', {
      // Players must be able to cross the rim and fall; never clamp to the ice radius.
      isPlayable: (x, z) => Math.abs(x) < 64 && Math.abs(z) < 64,
      spawn: index => { const a = (index % 32) * Math.PI / 16;
        return { x: Math.cos(a) * 12, y: 9, z: Math.sin(a) * 12 }; },
    });
    const kit = new MapKit(world);
    kit.fill(-24, 0, -24, 24, 0, 24, BLOCK.WATER);
    for (let x = -18; x <= 18; x++) for (let z = -18; z <= 18; z++)
      if (Math.hypot(x + .5, z + .5) <= 18) kit.block(x, 8, z, BLOCK.ICE);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, x = Math.round(28 * Math.cos(a)), z = Math.round(28 * Math.sin(a));
      kit.fill(x, 0, z, x + 1, 10, z + 1, BLOCK.SNOW);
      kit.block(x, 11, z, BLOCK.GLOW);
    }
    return world;
  }
}
