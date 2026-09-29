import { BLOCK, ICE_BREAK, traceBlockShape, type VoxelWorld } from 'winterarc-world';
import type { Motion, Vec3 } from 'winterarc-core';
import { EYE_HEIGHT } from './movement.js';

export interface IceAim {
  from: Vec3;
  to: Vec3;
  block: { x: number; y: number; z: number } | null;
}

// DDA: duyệt chính xác các voxel mà tia ngắm đi qua.
export function aimIce(p: Motion, world: VoxelWorld): IceAim {
  const from: Vec3 = [p.x, p.y + EYE_HEIGHT, p.z];
  const dir: Vec3 = [
    Math.sin(p.yaw) * Math.cos(p.pitch),
    -Math.sin(p.pitch),
    Math.cos(p.yaw) * Math.cos(p.pitch),
  ];
  const hit = traceBlockShape(world, from, dir, ICE_BREAK.reach, 'collision');
  if (hit) return {
    from, to: hit.point,
    block: hit.block === BLOCK.ICE && hit.y === ICE_BREAK.floorY ? { x:hit.x, y:hit.y, z:hit.z } : null,
  };
  return {
    from,
    to: [
      from[0] + dir[0] * ICE_BREAK.reach,
      from[1] + dir[1] * ICE_BREAK.reach,
      from[2] + dir[2] * ICE_BREAK.reach,
    ],
    block: null,
  };
}
