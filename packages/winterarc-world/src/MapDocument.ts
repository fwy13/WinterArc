import { clearSupportedFeet } from './BlockShapes.js';
import type { GameId, Position } from 'winterarc-core';
import { MAP_HALF, MAP_HEIGHT, PALETTE, VoxelWorld } from './VoxelWorld.js';

export interface RacePoint extends Position { radius: number }
export interface MapDocument {
  version: 1 | 2;
  name: string;
  mode: GameId;
  placement: 'replace' | 'overlay';
  blocks: [number, number, number, number][];
  spawns: Position[];
  targets: (Position & { zone: string })[];
  checkpoints: RacePoint[];
  finish?: RacePoint;
  loseY: number;
  /** Version 2: additive for overlays, complete lists for replacement maps. */
  trees?: { x: number; y: number; z: number; scale: number }[];
  lamps?: [number, number, number][];
  obstacles?: { x: number; y: number; z: number; radius: number; height: number }[];
}

export function isReservedMapCell(mode: GameId, x: number, z: number, margin = 0): boolean {
  if (mode === 'crab') return Math.hypot(x + 0.5, z + 0.5) < 32 + margin;
  if ((mode === 'icebreak' || mode === 'knockout')) return Math.hypot(x + 0.5, z + 0.5) < 21 + margin;
  return mode === 'colorfall' && Math.abs(x) <= 19 + margin && Math.abs(z) <= 19 + margin;
}

