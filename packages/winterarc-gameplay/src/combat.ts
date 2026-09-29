import { EYE_HEIGHT } from './movement.js';
import type { DangerZone, Motion, Position, Vec3 } from 'winterarc-core';
import { traceBlockShape, type VoxelWorld } from 'winterarc-world';
export const ATTACK_COOLDOWN = 0.42,
  SNOWBALL_DAMAGE = 18,
  BOSS_RADIUS = 3.45,
  MAX_LIVES = 3;
export function zoneHits(zone: DangerZone, p: Position): boolean {
  const d = Math.hypot(p.x - zone.x, p.z - zone.z);
  return (
    d <= zone.radius + 0.29 &&
    (zone.kind !== 'ring' || d >= zone.inner - 0.29) &&
    (zone.kind === 'circle' || p.y < 4.15)
  );
}
export function aimSnowball(
  p: Motion,
  boss: Position,
  world: VoxelWorld,
): { from: Vec3; to: Vec3; hit: boolean } {
  const from: Vec3 = [p.x, p.y + EYE_HEIGHT, p.z],
    dir: Vec3 = [
      Math.sin(p.yaw) * Math.cos(p.pitch),
      -Math.sin(p.pitch),
      Math.cos(p.yaw) * Math.cos(p.pitch),
    ];
  const center: Vec3 = [boss.x, boss.y + 1.65, boss.z],
    offset = from.map((v, i) => v - center[i]);
  const b = offset.reduce((n, v, i) => n + v * dir[i], 0),
    c = offset.reduce((n, v) => n + v * v, 0) - BOSS_RADIUS ** 2,
    disc = b * b - c;
  const near = disc >= 0 ? -b - Math.sqrt(disc) : -1;
  let distance = near >= 0 ? Math.min(42, near) : 42,
    hit = near >= 0 && near <= 42;
  const obstacle = traceBlockShape(world, from, dir, distance, 'collision');
  if (obstacle && obstacle.distance < distance) { distance = obstacle.distance; hit = false; }
  return {
    from,
    to: [from[0] + dir[0] * distance, from[1] + dir[1] * distance, from[2] + dir[2] * distance],
    hit,
  };
}
