import { IDLE, movePlayer } from 'winterarc-gameplay';
import { BLOCK } from 'winterarc-world';
import type { RoundContext, RoundController } from './RoundContext.js';
/** Aim remains private on the server. Everyone reveals and launches on the same tick. */
export class KnockoutRound implements RoundController {
  private readonly aims = new Map<string, { yaw: number; power: number }>();
  private deadline = 10;
  constructor(private readonly arena: RoundContext) {}
  prepare(): void {
    const s = this.arena.state;
    s.knockoutStage = 'aim'; s.knockoutRemaining = 10; s.knockoutTurn = 1;
    s.iceRadius = 18; s.iceShrinkIn = 0;
    for (const [id,p] of this.arena.alive()) {
      p.vx = p.vz = p.vy = 0; p.launchPower = 0;
      this.aims.set(id, { yaw: Math.atan2(-p.x,-p.z), power: 5 });
    }
  }
  aim(id: string, yaw: number, power: number, turn: number): void {
    const s = this.arena.state, p = s.players.get(id);
    if (s.phase !== 'playing' || s.knockoutStage !== 'aim' || s.elapsed >= this.deadline || turn !== s.knockoutTurn ||
        !p || p.out || p.observer || !p.connected || !Number.isFinite(yaw) || Math.abs(yaw) >= 100 || !Number.isInteger(power) || power < 1 || power > 10) return;
    this.aims.set(id, { yaw, power });
  }
  update(dt: number): void {
    const s = this.arena.state;
    if (s.elapsed >= this.deadline) {
      if (s.knockoutStage === 'aim') {
        s.knockoutStage = 'reveal'; this.deadline = s.elapsed + 1;
        for (const [id,p] of this.arena.alive()) { p.yaw = this.aims.get(id)?.yaw ?? p.yaw; p.launchPower = this.aims.get(id)?.power ?? 5; }
      } else if (s.knockoutStage === 'reveal') {
        s.knockoutStage = 'slide'; this.deadline = s.elapsed + 4;
        for (const [id,p] of this.arena.alive()) {
          const aim = this.aims.get(id) ?? { yaw:p.yaw, power:5 }, speed = 2 + aim.power * 2.4;
          p.vx = Math.sin(aim.yaw)*speed; p.vz = Math.cos(aim.yaw)*speed;
        }
        this.arena.sound('throw',[0,9,0]);
      } else {
        s.knockoutStage = 'aim'; s.knockoutTurn++; this.deadline = s.elapsed + 10;
        this.shrink();
        for (const [id,p] of this.arena.alive()) {
          p.vx = p.vz = 0; p.launchPower = 0;
          this.aims.set(id,{yaw:Math.atan2(-p.x,-p.z),power:5});
        }
      }
    }
    s.knockoutRemaining = Math.max(0,this.deadline-s.elapsed);
    // Substeps prevent fast snowmen tunneling through each other.
    const alive = this.arena.alive();
    for (let step=0;step<4;step++) {
      for (const [,p] of alive) movePlayer(p,{...IDLE,yaw:p.yaw,pitch:0},this.arena.world,dt/4,.8);
      if (s.knockoutStage === 'slide') for (let i=0;i<alive.length;i++) for (let j=i+1;j<alive.length;j++) {
        const a=alive[i][1], b=alive[j][1], dx=b.x-a.x, dz=b.z-a.z, distance=Math.hypot(dx,dz);
        if (distance>=.9 || Math.abs(a.y-b.y)>1.2) continue;
        const nx=distance>.0001?dx/distance:1, nz=distance>.0001?dz/distance:0;
        const closing=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
        const overlap=(.9-distance)/2;
        a.x-=nx*overlap; a.z-=nz*overlap; b.x+=nx*overlap; b.z+=nz*overlap;
        if (closing<=0) continue;
        const impulse=closing*.92;
        a.vx-=impulse*nx; a.vz-=impulse*nz; b.vx+=impulse*nx; b.vz+=impulse*nz;
        if (closing>3) this.arena.sound('impact',[(a.x+b.x)/2,9,(a.z+b.z)/2]);
      }
    }
    for (const [id,p] of alive) if (p.y<=2.05) this.arena.eliminate(id);
    const count=this.arena.alive().length;
    if (!count || (s.entrants>1 && count===1)) this.arena.complete('survivors');
  }
  private shrink(): void {
    const {state:s,world}=this.arena;
    s.iceRadius=Math.max(s.entrants===1?6:0,s.iceRadius-1.5);
    for (let x=-18;x<=18;x++) for (let z=-18;z<=18;z++)
      if (Math.hypot(x+.5,z+.5)>=s.iceRadius && world.get(x,8,z)===BLOCK.ICE) {
        world.set(x,8,z,BLOCK.AIR);s.brokenIce.push(`${x}:${z}`);
      }
    this.arena.sound('break',[0,8,0]);
  }
}
