import { marketStall } from './WinterLandmarks.js';
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
        // Lit windows, corner beams and a chimney make each cabin readable.
        for (const side of [-1, 1]) {
          kit.fill(x + side * 5, 4, z - 1, x + side * 5, 5, z + 1, BLOCK.GLASS);
          kit.fill(x + side * 5, 3, z - 4, x + side * 5, 7, z - 4, BLOCK.LOG);
        }
        kit.fill(x + 3, 10, z - 3, x + 4, 12, z - 2, BLOCK.STONE);
        kit.block(x, 6, z + 4, BLOCK.GLOW);
        kit.fill(x - 1, 2, z + 5, x + 1, 2, z + 15, BLOCK.STONE);
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
    // Two open market rows off the main north/south road.
    for (const x of [-19, 19]) for (const z of [-18, -5, 9]) {
      marketStall(kit, x, z, x < 0 ? BLOCK.RED : BLOCK.GREEN);
      hide(x + .5, 3, z - .5, 'market');
    }
    kit.fill(-28, 2, -29, 28, 2, -27, BLOCK.STONE);
    kit.fill(-28, 2, 20, 28, 2, 22, BLOCK.STONE);
    // Frozen garden in the eastern quarter, with a low bridge and no deep pit.
    for (let x = 37; x <= 57; x++) for (let z = -18; z <= 6; z++) {
      if (Math.hypot((x - 47) / 10, (z + 6) / 12) < 1) kit.block(x, 2, z, BLOCK.ICE);
    }
    kit.fill(37, 3, -7, 57, 3, -5, BLOCK.WOOD);
    for (const x of [37, 57]) kit.lamp(x, 4, -9, 3);
    hide(47.5, 4, -5.5, 'garden');
    // Western hedge maze: open ends and two-block-wide corridors.
    for (const x of [-58, -52, -46, -40]) {
      kit.fill(x, 3, -18, x, 4, 4, BLOCK.LEAVES);
      const gapZ = x % 4 === 0 ? -14 : 0;
      kit.fill(x, 3, gapZ, x, 4, gapZ + 2, BLOCK.AIR);
    }
    hide(-54.5, 3, -7.5, 'garden');
    hide(-42.5, 3, -9.5, 'garden');
    // Landmark clock tower north of the tree, away from spawn lanes.
    kit.fill(-3, 3, 42, 3, 12, 48, BLOCK.STONE);
    kit.fill(-4, 13, 41, 4, 13, 49, BLOCK.WOOD);
    kit.fill(-4, 14, 41, 4, 14, 49, BLOCK.SNOW);
    kit.fill(-1, 9, 41, 1, 11, 41, BLOCK.GOLD);
    kit.block(0, 10, 40, BLOCK.DARK).block(0, 11, 40, BLOCK.DARK).block(1, 10, 40, BLOCK.DARK);
    hide(5.5, 3, 46.5, 'village');
    return world;
  }
}
