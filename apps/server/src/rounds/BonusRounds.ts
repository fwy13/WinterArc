import { canReachPoint, EYE_HEIGHT } from 'winterarc-gameplay';
import {
  BLOCK,
  FROSTY_FINISH_Z,
  MELTDOWN_LAYERS,
  randomFromSeed,
  traceBlockShape,
} from 'winterarc-world';
import type { Vec3 } from 'winterarc-core';
import { ZoneState } from '../state.js';
import type { RoundContext, RoundController } from './RoundContext.js';

function recordVoxel(
  context: RoundContext,
  brokenMap: Map<string, number>,
  x: number,
  y: number,
  z: number,
  block: number,
): boolean {
  const { world, state } = context;
  const old = world.get(x, y, z);
  if (old === block) return false;
  world.set(x, y, z, block);
  const key = `${x}:${y}:${z}`;
  const entry = `${x}:${y}:${z}:${block}`;
  const idx = brokenMap.get(key);
  if (idx !== undefined) {
    state.brokenIce[idx] = entry;
  } else if (state.brokenIce.length < 1800) {
    brokenMap.set(key, state.brokenIce.length);
    state.brokenIce.push(entry);
  }
  return true;
}

/** 1. Boom Gift (Hot Potato): Pass the ticking gift before it explodes and blasts a voxel crater! */
export class BoomGiftRound implements RoundController {
  private random = Math.random;
  private explodeAt = 14;
  private passImmunity = new Map<string, number>();
  private brokenMap = new Map<string, number>();

  constructor(private readonly context: RoundContext) {}

  prepare(): void {
    this.random = randomFromSeed(this.context.state.seed);
    this.context.state.floorCycle = 1;
    this.context.state.floorDropped = false;
    this.brokenMap.clear();
    this.assignBombs();
  }

  private assignBombs(): void {
    const { state } = this.context;
    const alive = this.context.alive();
    for (const [, p] of alive) p.launchPower = 0;
    if (!alive.length) return;
    const bombCount = alive.length === 1 ? 1 : Math.max(1, Math.min(3, Math.floor(alive.length / 3)));
    const pool = [...alive];
    for (let i = 0; i < bombCount && pool.length; i++) {
      const pick = Math.floor(this.random() * pool.length);
      pool.splice(pick, 1)[0][1].launchPower = 1;
    }
    state.floorRemaining = Math.max(9, 14 - state.floorCycle * 0.5);
    this.explodeAt = state.elapsed + state.floorRemaining;
  }

  private transferBomb(fromId: string, toId: string): void {
    const { state } = this.context;
    const a = state.players.get(fromId);
    const b = state.players.get(toId);
    if (!a || !b || a.launchPower !== 1 || b.launchPower === 1) return;
    if (state.elapsed < (this.passImmunity.get(toId) ?? 0)) return;
    a.launchPower = 0;
    b.launchPower = 1;
    a.score += 2;
    this.passImmunity.set(fromId, state.elapsed + 1.1);
    this.passImmunity.set(toId, state.elapsed + 1.1);
    this.context.sound('deliver', [b.x, b.y + 1, b.z], fromId);
  }

  attack(id: string): void {
    const { state, world } = this.context;
    const p = state.players.get(id);
    if (!p) return;
    const from: Vec3 = [p.x, p.y + EYE_HEIGHT, p.z];
    const dir: Vec3 = [
      Math.sin(p.yaw) * Math.cos(p.pitch),
      -Math.sin(p.pitch),
      Math.cos(p.yaw) * Math.cos(p.pitch),
    ];
    let bestId = '';
    let bestDist = 16;
    for (const [otherId, other] of this.context.alive()) {
      if (otherId === id) continue;
      const dx = other.x - from[0];
      const dy = other.y + 1.0 - from[1];
      const dz = other.z - from[2];
      const proj = dx * dir[0] + dy * dir[1] + dz * dir[2];
      if (proj < 0.3 || proj > bestDist) continue;
      const perpSq = dx * dx + dy * dy + dz * dz - proj * proj;
      if (perpSq <= 0.75) {
        bestDist = proj;
        bestId = otherId;
      }
    }
    const wall = traceBlockShape(world, from, dir, bestDist, 'collision');
    if (wall && wall.distance < bestDist) {
      bestId = '';
      bestDist = wall.distance;
    }
    const to: Vec3 = [from[0] + dir[0] * bestDist, from[1] + dir[1] * bestDist, from[2] + dir[2] * bestDist];
    this.context.shot({ from, to, hit: !!bestId, playerId: id });
    if (bestId) {
      const target = state.players.get(bestId)!;
      target.vx += dir[0] * 7;
      target.vz += dir[2] * 7;
      if (p.launchPower === 1) this.transferBomb(id, bestId);
    } else if (state.entrants === 1 && p.launchPower === 1 && wall && wall.y >= 3) {
      // In solo practice, hitting a gift stack defuses & resets the bomb timer for +1 score!
      p.score++;
      this.explodeAt = state.elapsed + 12;
      recordVoxel(this.context, this.brokenMap, wall.x, wall.y, wall.z, BLOCK.AIR);
      this.context.sound('deliver', to, id);
    }
  }

