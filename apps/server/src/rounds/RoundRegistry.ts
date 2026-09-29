import type { GameId } from 'winterarc-core';
import type { RoundContext, RoundController } from './RoundContext.js';
import { HuntRound } from './HuntRound.js';
import { ColorFallRound } from './ColorFallRound.js';
import { GiftRaceRound } from './GiftRaceRound.js';
import { CrabRound } from './CrabRound.js';
import { IceBreakRound } from './IceBreakRound.js';
const factories: Record<GameId, (context: RoundContext) => RoundController> = {
  hunt: (c) => new HuntRound(c),
  colorfall: (c) => new ColorFallRound(c),
  giftrace: (c) => new GiftRaceRound(c),
  crab: (c) => new CrabRound(c),
  icebreak: (c) => new IceBreakRound(c),
};
export function createRound(mode: GameId, context: RoundContext): RoundController {
  return factories[mode](context);
}
