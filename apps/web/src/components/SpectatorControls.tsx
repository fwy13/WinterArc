import { useEffect, useState } from 'react';
import type { Snapshot } from 'winterarc-protocol';
import { useI18n } from '../i18n';
import { field } from './ui';

export interface SpectatorOptions { target?: string; distance?: number; angle?: number; elevation?: number }
export default function SpectatorControls({ state, onChange }: {state:Snapshot;onChange(value:SpectatorOptions):void}) {
  const { t } = useI18n();
  const [target, setTarget] = useState('');
  const [distance, setDistance] = useState(12);
  const [angle, setAngle] = useState(0);
  const [elevation, setElevation] = useState(0.55);
  const me=state.players.find(p=>p.id===state.selfId);
  const candidates=state.players.filter(p=>!p.observer && !p.out && !p.qualified && p.connected && p.hp>0);
  const selected=candidates.some(p=>p.id===target)?target:(candidates[0]?.id||'');
  useEffect(()=>{onChange({target:selected,distance,angle,elevation});},[selected,distance,angle,elevation,onChange]);
  return <section className="match-spectator pointer-events-auto fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 z-40 w-[min(94vw,38rem)] -translate-x-1/2 rounded border border-fir/40 p-2 text-xs shadow-lg">
    <div className="flex items-center gap-2">
      <label htmlFor="spectate-player" className="shrink-0 font-bold">{t(me?.observer?'account.director':'account.spectating')}</label>
      <select id="spectate-player" className={`${field} !min-h-9 !py-1`} value={selected} onChange={e=>setTarget(e.target.value)}>
        {!candidates.length && <option value="">{t('account.noTargets')}</option>}
        {candidates.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <label className="flex shrink-0 items-center gap-1">↔<input aria-label={t('account.zoom')} type="range" min={3} max={32} value={distance} onChange={e=>setDistance(Number(e.target.value))} className="w-20 accent-fir"/></label>
    </div>
    {me?.observer && <div className="mt-2 flex gap-4">
      <label className="flex flex-1 items-center gap-2">{t('account.orbit')}<input className="min-w-0 flex-1 accent-fir" type="range" min={-3.14} max={3.14} step={0.02} value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label>
      <label className="flex flex-1 items-center gap-2">{t('account.elevation')}<input className="min-w-0 flex-1 accent-fir" type="range" min={0.15} max={1.25} step={0.02} value={elevation} onChange={e=>setElevation(Number(e.target.value))}/></label>
    </div>}
  </section>;
}
