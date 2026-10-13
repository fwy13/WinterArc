import type { GameMode, ModeContext } from './GameMode.js';
/** Forehead labels are owned by PlayerManager so they follow interpolated heads. */
export class CodeHuntMode implements GameMode {
  readonly id = 'codehunt' as const;
  constructor(_context: ModeContext) {}
  sync(): void {}
  render(): void {}
  interaction(): null { return null; }
  onShot(): void {}
  dispose(): void {}
}
