import { CombatSystem } from '../systems/CombatSystem.js';
import { ZoneState } from '../state.js';
import type { RoundContext, RoundController } from './RoundContext.js';
/** Authoritative jump/impact choreography. Visual shockwave and damage use the same radius. */
export class CrabRound implements RoundController {
  private combat = new CombatSystem();
  private clock = 0;
  private hit = new Set<string>();
  constructor(private readonly context: RoundContext) {}
  prepare(): void {
    const b = this.context.state.boss;
    b.maxHp = 600 + this.context.roster.length * 250;
    b.hp = b.maxHp;
    b.y = 3;
    b.action = 'idle';
  }
  attack(id: string): void {
    const { state, world } = this.context;
    const shot = this.combat.fire(id, state, world, state.elapsed);
    if (!shot) return;
    this.context.shot(shot);
    if (state.boss.hp <= 0) {
      state.boss.action = 'dead';
      state.boss.y = 3;
      this.context.complete('boss-defeated');
    }
  }
  update(dt: number): void {
    const { state } = this.context;
    const b = state.boss;
    if (!this.context.alive().length) {
      this.context.complete('all-out');
      return;
    }
    this.clock += dt;
    b.stage = b.hp / b.maxHp < 0.35 ? 3 : b.hp / b.maxHp < 0.7 ? 2 : 1;
    const duration =
      b.action === 'idle'
        ? 2.4 - b.stage * 0.2
        : b.action === 'slam'
          ? 1.2
          : b.action === 'leap'
            ? 0.85
            : b.action === 'shockwave'
              ? 1.8
              : 0.7;
    b.progress = Math.min(1, this.clock / duration);
    if (b.action === 'idle') {
      const target = this.context.alive().sort(([, a], [, c]) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z))[0]?.[1];
      if (target) b.yaw = Math.atan2(target.x, target.z);
    }
    if (b.action === 'leap') b.y = 3 + Math.sin(b.progress * Math.PI) * 7;
    if (b.action === 'shockwave') {
      b.shockRadius = b.progress * 31;
      for (const [id, p] of this.context.alive()) {
        if (
          !this.hit.has(id) &&
          Math.abs(Math.hypot(p.x, p.z) - b.shockRadius) < 2.1 &&
          p.y < 3.75
        ) {
          this.damage(id, 38 + b.stage * 4);
          this.hit.add(id);
        }
      }
    }
    const zone = state.zones[0];
    if (zone) zone.remaining = Math.max(0, duration - this.clock);
    if (this.clock < duration) return;
    this.clock = 0;
    b.progress = 0;
    state.zones.clear();
    if (b.action === 'idle') {
      b.action = 'slam';
      state.zones.push(
        Object.assign(new ZoneState(), {
          id: `slam-${b.impactSerial}`,
          x: 0,
          z: 0,
          radius: 10,
          duration: 1.2,
          remaining: 1.2,
        }),
      );
    } else if (b.action === 'slam') {
      b.action = 'leap';
    } else if (b.action === 'leap') {
      b.y = 3;
      b.action = 'shockwave';
      b.impactSerial++;
      b.shockRadius = 0;
      this.hit.clear();
      for (const [id, p] of this.context.alive())
        if (Math.hypot(p.x, p.z) < 10) this.damage(id, 45);
      this.context.sound('impact', [0, 3, 0]);
    } else if (b.action === 'shockwave') {
      b.action = 'recover';
      for (const [, p] of this.context.alive()) p.hp = Math.min(100, p.hp + 6);
      b.shockRadius = 0;
    } else b.action = 'idle';
  }
  private damage(id: string, damage: number): void {
    const p = this.context.state.players.get(id);
    if (!p) return;
    p.hp = Math.max(0, p.hp - damage);
    if (p.hp === 0) this.context.eliminate(id);
  }
}
