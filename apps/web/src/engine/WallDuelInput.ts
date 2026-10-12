import { createStore } from '../hooks/useStore';
export const duelPose=createStore(0);
export const duelControls={hider:false,hunter:false,fireRequested:false};
export function selectDuelPose(pose: number): void {
  if(duelControls.hider && Number.isInteger(pose) && pose>=0 && pose<=2)duelPose.set(pose);
}
