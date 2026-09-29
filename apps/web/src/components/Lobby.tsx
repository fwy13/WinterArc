import TournamentBoard from './TournamentBoard';
import ProfileName from '../account/ProfileName';
import { GAME_DEFINITIONS, MAX_PLAYERS } from 'winterarc-gameplay';
import { type GameId, type ModeSelection, type MatchFormat } from 'winterarc-core';
import { type Snapshot } from 'winterarc-protocol';
import { useI18n } from '../i18n';
import { panel, eyebrow, primary, secondary, field, PaperHolly } from './ui';
interface Props {
  state: Snapshot;
  onready(): void;
  onstart(): void;
  onleave(): void;
  oncopy(): void;
  onMode(mode: ModeSelection): void;
  onFormat(format: MatchFormat): void;
}
export default function Lobby({
  state: s,
  onready,
  onstart,
  onleave,
  oncopy,
  onFormat,
  onMode,
}: Props) {
  const { t } = useI18n(),
    me = s.players.find((p) => p.id === s.selfId),
    host = s.hostId === s.selfId;
  const enough = s.players.filter((p) => !p.observer && p.connected).length >= (s.tournamentId ? 2 : 1);
  const ready = s.players.every((p) => p.observer || p.id === s.hostId || !p.connected || p.ready);
  return (
    <main className="relative z-10 mx-auto max-w-2xl px-3 pb-8 pt-28 sm:px-5 sm:pb-20 sm:pt-28 [@media(max-height:500px)]:pt-14">
      <section className={`${panel} [@media(max-height:500px)]:!p-3 paper-tape max-sm:!p-4 [&_button]:min-h-11`}>
        <div className="flex items-center justify-between">
          <p className={eyebrow}>{t('match.single')}</p>
          <PaperHolly />
        </div>
        <h1 className="font-note my-2 text-xl sm:text-3xl font-bold">{s.tournamentTitle || t('lobby.title')}</h1>
        {s.tournamentId && <p>{t('account.tournamentProgress', { done: s.tournamentCompleted, total: s.tournamentRounds })}</p>}
        <><label className="my-4 block text-sm">
              <span className="mb-2 block text-ink/65">{t('menu.format')}</span>
              <select
                className={field}
                disabled={!host || !!s.tournamentId}
                value={s.format}
                onChange={(e) => onFormat(e.target.value as MatchFormat)}
              >
                <option value="solo">{t('format.solo')}</option>
                <option value="squad">{t('format.squad')}</option>
              </select>
            </label>
            <p className="text-xs leading-6 text-ink/65">{t(`format.${s.format}Help`)}</p></>
        <label className="mt-4 block text-sm" htmlFor="lobby-mode">
          {t('match.mode')}
        </label>
        <select
          id="lobby-mode"
          className={`${field} mt-2`}
          disabled={!host || !!s.tournamentId}
          value={s.modeSelection}
          onChange={(e) => onMode(e.target.value as ModeSelection)}
        >
          <option value="random">{t('room.random')}</option>
          {(Object.keys(GAME_DEFINITIONS) as GameId[]).map((mode) => (
            <option key={mode} value={mode}>
              {t(`games.${mode}.title`)}
            </option>
          ))}
        </select>
        <p className="mt-3 text-xs text-fir">{t(s.privateRoom ? 'room.private' : 'room.public')}</p>
        {s.privateRoom && <p className="mt-1 text-xs text-ink/65">{t('room.shareHint')}</p>}
        <div className="my-6 flex flex-wrap items-center justify-between gap-3 rounded-sm bg-ink/5 p-4">
          <div>
            <p className="text-xs text-ink/65">{t('lobby.room')}</p>
            <strong className="select-all font-mono text-xl tracking-widest text-fir">
              {s.roomId}
            </strong>
          </div>
          <button className={secondary} onClick={oncopy}>
            {t('lobby.copy')}
          </button>
        </div>
        <p className="mb-3 text-xs tracking-widest text-ink/65">
          {t('lobby.players')} · {s.players.filter(p => !p.observer).length}/{s.tournamentId ? s.tournamentCapacity : MAX_PLAYERS}
        </p>
        <ul className="max-h-[30dvh] sm:max-h-72 divide-y divide-ink/15 overflow-auto">
          {s.players.map((p) => (
            <li key={p.id} className="flex justify-between gap-4 py-3">
              <span className="min-w-0 flex-1 whitespace-normal [overflow-wrap:anywhere]">
                <ProfileName player={p} />{' '}
                {p.id === s.selfId && <small className="text-fir">({t('common.you')})</small>}
              </span>
              <span className="shrink-0 text-xs text-ink/65">
                {p.observer ? t('account.observer') : !p.connected
                  ? t('lobby.disconnected')
                  : p.id === s.hostId
                    ? t('common.host')
                    : p.ready
                      ? t('lobby.ready')
                      : t('lobby.notReady')}
              </span>
            </li>
          ))}
        </ul>
        <p className="my-5 text-sm text-ink/65">{enough ? t('lobby.hint') : t('lobby.minimum')}</p>
        {s.tournamentId && <TournamentBoard state={s} />}
        <div className="flex flex-wrap gap-3">
          {host ? (
            <button className={primary} disabled={!ready || !enough} onClick={onstart}>
              {t('lobby.start')}
            </button>
          ) : !me?.observer && (
            <button className={primary} onClick={onready}>
              {me?.ready ? t('lobby.unready') : t('lobby.ready')}
            </button>
          )}
          <button className={secondary} onClick={onleave}>
            {t('common.back')}
          </button>
        </div>
      </section>
    </main>
  );
}
