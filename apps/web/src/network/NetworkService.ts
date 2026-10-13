import { apiBaseUrl, websocketUrl } from '../config/endpoints';
import { accessTicket, refreshAccount, account } from '../account/service';
import { Client, type Room } from 'colyseus.js';
import { t, translateNotice } from '../i18n';
import { createStore } from '../hooks/useStore';
import { TOURNAMENT_ROOM, type Snapshot, type DuelPrivate, type CodeView, type ShotEvent, type SoundEvent } from 'winterarc-protocol';
import { type GameId } from 'winterarc-core';
import type { RoomState, PublicRoom, ConnectOptions, ClientMessages } from 'winterarc-protocol';

export type ConnectionStatus = 'offline' | 'connecting' | 'online' | 'reconnecting';

export const connection = createStore<ConnectionStatus>('offline');
export const snapshot = createStore<Snapshot | null>(null);
export const latency = createStore(0);

const RESUME_KEY = 'winterarc:room-resume:v1';

export class NetworkService {
  private readonly client: Client;
  private readonly roomsUrl: string;
  private room: Room<RoomState> | null = null;
  private generation = 0;
  private ping: ReturnType<typeof setInterval> | null = null;

  private readonly warnBeforeLeave = (event: BeforeUnloadEvent): void => {
    event.preventDefault();
    event.returnValue = '';
  };

  /** Stored per tab, never put this bearer token in the URL or localStorage. */
  private saveResume(room: Room<RoomState>): void {
    try {
      sessionStorage.setItem(RESUME_KEY, JSON.stringify({
        token: room.reconnectionToken,
        endpoint: this.roomsUrl,
        accountId: account.get()?.id,
      }));
    } catch { /* Reload recovery is unavailable when storage is denied. */ }
  }

