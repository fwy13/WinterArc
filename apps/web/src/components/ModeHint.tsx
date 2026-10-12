import type { Snapshot } from 'winterarc-protocol';
import { useI18n } from '../i18n';

export default function ModeHint({ state: s }: { state: Snapshot }) {
  const { t } = useI18n();
  const me = s.players.find(p => p.id === s.selfId);
  if (!me || me.observer || me.out || me.qualified || s.phase !== 'playing') return null;
  let text = '';
  if ((s.mode === 'icebreak' || s.mode === 'knockout')) text = s.ice.shrinkIn > 0 ? t('hint.ice', { seconds: Math.ceil(s.ice.shrinkIn) }) : t('hint.iceStable');
  if (s.mode === 'crab') {
    if (['slam', 'leap'].includes(s.boss.action)) text = t('hint.crabAway');
    else if (s.boss.action === 'shockwave') text = t('hint.crabJump');
    else if (s.boss.action === 'recover') text = t('hint.crabRecover');
  }
  if (s.mode === 'hunt' && s.elapsed >= 45) {
    const distances = s.targets.filter(target => !me.found.includes(target.id)).map(target => Math.hypot(target.x - me.x, target.y - me.y, target.z - me.z));
    if (distances.length) text = t('hint.hunt', { distance: Math.ceil(Math.min(...distances)) });
  }

  if (!text) return null;
  const danger = (s.mode === 'crab' && ['slam', 'leap', 'shockwave'].includes(s.boss.action)) ||
    ((s.mode === 'icebreak' || s.mode === 'knockout') && s.ice.shrinkIn > 0 && s.ice.shrinkIn <= 3);
  return <p className={`hud-hint ${danger ? 'hud-hint--danger' : ''}`}><span aria-hidden="true">{danger ? '!' : '↗'}</span>{text}</p>;
}
