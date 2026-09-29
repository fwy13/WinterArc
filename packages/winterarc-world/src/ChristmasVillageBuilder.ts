import { MapKit } from './MapKit.js';
import { BLOCK, VoxelWorld, type MapBuilder } from './VoxelWorld.js';
/** Large village with authored, reachable hiding spots; the round samples them by seed. */
export class ChristmasVillageBuilder implements MapBuilder {
  build(): VoxelWorld {
    const world = new VoxelWorld('hunt', {
      isPlayable: (x, z) => Math.abs(x) < 70 && Math.abs(z) < 70,
      spawn: (index) => ({
        x: ((index % 8) - 3.5) * 1.8,
        y: 3,
        z: -10 - Math.floor(index / 8) * 2,
      }),
    });
    const kit = new MapKit(world);
    kit.fill(-72, 0, -72, 72, 1, 72, BLOCK.DIRT);
    kit.fill(-72, 2, -72, 72, 2, 72, BLOCK.SNOW);
    kit.fill(-2, 2, -70, 2, 2, 70, BLOCK.STONE);
    kit.fill(-70, 2, -2, 70, 2, 2, BLOCK.STONE);
    const hide = (x: number, y: number, z: number, zone: string) =>
      world.targetSpawns.push({ x, y, z, zone });
    for (const x of [-48, -24, 24, 48]) {
      for (const z of [-45, 30]) {
        kit.fill(x - 5, 3, z - 4, x + 5, 7, z + 4, BLOCK.WOOD);
        kit.fill(x - 4, 3, z - 3, x + 4, 7, z + 3, BLOCK.AIR);
        kit.fill(x - 1, 3, z + 4, x + 1, 5, z + 4, BLOCK.AIR);
        kit.fill(x - 6, 8, z - 5, x + 6, 8, z + 5, BLOCK.RED);
        kit.fill(x - 6, 9, z - 5, x + 6, 9, z + 5, BLOCK.SNOW);
        hide(x - 2, 3, z - 2, 'cabin');
        hide(x + 7, 3, z - 2, 'village');
        // Broad stair route onto the roof; each rise is one block.
        for (let step = 0; step < 7; step++) {
          kit.fill(x - 4, 3, z + 12 - step, x - 2, 3 + step, z + 12 - step, BLOCK.WOOD);
        }
        hide(x + 1, 10, z + 1, 'rooftop');
      }
    }
    // Floating, ascending gift platforms. A missed jump returns to safe snow below.
    for (const z of [-62, 56])
      for (const startX of [-58, 14]) {
        for (let step = 0; step < 8; step++) {
          const x = startX + step * 4;
          kit.fill(x, 3 + step, z, x + 2, 3 + step, z + 2, step % 2 ? BLOCK.GREEN : BLOCK.RED);
          if (step === 3 || step === 7) hide(x + 1.5, 4 + step, z + 1.5, 'parkour');
        }
      }
    for (const x of [-62, -12, 12, 62])
      for (const z of [-25, 15, 45]) {
        world.trees.push({ x, y: 3, z, scale: 1.25 });
        world.obstacles.push({ x, y: 3, z, radius: 0.4, height: 9 });
        hide(x + 3, 3, z + 2, 'trees');
      }
    world.trees.push({ x: 0, y: 3, z: 7, scale: 2.2 });
    world.obstacles.push({ x: 0, y: 3, z: 7, radius: 0.65, height: 16 });
    for (const z of [-55, -25, 25, 55])
      for (const x of [-5, 5]) {
        kit.fill(x, 3, z, x, 6, z, BLOCK.DARK);
        kit.block(x, 7, z, BLOCK.GLOW);
        world.lamps.push([x + 0.5, 7.5, z + 0.5]);
      }
    kit.gift(7, 3, 2, 2, BLOCK.GREEN).gift(-10, 3, 2, 2);
    kit.candyCane(-7, 3, -5).candyCane(7, 3, -5);
    return world;
  }
}
