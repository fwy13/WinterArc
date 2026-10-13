import { randomInt } from 'node:crypto';
import { canReadCode, codeEpoch, CODE_HUNT } from 'winterarc-gameplay';
import type { RoundContext, RoundController } from './RoundContext.js';
export class CodeHuntRound implements RoundController {
  private readonly codes = new Map<string, string>();
  private readonly nextGuess = new Map<string, number>();
  private epoch = -1;
  private nextView = 0;
  private breakEnds = 0;
  constructor(private readonly context: RoundContext) {}
  prepare(): void {
    const s = this.context.state;
    s.codeTurn = 0; s.goal = CODE_HUNT.rounds;
    for (const id of this.context.roster) { const p=s.players.get(id); if(p) p.score=0; }
    this.startTurn();
  }
  private startTurn(): void {
    const {state:s,world,roster} = this.context;
    s.codeTurn++; s.codeStage='hide'; s.codeStartedAt=s.elapsed; s.codeRemaining=CODE_HUNT.hideSeconds;
    this.nextGuess.clear(); this.epoch=-1; this.nextView=0;
    const slots = Array.from({length:roster.length},(_,i)=>i);
    for(let i=slots.length-1;i>0;i--) { const j=randomInt(i+1); [slots[i],slots[j]]=[slots[j],slots[i]]; }
    roster.forEach((id,index)=>{
      const p=s.players.get(id); if(!p || p.observer) return;
      Object.assign(p,world.spawn(slots[index]),{out:false,hp:100,qualified:false,vy:0,vx:0,vz:0,
        yaw:0,pitch:0,eliminatedAt:0,eliminatedRound:0});
    });
    this.context.resetInputs?.(); this.sendViews();
  }
  private rotate(): void {
    const epoch=codeEpoch(this.context.state.elapsed-this.context.state.codeStartedAt);
    if(epoch<0 || epoch===this.epoch) return;
    this.epoch=epoch;
    const used=new Set(this.codes.values()); this.codes.clear();
    for(const [id] of this.context.alive()) {
      let code:string; do {code=String(randomInt(10000)).padStart(4,'0');} while(used.has(code));
      used.add(code);this.codes.set(id,code);
    }
  }
  private endTurn(): void {
    const s=this.context.state;
    if(s.codeTurn>=CODE_HUNT.rounds) { this.context.complete('codehunt-points');return; }
    s.codeStage='break';s.codeRemaining=CODE_HUNT.breakSeconds;
    this.breakEnds=s.elapsed+CODE_HUNT.breakSeconds;this.epoch=-1;
    this.context.resetInputs?.();this.sendViews();
  }
  private sendViews(): void {
    const {state,world}=this.context,alive=this.context.alive();
    for(const [id,viewer] of state.players) {
      if(!viewer.connected)continue;
      const visible=state.codeStage==='hunt' && !viewer.out && !viewer.observer && this.epoch>=0
        ? alive.filter(([other,target])=>other!==id && canReadCode(viewer,target,world))
          .flatMap(([other])=>{const code=this.codes.get(other);return code?[{id:other,code}]:[];}) : [];
      this.context.privateCodes(id,{round:state.round,turn:state.codeTurn,epoch:this.epoch,visible});
    }
  }
  update(): void {
    const {state:s,world}=this.context;
    const connected=this.context.roster.filter(id=>{const p=s.players.get(id);return p?.connected&&!p.observer;});
    // Keep the normal reconnect grace period: missing contestants can return next turn.
    if(s.codeStage==='break') {
      s.codeRemaining=Math.max(0,this.breakEnds-s.elapsed);
      if(s.codeRemaining===0)this.startTurn();
      return;
    }
    const elapsed=s.elapsed-s.codeStartedAt;
    s.codeStage=elapsed<CODE_HUNT.hideSeconds?'hide':'hunt';
    s.codeRemaining=Math.max(0,(s.codeStage==='hide'?CODE_HUNT.hideSeconds:CODE_HUNT.roundSeconds)-elapsed);
    this.rotate();
    for(const [id,p] of this.context.alive()) if(p.y<=world.loseY)this.context.eliminate(id);
    if(elapsed>=CODE_HUNT.roundSeconds || this.context.alive().length<=1) {this.endTurn();return;}
    // No premature winner based on connection state or the last turn's survivor.
    if(!connected.length) return;
    if(s.elapsed>=this.nextView){this.nextView=s.elapsed+.1;this.sendViews();}
  }
  interact(id:string,data:unknown):void {
    const {state:s,world}=this.context,viewer=s.players.get(id);
    if(s.phase!=='playing'||s.codeStage!=='hunt'||!viewer?.connected||viewer.out||viewer.observer||viewer.qualified||viewer.hp<=0)return;
    if(!data||typeof data!=='object')return;
    const {code,turn}=data as {code?:unknown;turn?:unknown};
    const elapsed=s.elapsed-s.codeStartedAt;
    if(turn!==s.codeTurn||typeof code!=='string'||!/^\d{4}$/.test(code)||codeEpoch(elapsed)<0||elapsed>=CODE_HUNT.roundSeconds)return;
    if(s.elapsed<(this.nextGuess.get(id)??0))return;
    this.nextGuess.set(id,s.elapsed+CODE_HUNT.cooldown);this.rotate();
    const target=this.context.alive().find(([other,p])=>other!==id&&this.codes.get(other)===code&&canReadCode(viewer,p,world));
    if(!target){this.context.notice(id,'@codehunt.miss');return;}
    this.context.eliminate(target[0]);viewer.score++;
    this.context.sound('hit',[target[1].x,target[1].y+1.5,target[1].z],id);
    this.context.notice(id,'@codehunt.hit');this.nextView=0;
    if(this.context.alive().length<=1)this.endTurn();else this.sendViews();
  }
}
