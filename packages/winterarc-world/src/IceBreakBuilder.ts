import { MapKit } from './MapKit.js';
import { BLOCK, VoxelWorld, type MapBuilder } from './VoxelWorld.js';

export const ICE_BREAK = {
  radius: 18,
  floorY: 8,
  loseY: 2.05,
  reach: 7,
  cooldownMs: 350,
} as const;

export class IceBreakBuilder implements MapBuilder {
  build(): VoxelWorld {
    const world = new VoxelWorld('icebreak', {
      isPlayable: (x, z) => Math.hypot(x, z) < ICE_BREAK.radius + 0.8,
      spawn: (index) => {
        const angle = ((index % 32) * Math.PI) / 16;
        return {
          x: Math.cos(angle) * 12,
          y: ICE_BREAK.floorY + 1,
          z: Math.sin(angle) * 12,
        };
      },
    });
    const kit = new MapKit(world);
    kit.fill(-23, 0, -23, 23, 0, 23, BLOCK.STONE);
    kit.fill(-23, 1, -23, 23, 1, 23, BLOCK.WATER);
    for (let x = -23; x <= 23; x++) {
      for (let z = -23; z <= 23; z++) {
        const radius = Math.hypot(x + 0.5, z + 0.5);
        if (radius <= ICE_BREAK.radius) {
          kit.block(x, ICE_BREAK.floorY, z, BLOCK.ICE);
        } else if (radius >= 21 && radius <= 23) {
          kit.fill(x, 2, z, x, 8, z, BLOCK.DIRT);
          kit.block(x, 9, z, BLOCK.SNOW);
        }
      }
    }
    // Cột kẹo Giáng sinh nằm ngoài vùng người chơi có thể đứng.
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      const x = Math.floor(Math.cos(angle) * 22);
      const z = Math.floor(Math.sin(angle) * 22);
      for (let y = 10; y <= 14; y++) {
        kit.block(x, y, z, y % 2 ? BLOCK.RED : BLOCK.SNOW);
      }
      kit.block(x, 15, z, BLOCK.GLOW);
    }
    return world;
  }
}
