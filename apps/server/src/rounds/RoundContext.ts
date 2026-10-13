import type { SoundKind, ShotEvent, InputCommand, DuelPrivate, CodeView } from 'winterarc-protocol';
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
  resetInputs?(): void;
  privateCodes(id: string, data: CodeView): void;
  notice(id: string, text: string): void;
  privateDuel(id: string, data: DuelPrivate): void;
}
export interface RoundController {
  input?(id: string, cmd: InputCommand | undefined): void;
  prepare(): void;
  update(dt: number): void;
  interact?(id: string, data: unknown): void;
  attack?(id: string): void;
  aim?(id: string, yaw: number, power: number, turn: number): void;
}