  update(dt: number): void {
    const { state, world } = this.context;
    const alive = this.context.alive();
    for (const [id, p] of alive) {
      if (p.y <= world.loseY) this.context.eliminate(id);
      else if (p.launchPower === 1) {
        // Touch-passing within 1.8m + slight speed boost for bomb carriers.
        p.vx += Math.sin(p.yaw) * 1.8 * dt;
        p.vz += Math.cos(p.yaw) * 1.8 * dt;
        for (const [otherId, other] of alive) {
          if (
            otherId !== id &&
            other.launchPower === 0 &&
            Math.hypot(other.x - p.x, other.z - p.z) < 1.8 &&
            Math.abs(other.y - p.y) < 1.6
          ) {
            this.transferBomb(id, otherId);
            break;
          }
        }
      }
    }

    const remainingAlive = this.context.alive();
    if (!remainingAlive.length || (state.format === 'solo' && state.entrants > 1 && remainingAlive.length === 1)) {
      this.context.complete('survivors');
      return;
    }
    if ( remainingAlive.every(([, p]) => p.launchPower === 0)) {
      this.assignBombs();
    }

    state.floorRemaining = Math.max(0, this.explodeAt - state.elapsed);
    if (state.elapsed < this.explodeAt) return;

    // Detonate all active Boom Gifts, blasting a 3D voxel crater at each carrier!
    for (const [id, p] of remainingAlive) {
      if (p.launchPower !== 1) {
        p.score++;
        continue;
      }
      p.launchPower = 0;
      const cx = Math.round(p.x);
      const cz = Math.round(p.z);
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          if (Math.hypot(dx, dz) > 3.1) continue;
          for (let y = 3; y <= 6; y++) {
            recordVoxel(this.context, this.brokenMap, cx + dx, y, cz + dz, BLOCK.AIR);
          }
          if (Math.hypot(dx, dz) <= 1.6 && Math.hypot(cx + dx, cz + dz) < 24) {
            recordVoxel(this.context, this.brokenMap, cx + dx, 2, cz + dz, BLOCK.AIR);
          }
        }
      }
      this.context.sound('impact', [p.x, p.y + 1, p.z], id);
      this.context.eliminate(id);
    }

    const postBlast = this.context.alive();
    if (!postBlast.length || (state.format === 'solo' && state.entrants > 1 && postBlast.length === 1)) {
      this.context.complete('survivors');
      return;
    }
    state.floorCycle++;
    this.assignBombs();
  }
}

/** 2. Multi-Layer Meltdown (Hex-A-Freeze): 4 stacked floors that crack 0.45s after being stepped on! */
export class MeltdownRound implements RoundController {
  private cracking = new Map<string, { x: number; y: number; z: number; breakAt: number }>();
  private brokenMap = new Map<string, number>();

  constructor(private readonly context: RoundContext) {}

  prepare(): void {
    this.cracking.clear();
    this.brokenMap.clear();
    this.context.state.iceRadius = MELTDOWN_LAYERS.length;
    this.context.state.iceShrinkIn = 0;
  }

  attack(id: string): void {
    const { state, world } = this.context;
    const p = state.players.get(id);
    if (!p) return;
    const from: Vec3 = [p.x, p.y + EYE_HEIGHT, p.z];
    const dir: Vec3 = [
      Math.sin(p.yaw) * Math.cos(p.pitch),
      -Math.sin(p.pitch),
      Math.cos(p.yaw) * Math.cos(p.pitch),
    ];
    const hit = traceBlockShape(world, from, dir, 7.5, 'collision');
    const canBreak = !!hit && (MELTDOWN_LAYERS as readonly number[]).includes(hit.y);
    if (canBreak && hit) {
      recordVoxel(this.context, this.brokenMap, hit.x, hit.y, hit.z, BLOCK.AIR);
      p.score++;
    }
    const to: Vec3 = hit
      ? hit.point
      : [from[0] + dir[0] * 7.5, from[1] + dir[1] * 7.5, from[2] + dir[2] * 7.5];
    this.context.shot({ from, to, hit: canBreak, playerId: id });
  }

