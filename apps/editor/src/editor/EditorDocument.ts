import {
  MAP_HALF, MAP_HEIGHT, PALETTE, WorldFactory, VoxelWorld,
  validateMapDocument, isReservedMapCell, rotateBlock, type MapDocument,
} from 'winterarc-world';
import type { GameId, Position } from 'winterarc-core';

export type Cell = [number, number, number];
export type Row = [number, number, number, number];
export type MarkerKind = 'spawn' | 'target' | 'checkpoint' | 'finish' | 'tree' | 'lamp' | 'obstacle';
type Metadata = Omit<MapDocument, 'blocks'>;
type Change = { cells: [number, number, number, number, number][]; before: Metadata; after: Metadata };
const clone = <T,>(value: T): T => structuredClone(value);
const volume = (a: Cell, b: Cell) => a.reduce((n, v, i) => n * (Math.abs(v - b[i]) + 1), 1);

/** CPU voxel data is authoritative; React only observes a revision counter. */
export class EditorDocument {
  world: VoxelWorld;
  private base: VoxelWorld;
  meta: Metadata;
  revision = 0;
  private undoStack: Change[] = [];
  private redoStack: Change[] = [];
  private historyCells = 0;
  clipboard: Row[] = [];
  clipboardSize: Cell = [0, 0, 0];
  onChange: (cells: Cell[] | null) => void = () => {};

  constructor(mode: GameId = 'hunt', blank = false) {
    this.base = WorldFactory.createBase(mode);
    this.world = WorldFactory.createBase(mode);
    const replace = mode === 'hunt' || mode === 'giftrace';
    this.meta = {
      version: 2, name: `${mode}-custom`, mode, placement: replace ? 'replace' : 'overlay',
      spawns: replace ? [clone(this.world.spawn(0))] : [],
      targets: replace ? clone(this.world.targetSpawns) : [],
      checkpoints: mode === 'giftrace' ? this.world.race.checkpoints.map(p => ({ ...p, radius: Math.min(12, p.radius) })) : [],
      ...(mode === 'giftrace' ? { finish: clone(this.world.race.finish) } : {}),
      loseY: this.world.loseY,
      trees: replace ? clone(this.world.trees) : [],
      lamps: replace ? clone(this.world.lamps) : [],
      obstacles: replace ? clone(this.world.obstacles) : [],
    };
    if (blank && replace) {
      this.world.data.fill(0);
      this.meta.spawns = [];
      this.meta.targets = [];
      this.meta.checkpoints = [];
      delete this.meta.finish;
      this.meta.trees = []; this.meta.lamps = []; this.meta.obstacles = [];
      for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) this.world.set(x, 2, z, 1);
      this.meta.spawns.push({ x: 0.5, y: 3, z: 0.5 });
    }
    this.syncMetadata();
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  editable(x: number, y: number, z: number): boolean {
    return [x, y, z].every(Number.isInteger) && x >= -MAP_HALF && x < MAP_HALF &&
      z >= -MAP_HALF && z < MAP_HALF && y >= 0 && y < MAP_HEIGHT && !isReservedMapCell(this.meta.mode, x, z);
  }

  private syncMetadata(): void {
    const overlay = this.meta.placement === 'overlay';
    this.world.customSpawns = overlay ? clone(this.base.customSpawns) : clone(this.meta.spawns);
    this.world.loseY = overlay ? this.base.loseY : this.meta.loseY;
    this.world.targetSpawns.splice(0, Infinity, ...clone(overlay ? this.base.targetSpawns : this.meta.targets));
    this.world.trees.splice(0, Infinity, ...clone([...(overlay ? this.base.trees : []), ...(this.meta.trees ?? [])]));
    this.world.lamps.splice(0, Infinity, ...clone([...(overlay ? this.base.lamps : []), ...(this.meta.lamps ?? [])]));
    this.world.obstacles.splice(0, Infinity, ...clone([...(overlay ? this.base.obstacles : []), ...(this.meta.obstacles ?? [])]));
    if (!overlay && this.meta.finish) this.world.race = { checkpoints: clone(this.meta.checkpoints), finish: clone(this.meta.finish) };
  }

  edit(rows: Row[], changeMeta?: (meta: Metadata) => void): void {
    if (rows.length > 65536) throw new Error('editor.tooLarge');
    const before = clone(this.meta), after = clone(this.meta);
    changeMeta?.(after);
    validateMapDocument({ ...after, blocks: [] }, { draft: true });
    const unique = new Map<string, Row>();
    for (const row of rows) {
      const [x, y, z, id] = row;
      if (!this.editable(x, y, z) || !Number.isInteger(id) || (id !== 0 && !PALETTE[id])) throw new Error('editor.locked');
      unique.set(`${x}:${y}:${z}`, row);
    }
    const cells: Change['cells'] = [];
    for (const [x, y, z, id] of unique.values()) {
      const old = this.world.get(x, y, z);
      if (old !== id) cells.push([x, y, z, old, id]);
    }
    if (!cells.length && JSON.stringify(before) === JSON.stringify(after)) return;
    const change = { cells, before, after };
    this.undoStack.push(change); this.redoStack = []; this.historyCells += cells.length;
    while (this.undoStack.length > 60 || this.historyCells > 300000) this.historyCells -= this.undoStack.shift()!.cells.length;
    this.apply(change, true);
  }

