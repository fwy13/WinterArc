import type { Snapshot } from 'winterarc-protocol';
import { useStore } from '../hooks/useStore';
import { knockoutPower, adjustKnockoutPower } from '../engine/KnockoutInput';
import { useI18n } from '../i18n';
export default function KnockoutHud({ state: s, active }: { state: Snapshot; active: boolean }) {
  const { locale } = useI18n(), vi=locale==='vi', power=useStore(knockoutPower);
  const k=s.knockout, aiming=k.stage==='aim';
  return <section className={`knockout-hud hud-surface ${aiming && k.remaining<=3?'is-urgent':''}`}>
    <span className="hud-eyebrow">{vi?'LƯỢT':'TURN'} {k.turn}</span>
    <div className="knockout-count"><strong>{Math.ceil(k.remaining)}</strong><span>{aiming?(vi?'CHỌN HƯỚNG':'CHOOSE YOUR AIM'):k.stage==='reveal'?(vi?'SẴN SÀNG!':'GET READY!'):(vi?'LAO ĐI!':'GO!')}</span></div>
    {active && <fieldset disabled={!aiming} className="knockout-power">
      <label htmlFor="knockout-power">{vi?'Lực đẩy':'Power'} <b>{power}/10</b></label>
      <div><button type="button" aria-label={vi?'Giảm lực':'Less power'} onClick={()=>adjustKnockoutPower(power-1)}>−</button>
      <input id="knockout-power" type="range" min="1" max="10" step="1" value={power} onChange={e=>adjustKnockoutPower(Number(e.target.value))} />
      <button type="button" aria-label={vi?'Tăng lực':'More power'} onClick={()=>adjustKnockoutPower(power+1)}>+</button></div>
      <small>{vi?'Xoay góc nhìn để ngắm · Q / E chỉnh lực':'Look to aim · Q / E adjust power'}</small>
    </fieldset>}
  </section>;
}
