import type { Controls, Motion, Position } from 'winterarc-core';
import { blockShape, boxesIntersect, traceBlockShape, type BlockBox, type VoxelWorld } from 'winterarc-world';
export const STEP = 1 / 30;
export const STEP_HEIGHT = 0.5;
export const PLAYER_RADIUS = 0.29;

export const PLAYER_HEIGHT = 2;
export const EYE_HEIGHT = 1.9;

export const REACH = 3.15;
export const IDLE: Readonly<Controls> = Object.freeze({
  forward: 0,
  side: 0,
  jump: false,
  sprint: false,
  yaw: 0,
  pitch: 0,
});
const EPS = 0.00001;
export function collides(world: VoxelWorld, x: number, y: number, z: number): boolean {
  if (
    world.obstacles.some(
      (o) =>
        y < o.y + o.height &&
        y + PLAYER_HEIGHT > o.y &&
        Math.hypot(x - o.x, z - o.z) < o.radius + PLAYER_RADIUS,
    )
  )
    return true;
  if (
    !world.isPlayable(x - PLAYER_RADIUS, z - PLAYER_RADIUS) ||
    !world.isPlayable(x + PLAYER_RADIUS, z + PLAYER_RADIUS) ||
    y < 0
  )
    return true;
  for (
    let ix = Math.floor(x - PLAYER_RADIUS + EPS);
    ix <= Math.floor(x + PLAYER_RADIUS - EPS);
    ix++
  )
    for (
      let iz = Math.floor(z - PLAYER_RADIUS + EPS);
      iz <= Math.floor(z + PLAYER_RADIUS - EPS);
      iz++
    )
      for (let iy = Math.floor(y + EPS); iy <= Math.floor(y + PLAYER_HEIGHT - EPS); iy++)
        for (const box of blockShape(world.get(ix, iy, iz)).collision) {
          const body: BlockBox = [x-PLAYER_RADIUS,y,z-PLAYER_RADIUS,x+PLAYER_RADIUS,y+PLAYER_HEIGHT,z+PLAYER_RADIUS];
          const obstacle: BlockBox = [ix+box[0],iy+box[1],iz+box[2],ix+box[3],iy+box[4],iz+box[5]];
          if (boxesIntersect(body, obstacle, EPS)) return true;
        }
  return false;
}
// Fixed-step kinematic controller. No position, velocity or delta time is trusted from clients.
export function movePlayer<T extends Motion>(
  p: T,
  input: Controls,
  world: VoxelWorld,
  dt = STEP,
  drag = 3,
): T {
  let f = input.forward,
    s = input.side;
  const norm = Math.hypot(f, s);
  if (norm > 1) {
    f /= norm;
    s /= norm;
  }
  const speed = input.sprint ? 6.4 : 4.3;
  let dx = (Math.sin(input.yaw) * f + Math.cos(input.yaw) * s) * speed * dt;
  let dz = (Math.cos(input.yaw) * f - Math.sin(input.yaw) * s) * speed * dt;
  dx += (p.vx || 0) * dt;
  dz += (p.vz || 0) * dt;
  p.vx = (p.vx || 0) * Math.exp(-drag * dt);
  p.vz = (p.vz || 0) * Math.exp(-drag * dt);
  p.yaw = input.yaw;
  p.pitch = input.pitch;
  const grounded = collides(world, p.x, p.y - 0.025, p.z);
  if (input.jump && grounded && p.vy <= 0) p.vy = 8.7;
  p.vy = Math.max(-25, p.vy - 24 * dt);
  function axis(key: 'x' | 'y' | 'z', amount: number) {
    const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.08));
    for (let i = 0; i < steps; i++) {
      const old = p[key];
      p[key] += amount / steps;
      if (collides(world, p.x, p.y, p.z)) {
        p[key] = old;
        // Step only from a supported, non-rising position. Check the whole upward
        // sweep so a low ceiling or underside of a slab cannot be teleported through.
        if (key !== 'y' && p.vy <= 0 && collides(world,p.x,p.y-0.025,p.z)) {
          const originalY = p.y;
          let clear = true;
          for (let rise = 0.05; rise <= STEP_HEIGHT + 0.001; rise += 0.05) {
            if (collides(world,p.x,originalY+rise,p.z)) { clear = false; break; }
          }
          if (clear) {
            p.y = originalY + STEP_HEIGHT;
            p[key] = old + amount / steps;
            if (!collides(world,p.x,p.y,p.z)) {
              // Find the actual top surface under the newly advanced position.
              let low = originalY, high = p.y;
              for (let j=0;j<14;j++) { const mid=(low+high)/2; if (collides(world,p.x,mid,p.z)) low=mid; else high=mid; }
              p.y = high;
              continue;
            }
            p[key] = old;
          }
          p.y = originalY;
        }
        // Binary refinement brings feet flush to the floor without embedding the AABB.
        let lo = 0,
          hi = 1;
        for (let j = 0; j < 10; j++) {
          const mid = (lo + hi) / 2;
          p[key] = old + (amount / steps) * mid;
          if (collides(world, p.x, p.y, p.z)) hi = mid;
          else lo = mid;
        }
        p[key] = old + (amount / steps) * lo;
        return false;
      }
    }
    return true;
  }
  if (!axis('x', dx)) p.vx = 0;
  if (!axis('z', dz)) p.vz = 0;
  if (!axis('y', p.vy * dt)) p.vy = 0;
  if (p.y < -5 || p.y > 50) Object.assign(p, world.spawn(), { vy: 0 });
  return p;
}
export function canFind(
  p: Position & Pick<Motion, 'yaw' | 'pitch'>,
  t: Position,
  world: VoxelWorld,
): boolean {
  const eye = [p.x, p.y + EYE_HEIGHT, p.z],
    end = [t.x, t.y + 1.1, t.z];
  const d = end.map((v, i) => v - eye[i]),
    length = Math.hypot(...d);
  if (length > REACH) return false;
  const look = [
    Math.sin(p.yaw) * Math.cos(p.pitch),
    -Math.sin(p.pitch),
    Math.cos(p.yaw) * Math.cos(p.pitch),
  ];
  if (length > 0.1 && d.reduce((n, v, i) => n + v * look[i], 0) / length < 0.82) return false;
  if (length > 0.00001 && traceBlockShape(world, eye as [number,number,number], d.map(v => v/length) as [number,number,number], Math.max(0,length-0.03), 'collision')) return false;
  return true;
}
