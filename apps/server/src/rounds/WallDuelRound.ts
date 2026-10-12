import { DUEL, duelHit, duelPoint, duelRay, STEP } from 'winterarc-gameplay';
import type { InputCommand } from 'winterarc-protocol';
import type { RoundContext, RoundController } from './RoundContext.js';
export class WallDuelRound implements RoundController {
  private hidden = { x:0, pose:0 };
  private deadline = DUEL.hideTime as number;
  private fireAt = 0;
  private nextShot = 0;
  private lastPrivate = -1;
  private fireHeld = false;
  constructor(private readonly arena: RoundContext) {}
  prepare(): void {
    const s=this.arena.state, ids=[...this.arena.roster];
    // Seed is already randomized for each match. Exactly two entrants is enforced by the room.
    s.duelHunterId=ids[s.seed%2] ?? '';s.duelHiderId=ids[(s.seed+1)%2] ?? '';
    s.duelTurn=1;
    this.beginTurn();
  }
  private beginTurn(): void {
    const s=this.arena.state;
    this.hidden={x:0,pose:0};this.fireAt=0;this.nextShot=0;this.fireHeld=true;
    s.duelAmmo=3;s.duelStage='hide';s.duelYaw=0;s.duelPitch=.06;s.duelCharge=0;
    this.deadline=s.elapsed+DUEL.hideTime;s.duelRemaining=DUEL.hideTime;
    for(const [id,p] of this.arena.alive()) {
      // Public positions remain fixed. Never put the hidden pose in shared schema state.
      p.x=0;p.y=DUEL.floor;p.z=id===s.duelHunterId?DUEL.hunterZ:DUEL.hiderZ;
      p.vx=p.vy=p.vz=p.yaw=p.pitch=0;
    }
    this.sendPrivate();
  }
  input(id: string, cmd: InputCommand | undefined): void {
    const s=this.arena.state,p=s.players.get(id);
    if(!p?.connected || !cmd || cmd.duelTurn!==s.duelTurn || s.phase!=='playing')return;
    if(id===s.duelHiderId) {
      if(cmd.duelPose !== undefined && Number.isInteger(cmd.duelPose) && cmd.duelPose>=0 && cmd.duelPose<=2)this.hidden.pose=cmd.duelPose;
      const speed=this.hidden.pose===0?4:this.hidden.pose===1?2.8:1.9;
      // The hider's camera faces -Z, so screen-right is world -X.
      this.hidden.x=Math.max(-DUEL.limit,Math.min(DUEL.limit,this.hidden.x-cmd.side*speed*STEP));
    } else if(id===s.duelHunterId) {
      if(!this.fireAt) {
        const approach=(a:number,b:number)=>a+Math.max(-1.2*STEP,Math.min(1.2*STEP,b-a));
        s.duelYaw=approach(s.duelYaw,Math.max(-.42,Math.min(.42,cmd.yaw)));
        s.duelPitch=approach(s.duelPitch,Math.max(-.26,Math.min(.26,cmd.pitch)));
      }
      const pressed=cmd.duelFire===true;
      if(pressed && !this.fireHeld && s.duelStage==='hunt' && s.duelAmmo>0 && !this.fireAt && s.elapsed>=this.nextShot && s.elapsed<this.deadline) {
        s.duelAmmo--;this.fireAt=s.elapsed+DUEL.shotDelay;this.nextShot=this.fireAt+DUEL.cooldown;
      }
      this.fireHeld=pressed;
    }
  }
  update(_dt: number): void {
    const s=this.arena.state;
    if(this.arena.alive().length<2) { this.arena.complete('duel-forfeit');return; }
    if(this.fireAt && s.elapsed>=this.fireAt) {
      this.fireAt=0;s.duelCharge=0;
      const hit=duelHit(s.duelYaw,s.duelPitch,this.hidden.x,this.hidden.pose);
      const hunter=s.players.get(s.duelHunterId)!;
      this.arena.shot({playerId:s.duelHunterId,from:duelRay(s.duelYaw,s.duelPitch).from,to:duelPoint(s.duelYaw,s.duelPitch,DUEL.hiderZ+.6),hit});
      if(hit) {hunter.score++;this.arena.eliminate(s.duelHiderId);this.arena.complete('duel-hit');return;}
      if(s.duelAmmo===0)this.swap();
    }
    if(s.elapsed>=this.deadline && !this.fireAt) {
      if(s.duelStage==='hide') {s.duelStage='hunt';this.deadline=s.elapsed+DUEL.huntTime;}
      else this.swap();
    }
    s.duelCharge=this.fireAt?Math.max(0,this.fireAt-s.elapsed):0;
    s.duelRemaining=Math.max(0,this.deadline-s.elapsed);
    if(s.elapsed-this.lastPrivate>=.05)this.sendPrivate();
  }
  private swap(): void {
    const s=this.arena.state;
    [s.duelHunterId,s.duelHiderId]=[s.duelHiderId,s.duelHunterId];s.duelTurn++;
    this.beginTurn();
  }
  private sendPrivate(): void {
    const s=this.arena.state;this.lastPrivate=s.elapsed;
    this.arena.privateDuel(s.duelHiderId,{round:s.round,turn:s.duelTurn,...this.hidden});
  }
}
