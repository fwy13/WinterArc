import { useEffect,useState } from 'react';
import type { Snapshot } from 'winterarc-protocol';
import { useI18n } from '../i18n';
import { seaInput } from '../engine/SeaInput';
import './battleship.css';
const coordinate=(c:number)=>`${String.fromCharCode(65+c%6)}${Math.floor(c/6)+1}`;
export default function BattleshipHud({state:s}:{state:Snapshot}){
 const {locale}=useI18n(),vi=locale==='vi',d=s.sea,me=s.players.find(p=>p.id===s.selfId);
 const [selected,setSelected]=useState(-1),[waiting,setWaiting]=useState(false);
 useEffect(()=>{setSelected(-1);setWaiting(false);},[s.round,d.turn]);
 const privateState=d.self,active=!!me&&!me.out&&!me.observer&&s.phase==='playing';
 const myTurn=active&&d.activeId===s.selfId;
 const shots=privateState?.shots??Array(36).fill(0);
 return <section className="sea-hud">
  <header><div><small>LASER FLEET · 1 VS 1</small><h2>{myTurn?(vi?'Đến lượt bạn':'Your turn'):(vi?'Chờ đối thủ':'Opponent’s turn')}</h2></div><time>{Math.ceil(d.remaining)}s</time><span>{vi?'Lượt':'Turn'} {d.turn}</span></header>
  {!privateState?<p>{me?.observer?(vi?'Đội tàu được giữ bí mật.':'Fleets are hidden.'):(vi?'Đang nhận đội tàu…':'Loading fleet…')}</p>:<>
   <div className="sea-boards"><div className="sea-target"><h3>{vi?'Vùng biển đối phương':'Enemy waters'} <span>{privateState.enemySunk}/3 {vi?'tàu chìm':'sunk'}</span></h3>
    <div className="sea-grid-wrap"><div className="sea-grid">{shots.map((v,c)=><button type="button" key={c} aria-label={`${coordinate(c)} · ${v===0?(vi?'chưa bắn':'unknown'):v===1?(vi?'trượt':'miss'):v===3?(vi?'tàu chìm':'sunk'):(vi?'trúng':'hit')}`} aria-pressed={selected===c} disabled={!myTurn||waiting||v!==0} className={`sea-cell sea-cell-${v} ${selected===c?'is-selected':''}`} onClick={()=>setSelected(c)}><small>{coordinate(c)}</small><b>{v===1?'·':v>=2?'✕':selected===c?'⊕':''}</b></button>)}</div>
    {selected>=0 && <svg className="sea-aim-laser" viewBox="0 0 600 600" aria-hidden="true"><line x1="300" y1="600" x2={(selected%6+.5)*100} y2={(Math.floor(selected/6)+.5)*100}/><circle cx={(selected%6+.5)*100} cy={(Math.floor(selected/6)+.5)*100} r="22"/></svg>}
    </div>
    <button className="sea-fire" type="button" disabled={!myTurn||waiting||selected<0||shots[selected]!==0} onClick={()=>{seaInput.pending={cell:selected,turn:d.turn};setWaiting(true);}}>{waiting?(vi?'Đang bắn…':'Firing…'):`${vi?'Bắn laser':'Fire laser'} ${selected>=0?coordinate(selected):''}`}</button>
   </div><details className="sea-own" open><summary>{vi?'Đội tàu của bạn':'Your fleet'} · {3-privateState.sunk}/3</summary><div className="sea-grid sea-grid--own">{privateState.own.map((ship,c)=>{const shot=privateState.incoming[c];return <div key={c} className={`sea-cell sea-cell-${shot} ${ship?'has-ship':''}`} title={`${coordinate(c)} ${ship?`${vi?'Tàu':'Ship'} ${ship}`:''}`}><small>{coordinate(c)}</small><b>{shot>=2?'✕':shot===1?'·':ship?'▰':''}</b></div>;})}</div><p>{vi?'3 tàu: 3–2–2 ô. Trúng hoặc trượt đều đổi lượt. Hết 20s sẽ tự bắn một ô chưa thử.':'3 ships: 3–2–2 cells. Every shot swaps turns. At 20s, an untried cell is fired automatically.'}</p></details></div>
  </>}
 </section>;
}
