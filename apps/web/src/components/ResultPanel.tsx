import TournamentBoard from './TournamentBoard';
import ProfileName from '../account/ProfileName';
import { GAME_DEFINITIONS } from 'winterarc-gameplay';
import { type GameId, type ModeSelection, type MatchFormat } from 'winterarc-core';
import { type Snapshot } from 'winterarc-protocol';
import { useI18n } from '../i18n';
import { panel, primary, secondary, field, eyebrow } from './ui';

interface Props {
  state: Snapshot;
  onstart(): void;
  onleave(): void;
  onready(): void;
  onMode(mode: ModeSelection): void;
  onFormat(format: MatchFormat): void;
}
export default function ResultPanel({
  state: s,
  onstart,
  onleave,
  onready,
  onMode,
  onFormat,
}: Props) {
  const { t } = useI18n();
  const me = s.players.find((p) => p.id === s.selfId);
  const host = s.hostId === s.selfId;
  const players = s.players.filter((p) => p.connected && !p.observer);
  const results = s.players.filter((p) => p.rank > 0).sort((a, b) => a.rank - b.rank);
  const canStart =
    players.length >= (s.tournamentId ? 2 : 1) &&
    players.every((p) => p.ready) &&
    (!s.tournamentId || s.tournamentCompleted < s.tournamentRounds);
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-fir/35 px-3 pb-6 pt-28 sm:px-6 [@media(max-height:500px)]:pt-14">
      <main className="mx-auto grid max-w-5xl gap-5 min-[640px]:grid-cols-[1.1fr_1fr]">
        <section className={`${panel} p-5!`}>
          <p className={eyebrow}>
            {t('post.results')} · {t(`games.${s.resultMode}.title`)}
          </p>
          <h1 className="font-note my-4 text-3xl font-bold">
            {s.winnerIds.length ? t('post.celebrate') : t('cup.empty')}
          </h1>
          <ol className="mt-4 max-h-64 divide-y divide-ink/15 overflow-auto text-sm">
            {results.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2">
                <span className="min-w-0 flex-1 whitespace-normal [overflow-wrap:wrap-anywhere]">
                  {p.rank}. <ProfileName player={p} />
                </span>
                <span>
                  {p.score} · {t('post.falls', { count: p.deaths })}
                </span>
              </li>
            ))}
          </ol>
        </section>
        <section className={`${panel} p-5!`}>
          <p className={eyebrow}>{s.tournamentTitle || t('post.room', { code: s.roomId })}</p>
          {s.tournamentId && (
            <p>
              {t('account.tournamentProgress', {
                done: s.tournamentCompleted,
                total: s.tournamentRounds,
              })}
            </p>
          )}
          <h2 className="font-note my-3 text-3xl font-bold">{t('post.next')}</h2>
          <p className="mb-4 text-sm text-ink/65">{t('post.hint')}</p>
          <label className="block text-sm">
            {t('match.mode')}
            <select
              className={`${field} mt-1`}
              disabled={!host || !!s.tournamentId}
              value={s.modeSelection}
              onChange={(e) => onMode(e.target.value as ModeSelection)}
            >
              <option value="random">{t('room.random')}</option>
          {(Object.keys(GAME_DEFINITIONS) as GameId[]).map((id) => (
                <option key={id} value={id}>
                  {t(`games.${id}.title`)}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm">
            {t('menu.format')}
            <select
              className={`${field} mt-1`}
              disabled={!host || !!s.tournamentId}
              value={s.format}
              onChange={(e) => onFormat(e.target.value as MatchFormat)}
            >
              <option value="solo">{t('format.solo')}</option>
              <option value="squad">{t('format.squad')}</option>
            </select>
          </label>
          <ul className="my-4 max-h-56 divide-y divide-ink/15 overflow-auto text-sm">
            {players.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2">
                <span className="min-w-0 flex-1 whitespace-normal wrap-anywhere">
                  <ProfileName player={p} />
                  {p.id === s.hostId ? ' ♛' : ''}
                </span>
                <span className={p.ready ? 'text-fir' : 'text-ink/60'}>
                  {t(p.ready ? 'lobby.ready' : 'lobby.notReady')}
                </span>
              </li>
            ))}
          </ul>
          <p className="mb-3 text-xs text-ink/65">
            {t('post.readyCount', {
              ready: players.filter((p) => p.ready).length,
              total: players.length,
            })}
          </p>
          {s.tournamentId && <TournamentBoard state={s} />}
          <div className="flex flex-wrap gap-2">
            {!me?.observer && (
              <button className={primary} onClick={onready}>
                {t(me?.ready ? 'lobby.unready' : 'lobby.ready')}
              </button>
            )}
            {host && (
              <button className={primary} disabled={!canStart} onClick={onstart}>
                {t('result.again')}
              </button>
            )}
            <button className={secondary} onClick={onleave}>
              {t('common.back')}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
