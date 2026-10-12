import { createStore } from '../hooks/useStore';
export const knockoutPower = createStore(5);
export const knockoutControls = { enabled: false };
export function adjustKnockoutPower(value: number): void {
  if (knockoutControls.enabled) knockoutPower.set(Math.max(1, Math.min(10, Math.round(value))));
}
