import type { Engine } from 'noa-engine';
import type { Snapshot } from 'winterarc-protocol';

/** Never moves the authoritative player: only the local noa camera carrier. */
export class SpectatorCamera {
  private target = '';
  private distance = 12;
  private angle = 0;
  private elevation = 0.55;
  private placed = false;
  private roomRound = '';
  configure(value: { target?: string; distance?: number; angle?: number; elevation?: number }): void {
    if (value.target !== undefined && this.target !== value.target) { this.target = value.target; this.placed = false; }
    if (Number.isFinite(value.distance)) this.distance = Math.max(3, Math.min(32, value.distance!));
    if (Number.isFinite(value.angle)) this.angle = value.angle!;
    if (Number.isFinite(value.elevation)) this.elevation = Math.max(0.15, Math.min(1.25, value.elevation!));
  }
  update(noa: Engine, state: Snapshot | null, dt: number): boolean {
    const me = state?.players.find(p=>p.id===state.selfId);
    if (!state || state.phase !== 'playing' || !me || (!me.observer && !me.out && !me.qualified)) {
      this.placed = false; return false;
    }
    const key = `${state.roomId}:${state.round}`;
    if (key !== this.roomRound) { this.roomRound = key; this.placed = false; }
    const available = state.players.filter(p=>!p.observer && !p.out && !p.qualified && p.connected && p.hp>0);
    const target = available.find(p=>p.id===this.target) || available[0];
    if (target && target.id !== this.target) { this.target=target.id; this.placed=false; }
    // Director orbit is only exposed to server-authorized observer seats.
    const angle = me.observer ? this.angle : (target?.yaw || 0);
    const elevation = me.observer ? this.elevation : 0.55;
    const horizontal = Math.cos(elevation) * this.distance;
    const desired = target
      ? [target.x - Math.sin(angle)*horizontal, target.y + Math.sin(elevation)*this.distance, target.z - Math.cos(angle)*horizontal]
      : [0, 28, -28];
    const current = noa.ents.getPosition(noa.playerEntity);
    const ease = this.placed ? 1-Math.exp(-9*dt) : 1;
    noa.ents.setPosition(noa.playerEntity, desired.map((v,i)=>current[i]+(v-current[i])*ease));
    noa.camera.heading = target ? angle : 0;
    // Both carrier and target eye use EYE_HEIGHT, so the pitch remains elevation.
    noa.camera.pitch = target ? elevation : 0.6;
    this.placed = true;
    return true;
  }
}
