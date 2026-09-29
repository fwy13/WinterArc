import { RoomPassword } from './RoomPassword.js';
import { Room, ServerError, type Client } from '@colyseus/core';
import { accounts, AccountError, type MatchResult } from '../account/AccountStore.js';
import type { AccountProfile } from 'winterarc-profile';
type RoomProfile = AccountProfile & { adminSessionHash: string };
import { randomInt, randomUUID } from 'node:crypto';
import { GAME_DEFINITIONS, IDLE, MAX_PLAYERS, STEP, movePlayer } from 'winterarc-gameplay';
import { validInput, type InputCommand } from 'winterarc-protocol';
import { type GameId } from 'winterarc-core';
import { WorldFactory, randomFromSeed, type VoxelWorld } from 'winterarc-world';
import { BossState, PlayerState, WinterState } from '../state.js';
import { createRound } from '../rounds/RoundRegistry.js';
import type { RoundController, RoundContext } from '../rounds/RoundContext.js';
interface InputQueue {
  last: number;
  commands: InputCommand[];
}
/** One room, one selected mode per match. The host can change mode in the lobby. */
export class TournamentRoom extends Room<WinterState> {
  private lastPlayedMode?: GameId;
  private world!: VoxelWorld;
  private readonly adminSessions = new Map<string, string>();
  private matchId = '';
  private pendingResult: MatchResult | null = null;
  private canManage(client: Client): boolean {
    const p = this.state.players.get(client.sessionId);
    return !!p?.connected && (this.state.tournamentId ? !!accounts().adminAuth.currentHash(this.adminSessions.get(client.sessionId) || '') : client.sessionId === this.state.hostId);
  }
  private flushResult(): void {
    if (!this.pendingResult) return;
    try {
      accounts().settle(this.pendingResult);
      this.pendingResult = null;
      if (this.state.tournamentId) this.state.tournamentCompleted = accounts().event(this.state.tournamentId).completed_rounds;
      if (this.state.tournamentId && this.state.tournamentCompleted >= this.state.tournamentRounds) this.autoDispose = true;
      this.broadcast('accountChanged');
    } catch (error) {
      console.error('Result settlement pending', this.matchId, error);
      this.clock.setTimeout(() => this.flushResult(), 5000);
    }
  }
  onDispose(): void {
    if (!this.state?.players) return;
    this.flushResult();
    for (const p of this.state.players.values()) accounts().release(p.accountId, this.roomId);
    if (this.state.tournamentId) accounts().releaseEventRoom(this.state.tournamentId, this.roomId);
  }

