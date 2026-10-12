import type { ModeSelection, Controls, Motion, Position, Vec3, GameId, MatchFormat, Phase, Target, BossAction, DangerZone } from 'winterarc-core';

export interface InputCommand extends Controls {
  seaTurn?: number;
  seaCell?: number;
  seaFire?: boolean;
  duelTurn?: number;
  duelPose?: number;
  duelFire?: boolean;
  knockoutPower?: number;
  knockoutTurn?: number;
  seq: number;
  round: number;
}
export interface PlayerSnapshot extends Motion {
  launchPower?: number;
  accountId: string;
  avatar: string;
  avatarUrl: string;
  school: string;
  frameId: string;
  skinId: string;
  roles: string[];
  theme: string;
  premium: boolean;
  observer: boolean;
  id: string;
  name: string;
  color: number;
  ack: number;
  score: number;
  totalScore: number;
  ready: boolean;
  connected: boolean;
  found: string[];
  hp: number;
  deaths: number;
  out: boolean;
  qualified: boolean;
  eliminatedRound: number;
  rank: number;
  checkpoint: number;
}
export interface BossSnapshot extends Position {
  hp: number;
  maxHp: number;
  stage: number;
  action: BossAction;
  yaw: number;
  flash: number;
  progress: number;
  shockRadius: number;
  impactSerial: number;
}
export interface BlockChange {
  x: number;
  y: number;
  z: number;
  block: number;
}
export type SoundKind =
  | 'sniper'
  | 'found'
  | 'throw'
  | 'hit'
  | 'break'
  | 'place'
  | 'deliver'
  | 'impact';
export interface SoundEvent {
  id: string;
  kind: SoundKind;
  at: Vec3;
  playerId: string;
}
export interface ShotEvent {
  from: Vec3;
  to: Vec3;
  hit: boolean;
  playerId: string;
}
export interface DuelPrivate { round: number; turn: number; x: number; pose: number }
export interface SeaPrivate { round:number; own:number[]; shots:number[]; incoming:number[]; sunk:number; enemySunk:number }
export interface Snapshot {
  sea: { turn:number; activeId:string; remaining:number; self?:SeaPrivate };
  duel: { hunterId: string; hiderId: string; stage: string; turn: number; ammo: number; remaining: number; yaw: number; pitch: number; charge: number; self?: DuelPrivate };
  modeSelection: ModeSelection;
  tournamentId: string;
  tournamentTitle: string;
  tournamentCapacity: number;
  tournamentRounds: number;
  tournamentCompleted: number;
  resultMode: GameId;
  knockout: { stage: string; remaining: number; turn: number };
  ice: { radius: number; shrinkIn: number };
  privateRoom: boolean;
  roomId: string;
  selfId: string;
  mode: GameId;
  format: MatchFormat;
  phase: Phase;
  hostId: string;
  round: number;
  stageIndex: number;
  stages: GameId[];
  countdown: number;
  remaining: number;
  elapsed: number;
  seed: number;
  entrants: number;
  quota: number;
  total: number;
  goal: number;
  winnerIds: string[];
  winnerName: string;
  reason: string;
  players: PlayerSnapshot[];
  targets: Target[];
  boss: BossSnapshot;
  zones: DangerZone[];
  brokenIce: string[];
  floor: { cycle: number; safeBlock: number; remaining: number; dropped: boolean };
}
export const TOURNAMENT_ROOM = 'winter_tournament';
