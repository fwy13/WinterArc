import type { GameId } from 'winterarc-core';
import type { GameMode, ModeContext } from './GameMode.js';
import { SnowHuntMode } from './SnowHuntMode.js';
import { CrabRaidMode } from './CrabRaidMode.js';
import { BattleshipMode } from './BattleshipMode.js';
import { WallDuelMode } from './WallDuelMode.js';
import { KnockoutMode } from './KnockoutMode.js';
import { IceBreakMode } from './IceBreakMode.js';
import { ColorFallMode } from './ColorFallMode.js';
import { GiftRaceMode } from './GiftRaceMode.js';
export class GameRegistry {
  private static readonly factories: Record<GameId, (context: ModeContext) => GameMode> = {
    battleship: (c) => new BattleshipMode(c),
    wallduel: (c) => new WallDuelMode(c),
    knockout: (c) => new KnockoutMode(c),
    hunt: (c) => new SnowHuntMode(c),
    colorfall: (c) => new ColorFallMode(c),
    giftrace: (c) => new GiftRaceMode(c),
    crab: (c) => new CrabRaidMode(c),
    icebreak: (c) => new IceBreakMode(c),
  };
  static create(id: GameId, context: ModeContext): GameMode {
    return this.factories[id](context);
  }
}