  update(): void {
    const { state, world } = this.context;
    const now = state.elapsed;

    for (const [id, p] of this.context.alive()) {
      if (p.y <= world.loseY) {
        this.context.eliminate(id);
        continue;
      }
      // Track which of the 4 layers the player is currently on.
      const layerIdx = MELTDOWN_LAYERS.findIndex((ly) => p.y >= ly);
      p.checkpoint = layerIdx >= 0 ? MELTDOWN_LAYERS.length - layerIdx : 1;

      // Queue tiles directly beneath the player's feet to crack after 0.45s!
      for (const ly of MELTDOWN_LAYERS) {
        if (Math.abs(p.y - (ly + 1)) > 0.25) continue;
        for (const ox of [-0.22, 0.22]) {
          for (const oz of [-0.22, 0.22]) {
            const bx = Math.floor(p.x + ox);
            const bz = Math.floor(p.z + oz);
            const blockId = world.get(bx, ly, bz);
            if (blockId !== BLOCK.AIR) {
              const key = `${bx}:${ly}:${bz}`;
              if (!this.cracking.has(key)) {
                this.cracking.set(key, { x: bx, y: ly, z: bz, breakAt: now + 0.45 });
              }
            }
          }
        }
      }
    }

    let brokeSound = false;
    let lastPos: Vec3 = [0, 8, 0];
    for (const [key, tile] of this.cracking) {
      if (now >= tile.breakAt) {
        this.cracking.delete(key);
        if (recordVoxel(this.context, this.brokenMap, tile.x, tile.y, tile.z, BLOCK.AIR)) {
          brokeSound = true;
          lastPos = [tile.x, tile.y, tile.z];
        }
      }
    }
    if (brokeSound) {
      this.context.sound('break', lastPos);
      for (const [, p] of this.context.alive()) p.score++;
    }

    const survivors = this.context.alive();
    if (survivors.length) {
      state.iceRadius = Math.max(...survivors.map(([, p]) => p.checkpoint || 1));
    }
    if (!survivors.length || (state.format === 'solo' && state.entrants > 1 && survivors.length === 1)) {
      this.context.complete('survivors');
    }
  }
}

/** 3. Frosty Freeze (Red Light, Green Light): Run when Frosty sings, freeze or hide behind cover when he scans! */
export class FrostyRound implements RoundController {
  private random = Math.random;
  private phaseEndsAt = 4.5;
  private prevPos = new Map<string, { x: number; y: number; z: number }>();
  private zappedCooldown = new Map<string, number>();

  constructor(private readonly context: RoundContext) {}

  prepare(): void {
    const { state } = this.context;
    this.random = randomFromSeed(state.seed);
    state.goal = this.context.world.race.checkpoints.length + 1;
    state.knockoutStage = 'green';
    state.knockoutTurn = 1;
    state.knockoutRemaining = 4.5;
    this.phaseEndsAt = 4.5;
    state.boss.x = 0;
    state.boss.y = 3;
    state.boss.z = 52;
    state.boss.yaw = 0; // Facing away (+Z) during Green Light
    state.boss.maxHp = 100;
    state.boss.hp = 100;
    state.boss.action = 'idle';
    this.prevPos.clear();
    this.zappedCooldown.clear();
  }