  private controller: RoundController | null = null;
  private roster: string[] = [];
  private password: RoomPassword | null = null;
  private inputs = new Map<string, InputQueue>();
  private actionTimes = new Map<string, number>();
  private accumulator = 0;
  private phaseTicks = 0;
  private playTicks = 0;
  private eventSerial = 0;
  async onCreate(
    options: {
      accessTicket?: unknown;
      tournament?: { title?: unknown; rounds?: unknown; maxPlayers?: unknown };
      format?: unknown;
      mode?: unknown;
      privateRoom?: unknown;
      password?: unknown;
    } = {},
  ): Promise<void> {
    const owner = accounts().ticket(options.accessTicket);
    this.maxClients = MAX_PLAYERS + 4;
    this.state = new WinterState();
    this.state.format = options.format === 'squad' ? 'squad' : 'solo';
    if (options.tournament !== undefined) {
      if (!owner.admin) throw new ServerError(403, 'ADMIN_REQUIRED');
      if (!options.tournament || typeof options.tournament !== 'object') throw new ServerError(400, 'TOURNAMENT_INVALID');
      options.privateRoom = true;
      this.state.format = 'solo';
    }
    if (options.mode !== 'random' && !this.isMode(options.mode)) throw new ServerError(400, 'MODE_INVALID');
    this.state.modeSelection = options.mode;
    const initialMode = options.mode === 'random' ? this.drawMode() : options.mode;
    this.state.privateRoom = options.privateRoom === true;
    if (this.state.privateRoom) this.password = await RoomPassword.create(options.password);
    if (options.tournament) {
      try {
        this.state.tournamentId = accounts().createRoomTournament(owner.adminSessionHash, this.roomId,
          options.tournament.title, initialMode, options.tournament.rounds, options.tournament.maxPlayers);
      } catch (error) {
        throw new ServerError(error instanceof AccountError ? error.status : 400, error instanceof Error ? error.message : 'TOURNAMENT_INVALID');
      }
      const event = accounts().event(this.state.tournamentId);
      this.state.tournamentTitle = event.title;
      this.state.tournamentRounds = event.rounds;
      this.state.tournamentCapacity = event.max_players;
      this.maxClients = event.max_players + 4;
    }
    await this.setPrivate(this.state.privateRoom);
    this.selectMode(initialMode);
    this.publishListing();
    this.patchRate = 50;
    this.clock.setInterval(() => this.assignHost(), 2000);
    this.onMessage('input', (client, data: unknown) => {
      if (this.state.players.get(client.sessionId)?.observer) return;
      const queue = this.inputs.get(client.sessionId);
      // Reject delayed packets from the previous map. Only playing input enters the queue.
      if (
        this.state.phase !== 'playing' ||
        !queue ||
        !validInput(data) ||
        data.round !== this.state.round ||
        data.seq <= queue.last ||
        data.seq > queue.last + 120
      )
        return;
      queue.last = data.seq;
      queue.commands.push({ ...data });
      if (queue.commands.length > 9) queue.commands.splice(0, queue.commands.length - 3);
    });
    this.onMessage('ready', (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p?.connected && !p.observer && ['lobby', 'finished'].includes(this.state.phase) && this.throttle(client.sessionId, 'ready', 200)) p.ready = !p.ready;
    });
    this.onMessage('format', (client, value: unknown) => {
      if (
        !this.canManage(client) || this.state.tournamentId !== '' ||
        !['lobby', 'finished'].includes(this.state.phase) ||
        (value !== 'solo' && value !== 'squad')
      )
        return;
      this.state.format = value;
      this.publishListing();
      for (const p of this.state.players.values()) p.ready = false;
    });
    this.onMessage('mode', (client, value: unknown) => {
      if (
        !this.canManage(client) || this.state.tournamentId !== '' ||
        !['lobby', 'finished'].includes(this.state.phase) ||
        (value !== 'random' && !this.isMode(value))
      )
        return;
      this.state.modeSelection = value;
      if (value !== 'random') this.selectMode(value);
      for (const p of this.state.players.values()) p.ready = false;
      this.publishListing();
    });
    this.onMessage('lobby', (client) => {
      if (!this.canManage(client) || this.state.tournamentId || this.state.phase !== 'finished') return;
      this.controller = null;
      this.state.phase = 'lobby';
      this.state.winnerIds.clear();
      this.state.winnerName = '';
      this.state.reason = '';
      this.state.stageIndex = 0;
      for (const [id, p] of this.state.players) {
        if (!p.connected) this.state.players.delete(id);
        else Object.assign(p, { ready: false, out: p.observer, qualified: false, rank: 0, hp: p.observer ? 0 : 100 });
      }
      this.selectMode(this.state.mode);
      this.publishListing();
      void this.unlock();
    });
    this.onMessage('start', (client) => this.startMatch(client));
    this.onMessage('find', (client, message: unknown) => {
      if (!this.validAction(client.sessionId, message, 'interact', 180)) return;
      this.controller?.interact?.(client.sessionId, (message as { target: unknown }).target);
    });
    this.onMessage('attack', (client, message: unknown) => {
      if (
        !this.validAction(
          client.sessionId,
          message,
          'attack',
          this.state.mode === 'crab' ? 420 : 350,
        )
      )
        return;
      this.controller?.attack?.(client.sessionId);
    });
    this.onMessage('ping', (client, value: unknown) => {
      if (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        this.throttle(client.sessionId, 'ping', 800)
      )
        client.send('pong', value);
    });
    this.setSimulationInterval((delta) => {
      this.accumulator += Math.min(delta, 150);
      while (this.accumulator >= STEP * 1000) {
        this.tick();
        this.accumulator -= STEP * 1000;
      }
    }, STEP * 1000);
  }
  private drawMode(): GameId {
    const modes = (Object.keys(GAME_DEFINITIONS) as GameId[])
      .filter(mode => mode !== this.lastPlayedMode);
    return modes[randomInt(modes.length)];
  }
  private isMode(value: unknown): value is GameId {
    return typeof value === 'string' && Object.hasOwn(GAME_DEFINITIONS, value);
  }
  private selectMode(mode: GameId): void {
    this.state.mode = mode;
    // Retain these wire fields so existing snapshots and previews remain compatible.
    this.state.stages.clear();
    this.state.stages.push(mode);
    this.state.stageIndex = 0;
    this.world = WorldFactory.create(mode);
    let index = 0;
    for (const p of this.state.players.values()) {
      Object.assign(p, this.world.spawn(index++), { vy: 0 });
    }
  }
  private publishListing(): void {
    void this.setMetadata({
      format: this.state.format,
      phase: this.state.phase,
      stageIndex: this.state.stageIndex,
      mode: this.state.mode,
      modeSelection: this.state.modeSelection,
    }).catch((error: unknown) => console.error('Room listing update failed', error));
  }
  async onAuth(_client: Client, options: { password?: unknown; accessTicket?: unknown; observer?: unknown } = {}): Promise<{ profile: RoomProfile; observer: boolean }> {
    try {
      const profile = accounts().ticket(options.accessTicket, true);
      const observer = options.observer === true;
      if (observer && !profile.admin) throw new AccountError(403, 'ADMIN_REQUIRED');
      if (!observer && !['lobby', 'finished'].includes(this.state.phase)) throw new AccountError(403, 'Match already begun');
      if (this.password) await this.password.verify(options.password);
      if (!observer && !['lobby', 'finished'].includes(this.state.phase)) throw new AccountError(403, 'Match already begun');
      return { profile, observer };
    } catch (error) {
      if (error instanceof AccountError) throw new ServerError(error.status, error.message);
      throw error;
    }
  }
  onJoin(client: Client, _options: unknown, auth: { profile: RoomProfile; observer: boolean }): void {
    const { profile, observer } = auth;
    if (!observer && !['lobby', 'finished'].includes(this.state.phase)) throw new ServerError(403, 'Match already begun');
    const contestants = [...this.state.players.values()].filter(p => !p.observer && p.connected);
    const capacity = this.state.tournamentId ? accounts().event(this.state.tournamentId).max_players : MAX_PLAYERS;
    if ((!observer && contestants.length >= capacity) || (observer && [...this.state.players.values()].filter(p => p.observer).length >= 4)) throw new ServerError(409, 'ROOM_FULL');
    try { accounts().claim(profile.id, this.roomId); }
    catch (error) { throw new ServerError(409, error instanceof Error ? error.message : 'ALREADY_IN_ROOM'); }
    const p = new PlayerState();
    Object.assign(p, { accountId: profile.id, name: profile.name, avatar: profile.avatar,
      theme: profile.theme, premium: profile.premium, color: profile.color,
      skinId: profile.skinId, school: profile.school, avatarUrl: profile.avatarUrl, frameId: profile.frameId,
      observer, admin: profile.admin, out: observer, hp: observer ? 0 : 100 });
    if (profile.admin) this.adminSessions.set(client.sessionId, profile.adminSessionHash);
    p.roles.push(...profile.roles);
    Object.assign(p, this.world.spawn(contestants.length));
    this.state.players.set(client.sessionId, p);
    this.inputs.set(client.sessionId, { last: -1, commands: [] });
    this.assignHost();
  }
  async onLeave(client: Client, consented: boolean): Promise<void> {
    const id = client.sessionId,
      p = this.state.players.get(id);
    if (!p) return;
    if (p.observer && !accounts().adminAuth.currentHash(this.adminSessions.get(id) || '')) consented = true;
    p.connected = false;
    p.ready = false;
    const queue = this.inputs.get(id);
    if (queue) queue.commands.length = 0;
    this.assignHost();
    if (consented) this.eliminate(id);
    try {
      if (consented) throw new Error('left');
      await this.allowReconnection(client, 20);
      p.connected = true;
      this.assignHost();
    } catch {
      this.eliminate(id);
      this.inputs.delete(id);
      this.adminSessions.delete(id);
      accounts().release(p.accountId, this.roomId);
      // Keep the participant record through the result screen; prune before the next match.
      if (this.state.phase === 'lobby') this.state.players.delete(id);
      this.assignHost();
    }
  }
  private assignHost(): void {
    for (const [id, player] of this.state.players) {
      player.admin = !!accounts().adminAuth.currentHash(this.adminSessions.get(id) || '');
      if (player.observer && !player.admin && player.connected) {
        player.connected = false;
        void this.clients.find(client => client.sessionId === id)?.leave(4003);
      }
    }
    const valid = (p: PlayerState) => p.connected && (this.state.tournamentId ? p.admin : !p.observer);
    const current = this.state.players.get(this.state.hostId);
    if (!current || !valid(current)) this.state.hostId = [...this.state.players].find(([, p]) => valid(p))?.[0] || '';
  }
  private throttle(id: string, action: string, delay: number): boolean {
    const key = `${id}:${action}`,
      now = Date.now();
    if (now - (this.actionTimes.get(key) ?? 0) < delay) return false;
    this.actionTimes.set(key, now);
    return true;
  }
  private validAction(id: string, message: unknown, action: string, delay: number): boolean {
    const p = this.state.players.get(id);
    if (this.state.phase !== 'playing' || !p?.connected || p.observer || p.out || p.qualified || p.hp <= 0)
      return false;
    if (
      !message ||
      typeof message !== 'object' ||
      (message as { round?: unknown }).round !== this.state.round
    )
      return false;
    return this.throttle(id, action, delay);
  }
  private startMatch(client: Client): void {
    if (!this.canManage(client) || !['lobby', 'finished'].includes(this.state.phase))
      return;
    if (this.pendingResult) { client.send('notice', '@account.settling'); return; }
    if ([...this.state.players].some(([id, p]) => !p.connected && this.inputs.has(id))) {
      client.send('notice', '@account.waitReconnect'); return;
    }
    const connected = [...this.state.players].filter(([, p]) => p.connected && !p.observer);
    if (connected.length < 1) {
      client.send('notice', '@notice.minimum');
      return;
    }
    if (
      connected.some(([id, p]) => !p.ready && (this.state.phase === 'finished' || id !== client.sessionId))
    ) {
      client.send('notice', '@notice.waitReady');
      return;
    }
    const nextMode = this.state.modeSelection === 'random' ? this.drawMode() : this.state.modeSelection;
    if (this.state.tournamentId) {
      try { accounts().beginHeat(this.state.tournamentId, connected.map(([,p]) => p.accountId), nextMode); }
      catch { client.send('notice', '@account.tournamentNotReady'); return; }
    }
    this.selectMode(nextMode);
    this.lastPlayedMode = nextMode;
    for (const [id, p] of this.state.players) if (!p.connected) {
      accounts().release(p.accountId, this.roomId);
      this.state.players.delete(id);
    }
    for (const [, p] of connected)
      Object.assign(p, { out: false, eliminatedRound: 0, totalScore: 0, ready: false, rank: 0 });
    this.state.winnerIds.clear();
    this.state.winnerName = '';
    this.state.reason = '';
    this.state.stageIndex = 0;
    this.actionTimes.clear();
    // Keep observer seats available. onAuth rejects contestants during a running round.
    void this.unlock();
    this.beginStage(connected.map(([id]) => id));
  }
  private beginStage(ids: string[]): void {
    this.roster = ids.filter((id) => this.state.players.get(id)?.connected);
    if (!this.roster.length) {
      this.finishMatch([], 'all-out');
      return;
    }
    this.state.mode = this.state.stages[this.state.stageIndex] as GameId;
    this.state.round++;
    this.matchId = randomUUID();
    this.state.seed = randomInt(1, 2147483647);
    this.world = WorldFactory.create(this.state.mode);
    this.state.entrants = this.roster.length;
    this.state.quota = this.state.format === 'squad' ? this.roster.length : 1;
    this.state.targets.clear();
    this.state.zones.clear();
    this.state.brokenIce.clear();
    this.state.boss = new BossState();
    this.state.floorCycle = 0;
    this.state.floorDropped = false;
    this.state.floorRemaining = 0;
    this.state.total = 0;
    this.state.goal = 0;
    this.state.elapsed = 0;
    this.state.reason = '';
    this.state.remaining = GAME_DEFINITIONS[this.state.mode].duration;
    this.state.phase = 'countdown';
    this.publishListing();
    this.state.countdown = 5;
    this.phaseTicks = 0;
    this.playTicks = 0;
    const random = randomFromSeed(this.state.seed);
    const shuffled = [...this.roster];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (const [id, p] of this.state.players) {
      const index = this.roster.indexOf(id);
      const profile = accounts().profile(p.accountId);
      Object.assign(p, { name: profile.name, avatar: profile.avatar, theme: profile.theme, premium: profile.premium, color: profile.color });
      p.skinId = profile.skinId;
      p.school = profile.school;
      p.avatarUrl = profile.avatarUrl;
      p.frameId = profile.frameId;
      p.roles.clear();
      p.roles.push(...profile.roles);
      p.qualified = false;
      p.rank = 0;
      p.score = 0;
      p.found.clear();
      p.finishedAt = 0;
      p.eliminatedAt = 0;
      p.progress = 0;
      p.checkpoint = 0;
      p.deaths = 0;
      if (index >= 0) {
        Object.assign(p, this.world.spawn(index), { hp: 100, vy: 0, yaw: 0, pitch: 0, out: false });
        p.tieOrder = shuffled.indexOf(id);
      }
      const queue = this.inputs.get(id);
      if (queue) {
        queue.commands.length = 0;
        p.ack = queue.last;
      }
    }
    const context: RoundContext = {
      state: this.state,
      world: this.world,
      roster: this.roster,
      alive: () => this.alive(),
      eliminate: (id) => this.eliminate(id),
      qualify: (id) => this.qualify(id),
      complete: (reason) => this.completeStage(reason),
      sound: (kind, at, playerId = '') =>
        this.broadcast('sound', {
          id: `${this.state.round}:${++this.eventSerial}`,
          kind,
          at,
          playerId,
        }),
      shot: (event) => this.broadcast('shot', event),
      found: (id, score) => this.clients.find((c) => c.sessionId === id)?.send('found', { score }),
    };
    this.controller = createRound(this.state.mode, context);
    this.controller.prepare();
  }
  private alive(): [string, PlayerState][] {
    // Disconnected contestants remain vulnerable during the reconnection grace period.
    return this.roster.flatMap((id) => {
      const p = this.state.players.get(id);
      return p && !p.out ? [[id, p] as [string, PlayerState]] : [];
    });
  }
  private eliminate(id: string): void {
    const p = this.state.players.get(id);
    if (!p || p.out) return;
    p.out = true;
    p.hp = 0;
    p.vy = 0;
    p.qualified = false;
    p.eliminatedAt = this.state.elapsed;
    p.eliminatedRound = this.state.stageIndex + 1;
  }
  private qualify(id: string): void {
    const p = this.state.players.get(id);
    if (!p || p.qualified || p.out) return;
    p.qualified = true;
    p.finishedAt = this.state.elapsed;
    if (this.alive().filter(([, q]) => q.qualified).length >= this.state.quota)
      this.completeStage('quota-filled');
  }
  private ranked(): [string, PlayerState][] {
    return this.roster
      .flatMap((id) => {
        const p = this.state.players.get(id);
        return p ? [[id, p] as [string, PlayerState]] : [];
      })
      .sort(([, a], [, b]) => {
        if (a.out !== b.out) return Number(a.out) - Number(b.out);
        if (a.qualified !== b.qualified) return Number(b.qualified) - Number(a.qualified);
        if (a.qualified && b.qualified)
          return a.finishedAt - b.finishedAt || a.tieOrder - b.tieOrder;
        if (a.out && b.out) return b.eliminatedAt - a.eliminatedAt || a.tieOrder - b.tieOrder;
        const progress =
          this.state.mode === 'hunt' ? a.progress - b.progress : b.progress - a.progress;
        return (
          b.score - a.score ||
          progress ||
          b.hp - a.hp ||
          a.deaths - b.deaths ||
          a.tieOrder - b.tieOrder
        );
      });
  }
  private completeStage(reason: string): void {
    if (this.state.phase !== 'playing') return;
    const ranked = this.ranked();
    const eligible = ranked.filter(([, p]) => !p.out && p.connected);
    let passing = eligible.slice(0, this.state.quota).map(([id]) => id);
    if (this.state.format === 'squad')
      passing =
        this.state.mode === 'crab' && reason !== 'boss-defeated'
          ? []
          : eligible
              .filter(([, p]) => !['hunt', 'giftrace'].includes(this.state.mode) || p.qualified)
              .map(([id]) => id);
    if (this.state.mode === 'crab' && reason !== 'boss-defeated') passing = [];
    ranked.forEach(([id, p], index) => {
      p.rank = index + 1;
      p.totalScore += Math.max(0, this.roster.length - index) * 10;
      p.qualified = passing.includes(id);
      if (!p.qualified) this.eliminate(id);
    });
    this.state.zones.clear();
    this.state.reason = reason;
    this.finishMatch(passing, passing.length ? reason : 'all-out');
  }
  private finishMatch(ids: string[], reason: string): void {
    if (this.state.phase === 'finished') return;
    this.pendingResult = {
      id: this.matchId,
      participants: this.roster.flatMap(id => {
        const p = this.state.players.get(id); return p && !p.observer ? [p.accountId] : [];
      }),
      winners: ids.flatMap(id => {
        const p = this.state.players.get(id); return p && !p.observer ? [p.accountId] : [];
      }),
      elapsed: this.state.elapsed,
      tournamentId: this.state.tournamentId,
    };
    this.flushResult();
    this.state.resultMode = this.state.mode;
    for (const p of this.state.players.values()) p.ready = false;
    this.state.phase = 'finished';
    this.publishListing();
    this.state.reason = reason;
    this.state.winnerIds.clear();
    this.state.winnerIds.push(...ids);
    this.state.winnerName = ids.map((id) => this.state.players.get(id)?.name || '').join(', ');
    this.state.zones.clear();
    void this.unlock();
  }
  private tick(): void {
    if (this.state.phase === 'countdown') {
      this.phaseTicks++;
      this.state.countdown = Math.max(0, 5 - Math.floor(this.phaseTicks * STEP));
      if (this.phaseTicks * STEP >= 5) {
        this.state.phase = 'playing';
        this.publishListing();
        this.playTicks = 0;
      }
      return;
    }
    if (this.state.phase !== 'playing') return;
    this.playTicks++;
    this.state.elapsed = this.playTicks * STEP;
    this.state.remaining = Math.max(
      0,
      GAME_DEFINITIONS[this.state.mode].duration - Math.floor(this.state.elapsed),
    );
    for (const [id, p] of this.state.players) {
      const cmd = this.inputs.get(id)?.commands.shift();
      if (cmd) p.ack = cmd.seq;
      if (p.observer || p.out || p.qualified) continue;
      movePlayer(p, p.connected && cmd ? cmd : { ...IDLE, yaw: p.yaw, pitch: p.pitch }, this.world);
    }
    this.controller?.update(STEP);
    if (this.state.phase !== 'playing') return;
    if (!this.alive().length) {
      this.completeStage('all-out');
      return;
    }
    if (!this.state.remaining) this.completeStage('timeout');
  }
}
