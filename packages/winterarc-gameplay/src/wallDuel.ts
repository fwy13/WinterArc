import type { Vec3 } from 'winterarc-core';
/** Shared visual boxes and server hitboxes, relative to feet. */
export interface DuelBox { at: Vec3; size: Vec3; color: string }
export const DUEL = { floor: 3, wallZ: 0, hiderZ: 2.25, hunterZ: -10, eye: 4.9, limit: 4, hideTime: 3, huntTime: 20, shotDelay: .45, cooldown: .9 } as const;
export const DUEL_POSES: readonly (readonly DuelBox[])[] = [
  [
    { at:[0,1.5,0], size:[.5,.5,.45], color:'#f4d8bc' },
    { at:[0,.93,0], size:[.55,.65,.4], color:'#70d8cc' },
    { at:[-.2,.3,0], size:[.22,.6,.35], color:'#325c78' },
    { at:[.2,.3,0], size:[.22,.6,.35], color:'#325c78' },
    { at:[-.4,.92,0], size:[.2,.65,.3], color:'#70d8cc' },
    { at:[.4,.92,0], size:[.2,.65,.3], color:'#70d8cc' },
  ],
  [
    { at:[0,.91,0], size:[.5,.5,.45], color:'#f4d8bc' },
    { at:[0,.48,0], size:[.65,.4,.4], color:'#70d8cc' },
    { at:[-.28,.14,0], size:[.32,.28,.4], color:'#325c78' },
    { at:[.28,.14,0], size:[.32,.28,.4], color:'#325c78' },
  ],
  [
    { at:[-.68,.27,0], size:[.5,.5,.45], color:'#f4d8bc' },
    { at:[-.05,.24,0], size:[.75,.38,.45], color:'#70d8cc' },
    { at:[.65,.17,0], size:[.65,.3,.4], color:'#325c78' },
  ],
];
export function duelRay(yaw: number, pitch: number): { from: Vec3; dir: Vec3 } {
  return { from:[0,DUEL.eye,DUEL.hunterZ], dir:[Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)] };
}
export function duelPoint(yaw: number, pitch: number, z: number): Vec3 {
  const {from,dir}=duelRay(yaw,pitch), distance=(z-from[2])/dir[2];
  return [from[0]+dir[0]*distance,from[1]+dir[1]*distance,z];
}
/** Slab intersection: no client-reported hits, and the divider deliberately does not stop bullets. */
export function duelHit(yaw: number, pitch: number, x: number, pose: number): boolean {
  const {from,dir}=duelRay(yaw,pitch);
  return (DUEL_POSES[pose] ?? DUEL_POSES[0]).some(box => {
    const center: Vec3=[x+box.at[0],DUEL.floor+box.at[1],DUEL.hiderZ+box.at[2]];
    let near=0,far=30;
    for(let axis=0;axis<3;axis++) {
      const lo=center[axis]-box.size[axis]/2,hi=center[axis]+box.size[axis]/2;
      if(Math.abs(dir[axis])<1e-8) { if(from[axis]<lo || from[axis]>hi)return false; continue; }
      const a=(lo-from[axis])/dir[axis],b=(hi-from[axis])/dir[axis];
      near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
      if(near>far)return false;
    }
    return true;
  });
}