  attack(id: string): void {
    const { state, world } = this.context;
    const p = state.players.get(id);
    if (!p) return;
    const from: Vec3 = [p.x, p.y + EYE_HEIGHT, p.z];
    const dir: Vec3 = [
      Math.sin(p.yaw) * Math.cos(p.pitch),
      -Math.sin(p.pitch),
      Math.cos(p.yaw) * Math.cos(p.pitch),
    ];
    let hitId = '';
    let bestDist = 18;
    for (const [otherId, other] of this.context.alive()) {
      if (otherId === id || other.qualified) continue;
      const dx = other.x - from[0];
      const dy = other.y + 1.0 - from[1];
      const dz = other.z - from[2];
      const proj = dx * dir[0] + dy * dir[1] + dz * dir[2];
      if (proj < 0.3 || proj > bestDist) continue;
      if (dx * dx + dy * dy + dz * dz - proj * proj <= 0.8) {
        bestDist = proj;
        hitId = otherId;
      }
    }
    const wall = traceBlockShape(world, from, dir, bestDist, 'collision');
    if (wall && wall.distance < bestDist) {
      hitId = '';
      bestDist = wall.distance;
    }
    const to: Vec3 = [from[0] + dir[0] * bestDist, from[1] + dir[1] * bestDist, from[2] + dir[2] * bestDist];
    this.context.shot({ from, to, hit: !!hitId, playerId: id });
    if (hitId) {
      const rival = state.players.get(hitId)!;
      rival.vx += dir[0] * 9.5;
      rival.vz += dir[2] * 9.5;
    }
  }

  interact(id: string): void {
    const p = this.context.state.players.get(id);
    if (p && p.z >= FROSTY_FINISH_Z - 3.5) {
      p.score = this.context.state.goal;
      this.context.sound('deliver', [p.x, p.y + 1, p.z], id);
      this.context.qualify(id);
    }
  }

  update(): void {
    const { state, world } = this.context;
    const now = state.elapsed;

    if (now >= this.phaseEndsAt) {
      if (state.knockoutStage === 'green') {
        state.knockoutStage = 'warn';
        this.phaseEndsAt = now + 1.15;
        state.boss.action = 'slam';
        this.context.sound('place', [0, 6, 52]);
      } else if (state.knockoutStage === 'warn') {
        state.knockoutStage = 'red';
        this.phaseEndsAt = now + 2.4;
        state.boss.yaw = Math.PI; // Faces players (-Z)
        state.boss.action = 'shockwave';
        this.context.sound('impact', [0, 6, 52]);
      } else {
        state.knockoutStage = 'green';
        state.knockoutTurn++;
        this.phaseEndsAt = now + 3.4 + this.random() * 1.8;
        state.boss.yaw = 0;
        state.boss.action = 'idle';
      }
    }
    state.knockoutRemaining = Math.max(0, this.phaseEndsAt - now);

    const eyeFrom: Vec3 = [0, 7.8, 52];
    for (const [id, p] of this.context.alive()) {
      if (p.qualified) continue;
      if (p.y <= world.loseY) {
        Object.assign(p, world.spawn(this.context.roster.indexOf(id)), { vy: 0, vx: 0, vz: 0 });
        p.deaths = Math.min(255, p.deaths + 1);
      }

      // Checkpoints & crossing finish line at z >= FROSTY_FINISH_Z.
      const nextCp = world.race.checkpoints[p.checkpoint];
      if (nextCp && p.z >= nextCp.z) {
        p.checkpoint++;
        p.score = p.checkpoint;
      }
      if (p.z >= FROSTY_FINISH_Z) {
        p.score = state.goal;
        this.context.sound('deliver', [p.x, p.y + 1, p.z], id);
        this.context.qualify(id);
        continue;
      }
      p.progress = p.z;

      const prev = this.prevPos.get(id) ?? { x: p.x, y: p.y, z: p.z };
      const moved = Math.hypot(p.x - prev.x, p.z - prev.z) > 0.045 || Math.abs(p.y - prev.y) > 0.08;
      this.prevPos.set(id, { x: p.x, y: p.y, z: p.z });

      if (state.knockoutStage === 'red' && moved && now >= (this.zappedCooldown.get(id) ?? 0)) {
        const targetPt: Vec3 = [p.x, p.y + 1.0, p.z];
        const dx = targetPt[0] - eyeFrom[0];
        const dy = targetPt[1] - eyeFrom[1];
        const dz = targetPt[2] - eyeFrom[2];
        const dist = Math.hypot(dx, dy, dz);
        const dir: Vec3 = [dx / dist, dy / dist, dz / dist];
        const cover = traceBlockShape(world, eyeFrom, dir, Math.max(0, dist - 0.35), 'collision');
        if (!cover) {
          this.zappedCooldown.set(id, now + 0.9);
          this.context.shot({ from: eyeFrom, to: targetPt, hit: true, playerId: id });
          p.vz = -14;
          p.vy = 4.8;
          p.deaths = Math.min(255, p.deaths + 1);
          this.context.sound('hit', targetPt, id);
        }
      }
    }
  }
}

