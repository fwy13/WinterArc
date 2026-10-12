import BattleshipHud from './BattleshipHud';
import WallDuelHud from './WallDuelHud';
import KnockoutHud from './KnockoutHud';
import { CLUB } from '../config/club';
import type { Snapshot } from 'winterarc-protocol';
import { PALETTE } from 'winterarc-world';
import { useTouchControls } from '../hooks/useTouchControls';
import { useI18n, type TranslationKey } from '../i18n';
import ModeHint from './ModeHint';
import HudIcon from './hud/HudIcon';
import './hud/hud.css';

export function HudLayout({ state: s, candidate = false, touch = false }: {
  state: Snapshot; candidate?: boolean; touch?: boolean;
}) {
  const { t } = useI18n();
  const me = s.players.find(p => p.id === s.selfId);
  const active = !!me && !me.observer && !me.out && !me.qualified && me.hp > 0;
  const playing = s.phase === 'playing';
  const seconds = Math.max(0, Math.ceil(s.remaining));
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const alive = s.players.filter(p => !p.observer && !p.out).length;
  const progress = s.mode === 'giftrace' ? me?.checkpoint ?? 0 : me?.score ?? 0;
  const goal = Math.max(0, s.goal);
  const bossHp = Math.max(0, Math.min(s.boss.hp, s.boss.maxHp));
  const urgent = s.mode === 'colorfall' ? !s.floor.dropped && s.floor.remaining <= 3
    : s.mode === 'crab' ? ['slam', 'leap', 'shockwave'].includes(s.boss.action)
    : (s.mode === 'icebreak' || s.mode === 'knockout') && s.ice.shrinkIn > 0 && s.ice.shrinkIn <= 3;
  if (s.mode === 'battleship') return <BattleshipHud state={s} />;
  if (s.mode === 'wallduel') return <WallDuelHud state={s} touch={touch} />;
  return <div className={`game-hud ${touch ? 'game-hud--touch' : ''}`} data-mode={s.mode}>
    {s.mode === 'knockout' && playing && s.knockout && <KnockoutHud state={s} active={active} />}
    <section className="hud-identity hud-surface">
      <span className="hud-mode-icon hud-club-mark"><img src={CLUB.mark} width={32} height={32} alt={CLUB.name} /></span>
      <div><span className="hud-eyebrow">IT CLUB · WINTER ARC</span><h2>{t(`games.${s.mode}.title`)}</h2></div>
    </section>
    <section className={`hud-match hud-surface ${seconds <= 15 && playing ? 'is-urgent' : ''}`}>
      <div className="hud-clock" aria-label={`${t('hud.time')}: ${clock}`}><HudIcon name="clock" /><time>{clock}</time></div>
      <div className="hud-alive"><HudIcon name="players" /><span>{alive}<small> / {s.entrants}</small></span><span className="hud-alive-label">{t('cup.remaining')}</span></div>
    </section>

    {playing && s.mode !== 'knockout' && (active || s.mode === 'crab' || s.mode === 'colorfall') && <section className={`hud-objective hud-surface ${urgent ? 'is-urgent' : ''}`}>
      <div className="hud-objective-heading"><span className="hud-eyebrow">{t(`ingame.${s.mode}.label`)}</span><span className="hud-live-dot" /></div>
      {(s.mode === 'hunt' || s.mode === 'giftrace') && <>
        <div className="hud-objective-value"><strong>{progress}<small> / {goal}</small></strong><span>{t(s.mode === 'hunt' ? 'hud.found' : 'hud.checkpoint')}</span></div>
        <progress className="hud-meter" aria-label={t(s.mode === 'hunt' ? 'hud.found' : 'hud.checkpoint')} value={Math.min(progress, goal)} max={goal || 1} />
        <p className="hud-description">{t(s.mode === 'giftrace' && progress >= goal ? 'ingame.deliverHint' : `ingame.${s.mode}.hint`)}</p>
      </>}
      {s.mode === 'crab' && <>
        <div className="hud-boss-title"><strong>{t('hud.boss')}</strong><span>{bossHp}<small> / {s.boss.maxHp}</small></span></div>
        <progress className="hud-meter hud-meter--boss" aria-label={t('hud.boss')} value={bossHp} max={s.boss.maxHp || 1} />
        <div className="hud-boss-meta"><span>{t('ingame.stage', { count: s.boss.stage })}</span>{active && <><span className="hud-health"><HudIcon name="heart" />{me.hp} <small>HP</small></span><span>{t('common.score')}: {me.score}</span></>}</div>
      </>}
      {s.mode === 'colorfall' && <>
        <div className="hud-color-callout">
          <span className="hud-color-swatch" style={{ backgroundColor: PALETTE[s.floor.safeBlock]?.[1] ?? '#fff' }}><HudIcon name={s.floor.dropped ? 'check' : 'colorfall'} /></span>
          <div className="hud-color-name"><span>{t(s.floor.dropped ? 'floor.return' : 'floor.stand')}</span><strong>{t(`tile.${s.floor.safeBlock}` as TranslationKey)}</strong></div>
          <strong className="hud-phase-time">{Math.max(0, Math.ceil(s.floor.remaining))}<small>s</small></strong>
        </div>
        <div className="hud-boss-meta"><span>{t('floor.cycle', { count: s.floor.cycle + 1 })}</span><span>{t(s.floor.dropped ? 'ingame.hold' : 'ingame.moveNow')}</span></div>
      </>}
      {s.mode === 'icebreak' && <>
        <div className="hud-objective-value"><strong>{alive}<small> / {s.entrants}</small></strong><span>{t('hud.alive')}</span></div>
        <div className="hud-boss-meta"><span>{t('ingame.radius')}</span><strong>{Math.max(0, s.ice.radius).toFixed(1)} m</strong></div>
        <p className="hud-description">{t('ingame.icebreak.hint')}</p>
      </>}
      {active && (!touch || urgent || s.mode === 'giftrace' && progress >= goal) && <ModeHint state={s} />}
    </section>}

    {playing && active && <>
      {s.mode !== 'knockout' && <span className={`hud-reticle ${candidate ? 'is-ready' : ''}`} />}
      {candidate && (s.mode === 'hunt' || s.mode === 'giftrace') && <div className="hud-interact hud-surface" role="status">
        <kbd>{touch ? '◎' : 'E'}</kbd><span>{t(s.mode === 'hunt' ? 'ingame.find' : 'ingame.deliver')}</span>
      </div>}
      {!touch && s.mode !== 'knockout' && <div className="hud-controls"><span><kbd>W A S D</kbd>{t('mobile.move')}</span><span><kbd>SPACE</kbd>{t('mobile.jump')}</span><span><kbd>{s.mode === 'crab' || s.mode === 'icebreak' ? 'F' : 'SHIFT'}</kbd>{t(s.mode === 'crab' || s.mode === 'icebreak' ? 'mobile.attack' : 'ingame.sprint')}</span><span><kbd>ESC</kbd>{t('ingame.pause')}</span></div>}
    </>}
    {playing && me && !active && <div className="hud-result-tag hud-surface" role="status"><HudIcon name={me.qualified ? 'check' : 'players'} /><div><strong>{t(me.observer ? 'account.spectating' : me.out ? 'cup.eliminated' : me.qualified ? 'cup.qualified' : 'account.spectating')}</strong><span>{t('cup.watch')}</span></div></div>}
  </div>;
}
export default function GameHud(props: { state: Snapshot; candidate: boolean }) {
  const touch = useTouchControls();
  return <HudLayout {...props} touch={touch} />;
}