export function validateMapDocument(doc: MapDocument, options: { draft?: boolean } = {}): void {
  if (!doc || typeof doc !== 'object') throw new Error('Invalid map document');
  if (typeof doc.name !== 'string' || doc.name.length > 120) throw new Error('Invalid map name');
  if (![1, 2].includes(doc.version) || !['hunt', 'giftrace', 'crab', 'icebreak', 'knockout', 'colorfall'].includes(doc.mode))
    throw new Error('Unsupported map mode/version');
  if (!['replace', 'overlay'].includes(doc.placement)) throw new Error('Invalid placement');
  if (doc.placement === 'replace' && !['hunt', 'giftrace'].includes(doc.mode))
    throw new Error('Crab, Ice Break and Color Fall only support decoration overlays');
  if (![doc.blocks, doc.spawns, doc.targets, doc.checkpoints].every(Array.isArray))
    throw new Error('Missing map arrays');
  if (doc.blocks.length > 160 * 48 * 160) throw new Error('Too many blocks');
  if (!Number.isFinite(doc.loseY) || doc.loseY < 0.2 || doc.loseY >= 46)
    throw new Error('loseY must be between 0.2 and 46');
  for (const row of doc.blocks) {
    if (!Array.isArray(row) || row.length !== 4 || !row.every(Number.isInteger)) throw new Error('Invalid block row');
    const [x, y, z, id] = row;
    if (x < -MAP_HALF || x >= MAP_HALF || z < -MAP_HALF || z >= MAP_HALF || y < 0 || y >= MAP_HEIGHT || (id !== 0 && !Object.hasOwn(PALETTE, id)))
      throw new Error(`Invalid block coordinates/id: ${row}`);
    if (doc.mode === 'crab' && Math.hypot(x + 0.5, z + 0.5) < 32) throw new Error('Crab arena radius 32 is reserved');
    if ((doc.mode === 'icebreak' || doc.mode === 'knockout') && Math.hypot(x + 0.5, z + 0.5) < 21) throw new Error('Ice Break radius 21 is reserved');
    if (doc.mode === 'colorfall' && Math.abs(x) <= 19 && Math.abs(z) <= 19) throw new Error('Color Fall arena [-19,19] is reserved');
  }
  if (doc.spawns.length > 256 || doc.targets.length > 4096 || doc.checkpoints.length > 200)
    throw new Error('Too many gameplay markers');
  for (const target of doc.targets) if (!target || typeof target.zone !== 'string' || target.zone.length > 80)
    throw new Error('Invalid target zone');
  const markers = [...doc.spawns, ...doc.targets, ...doc.checkpoints, ...(doc.finish ? [doc.finish] : [])];
  for (const p of markers)
    if (!p || ![p.x, p.y, p.z].every(Number.isFinite) || Math.abs(p.x) > 78.7 || Math.abs(p.z) > 78.7 || p.y <= doc.loseY || p.y >= 46)
      throw new Error('Marker outside playable bounds or below loseY');
  for (const p of [...doc.checkpoints, ...(doc.finish ? [doc.finish] : [])])
    if (!Number.isFinite(p.radius) || p.radius < 0.5 || p.radius > 12) throw new Error('Invalid marker radius');
  if (doc.placement === 'replace' && !options.draft) {
    if (!doc.spawns.length) throw new Error('Replacement map needs spawn markers');
    if (doc.mode === 'hunt' && doc.targets.length < 6) throw new Error('Hunt needs at least six targets');
    if (doc.mode === 'giftrace' && (!doc.checkpoints.length || doc.checkpoints.length > 200 || !doc.finish))
      throw new Error('Gift Run needs 1–200 checkpoints and one finish');
    const blocks = new Map(doc.blocks.map(([x, y, z, id]) => [`${x}:${y}:${z}`, id]));
    for (const p of markers) {
      if (!clearSupportedFeet((x,y,z) => blocks.get(`${x}:${y}:${z}`) ?? 0, p.x,p.y,p.z))
        throw new Error(`Marker needs a supporting surface and room for the player: ${p.x},${p.y},${p.z}`);
    }
  }
  for (const key of ['trees', 'lamps', 'obstacles'] as const) {
    const list = doc[key];
    if (list !== undefined && (doc.version !== 2 || !Array.isArray(list) || list.length > 2048))
      throw new Error(`Invalid decoration list: ${key}`);
  }
  const position = (x: number, y: number, z: number, margin = 0) => {
    if (![x, y, z, margin].every(Number.isFinite) || Math.abs(x) + margin >= MAP_HALF ||
        Math.abs(z) + margin >= MAP_HALF || y < 0 || y >= MAP_HEIGHT ||
        isReservedMapCell(doc.mode, x, z, margin)) throw new Error('Decoration outside editable bounds');
  };
  for (const tree of doc.trees ?? []) {
    if (!tree || !Number.isFinite(tree.scale) || tree.scale < 0.25 || tree.scale > 4)
      throw new Error('Invalid tree scale');
    position(tree.x, tree.y, tree.z, tree.scale * 3);
    if (tree.y + tree.scale * 7 > MAP_HEIGHT) throw new Error('Tree is too tall');
  }
  for (const lamp of doc.lamps ?? []) {
    if (!Array.isArray(lamp) || lamp.length !== 3) throw new Error('Invalid lamp');
    position(...lamp);
  }
  for (const obstacle of doc.obstacles ?? []) {
    if (!obstacle || !Number.isFinite(obstacle.radius) || obstacle.radius <= 0 || obstacle.radius > 12 ||
        !Number.isFinite(obstacle.height) || obstacle.height <= 0 || obstacle.y + obstacle.height > MAP_HEIGHT)
      throw new Error('Invalid obstacle');
    position(obstacle.x, obstacle.y, obstacle.z, obstacle.radius);
  }

}

export function applyMapDocument(world: VoxelWorld, doc: MapDocument): VoxelWorld {
  validateMapDocument(doc);
  if (world.id !== doc.mode) throw new Error('Map mode mismatch');
  if (doc.placement === 'replace') {
    world.data.fill(0);
    world.targetSpawns.length = world.lamps.length = world.trees.length = world.obstacles.length = 0;
    world.customSpawns = doc.spawns.map(p => ({ ...p }));
    world.loseY = doc.loseY;
    world.targetSpawns.push(...doc.targets.map(p => ({ ...p })));
    if (doc.mode === 'giftrace') world.race = { checkpoints: doc.checkpoints.map(p => ({ ...p })), finish: { ...doc.finish! } };
  }
  for (const [x, y, z, id] of doc.blocks) world.set(x, y, z, id);
  if (doc.version === 2) {
    world.trees.push(...(doc.trees ?? []).map(t => ({ ...t })));
    world.lamps.push(...(doc.lamps ?? []).map(p => [...p] as [number, number, number]));
    world.obstacles.push(...(doc.obstacles ?? []).map(o => ({ ...o })));
  }
  return world;
}
