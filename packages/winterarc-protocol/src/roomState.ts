import type { DangerZone, Target } from 'winterarc-core';
import type { Snapshot, PlayerSnapshot } from './messages.js';

/** Structural view of the decoded Colyseus state, with no server-only members.
 * Iterable collections accept ArraySchema/MapSchema without importing their runtime.
 */
export interface RoomPlayer extends Omit<PlayerSnapshot, 'id' | 'roles' | 'found'> {
  roles: Iterable<string>;
  found: Iterable<string>;
}
export interface RoomState extends Omit<Snapshot,
  'roomId' | 'selfId' | 'ice' | 'floor' | 'players' | 'targets' | 'zones'
  | 'brokenIce' | 'stages' | 'winnerIds'
> {
  iceRadius: number;
  iceShrinkIn: number;
  floorCycle: number;
  floorSafeBlock: number;
  floorRemaining: number;
  floorDropped: boolean;
  players: Iterable<[string, RoomPlayer]>;
  targets: Iterable<Target>;
  zones: Iterable<DangerZone>;
  brokenIce: Iterable<string>;
  stages: Iterable<string>;
  winnerIds: Iterable<string>;
}
