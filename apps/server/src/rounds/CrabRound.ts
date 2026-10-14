import { BLOCK } from 'winterarc-world';
import { CombatSystem } from '../systems/CombatSystem.js';
import { ZoneState } from '../state.js';
import type { RoundContext, RoundController } from './RoundContext.js';

/** Authoritative jump/impact choreography with real-time 3D voxel destruction & floor cratering. */
export class CrabRound implements RoundController {
  private combat = new CombatSystem();
  private clock = 0;
  private hit = new Set<string>();
  private brokenMap = new Map<string, number>();
  private leapFrom = { x: 0, z: 0 };
  private leapTo = { x: 0, z: 0 };

  constructor(private readonly context: RoundContext) {}

  prepare(): void {
    const b = this.context.state.boss;
    b.maxHp = 600 + this.context.roster.length * 250;
    b.hp = b.maxHp;
    b.x = 0;
    b.y = 3;
    b.z = 0;
    b.action = 'idle';
    this.brokenMap.clear();
  }

  private setVoxel(x: number, y: number, z: number, block: number): void {
    const { world, state } = this.context;
    const old = world.get(x, y, z);
    if (old === block) return;
    world.set(x, y, z, block);
    const key = `${x}:${y}:${z}`;
    const entry = `${x}:${y}:${z}:${block}`;
    const existingIdx = this.brokenMap.get(key);
    if (existingIdx !== undefined) {
      state.brokenIce[existingIdx] = entry;
    } else if (state.brokenIce.length < 1500) {
      this.brokenMap.set(key, state.brokenIce.length);
      state.brokenIce.push(entry);
    }
  }

  /** Smashes above-ground structures in smashRadius and cracks/craters the island floor in centerRadius. */
  private smashTerrain(cx: number, cz: number, smashRadius: number, craterRadius: number, stage: number): void {
    const { world } = this.context;
    let brokeAny = false;
    const rCeil = Math.ceil(smashRadius);
    for (let dx = -rCeil; dx <= rCeil; dx++) {
      for (let dz = -rCeil; dz <= rCeil; dz++) {
        const dist = Math.hypot(dx, dz);
        if (dist > smashRadius) continue;
        const x = Math.round(cx) + dx;
        const z = Math.round(cz) + dz;
        if (Math.hypot(x, z) > 25) continue;

        // Destroy any destructible cover/fortress/gift blocks above the island floor (y = 3..9).
        for (let y = 3; y <= 9; y++) {
          const id = world.get(x, y, z);
          if (id !== BLOCK.AIR && id !== BLOCK.DARK) {
            this.setVoxel(x, y, z, BLOCK.AIR);
            brokeAny = true;
          }
        }

        // Crack snow into ice, and in stage 2+ shatter cracked outer ice into water craters!
        if (dist <= craterRadius) {
          const floorId = world.get(x, 2, z);
          const distFromOrigin = Math.hypot(x, z);
          if (floorId === BLOCK.SNOW || floorId === BLOCK.STONE) {
            this.setVoxel(x, 2, z, BLOCK.ICE);
            brokeAny = true;
          } else if (stage >= 2 && floorId === BLOCK.ICE && dist <= craterRadius * 0.65 && distFromOrigin > 5.5 && distFromOrigin < 18.5) {
            this.setVoxel(x, 2, z, BLOCK.AIR);
            this.setVoxel(x, 1, z, BLOCK.WATER);
            brokeAny = true;
          }
        }
      }
    }
    if (brokeAny) {
      this.context.sound('break', [cx, 3, cz]);
    }
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
    const { state, world } = this.context;
    const b = state.boss;
    // Eliminate players who fall into water craters dug by the boss!
    for (const [id, p] of this.context.alive()) {
      if (p.y <= 1.65) this.context.eliminate(id);
    }
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
      const target = this.context
        .alive()
        .sort(([, a], [, c]) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z))[0]?.[1];
      if (target) b.yaw = Math.atan2(target.x - b.x, target.z - b.z);
    }
    if (b.action === 'leap') {
      b.x = this.leapFrom.x + (this.leapTo.x - this.leapFrom.x) * b.progress;
      b.z = this.leapFrom.z + (this.leapTo.z - this.leapFrom.z) * b.progress;
      b.y = 3 + Math.sin(b.progress * Math.PI) * (7 + b.stage);
      if (world.obstacles[0]) {
        world.obstacles[0].x = b.x;
        world.obstacles[0].z = b.z;
      }
    }
    if (b.action === 'shockwave') {
      b.shockRadius = b.progress * 31;
      for (const [id, p] of this.context.alive()) {
        if (
          !this.hit.has(id) &&
          Math.abs(Math.hypot(p.x - b.x, p.z - b.z) - b.shockRadius) < 2.1 &&
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
      this.leapFrom = { x: b.x, z: b.z };
      // Every other leap targets the nearest player/bastion (clamped to r <= 15); otherwise leaps back near center.
      const alive = this.context.alive();
      if (alive.length && b.impactSerial % 2 === 0) {
        const target = alive[b.impactSerial % alive.length][1];
        const dist = Math.hypot(target.x, target.z);
        const clampR = Math.min(15, dist);
        const angle = Math.atan2(target.z, target.x);
        this.leapTo = {
          x: dist > 0.5 ? Math.cos(angle) * clampR : 0,
          z: dist > 0.5 ? Math.sin(angle) * clampR : 0,
        };
        b.yaw = Math.atan2(this.leapTo.x - b.x, this.leapTo.z - b.z);
      } else {
        this.leapTo = { x: 0, z: 0 };
      }
      const slamRadius = 9 + b.stage;
      state.zones.push(
        Object.assign(new ZoneState(), {
          id: `slam-${b.impactSerial}`,
          x: this.leapTo.x,
          z: this.leapTo.z,
          radius: slamRadius,
          duration: 1.2,
          remaining: 1.2,
        }),
      );
    } else if (b.action === 'slam') {
      b.action = 'leap';
    } else if (b.action === 'leap') {
      b.x = this.leapTo.x;
      b.z = this.leapTo.z;
      b.y = 3;
      if (world.obstacles[0]) {
        world.obstacles[0].x = b.x;
        world.obstacles[0].z = b.z;
      }
      b.action = 'shockwave';
      b.impactSerial++;
      b.shockRadius = 0;
      this.hit.clear();
      const slamRadius = 9 + b.stage;
      for (const [id, p] of this.context.alive()) {
        if (Math.hypot(p.x - b.x, p.z - b.z) < slamRadius) this.damage(id, 45);
      }
      // Smash structures and crack/crater the island floor on landing!
      this.smashTerrain(b.x, b.z, 6.5 + b.stage, 4 + b.stage, b.stage);
      this.context.sound('impact', [b.x, 3, b.z]);
    } else if (b.action === 'shockwave') {
      b.action = 'recover';
      for (const [, p] of this.context.alive()) p.hp = Math.min(100, p.hp + 6);
      b.shockRadius = 0;
    } else {
      b.action = 'idle';
    }
  }

  private damage(id: string, damage: number): void {
    const p = this.context.state.players.get(id);
    if (!p) return;
    p.hp = Math.max(0, p.hp - damage);
    if (p.hp === 0) this.context.eliminate(id);
  }
}
