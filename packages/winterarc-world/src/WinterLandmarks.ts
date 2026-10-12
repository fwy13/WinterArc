import { MapKit } from './MapKit.js';
import { BLOCK } from './VoxelWorld.js';

/** Integer voxel scenery: all collision geometry is shared by server and client. */
export function marketStall(kit: MapKit, x: number, z: number, color: number): void {
  const k = kit.at(x, 3, z);
  k.fill(-3, -1, -2, 3, -1, 2, BLOCK.WOOD);
  for (const dx of [-3, 3]) for (const dz of [-2, 2]) k.fill(dx, 0, dz, dx, 3, dz, BLOCK.LOG);
  for (let dx = -4; dx <= 4; dx++) k.fill(dx, 4, -3, dx, 4, 3, dx % 2 ? color : BLOCK.SNOW);
  k.fill(-2, 0, 1, 2, 0, 1, BLOCK.WOOD);
  k.block(-1, 1, 1, BLOCK.GOLD).block(1, 1, 1, color);
}

/** Background only. Call beyond the arena's playable radius. */
export function iceSpire(kit: MapKit, x: number, y: number, z: number, height: number): void {
  kit.fill(x - 1, y, z - 1, x + 1, y + height - 3, z + 1, BLOCK.ICE);
  kit.fill(x, y + height - 2, z, x, y + height, z, BLOCK.ICE);
  kit.block(x, y + height + 1, z, BLOCK.SNOW);
}

export function pennantGate(kit: MapKit, z: number, half: number, y: number, color: number): void {
  for (const x of [-half, half]) {
    kit.fill(x, y, z, x, y + 5, z, BLOCK.LOG);
    kit.block(x, y + 6, z, BLOCK.GLOW);
  }
  kit.fill(-half, y + 5, z, half, y + 5, z, BLOCK.WOOD);
  for (let x = -half + 2; x < half; x += 3) kit.block(x, y + 4, z, color);
}
