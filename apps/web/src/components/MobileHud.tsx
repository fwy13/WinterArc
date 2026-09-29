import type { Snapshot } from 'winterarc-protocol';
import { PALETTE } from 'winterarc-world';
import { useI18n, type TranslationKey } from '../i18n';

/** Critical information only. Full controls/settings remain available while paused. */
export default function MobileHud({ state: s }: { state: Snapshot }) {
  const { t } = useI18n();
  const me = s.players.find((p) => p.id === s.selfId);
  const clock = `${Math.floor(s.remaining / 60)}:${String(s.remaining % 60).padStart(2, '0')}`;
  const alive = s.players.filter((p) => !p.observer && !p.out).length;
  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none text-[10px] leading-tight text-ink">
      <section className="absolute left-[max(0.5rem,env(safe-area-inset-left))] right-[calc(max(0.5rem,env(safe-area-inset-right))+11rem)] top-[max(0.5rem,env(safe-area-inset-top))] max-w-xs paper-tab px-2.5 py-1.5">
        <div className="flex items-center gap-2">
          <strong className="min-w-0 flex-1 truncate text-xs">{t(`games.${s.mode}.title`)}</strong>
          <time className="shrink-0 font-mono text-xs tabular-nums">{clock}</time>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink/85">
          <span>
            {t('cup.remaining')}: {alive}/{s.entrants}
          </span>
          {s.mode === 'hunt' && (
            <span className="text-fir">
              ☃ {me?.score ?? 0}/{s.goal}
            </span>
          )}
          {s.mode === 'giftrace' && (
            <span className="text-fir">
              🎁 {me?.checkpoint ?? 0}/{s.goal}
            </span>
          )}
        </div>
      </section>
      {s.mode === 'colorfall' && (
        <div className="absolute left-1/2 top-[calc(max(0.5rem,env(safe-area-inset-top))+4rem)] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-paper/95 px-3 py-1.5">
          <span>{t(s.floor.dropped ? 'floor.return' : 'floor.stand')}</span>
          <strong
            className="rounded px-2 py-1 text-ink"
            style={{ backgroundColor: PALETTE[s.floor.safeBlock]?.[1] }}
          >
            {t(`tile.${s.floor.safeBlock}` as TranslationKey)}
          </strong>
          <strong className="font-mono text-base tabular-nums">
            {Math.ceil(s.floor.remaining)}
          </strong>
        </div>
      )}
      {s.mode === 'crab' && (
        <section className="absolute left-1/2 top-[calc(max(0.5rem,env(safe-area-inset-top))+4rem)] w-[min(55vw,240px)] -translate-x-1/2 paper-tab px-2 py-1">
          <div className="flex justify-between gap-2">
            <strong>{t('hud.boss')}</strong>
            <span>♥ {me?.hp ?? 0}</span>
          </div>
          <progress
            aria-label={t('hud.boss')}
            className="mt-1 block h-1 w-full accent-berry"
            value={s.boss.hp}
            max={s.boss.maxHp || 1}
          />
        </section>
      )}
      {s.phase === 'playing' && !me?.out && !me?.qualified && (
        <span className="absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_2px_black]" />
      )}

    </div>
  );
}
