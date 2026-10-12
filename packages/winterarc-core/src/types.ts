export type GameId = 'hunt' | 'colorfall' | 'giftrace' | 'crab' | 'icebreak' | 'knockout' | 'wallduel';
export type MatchFormat = 'solo' | 'squad';
export type Phase = 'lobby' | 'countdown' | 'playing' | 'intermission' | 'finished';
export type Vec3 = [number, number, number];
export interface Position {
  x: number;
  y: number;
  z: number;
}
export interface Motion extends Position {
  vx?: number;
  vz?: number;
  vy: number;
  yaw: number;
  pitch: number;
}
export interface Controls {
  forward: number;
  side: number;
  yaw: number;
  pitch: number;
  jump: boolean;
  sprint: boolean;
}
export interface Target extends Position {
  id: string;
  zone: string;
}
export type BossAction = 'idle' | 'slam' | 'leap' | 'shockwave' | 'recover' | 'dead';
export interface DangerZone {
  id: string;
  kind: 'circle' | 'ring';
  x: number;
  z: number;
  radius: number;
  inner: number;
  remaining: number;
  duration: number;
}

export type SkyQuality = 'auto' | 'off' | 'low' | 'high';

/** A room can choose a concrete mode or draw a new one before each match. */
export type ModeSelection = GameId | 'random';
