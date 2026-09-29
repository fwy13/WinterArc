import type { GameId, Position, Vec3 } from 'winterarc-core';
export const MAP_HALF = 80,
  MAP_HEIGHT = 48,
  GROUND = 3,
  TARGET_COUNT = 12;
export const BLOCK = Object.freeze({
  AIR: 0,
  SNOW: 1,
  DIRT: 2,
  WOOD: 3,
  LOG: 4,
  LEAVES: 5,
  RED: 6,
  GOLD: 7,
  ICE: 8,
  STONE: 9,
  GLOW: 10,
  DARK: 11,
  GREEN: 12,
  RIBBON: 13,
  GLASS: 14,
  CARPET: 15,
  WATER: 16,
  TILE_RED: 17,
  TILE_GREEN: 18,
  TILE_BLUE: 19,
  TILE_GOLD: 20,
  TILE_VIOLET: 21,
  WOOD_SLAB: 22,
  WOOD_SLAB_TOP: 23,
  WOOD_STAIRS_PZ: 24,
  WOOD_STAIRS_NX: 25,
  WOOD_STAIRS_NZ: 26,
  WOOD_STAIRS_PX: 27,
  TORCH: 28,
  TORCH_WALL_PZ: 29,
  TORCH_WALL_NX: 30,
  TORCH_WALL_NZ: 31,
  TORCH_WALL_PX: 32,
});
export const PALETTE: Record<number, [string, string]> = {
  1: ['snow', '#e4f2f7'],
  2: ['earth', '#656877'],
  3: ['cedar', '#9e6650'],
  4: ['dark-wood', '#563d3d'],
  5: ['pine', '#21695b'],
  6: ['cranberry', '#b64050'],
  7: ['gold', '#e8b761'],
  8: ['ice', '#78becb'],
  9: ['stone', '#718b99'],
  10: ['lantern', '#ffda95'],
  11: ['charcoal', '#263e4c'],
  12: ['gift-green', '#42a48c'],
  13: ['ribbon', '#f7d299'],
  14: ['window', '#ffd58c'],
  15: ['rug', '#964c61'],
  16: ['cold-water', '#287f9d'],
  17: ['tile-red', '#ec596b'],
  18: ['tile-green', '#4ebf85'],
  19: ['tile-blue', '#528de8'],
  20: ['tile-gold', '#f4ce57'],
  21: ['tile-violet', '#b582de'],
  22: ['wood-slab-bottom', '#ad7752'],
  23: ['wood-slab-top', '#ad7752'],
  24: ['wood-stairs-+Z', '#a96a48'],
  25: ['wood-stairs--X', '#a96a48'],
  26: ['wood-stairs--Z', '#a96a48'],
  27: ['wood-stairs-+X', '#a96a48'],
  28: ['torch-standing', '#ffbd54'],
  29: ['torch-wall-+Z', '#ffa94b'],
  30: ['torch-wall--X', '#ffa94b'],
  31: ['torch-wall--Z', '#ffa94b'],
  32: ['torch-wall-+X', '#ffa94b'],
};
export function randomFromSeed(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface WorldSettings {
  isPlayable: (x: number, z: number) => boolean;
  spawn: (index: number) => Position;
}
const villageSettings: WorldSettings = {
  isPlayable: (x, z) => Math.abs(x) < 45 && Math.abs(z) < 45,
  spawn: (index) => ({
    x: ((index % 4) - 1.5) * 1.5,
    y: GROUND,
    z: -14 - Math.floor(index / 4) * 1.6,
  }),
};
/** Coordinates and collision data shared by client meshing and server simulation. */
export class VoxelWorld {
  customSpawns: Position[] = [];
  loseY = 0.2;
  race = {
    checkpoints: [-40, -12, 16, 44].map(z => ({ x: 0, y: 9, z, radius: 17 })),
    finish: { x: 0, y: 9, z: 57, radius: 4 },
  };
  readonly size = MAP_HALF * 2;
  readonly data = new Uint8Array(this.size * this.size * MAP_HEIGHT);
  readonly targetSpawns: (Position & { zone: string })[] = [];
  readonly lamps: Vec3[] = [];
  readonly trees: { x: number; y: number; z: number; scale: number }[] = [];
  readonly obstacles: {
    x: number;
    y: number;
    z: number;
    radius: number;
    height: number;
  }[] = [];
  constructor(
    readonly id: GameId,
    private readonly settings: WorldSettings = villageSettings,
  ) {}
  private inside(x: number, y: number, z: number): boolean {
    return (
      x >= -MAP_HALF && x < MAP_HALF && z >= -MAP_HALF && z < MAP_HALF && y >= 0 && y < MAP_HEIGHT
    );
  }
  private index(x: number, y: number, z: number): number {
    return ((x + MAP_HALF) * this.size + z + MAP_HALF) * MAP_HEIGHT + y;
  }
  get = (x: number, y: number, z: number): number =>
    this.inside(x, y, z) ? this.data[this.index(x, y, z)] : 0;
  set = (x: number, y: number, z: number, id: number): void => {
    if (this.inside(x, y, z)) this.data[this.index(x, y, z)] = id;
  };
  box = (
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    id: number,
  ): void => {
    for (let x = x1; x <= x2; x++)
      for (let z = z1; z <= z2; z++) for (let y = y1; y <= y2; y++) this.set(x, y, z, id);
  };
  isPlayable(x: number, z: number): boolean {
    if (this.customSpawns.length) return Math.abs(x) < MAP_HALF - 1 && Math.abs(z) < MAP_HALF - 1;
    return this.settings.isPlayable(x, z);
  }
  spawn(index = 0): Position {
    if (this.customSpawns.length) return { ...this.customSpawns[index % this.customSpawns.length] };
    return this.settings.spawn(index);
  }
}
export interface MapBuilder {
  build(): VoxelWorld;
}
