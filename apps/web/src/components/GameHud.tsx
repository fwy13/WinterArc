import MobileHud from './MobileHud';
import { useTouchControls } from '../hooks/useTouchControls';
import type { Snapshot } from 'winterarc-protocol';
import { COLOR_FLOOR, PALETTE, floorBlock } from 'winterarc-world';
import { useI18n, type TranslationKey } from '../i18n';
const badge = 'paper-tab px-4 py-3';
export default function GameHud({
  state: s,
  candidate,
}: {
  state: Snapshot;
  candidate: boolean;
}) {
  const { t } = useI18n(),
    me = s.players.find((p) => p.id === s.selfId);
  const touch = useTouchControls();
  if (touch) return <MobileHud state={s} />;
  const clock = `${Math.floor(s.remaining / 60)}:${String(s.remaining % 60).padStart(2, '0')}`;
  const counts = new Map<number, number>();
  if (s.mode === 'colorfall')
    for (let x = -18; x < 18; x++)
      for (let z = -18; z < 18; z++) {
        const block = floorBlock(x, z, s.floor.cycle);
        counts.set(block, (counts.get(block) || 0) + 1);
      }
  return (
    <div className="pointer-events-none fixed inset-0 z-20 text-sm">
      <div className="absolute left-4 top-24 flex max-w-[85vw] flex-wrap gap-2">
        <div className={badge}>
          <p className="text-[10px] tracking-widest text-fir">{t('match.single')}</p>
          <strong>{t(`games.${s.mode}.title`)}</strong>
        </div>
        <div className={badge}>
          <p className="text-[10px] text-ink/65">{t('hud.time')}</p>
          <strong className="font-mono text-xl tabular-nums">{clock}</strong>
        </div>
        <div className={badge}>
          <p className="text-[10px] text-ink/65">{t('cup.remaining')}</p>
          <strong>
            {s.players.filter((p) => !p.observer && !p.out).length}/{s.entrants}
          </strong>
        </div>
      </div>
      {s.mode === 'colorfall' && (
        <section className={`${badge} absolute right-4 top-40 w-60`}>
          <p className="text-xs text-ink/80">
            {t(s.floor.dropped ? 'floor.return' : 'floor.stand')}
          </p>
          <div className="my-2 flex items-center justify-between gap-3">
            <span
              className="rounded-sm px-2 py-1 font-bold text-ink"
              style={{ backgroundColor: PALETTE[s.floor.safeBlock]?.[1] }}
            >
              {t(`tile.${s.floor.safeBlock}` as TranslationKey)}
            </span>
            <strong className="font-mono text-3xl">{Math.ceil(s.floor.remaining)}</strong>
          </div>
          <p className="mb-2 text-xs text-ink/65">{t('floor.schedule')}</p>
          <ul className="space-y-1">
            {COLOR_FLOOR.blocks.map((block) => (
              <li key={block} className="flex items-center justify-between text-xs">
                <span>{t(`tile.${block}` as TranslationKey)}</span>
                <strong className={block === s.floor.safeBlock ? 'text-fir' : 'text-berry'}>
                  {block === s.floor.safeBlock ? counts.get(block) : 0}
                </strong>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink/65">
            {t('floor.cycle', { count: s.floor.cycle + 1 })}
          </p>
        </section>
      )}
      {s.mode === 'crab' && (
        <div className={`${badge} absolute left-1/2 top-48 w-[min(80vw,400px)] -translate-x-1/2`}>
          <div className="mb-2 flex justify-between text-xs">
            <strong>{t('hud.boss')}</strong>
            <span>
              {s.boss.hp}/{s.boss.maxHp}
            </span>
          </div>
          <progress className="h-2 w-full accent-berry" value={s.boss.hp} max={s.boss.maxHp || 1} />
          <p className="mt-2 text-xs">
            ♥ {me?.hp ?? 0} · {t('common.score')}: {me?.score ?? 0}
          </p>
        </div>
      )}
      {s.phase === 'playing' && !me?.out && !me?.qualified && (
        <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-700 bg-white" />
      )}
      {!me?.observer && !me?.out && !me?.qualified && <div className="absolute bottom-8 left-1/2 flex w-[min(94vw,640px)] -translate-x-1/2 flex-col items-center gap-3">
        {me?.out && <p className={`${badge} text-berry`}>{t('cup.eliminated')}</p>}
        {me?.qualified && !me.out && (
          <p className={`${badge} text-fir`}>
            {t('cup.qualified')} · {t('cup.watch')}
          </p>
        )}
        {candidate && (
          <p className="rounded-full bg-paper-dark px-5 py-3 font-bold text-ink">
            {t(s.mode === 'giftrace' ? 'hud.deliver' : 'hud.find')}
          </p>
        )}
        {s.mode === 'hunt' && (
          <p className={badge}>
            ☃ {t('hud.found')}: {me?.score ?? 0}/{s.goal}
          </p>
        )}
        {s.mode === 'giftrace' && (
          <p className={badge}>
            {t('hud.carryGift')} · {t('hud.checkpoint')} {me?.checkpoint ?? 0}/{s.goal}
          </p>
        )}
      </div>}
    </div>
  );
}
