import { CodeHuntRound } from './CodeHuntRound.js';
import type { GameId } from 'winterarc-core';
import type { RoundContext, RoundController } from './RoundContext.js';
import { WallDuelRound } from './WallDuelRound.js';
import { KnockoutRound } from './KnockoutRound.js';
import { HuntRound } from './HuntRound.js';
import { ColorFallRound } from './ColorFallRound.js';
import { GiftRaceRound } from './GiftRaceRound.js';
import { CrabRound } from './CrabRound.js';
import { IceBreakRound } from './IceBreakRound.js';
import {
  AvalancheRound,
  BoomGiftRound,
  FrostyRound,
  MeltdownRound,
  SnowfortRound,
} from './BonusRounds.js';
const factories: Record<GameId, (context: RoundContext) => RoundController> = {
  codehunt: (c) => new CodeHuntRound(c),
  wallduel: (c) => new WallDuelRound(c),
  knockout: (c) => new KnockoutRound(c),
  hunt: (c) => new HuntRound(c),
  colorfall: (c) => new ColorFallRound(c),
  giftrace: (c) => new GiftRaceRound(c),
  crab: (c) => new CrabRound(c),
  icebreak: (c) => new IceBreakRound(c),
  boomgift: (c) => new BoomGiftRound(c),
  meltdown: (c) => new MeltdownRound(c),
  frosty: (c) => new FrostyRound(c),
  snowfort: (c) => new SnowfortRound(c),
  avalanche: (c) => new AvalancheRound(c),
};
export function createRound(mode: GameId, context: RoundContext): RoundController {
  return factories[mode](context);
}
