import type { Motion, Vec3 } from 'winterarc-core';
import { traceBlockShape, type VoxelWorld } from 'winterarc-world';
import { EYE_HEIGHT } from './movement.js';
export const CODE_HUNT = { hideSeconds: 15, rotateSeconds: 30, range: 18, cooldown: 1.2 } as const;
export function codeEpoch(elapsed: number): number {
  return elapsed < CODE_HUNT.hideSeconds ? -1 : Math.floor((elapsed - CODE_HUNT.hideSeconds) / CODE_HUNT.rotateSeconds);
}
/** Front-facing forehead; no billboard, through-wall reading, or own-code access. */
export function canReadCode(viewer: Motion, target: Motion, world: VoxelWorld): boolean {
  const dx = viewer.x - target.x, dz = viewer.z - target.z;
  const flat = Math.hypot(dx, dz);
  if (flat < 0.5 || (dx * Math.sin(target.yaw) + dz * Math.cos(target.yaw)) / flat < 0.5) return false;
  const from: Vec3 = [viewer.x, viewer.y + EYE_HEIGHT, viewer.z];
  const to: Vec3 = [target.x + Math.sin(target.yaw) * .29, target.y + 1.52, target.z + Math.cos(target.yaw) * .29];
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  if (distance > CODE_HUNT.range || distance < .01) return false;
  const dir = to.map((n, i) => (n - from[i]) / distance) as Vec3;
  const dot = dir[0] * Math.sin(viewer.yaw) * Math.cos(viewer.pitch) - dir[1] * Math.sin(viewer.pitch) + dir[2] * Math.cos(viewer.yaw) * Math.cos(viewer.pitch);
  if (dot < Math.cos(Math.PI / 4)) return false;
  return !traceBlockShape(world, from, dir, distance, 'collision');
}
