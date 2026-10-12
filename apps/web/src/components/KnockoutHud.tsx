import type { CSSProperties } from 'react';
import type { Snapshot } from 'winterarc-protocol';
import { useStore } from '../hooks/useStore';
import { knockoutPower, adjustKnockoutPower } from '../engine/KnockoutInput';
import { useI18n } from '../i18n';

export default function KnockoutHud({ state: s, active }: { state: Snapshot; active: boolean }) {
  const { locale } = useI18n();
  const vi = locale === 'vi', power = useStore(knockoutPower);
  const k = s.knockout, aiming = k.stage === 'aim';
  const counting = aiming || k.stage === 'reveal';
  const seconds = Math.max(0, Math.ceil(k.remaining));
  const powerColor = power <= 3 ? '#62df9b' : power <= 7 ? '#f2ce64' : '#ff7771';
  return <>
    {counting && <div className={`knockout-count ${seconds <= 3 ? 'is-urgent' : ''}`} role="timer" aria-label={vi ? 'Đếm ngược lượt đẩy' : 'Push countdown'}>
      <strong>{seconds}</strong>
      <span>{aiming ? (vi ? 'Ngắm hướng' : 'Aim') : (vi ? 'Sẵn sàng!' : 'Ready!')}</span>
    </div>}
    {active && counting && <section className="knockout-hud hud-surface" style={{ '--power-color': powerColor } as CSSProperties}>
      <fieldset disabled={!aiming} className="knockout-power">
        <label htmlFor="knockout-power"><span>{vi ? 'Lực đẩy' : 'Power'} <b>{power}/10</b></span><span className="knockout-turn">{vi ? 'Lượt' : 'Turn'} {k.turn}</span></label>
        <div><button type="button" aria-label={vi ? 'Giảm lực' : 'Less power'} onClick={() => adjustKnockoutPower(power - 1)}>−</button>
          <input id="knockout-power" type="range" min="1" max="10" step="1" value={power} aria-valuetext={`${power}/10`} onChange={e => adjustKnockoutPower(Number(e.target.value))} />
          <button type="button" aria-label={vi ? 'Tăng lực' : 'More power'} onClick={() => adjustKnockoutPower(power + 1)}>+</button></div>
      </fieldset>
    </section>}
  </>;
}
