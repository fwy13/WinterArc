import type { GameId, MatchFormat, ModeSelection } from 'winterarc-core';
import type { Snapshot, InputCommand, DuelPrivate, CodeView, SoundEvent, ShotEvent } from './messages.js';

export interface PublicRoom {
  roomId: string;
  clients: number;
  maxClients: number;
  locked: boolean;
  format: MatchFormat;
  phase: Snapshot['phase'];
  mode: GameId;
  modeSelection: ModeSelection;
}

export interface ConnectOptions {
  tournament?: { title: string; rounds: number; maxPlayers: number };
  observer?: boolean;
  format: MatchFormat;
  mode: ModeSelection;
  name: string;
  code?: string;
  privateRoom?: boolean;
  password?: string;
}

/** Typed outgoing messages; the server still validates untrusted payloads at runtime. */
export interface ClientMessages {
  codeGuess: { round: number; code: string };
  input: InputCommand;
  find: { round: number; target: string };
  attack: { round: number };
  format: MatchFormat;
  mode: ModeSelection;
  ping: number;
  start: undefined;
  ready: undefined;
  lobby: undefined;
}
export interface ServerMessages {
  codeView: CodeView;
  duelPrivate: DuelPrivate;
  notice: string;
  sound: SoundEvent;
  shot: ShotEvent;
  found: { score: number };
  pong: number;
  accountChanged: undefined;
}
