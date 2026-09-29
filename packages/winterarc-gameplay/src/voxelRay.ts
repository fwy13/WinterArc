import type { Motion, Vec3 } from 'winterarc-core';
import { traceBlockShape, type VoxelWorld } from 'winterarc-world';
import { EYE_HEIGHT } from './movement.js';
export interface VoxelHit {
  x: number;
  y: number;
  z: number;
  block: number;
  before: Vec3;
}
export function voxelRay(p: Motion, world: VoxelWorld, reach = 6): VoxelHit | null {
  const from: Vec3 = [p.x, p.y + EYE_HEIGHT, p.z];
  const dir: Vec3 = [
    Math.sin(p.yaw) * Math.cos(p.pitch),
    -Math.sin(p.pitch),
    Math.cos(p.yaw) * Math.cos(p.pitch),
  ];
  const hit = traceBlockShape(world, from, dir, reach);
  if (!hit) return null;
  return { x:hit.x, y:hit.y, z:hit.z, block:hit.block,
    before:[hit.x+hit.normal[0],hit.y+hit.normal[1],hit.z+hit.normal[2]] };

}
export function canReachPoint(p: Motion, x: number, y: number, z: number, reach = 3.5): boolean {
  const dx = x - p.x,
    dy = y - p.y - EYE_HEIGHT,
    dz = z - p.z;
  const d = Math.hypot(dx, dy, dz);
  return (
    d <= reach &&
    (d < 0.3 ||
      (dx * Math.sin(p.yaw) * Math.cos(p.pitch) -
        dy * Math.sin(p.pitch) +
        dz * Math.cos(p.yaw) * Math.cos(p.pitch)) /
        d >
        0.3)
  );
}