  async restore(): Promise<void> {
    if (this.room || connection.get() !== 'offline') return;
    try {
      const raw = sessionStorage.getItem(RESUME_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { token?: unknown; endpoint?: unknown; accountId?: unknown };
      if (typeof saved.token !== 'string' || saved.endpoint !== this.roomsUrl || !account.get() || saved.accountId !== account.get()?.id) {
        sessionStorage.removeItem(RESUME_KEY);
        return;
      }
      window.addEventListener('beforeunload', this.warnBeforeLeave);
      await this.reconnect(saved.token, ++this.generation);
    } catch {
      this.clear();
    }
  }

  onSnapshot: (state: Snapshot | null) => void = () => {};
  onFound: () => void = () => {};
  onSound: (event: SoundEvent) => void = () => {};
  onShot: (event: ShotEvent) => void = () => {};
  onNotice: (message: string) => void = () => {};

  constructor() {
    this.client = new Client(websocketUrl);
    this.roomsUrl = `${apiBaseUrl}/rooms`;
  }

  async listRooms(signal?: AbortSignal): Promise<PublicRoom[]> {
    const response = await fetch(this.roomsUrl, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Room list unavailable');
    return response.json() as Promise<PublicRoom[]>;
  }

  async connect(options: ConnectOptions): Promise<void> {
    if (this.room || connection.get() !== 'offline') throw new Error(t('session.busy'));
    const { format, mode, name, code, privateRoom, password, observer, tournament } = options;
    const generation = ++this.generation;
    connection.set('connecting');
    window.addEventListener('beforeunload', this.warnBeforeLeave);
    try {
      const ticket = await accessTicket();
      const room = code
        ? await this.client.joinById<RoomState>(code, { name, password, observer, accessTicket: ticket })
        : await this.client.create<RoomState>(TOURNAMENT_ROOM, {
            name,
            format,
            mode,
            privateRoom,
            password,
            accessTicket: ticket,
            tournament,
            observer,
          });
      if (generation !== this.generation) {
        await room.leave();
        return;
      }
      this.attach(room, generation);
      history.replaceState(null, '', `?room=${encodeURIComponent(room.roomId)}`);
    } catch (error) {
      if (generation === this.generation) this.clear();
      throw error;
    }
  }

  private attach(room: Room<RoomState>, generation: number): void {
    this.room = room;
    this.saveResume(room);
    window.addEventListener('beforeunload', this.warnBeforeLeave);
    history.replaceState(null, '', `?room=${encodeURIComponent(room.roomId)}`);
    connection.set('online');
    let codeView: CodeView | undefined;
    let duelPrivate: DuelPrivate | undefined;
    const sync = () => {
      if (this.room !== room || !room.state?.players) return;
      const s = room.state;
      const value: Snapshot = {
        codeView: s.mode === 'codehunt' && s.phase === 'playing' && codeView?.round === s.round ? codeView : undefined,
        tournamentId: s.tournamentId,
        tournamentTitle: s.tournamentTitle,
        tournamentCapacity: s.tournamentCapacity,
        tournamentRounds: s.tournamentRounds,
        tournamentCompleted: s.tournamentCompleted,
        resultMode: s.resultMode,
        duel: { hunterId:s.duelHunterId, hiderId:s.duelHiderId, stage:s.duelStage, turn:s.duelTurn,
          ammo:s.duelAmmo, remaining:s.duelRemaining, yaw:s.duelYaw, pitch:s.duelPitch, charge:s.duelCharge,
          self:s.duelHiderId===room.sessionId && duelPrivate?.round===s.round && duelPrivate?.turn===s.duelTurn ? duelPrivate : undefined },
        knockout: { stage: s.knockoutStage, remaining: s.knockoutRemaining, turn: s.knockoutTurn },
        ice: { radius: s.iceRadius, shrinkIn: s.iceShrinkIn },
        privateRoom: s.privateRoom,
        roomId: room.roomId,
        selfId: room.sessionId,
        mode: s.mode,
        modeSelection: s.modeSelection,
        phase: s.phase,
        hostId: s.hostId,
        round: s.round,
        countdown: s.countdown,
        remaining: s.remaining,
        total: s.total,
        brokenIce: Array.from(s.brokenIce ?? []),
        format: s.format,
        stages: Array.from(s.stages) as GameId[],
        stageIndex: s.stageIndex,
        seed: s.seed,
        entrants: s.entrants,
        quota: s.quota,
        elapsed: s.elapsed,
        goal: s.goal,
        winnerIds: Array.from(s.winnerIds),
        winnerName: s.winnerName,
        floor: {
          cycle: s.floorCycle,
          safeBlock: s.floorSafeBlock,
          remaining: s.floorRemaining,
          dropped: s.floorDropped,
        },
        reason: s.reason,
        players: [...s.players].map(([id, p]) => ({
          id,
          accountId: p.accountId,
          avatar: p.avatar,
          avatarUrl: p.avatarUrl,
          school: p.school,
          frameId: p.frameId,
          skinId: p.skinId,
          roles: Array.from(p.roles || []),
          theme: p.theme,
          premium: p.premium,
          observer: p.observer,
          name: p.name,
          color: p.color,
          x: p.x,
          y: p.y,
          z: p.z,
          launchPower: p.launchPower,
          vy: p.vy, vx: p.vx || 0, vz: p.vz || 0,
          yaw: p.yaw,
          pitch: p.pitch,
          ack: p.ack,
          score: p.score,
          ready: p.ready,
          connected: p.connected,
          found: Array.from(p.found),
          totalScore: p.totalScore,
          qualified: p.qualified,
          eliminatedRound: p.eliminatedRound,
          rank: p.rank,
          checkpoint: p.checkpoint,
          hp: p.hp,
          deaths: p.deaths,
          out: p.out,
        })),
        targets: [...s.targets].map((t) => ({
          id: t.id,
          x: t.x,
          y: t.y,
          z: t.z,
          zone: t.zone,
        })),
        boss: {
          x: s.boss.x,
          y: s.boss.y,
          z: s.boss.z,
          hp: s.boss.hp,
          maxHp: s.boss.maxHp,
          stage: s.boss.stage,
          action: s.boss.action,
          yaw: s.boss.yaw,
          flash: s.boss.flash,
          progress: s.boss.progress,
          shockRadius: s.boss.shockRadius,
          impactSerial: s.boss.impactSerial,
        },
        zones: [...s.zones].map((z) => ({
          id: z.id,
          kind: z.kind,
          x: z.x,
          z: z.z,
          radius: z.radius,
          inner: z.inner,
          remaining: z.remaining,
          duration: z.duration,
        })),
      };
      snapshot.set(value);
      this.onSnapshot(value);
    };
    room.onStateChange(sync);
    room.onMessage('codeView', (data: CodeView) => {
      if (this.room !== room) return;
      codeView = data; sync();
    });
    room.onMessage('duelPrivate', (data: DuelPrivate) => {
      if (this.room !== room) return;
      duelPrivate=data;sync();
    });
    room.onMessage('notice', (m: string) => this.onNotice(translateNotice(m)));
    room.onMessage('sound', (event: SoundEvent) => this.onSound(event));
    room.onMessage('shot', (e: ShotEvent) => this.onShot(e));
    room.onMessage('found', (d: { score: number }) => {
      this.onFound();
      this.onNotice(t('notice.found', { score: d.score }));
    });
    room.onMessage('activity', () => {});
    room.onMessage('accountChanged', () => { void refreshAccount().catch(() => {}); });
    room.onMessage('pong', (sent: number) =>
      latency.set(Math.max(0, Math.round(performance.now() - sent))),
    );
    room.onError((_c, m) => this.onNotice(m || t('notice.connectionError')));
    room.onLeave((code) => {
      if (this.room !== room || generation !== this.generation) return;
      this.stopPing();
      if (code === 1000) {
        this.clear();
        return;
      }
      void this.reconnect(room.reconnectionToken, generation);
    });
    this.stopPing();
    this.ping = setInterval(() => this.send('ping', performance.now()), 2000);
    sync();
  }

  private async reconnect(token: string, generation: number): Promise<void> {
    connection.set('reconnecting');
    this.onNotice(t('notice.reconnecting'));
    const deadline = Date.now() + 18000;
    while (Date.now() < deadline && generation === this.generation) {
      try {
        const next = await this.client.reconnect<RoomState>(token);
        if (generation !== this.generation) {
          await next.leave();
          return;
        }
        this.attach(next, generation);
        this.onNotice(t('notice.reconnected'));
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
    if (generation === this.generation) {
      this.clear();
      this.onNotice(t('notice.connectionLost'));
    }
  }

  send<K extends keyof ClientMessages>(
    type: K,
    ...args: ClientMessages[K] extends undefined ? [] : [data: ClientMessages[K]]
  ): void {
    if (this.room?.connection.isOpen) this.room.send(type, args[0]);
  }

  async leave(): Promise<void> {
    ++this.generation;
    const room = this.room;
    this.clear();
    if (room) {
      try {
        await room.leave();
      } catch {
        /* ignored */
      }
    }
  }

  private clear(): void {
    window.removeEventListener('beforeunload', this.warnBeforeLeave);
    try { sessionStorage.removeItem(RESUME_KEY); } catch { /* optional storage */ }
    this.room = null;
    this.stopPing();
    connection.set('offline');
    snapshot.set(null);
    this.onSnapshot(null);
    history.replaceState(null, '', location.pathname);
  }

  private stopPing(): void {
    if (this.ping) clearInterval(this.ping);
    this.ping = null;
  }

  dispose(): void {
    void this.leave();
  }
}
