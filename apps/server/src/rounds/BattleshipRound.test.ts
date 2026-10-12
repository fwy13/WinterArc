import test from 'node:test';
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { createFleet, fireAtFleet, fleetSunk } from 'winterarc-gameplay';
import type { InputCommand, SeaPrivate } from 'winterarc-protocol';
import { BattleshipRound } from './BattleshipRound.js';
import type { RoundContext } from './RoundContext.js';
function harness() {
 const players=new Map(['a','b'].map(id=>[id,{connected:true,out:false,score:0}]));
 const state={players,round:1,elapsed:0,phase:'playing',seaTurn:0,seaActiveId:'',seaRemaining:0};
 const views=new Map<string,SeaPrivate>();let finishes=0;
 const context={state,roster:['a','b'],alive:()=>[...players].filter(([,p])=>!p.out),eliminate:(id:string)=>{players.get(id)!.out=true;},complete:()=>{finishes++;state.phase='finished';},sound:()=>{},privateSea:(id:string,data:SeaPrivate)=>views.set(id,data)} as unknown as RoundContext;
 const round=new BattleshipRound(context);round.prepare();
 const fire=(id:string,cell:number,turn=state.seaTurn)=>round.input(id,{seaFire:true,seaCell:cell,seaTurn:turn} as InputCommand);
 return {state,views,round,fire,get finishes(){return finishes;}};
}
test('generated fleets have 3 straight ships of lengths 3,2,2',()=>{
 for(let n=0;n<200;n++) {const b=createFleet(randomInt);assert.equal(b.length,36);for(let id=1;id<=3;id++){const cells=b.flatMap((v,c)=>v===id?[c]:[]);assert.equal(cells.length,id===1?3:2);const step=cells[1]-cells[0];assert([1,6].includes(step));assert(cells.every((c,i)=>c===cells[0]+i*step));if(step===1)assert.equal(Math.floor(cells[0]/6),Math.floor(cells.at(-1)!/6));}}
});
test('repeat/out of bounds shots do not change state; sunk ships are marked',()=>{
 const board=createFleet(randomInt),shots=Array(36).fill(0);
 assert(!fireAtFleet(board,shots,36));assert(!fireAtFleet(board,shots,-1));
 board.forEach((ship,c)=>{if(ship){assert(fireAtFleet(board,shots,c));assert(!fireAtFleet(board,shots,c));}});
 assert.equal(fleetSunk(board,shots),3);assert(board.every((ship,c)=>!ship||shots[c]===3));
});
test('private fleets, turn ownership and stale actions are enforced',()=>{
 const h=harness(),active=h.state.seaActiveId,other=active==='a'?'b':'a';
 assert.equal(h.views.size,2);assert.deepEqual(Object.keys(h.views.get(active)!).sort(),['round','own','shots','incoming','sunk','enemySunk'].sort());
 h.fire(other,0);assert.equal(h.state.seaTurn,1);h.fire(active,0,0);assert.equal(h.state.seaTurn,1);
 h.fire(active,0);assert.equal(h.state.seaActiveId,other);assert.equal(h.state.seaTurn,2);assert.equal(h.views.get(active)!.shots[0],h.views.get(other)!.incoming[0]);
 h.fire(active,1,1);assert.equal(h.state.seaTurn,2);
});
test('timeouts progress and a sunk fleet finishes exactly once',()=>{
 const h=harness();h.state.elapsed=20;h.round.update();assert.equal(h.state.seaTurn,2);
 for(let i=0;i<72 && h.state.phase==='playing';i++) {
  const id=h.state.seaActiveId,other=id==='a'?'b':'a',view=h.views.get(id)!;
  const target=h.views.get(other)!.own.findIndex((ship,c)=>ship>0&&!view.shots[c]);
  h.fire(id,target);
 }
 assert.equal(h.state.phase,'finished');assert.equal(h.finishes,1);h.round.update();assert.equal(h.finishes,1);
});
