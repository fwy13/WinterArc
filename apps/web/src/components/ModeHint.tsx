import type { Snapshot } from 'winterarc-protocol';
import { useI18n } from '../i18n';

export default function ModeHint({ state: s }: { state: Snapshot }) {
  const { t } = useI18n();
  const me = s.players.find(p => p.id === s.selfId);
  if (!me || me.out || me.qualified || s.phase !== 'playing') return null;
  let text = '';
  if (s.mode === 'icebreak') text = s.ice.shrinkIn > 0 ? t('hint.ice', { seconds: Math.ceil(s.ice.shrinkIn) }) : t('hint.iceStable');
  if (s.mode === 'crab') {
    if (['slam', 'leap'].includes(s.boss.action)) text = t('hint.crabAway');
    else if (s.boss.action === 'shockwave') text = t('hint.crabJump');
    else if (s.boss.action === 'recover') text = t('hint.crabRecover');
  }
  if (s.mode === 'hunt' && s.elapsed >= 45) {
    const distances = s.targets.filter(target => !me.found.includes(target.id)).map(target => Math.hypot(target.x - me.x, target.y - me.y, target.z - me.z));
    if (distances.length) text = t('hint.hunt', { distance: Math.ceil(Math.min(...distances)) });
  }
  if (s.mode === 'giftrace') text = t('hint.gift', { count: me.checkpoint, total: s.goal });
  if (!text) return null;
  return <p className="pointer-events-none fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 z-20 max-w-[65vw] -translate-x-1/2 rounded bg-paper/90 px-2 py-1 text-center text-[10px] text-ink sm:bottom-16 sm:text-xs">{text}</p>;
}
