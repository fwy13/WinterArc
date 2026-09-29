import type { SoundKind, ShotEvent } from 'winterarc-protocol';
import type { Vec3 } from 'winterarc-core';
import type { VoxelWorld } from 'winterarc-world';
import type { WinterState, PlayerState } from '../state.js';
export interface RoundContext {
  state: WinterState;
  world: VoxelWorld;
  roster: readonly string[];
  alive(): [string, PlayerState][];
  eliminate(id: string): void;
  qualify(id: string): void;
  complete(reason: string): void;
  sound(kind: SoundKind, at: Vec3, playerId?: string): void;
  shot(event: ShotEvent): void;
  found(id: string, score: number): void;
}
export interface RoundController {
  prepare(): void;
  update(dt: number): void;
  interact?(id: string, data: unknown): void;
  attack?(id: string): void;
}