/** 4. Snowfort Siege: Two forts across a frozen river; siege snowballs blast 3D fort walls & Crystal Pine Cores! */
export class SnowfortRound implements RoundController {
  private southCoreHp = 250;
  private northCoreHp = 250;
  private brokenMap = new Map<string, number>();

  constructor(private readonly context: RoundContext) {}

  prepare(): void {
    const { state } = this.context;
    this.southCoreHp = 250;
    this.northCoreHp = 250;
    this.brokenMap.clear();
    state.boss.maxHp = 500;
    state.boss.hp = 500;
    state.goal = 250;
    this.context.roster.forEach((id, index) => {
      const p = state.players.get(id);
      if (p) p.checkpoint = index % 2; // 0 = South Fort (-Z), 1 = North Fort (+Z)
    });
  }

  attack(id: string): void {
    const { state, world } = this.context;
    const p = state.players.get(id);
    if (!p) return;
    const from: Vec3 = [p.x, p.y + EYE_HEIGHT, p.z];
    const dir: Vec3 = [
      Math.sin(p.yaw) * Math.cos(p.pitch),
      -Math.sin(p.pitch),
      Math.cos(p.yaw) * Math.cos(p.pitch),
    ];

    const hit = traceBlockShape(world, from, dir, 38, 'collision');
    let hitEntity = false;
    if (hit && hit.y >= 3) {
      const isCore = hit.block === BLOCK.GOLD || hit.block === BLOCK.GLOW;
      const enemyCoreSign = p.checkpoint === 0 ? 1 : -1;
      if (isCore && Math.sign(hit.z) === enemyCoreSign) {
        hitEntity = true;
        recordVoxel(this.context, this.brokenMap, hit.x, hit.y, hit.z, BLOCK.AIR);
        if (enemyCoreSign > 0) this.northCoreHp = Math.max(0, this.northCoreHp - 25);
        else this.southCoreHp = Math.max(0, this.southCoreHp - 25);
        p.score += 25;
        this.context.sound('impact', hit.point, id);
      } else if (
        (
          [
            BLOCK.SNOW,
            BLOCK.RED,
            BLOCK.GREEN,
            BLOCK.WOOD,
            BLOCK.ICE,
            BLOCK.WOOD_SLAB,
          ] as number[]
        ).includes(hit.block)
      ) {
        hitEntity = true;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (Math.hypot(dx, dy, dz) > 1.45 || hit.y + dy < 3) continue;
              const bid = world.get(hit.x + dx, hit.y + dy, hit.z + dz);
              if (bid !== BLOCK.AIR && bid !== BLOCK.GOLD && bid !== BLOCK.GLOW && bid !== BLOCK.DARK) {
                recordVoxel(this.context, this.brokenMap, hit.x + dx, hit.y + dy, hit.z + dz, BLOCK.AIR);
              }
            }
          }
        }
        p.score += 5;
        this.context.sound('break', hit.point, id);
      }
    }

    const to: Vec3 = hit
      ? hit.point
      : [from[0] + dir[0] * 38, from[1] + dir[1] * 38, from[2] + dir[2] * 38];
    this.context.shot({ from, to, hit: hitEntity, playerId: id });
    state.boss.hp = this.southCoreHp + this.northCoreHp;

    if (this.northCoreHp === 0 || this.southCoreHp === 0) {
      const winningTeam = this.northCoreHp === 0 ? 0 : 1;
      for (const [pid, player] of this.context.alive()) {
        if (player.checkpoint === winningTeam) {
          player.score += 100;
          this.context.qualify(pid);
        }
      }
      this.context.complete('boss-defeated');
    }
  }

  update(): void {
    const { world, roster } = this.context;
    for (const [id, p] of this.context.alive()) {
      if (p.y <= world.loseY) {
        const idx = Math.max(0, roster.indexOf(id));
        Object.assign(p, world.spawn(idx), { vy: 0, vx: 0, vz: 0, hp: 100 });
        p.deaths = Math.min(255, p.deaths + 1);
      }
    }
  }
}

/** 5. Avalanche Escape: Downhill ski/parkour race ahead of a real-time collapsing voxel avalanche! */
export class AvalancheRound implements RoundController {
  private avalancheZ = -74;
  private collapsedRow = -74;
  private brokenMap = new Map<string, number>();

  constructor(private readonly context: RoundContext) {}

