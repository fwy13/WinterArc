import type { Server } from '@colyseus/core';
import { TOURNAMENT_ROOM } from 'winterarc-protocol';
import { TournamentRoom } from './TournamentRoom.js';
export class RoomRegistry {
  static register(server: Server): void {
    server.define(TOURNAMENT_ROOM, TournamentRoom);
  }
}
