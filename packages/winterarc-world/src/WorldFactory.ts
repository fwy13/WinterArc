import { CodeHuntBuilder } from './CodeHuntBuilder.js';
import { applyMapDocument } from './MapDocument.js';
import { importedMaps } from './maps/generated.js';
import type { GameId } from 'winterarc-core';
import { ChristmasVillageBuilder } from './ChristmasVillageBuilder.js';
import { SnowIslandBuilder } from './SnowIslandBuilder.js';
import { WallDuelBuilder } from './WallDuelBuilder.js';
import { KnockoutBuilder } from './KnockoutBuilder.js';
import { IceBreakBuilder } from './IceBreakBuilder.js';
import { ColorFallBuilder } from './ColorFallBuilder.js';
import { GiftRaceBuilder } from './GiftRaceBuilder.js';
import {
  AvalancheBuilder,
  BoomGiftBuilder,
  FrostyBuilder,
  MeltdownBuilder,
  SnowfortBuilder,
} from './BonusGamesBuilder.js';
import type { VoxelWorld } from './VoxelWorld.js';
export class WorldFactory {
  private static readonly builders: Record<GameId, () => VoxelWorld> = {
    codehunt: () => new CodeHuntBuilder().build(),
    wallduel: () => new WallDuelBuilder().build(),
    knockout: () => new KnockoutBuilder().build(),
    hunt: () => new ChristmasVillageBuilder().build(),
    colorfall: () => new ColorFallBuilder().build(),
    giftrace: () => new GiftRaceBuilder().build(),
    crab: () => new SnowIslandBuilder().build(),
    icebreak: () => new IceBreakBuilder().build(),
    boomgift: () => new BoomGiftBuilder().build(),
    meltdown: () => new MeltdownBuilder().build(),
    frosty: () => new FrostyBuilder().build(),
    snowfort: () => new SnowfortBuilder().build(),
    avalanche: () => new AvalancheBuilder().build(),
  };
  private static readonly cache = new Map<GameId, VoxelWorld>();
  /** Unmodified procedural base, used for deterministic editor overlays. */
  static createBase(id: GameId): VoxelWorld {
    return this.builders[id]();
  }
  static create(id: GameId): VoxelWorld {
    const world = this.createBase(id);
    if (id === 'wallduel') return world;
    return importedMaps[id] ? applyMapDocument(world, importedMaps[id]!) : world;
  }
  static get(id: GameId): VoxelWorld {
    if (!this.cache.has(id)) this.cache.set(id, this.create(id));
    return this.cache.get(id)!;
  }
  static getRegisteredIds(): GameId[] {
    return Object.keys(this.builders) as GameId[];
  }
}