  prepare(): void {
    const { state } = this.context;
    this.avalancheZ = -74;
    this.collapsedRow = -74;
    this.brokenMap.clear();
    state.iceRadius = -74;
    state.iceShrinkIn = 3;
    state.goal = this.context.world.race.checkpoints.length + 1;
    state.zones.clear();
    state.zones.push(
      Object.assign(new ZoneState(), {
        id: 'avalanche-front',
        x: 0,
        z: -74,
        radius: 16,
        duration: 150,
        remaining: 150,
      }),
    );
  }

  attack(id: string): void {
    const { state, world } = this.context;
    const p = state.players.get(id);
    if (!p) return;
    const from: Vec3 = [p.x, p.y + EYE_HEIGHT, p.z];
    const dir: Vec3 = [
      Math.sin(p.yaw) * Math.cos(p.pitch),
      -Math.sin(p.pitch),
      Math.cos(p.yaw) * Math.cos(p.pitch),
    ];
    let hitId = '';
    let bestDist = 16;
    for (const [otherId, other] of this.context.alive()) {
      if (otherId === id || other.qualified) continue;
      const dx = other.x - from[0];
      const dy = other.y + 1.0 - from[1];
      const dz = other.z - from[2];
      const proj = dx * dir[0] + dy * dir[1] + dz * dir[2];
      if (proj < 0.3 || proj > bestDist) continue;
      if (dx * dx + dy * dy + dz * dz - proj * proj <= 0.85) {
        bestDist = proj;
        hitId = otherId;
      }
    }
    const wall = traceBlockShape(world, from, dir, bestDist, 'collision');
    if (wall && wall.distance < bestDist) {
      hitId = '';
      bestDist = wall.distance;
    }
    const to: Vec3 = [from[0] + dir[0] * bestDist, from[1] + dir[1] * bestDist, from[2] + dir[2] * bestDist];
    this.context.shot({ from, to, hit: !!hitId, playerId: id });
    if (hitId) {
      const target = state.players.get(hitId)!;
      target.vx += dir[0] * 8;
      target.vz += dir[2] * 8;
    }
  }

  interact(id: string): void {
    const p = this.context.state.players.get(id);
    const finish = this.context.world.race.finish;
    if (p && canReachPoint(p, finish.x, finish.y + 1, finish.z, finish.radius)) {
      p.score = this.context.state.goal;
      this.context.sound('deliver', [finish.x, finish.y + 1, finish.z], id);
      this.context.qualify(id);
    }
  }

  update(dt: number): void {
    const { state, world } = this.context;
    if (state.elapsed < 3) {
      state.iceShrinkIn = Math.max(0, 3 - state.elapsed);
    } else {
      state.iceShrinkIn = 0;
      const speed = 1.15 + Math.min(0.65, (state.elapsed - 3) * 0.008);
      this.avalancheZ = Math.min(54, this.avalancheZ + speed * dt);
      state.iceRadius = this.avalancheZ;
      if (state.zones[0]) state.zones[0].z = this.avalancheZ;

      const targetRow = Math.floor(this.avalancheZ);
      while (this.collapsedRow < targetRow) {
        this.collapsedRow++;
        const z = this.collapsedRow;
        for (let x = -15; x <= 15; x += 3) {
          for (let y = 5; y <= 25; y++) {
            if (world.get(x, y, z) !== BLOCK.AIR) {
              recordVoxel(this.context, this.brokenMap, x, y, z, BLOCK.AIR);
            }
          }
        }
      }
    }

    for (const [id, p] of this.context.alive()) {
      if (p.qualified) continue;
      // Downhill ice glide momentum!
      const under = world.get(Math.floor(p.x), Math.floor(p.y - 0.2), Math.floor(p.z));
      if (under === BLOCK.ICE) {
        p.vz = Math.min(3.2, (p.vz || 0) + 2.4 * dt);
      }

      if (p.y <= world.loseY || p.z < this.avalancheZ - 1.5) {
        this.context.eliminate(id);
        continue;
      }

      const nextCp = world.race.checkpoints[p.checkpoint];
      if (nextCp && p.z >= nextCp.z) {
        p.checkpoint++;
        p.score = p.checkpoint;
        this.context.sound('deliver', [p.x, p.y + 1, p.z], id);
      }
      if (p.z >= 59 && Math.abs(p.x) <= 12) {
        p.score = state.goal;
        this.context.sound('deliver', [p.x, p.y + 1, p.z], id);
        this.context.qualify(id);
        continue;
      }
      p.progress = p.z;
    }
  }
}
