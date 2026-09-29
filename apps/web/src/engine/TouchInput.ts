/** Shared touch state; React writes it, InputManager consumes it without re-rendering. */
export const touchInput = {
  forward: 0,
  side: 0,
  jump: false,
  attack: false,
  interact: false,
  lookX: 0,
  lookY: 0,
};
export function clearTouchInput(): void {
  Object.assign(touchInput, {
    forward: 0,
    side: 0,
    jump: false,
    attack: false,
    interact: false,
    lookX: 0,
    lookY: 0,
  });
}
export function hasTouchControls(): boolean {
  return window.matchMedia('(any-pointer: coarse)').matches;
}
