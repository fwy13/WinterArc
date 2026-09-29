import type { Engine } from 'noa-engine';
import type { Motion, GameId } from 'winterarc-core';
import type { Snapshot, ShotEvent } from 'winterarc-protocol';
import type { MeshFactory } from '../engine/MeshFactory.js';
import type { ModelManager } from '../engine/ModelManager.js';
import type { EffectsManager } from '../engine/EffectsManager.js';
import type { MapManager } from '../engine/MapManager.js';
export interface ModeContext {
  noa: Engine;
  meshes: MeshFactory;
  models: ModelManager;
  effects: EffectsManager;
  map: MapManager;
  notice: (message: string) => void;
}
export interface GameMode {
  readonly id: GameId;
  sync(snapshot: Snapshot | null): void;
  render(dt: number, time: number): void;
  interaction(pose: Motion): string | null;
  onShot(event: ShotEvent): void;
  dispose(): void;
}
