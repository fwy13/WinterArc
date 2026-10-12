import type { GameId } from 'winterarc-core';
import type { RoundContext, RoundController } from './RoundContext.js';
import { BattleshipRound } from './BattleshipRound.js';
import { WallDuelRound } from './WallDuelRound.js';
import { KnockoutRound } from './KnockoutRound.js';
import { HuntRound } from './HuntRound.js';
import { ColorFallRound } from './ColorFallRound.js';
import { GiftRaceRound } from './GiftRaceRound.js';
import { CrabRound } from './CrabRound.js';
import { IceBreakRound } from './IceBreakRound.js';
const factories: Record<GameId, (context: RoundContext) => RoundController> = {
  battleship: (c) => new BattleshipRound(c),
  wallduel: (c) => new WallDuelRound(c),
  knockout: (c) => new KnockoutRound(c),
  hunt: (c) => new HuntRound(c),
  colorfall: (c) => new ColorFallRound(c),
  giftrace: (c) => new GiftRaceRound(c),
  crab: (c) => new CrabRound(c),
  icebreak: (c) => new IceBreakRound(c),
};
export function createRound(mode: GameId, context: RoundContext): RoundController {
  return factories[mode](context);
}
