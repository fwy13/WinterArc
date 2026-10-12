import { randomInt } from 'node:crypto';
import { createFleet, fireAtFleet, fleetSunk } from 'winterarc-gameplay';
import type { InputCommand } from 'winterarc-protocol';
import type { RoundContext, RoundController } from './RoundContext.js';
export class BattleshipRound implements RoundController {
  private boards=new Map<string,number[]>();
  private shots=new Map<string,number[]>();
  private deadline=20;
  private sent=-1;
  constructor(private readonly arena:RoundContext){}
  prepare():void {
    const s=this.arena.state;
    for(const id of this.arena.roster){this.boards.set(id,createFleet(randomInt));this.shots.set(id,Array(36).fill(0));}
    s.seaTurn=1;s.seaActiveId=this.arena.roster[randomInt(2)];s.seaRemaining=20;
    this.publish();
  }
  input(id:string,cmd:InputCommand|undefined):void {
    const s=this.arena.state;
    if(s.phase!=='playing'||!s.players.get(id)?.connected||!cmd||cmd.seaTurn!==s.seaTurn||cmd.seaFire!==true||id!==s.seaActiveId||s.elapsed>=this.deadline)return;
    if(cmd.seaCell!==undefined)this.fire(id,cmd.seaCell);
  }
  update():void {
    const s=this.arena.state;
    if(s.phase!=='playing')return;
    if(this.arena.alive().length<2){this.arena.complete('sea-forfeit');return;}
    if(s.elapsed>=this.deadline){
      const available=this.shots.get(s.seaActiveId)!.flatMap((v,i)=>v===0?[i]:[]);
      if(available.length)this.fire(s.seaActiveId,available[randomInt(available.length)]);
    }
    s.seaRemaining=Math.max(0,this.deadline-s.elapsed);
    if(s.elapsed-this.sent>=.5)this.publish();
  }
  private fire(id:string,cell:number):void {
    const s=this.arena.state,other=this.arena.roster.find(p=>p!==id)!;
    const board=this.boards.get(other)!,shots=this.shots.get(id)!;
    if(!fireAtFleet(board,shots,cell))return;
    const hit=shots[cell]>=2;
    if(hit)s.players.get(id)!.score++;
    this.arena.sound(hit?'hit':'sniper',[0,3,0],id);
    if(fleetSunk(board,shots)===3){this.publish();this.arena.eliminate(other);this.arena.complete('fleet-sunk');return;}
    s.seaTurn++;s.seaActiveId=other;this.deadline=s.elapsed+20;s.seaRemaining=20;this.publish();
  }
  private publish():void {
    const s=this.arena.state;this.sent=s.elapsed;
    for(const id of this.arena.roster){
      const other=this.arena.roster.find(p=>p!==id)!;
      const own=this.boards.get(id)!,shots=this.shots.get(id)!,incoming=this.shots.get(other)!;
      this.arena.privateSea(id,{round:s.round,own:[...own],shots:[...shots],incoming:[...incoming],sunk:fleetSunk(own,incoming),enemySunk:fleetSunk(this.boards.get(other)!,shots)});
    }
  }
}
