import type { RoomState } from 'winterarc-protocol';
import { Schema, MapSchema, ArraySchema, defineTypes } from '@colyseus/schema';
import type { ModeSelection, BossAction, GameId, Phase, Target, MatchFormat } from 'winterarc-core';
export class PlayerState extends Schema {
  accountId = '';
  avatar = 'snowman';
  avatarUrl = '';
  school = '';
  frameId = 'none';
  skinId = 'explorer';
  roles = new ArraySchema<string>();
  theme = 'paper';
  premium = false;
  observer = false;
  admin = false; // Server-only; not a client-supplied role.
  name = 'Khách';
  color = 0;
  x = 0;
  y = 3;
  z = -14;
  launchPower = 0;
  vx = 0;
  vz = 0;
  vy = 0;
  yaw = 0;
  pitch = 0;
  ack = -1;
  score = 0;
  ready = false;
  connected = true;
  found = new ArraySchema<string>();
  hp = 100;
  deaths = 0;
  out = false;
  totalScore = 0;
  qualified = false;
  eliminatedRound = 0;
  rank = 0;
  checkpoint = 0;
  // Server-only ranking inputs, intentionally absent from defineTypes.
  finishedAt = 0;
  eliminatedAt = 0;
  progress = 0;
  tieOrder = 0;
}
defineTypes(PlayerState, {
  school: 'string', avatarUrl: 'string', frameId: 'string', skinId: 'string', roles: ['string'],
  accountId: 'string', avatar: 'string', theme: 'string', premium: 'boolean', observer: 'boolean',
  name: 'string',
  color: 'uint8',
  x: 'float32',
  y: 'float32',
  z: 'float32',
  launchPower: 'uint8',
  vx: 'float32',
  vz: 'float32',
  vy: 'float32',
  yaw: 'float32',
  pitch: 'float32',
  ack: 'int32',
  score: 'uint32',
  ready: 'boolean',
  connected: 'boolean',
  found: ['string'],
  hp: 'uint8',
  deaths: 'uint8',
  out: 'boolean',
  totalScore: 'uint32',
  qualified: 'boolean',
  eliminatedRound: 'uint8',
  rank: 'uint8',
  checkpoint: 'uint8',
});
export class SnowmanState extends Schema implements Target {
  id = '';
  x = 0;
  y = 3;
  z = 0;
  zone = '';
}
defineTypes(SnowmanState, {
  id: 'string',
  x: 'float32',
  y: 'float32',
  z: 'float32',
  zone: 'string',
});
export class BossState extends Schema {
  hp = 0;
  maxHp = 0;
  stage = 1;
  action: BossAction = 'idle';
  x = 0;
  y = 3;
  z = 0;
  yaw = Math.PI;
  flash = 0;
  progress = 0;
  shockRadius = 0;
  impactSerial = 0;
}
defineTypes(BossState, {
  hp: 'uint32',
  maxHp: 'uint32',
  stage: 'uint8',
  action: 'string',
  x: 'float32',
  y: 'float32',
  z: 'float32',
  yaw: 'float32',
  flash: 'uint16',
  progress: 'float32',
  shockRadius: 'float32',
  impactSerial: 'uint16',
});
export class ZoneState extends Schema {
  id = '';
  kind: 'circle' | 'ring' = 'circle';
  x = 0;
  z = 0;
  radius = 1;
  inner = 0;
  remaining = 1;
  duration = 1;
}
defineTypes(ZoneState, {
  id: 'string',
  kind: 'string',
  x: 'float32',
  z: 'float32',
  radius: 'float32',
  inner: 'float32',
  remaining: 'float32',
  duration: 'float32',
});
export class WinterState extends Schema implements RoomState {
  modeSelection: ModeSelection = 'hunt';
  tournamentId = '';
  tournamentTitle = '';
  tournamentCapacity = 32;
  tournamentRounds = 0;
  tournamentCompleted = 0;
  resultMode: GameId = 'hunt';
  seaTurn = 1;
  seaActiveId = '';
  seaRemaining = 20;
  duelHunterId = '';
  duelHiderId = '';
  duelStage = 'hide';
  duelTurn = 1;
  duelAmmo = 3;
  duelRemaining = 3;
  duelYaw = 0;
  duelPitch = 0;
  duelCharge = 0;
  knockoutStage = 'aim';
  knockoutRemaining = 10;
  knockoutTurn = 1;
  iceRadius = 18;
  iceShrinkIn = 15;
  mode: GameId = 'hunt';
  privateRoom = false;
  players = new MapSchema<PlayerState>();
  format: MatchFormat = 'solo';
  stages = new ArraySchema<string>();
  winnerIds = new ArraySchema<string>();
  stageIndex = 0;
  entrants = 0;
  quota = 0;
  goal = 0;
  elapsed = 0;
  floorCycle = 0;
  floorSafeBlock = 17;
  floorRemaining = 0;
  floorDropped = false;
  targets = new ArraySchema<SnowmanState>();
  brokenIce = new ArraySchema<string>();
  zones = new ArraySchema<ZoneState>();
  boss = new BossState();
  phase: Phase = 'lobby';
  hostId = '';
  winnerName = '';
  reason = '';
  round = 0;
  seed = 0;
  countdown = 0;
  remaining = 480;
  total = 12;
}
defineTypes(WinterState, {
  modeSelection: 'string',
  tournamentCapacity: 'uint8',
  tournamentId: 'string', tournamentTitle: 'string', tournamentRounds: 'uint8', tournamentCompleted: 'uint8',
  resultMode: 'string',
  seaTurn: 'uint32', seaActiveId: 'string', seaRemaining: 'float32',
  duelHunterId: 'string',
  duelHiderId: 'string',
  duelStage: 'string',
  duelTurn: 'uint32',
  duelAmmo: 'uint8',
  duelRemaining: 'float32',
  duelYaw: 'float32',
  duelPitch: 'float32',
  duelCharge: 'float32',
  knockoutStage: 'string', knockoutRemaining: 'float32', knockoutTurn: 'uint16',
  iceRadius: 'float32',
  iceShrinkIn: 'float32',
  privateRoom: 'boolean',
  mode: 'string',
  format: 'string',
  stages: ['string'],
  winnerIds: ['string'],
  stageIndex: 'uint8',
  entrants: 'uint8',
  quota: 'uint8',
  goal: 'uint16',
  elapsed: 'float32',
  floorCycle: 'uint16',
  floorSafeBlock: 'uint8',
  floorRemaining: 'float32',
  floorDropped: 'boolean',
  players: { map: PlayerState },
  targets: [SnowmanState],
  brokenIce: ['string'],
  zones: [ZoneState],
  boss: BossState,
  phase: 'string',
  hostId: 'string',
  winnerName: 'string',
  reason: 'string',
  round: 'uint16',
  seed: 'uint32',
  countdown: 'uint8',
  remaining: 'uint16',
  total: 'uint8',
});
