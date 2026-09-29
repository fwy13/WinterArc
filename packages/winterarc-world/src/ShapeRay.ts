import { blockShape, type BlockBox } from './BlockShapes.js';
type Triple = [number, number, number];
export interface ShapeHit { x:number; y:number; z:number; block:number; distance:number; normal:Triple; point:Triple }
function rayBox(from:Triple, dir:Triple, box:BlockBox): { near:number; normal:Triple } | null {
  let near = 0, far = Infinity;
  const normal: Triple = [0,0,0];
  for (let i=0;i<3;i++) {
    if (Math.abs(dir[i]) < 1e-12) { if (from[i] < box[i] || from[i] > box[i+3]) return null; continue; }
    const a = (box[i]-from[i])/dir[i], b = (box[i+3]-from[i])/dir[i];
    const enter = Math.min(a,b), exit = Math.max(a,b);
    if (enter > near) { near = enter; normal.fill(0); normal[i] = dir[i] > 0 ? -1 : 1; }
    far = Math.min(far,exit);
    if (near > far) return null;
  }
  return far >= 0 ? { near, normal } : null;
}
/** Exact DDA + ray/AABB intersections. Direction must be a unit vector. */
export function traceBlockShape(world: { get(x:number,y:number,z:number):number }, from:Triple, dir:Triple, reach:number, type:'selection'|'collision' = 'selection'): ShapeHit | null {
  if (!Number.isFinite(reach) || reach < 0 || ![...from,...dir].every(Number.isFinite) || Math.hypot(...dir) < 1e-8) return null;
  const cell = from.map(Math.floor), step = dir.map(Math.sign);
  const delta = dir.map(d => d === 0 ? Infinity : Math.abs(1/d));
  const next = dir.map((d,i) => d === 0 ? Infinity : ((d > 0 ? cell[i]+1 : cell[i])-from[i])/d);
  let entered = 0;
  while (entered <= reach) {
    const [x,y,z] = cell, block = world.get(x,y,z), exit = Math.min(...next);
    let best: ShapeHit | null = null;
    for (const box of blockShape(block)[type]) {
      const hit = rayBox([from[0]-x,from[1]-y,from[2]-z],dir,box);
      if (!hit || hit.near < entered-1e-7 || hit.near > Math.min(reach,exit)+1e-7 || (best && best.distance <= hit.near)) continue;
      best = { x,y,z,block,distance:hit.near,normal:hit.normal,point:from.map((v,i)=>v+dir[i]*hit.near) as Triple };
    }
    if (best) return best;
    if (!Number.isFinite(exit)) break;
    entered = exit;
    for (let i=0;i<3;i++) if (next[i] <= exit+1e-10) { cell[i]+=step[i]; next[i]+=delta[i]; }
  }
  return null;
}
