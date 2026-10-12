import type { Snapshot } from 'winterarc-protocol';
import { duelControls, duelPose, selectDuelPose } from '../engine/WallDuelInput';
import { useStore } from '../hooks/useStore';
import { useI18n } from '../i18n';
import './wall-duel.css';
const posePaths=['M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4M12 7v7m-5-4 5-2 5 2m-5 4-4 7m4-7 4 7','M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4m0 4-3 6 6 2-4 5m-2-7-4 5h5m1-9 5 3','M4 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4m2 2h8l7 2m-7-2 7-2'];
export default function WallDuelHud({state:s,touch}:{state:Snapshot;touch:boolean}) {
  const {t}=useI18n(),pose=useStore(duelPose),d=s.duel;
  const me=s.players.find(p=>p.id===s.selfId),active=!!me && !me.observer && !me.out && s.phase==='playing';
  const hunter=active && d.hunterId===s.selfId,hider=active && d.hiderId===s.selfId;
  return <div className={`duel-hud ${touch?'duel-hud--touch':''}`}>
    <div className="duel-status hud-surface"><span>{t(hunter?'duel.hunter':hider?'duel.hider':'account.spectating')}</span><strong>{t('duel.turn',{turn:d.turn})}</strong><time>{Math.max(0,Math.ceil(d.remaining))}s</time><span className="duel-ammo" aria-label={t('duel.ammo',{count:d.ammo})}>{[0,1,2].map(i=><i key={i} className={i<d.ammo?'is-loaded':''}/>)}<b>{d.ammo}/3</b></span></div>
    {active && d.stage==='hide' && <div className="duel-count" role="timer"><strong>{Math.ceil(d.remaining)}</strong><span>{t(hider?'duel.hideNow':'duel.waitHide')}</span></div>}
    {hunter && d.stage==='hunt' && <span className={`duel-reticle ${d.charge>0?'is-firing':''}`} aria-hidden="true"/>}
    {active && d.charge>0 && <div className="duel-warning" role="status">{t(hider?'duel.dodge':'duel.firing')}</div>}
    {hider && <div className="duel-pose-panel"><span>{t(touch?'duel.moveTouch':'duel.moveKeys')}</span><div className="duel-poses">{(['duel.stand','duel.crouch','duel.lie'] as const).map((key,i)=><button key={key} type="button" aria-pressed={pose===i} onClick={()=>selectDuelPose(i)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d={posePaths[i]}/></svg><span>{!touch && `${i+1} · `}{t(key)}</span></button>)}</div></div>}
    {hunter && <div className="duel-fire-panel"><span>{t(touch?'duel.aimTouch':'duel.aimMouse')}</span><button type="button" disabled={d.stage!=='hunt'||d.ammo===0||d.charge>0} onClick={()=>{duelControls.fireRequested=true;}}>{t('duel.fire')} <small>{d.ammo}/3</small></button></div>}
  </div>;
}