  private apply(change: Change, forward: boolean): void {
    for (const [x, y, z, old, next] of change.cells) this.world.set(x, y, z, forward ? next : old);
    this.meta = clone(forward ? change.after : change.before);
    this.syncMetadata(); this.revision++;
    this.onChange(change.cells.map(([x, y, z]) => [x, y, z]));
  }
  undo(): void {
    const change = this.undoStack.pop(); if (!change) return;
    this.historyCells -= change.cells.length; this.redoStack.push(change); this.apply(change, false);
  }
  redo(): void {
    const change = this.redoStack.pop(); if (!change) return;
    this.undoStack.push(change); this.historyCells += change.cells.length; this.apply(change, true);
  }
  region(a: Cell, b: Cell, visit: (x: number, y: number, z: number) => void): void {
    if (![...a, ...b].every(Number.isInteger) || volume(a, b) > 65536) throw new Error('editor.tooLarge');
    for (let x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++)
      for (let y = Math.min(a[1], b[1]); y <= Math.max(a[1], b[1]); y++)
        for (let z = Math.min(a[2], b[2]); z <= Math.max(a[2], b[2]); z++) visit(x, y, z);
  }
  fill(a: Cell, b: Cell, id: number, replaceId?: number): void {
    const rows: Row[] = [];
    this.region(a, b, (x, y, z) => { if (replaceId === undefined || this.world.get(x, y, z) === replaceId) rows.push([x, y, z, id]); });
    this.edit(rows);
  }
  copy(a: Cell, b: Cell): void {
    const rows: Row[] = [], origin = a.map((v, i) => Math.min(v, b[i]));
    this.region(a, b, (x, y, z) => rows.push([x - origin[0], y - origin[1], z - origin[2], this.world.get(x, y, z)]));
    this.clipboard = rows;
    this.clipboardSize = a.map((v, i) => Math.abs(v - b[i]) + 1) as Cell;
  }
  paste(at: Cell, turns = 0, includeAir = false): void {
    if (!this.clipboard.length) throw new Error('editor.emptyClipboard');
    const rotated = this.clipboard.filter(r => includeAir || r[3] !== 0).map(([x, y, z, id]): Row => {
      let width = this.clipboardSize[0], depth = this.clipboardSize[2];
      for (let i = 0; i < turns; i++) { [x, z] = [depth - 1 - z, x]; [width, depth] = [depth, width]; }
      return [x + at[0], y + at[1], z + at[2], rotateBlock(id, turns)];
    });
    this.edit(rotated);
  }
  move(a: Cell, b: Cell, at: Cell): void {
    const rows: Row[] = [], origin = a.map((v, i) => Math.min(v, b[i]));
    this.region(a, b, (x, y, z) => rows.push([x, y, z, 0]));
    this.region(a, b, (x, y, z) => rows.push([x - origin[0] + at[0], y - origin[1] + at[1], z - origin[2] + at[2], this.world.get(x, y, z)]));
    this.edit(rows);
  }
  marker(kind: MarkerKind, p: Position, size = 1): void {
    if (this.meta.placement === 'overlay' && !['tree', 'lamp', 'obstacle'].includes(kind)) throw new Error('editor.overlayMarkers');
    this.edit([], meta => {
      if (kind === 'spawn') meta.spawns.push({ ...p });
      if (kind === 'target') meta.targets.push({ ...p, zone: 'custom' });
      if (kind === 'checkpoint') meta.checkpoints.push({ ...p, radius: size });
      if (kind === 'finish') meta.finish = { ...p, radius: size };
      if (kind === 'tree') {
        meta.trees!.push({ ...p, scale: size });
        // Generated trunk collider stays tied to this tree via the UI's remove operation.
        meta.obstacles!.push({ ...p, radius: 0.3 * size, height: 7 * size });
      }
      if (kind === 'lamp') meta.lamps!.push([p.x, p.y, p.z]);
      if (kind === 'obstacle') meta.obstacles!.push({ ...p, radius: size, height: 2 });
    });
  }
  removeMarker(kind: MarkerKind, index: number): void {
    this.edit([], meta => {
      if (kind === 'finish') { delete meta.finish; return; }
      const key = { spawn: 'spawns', target: 'targets', checkpoint: 'checkpoints', tree: 'trees', lamp: 'lamps', obstacle: 'obstacles' }[kind] as 'spawns';
      if (kind === 'tree') {
        const tree = meta.trees?.[index];
        if (tree) { const i = meta.obstacles!.findIndex(o => o.x === tree.x && o.y === tree.y && o.z === tree.z && o.radius === tree.scale * 0.3 && o.height === tree.scale * 7); if (i >= 0) meta.obstacles!.splice(i, 1); }
      }
      meta[key]?.splice(index, 1);
    });
  }
  export(validate = true): MapDocument {
    const blocks: Row[] = [];
    for (let x = -MAP_HALF; x < MAP_HALF; x++) for (let z = -MAP_HALF; z < MAP_HALF; z++) for (let y = 0; y < MAP_HEIGHT; y++) {
      const id = this.world.get(x, y, z);
      if (this.meta.placement === 'replace' ? id !== 0 : id !== this.base.get(x, y, z)) blocks.push([x, y, z, id]);
    }
    const doc = { ...clone(this.meta), blocks };
    validateMapDocument(doc, { draft: !validate });
    return doc;
  }
  static import(doc: MapDocument, draft = false): EditorDocument {
    validateMapDocument(doc, { draft });
    const model = new EditorDocument(doc.mode);
    const { blocks, ...meta } = clone(doc);
    model.meta = { ...meta, version: 2, trees: meta.trees ?? [], lamps: meta.lamps ?? [], obstacles: meta.obstacles ?? [] };
    if (doc.placement === 'replace') model.world.data.fill(0);
    for (const [x, y, z, id] of blocks) model.world.set(x, y, z, id);
    model.syncMetadata(); return model;
  }
}
