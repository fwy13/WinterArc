import { useEffect } from 'react';
import { useEnabledGames } from '../config/gameAvailability';
import { ClubLogo } from './ClubBrand';
import { type GameId, type MatchFormat } from 'winterarc-core';
import type { ConnectionStatus } from '../network/NetworkService';
import RoomBrowser from './RoomBrowser';
import type { PublicRoom } from 'winterarc-protocol';
import { useI18n } from '../i18n';
import { primary, secondary, field, eyebrow, panel } from './ui';
export const gameIcons: Record<GameId, string> = {
  hunt: '☃',
  colorfall: '▦',
  giftrace: '🎁',
  crab: '🦀',
  icebreak: '❄',
  knockout: '☃',
  wallduel: '◎',
  battleship: '⚓',
};
interface Props {
  randomMode: boolean;
  onRandomMode(value: boolean): void;
  authenticated: boolean;
  admin: boolean;
  tournament: boolean;
  tournamentTitle: string;
  tournamentRounds: number;
  tournamentCapacity: number;
  onTournament(value: boolean): void;
  onTournamentTitle(value: string): void;
  onTournamentRounds(value: number): void;
  onTournamentCapacity(value: number): void;
  selected: GameId;
  onSelect(value: GameId): void;
  privateRoom: boolean;
  onPrivateRoom(value: boolean): void;
  createPassword: string;
  onCreatePassword(value: string): void;
  joinPassword: string;
  onJoinPassword(value: string): void;
  format: MatchFormat;
  name: string;
  code: string;
  status: ConnectionStatus;
  error: string;
  ready: boolean;
  listRooms(signal?: AbortSignal): Promise<PublicRoom[]>;
  onJoinRoom(roomId: string): void;
  onFormat(format: MatchFormat): void;
  onconnect(join: boolean): void;
  onNameChange(value: string): void;
  onCodeChange(value: string): void;
}
export default function ArcadeMenu(p: Props) {
  const enabledModes = useEnabledGames();
  const { t } = useI18n();
  useEffect(() => { if (!enabledModes.includes(p.selected) && enabledModes[0]) p.onSelect(enabledModes[0]); }, [enabledModes, p.selected, p.onSelect]);
  useEffect(() => { if ((p.selected === 'knockout' || ['wallduel','battleship'].includes(p.selected)) && !p.randomMode && p.format !== 'solo') p.onFormat('solo'); }, [p.selected, p.randomMode, p.format, p.onFormat]);
  const busy = p.status === 'connecting';
  return (
    <main className="relative z-10 mx-auto grid w-full max-w-7xl gap-4 px-3 pb-8 pt-28 sm:gap-8 sm:px-10 sm:pb-20 sm:pt-28 min-[640px]:grid-cols-[1fr_1fr] lg:gap-16 [@media(max-height:500px)]:pt-14 [@media(max-height:500px)]:gap-3">
      <section className="space-y-5">
        <div className="paper-sheet club-game-hero p-5 sm:p-7">
          <ClubLogo />
          <div className="flex items-center justify-between gap-3">
            <p className={eyebrow}>{t('menu.eyebrow')}</p>
            <span className="club-game-tag">WINTER ARCADE</span>
          </div>
          <h1 className="font-note my-3 text-3xl font-bold leading-tight sm:text-5xl [@media(max-height:500px)]:text-2xl">
            {t('menu.title')}
          </h1>
          <p className="mt-5 border-t border-dashed border-ink/30 pt-3 font-note text-lg text-berry">
            {t('paper.greeting')}
          </p>
        </div>
        <RoomBrowser listRooms={p.listRooms} onJoin={p.onJoinRoom} disabled={busy || !p.ready} />
      </section>
      <section className="flex flex-col justify-end gap-4">
        <form
          className={`${panel} paper-tape space-y-3 max-sm:!p-4 [&_button]:min-h-11 [&_input]:min-h-11 [&_select]:min-h-11`}
          onSubmit={(e) => {
            e.preventDefault();
            p.onconnect(false);
          }}
        >
          {p.admin && <fieldset className="space-y-3 rounded border border-fir/25 p-3" disabled={busy}>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="!min-h-0 size-5 accent-fir" checked={p.tournament} onChange={e => p.onTournament(e.target.checked)} />
              {t('social.tournamentRoom')}
            </label>
            {p.tournament && <>
              <label className="block text-xs">{t('account.eventTitle')}
                <input className={field} minLength={3} maxLength={80} value={p.tournamentTitle} required onChange={e => p.onTournamentTitle(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs">{t('account.rounds')}
                  <input type="number" className={field} min={1} max={20} value={p.tournamentRounds} required onChange={e => p.onTournamentRounds(Number(e.target.value))} />
                </label>
                <label className="block text-xs">{t('account.capacity')}
                  <input type="number" className={field} min={2} max={['wallduel','battleship'].includes(p.selected) && !p.randomMode ? 2 : 32} disabled={['wallduel','battleship'].includes(p.selected) && !p.randomMode} value={['wallduel','battleship'].includes(p.selected) && !p.randomMode ? 2 : p.tournamentCapacity} required onChange={e => p.onTournamentCapacity(Number(e.target.value))} />
                </label>
              </div>
            </>}
          </fieldset>}
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="!min-h-0 size-5 accent-fir" checked={p.randomMode}
              disabled={busy} onChange={event => p.onRandomMode(event.target.checked)} />
            {t('room.random')}
          </label>
          <label className="block text-xs font-semibold text-ink/80" htmlFor="game-mode">
            {t('match.mode')}
          </label>
          <select
            id="game-mode"
            className={field}
            value={p.selected}
            disabled={busy || p.randomMode}
            onChange={(e) => p.onSelect(e.target.value as GameId)}
          >
            {enabledModes.map((mode) => (
              <option key={mode} value={mode}>
                {gameIcons[mode]} {t(`games.${mode}.title`)}
              </option>
            ))}
          </select>
          <><label className="block text-xs font-semibold text-ink/80" htmlFor="match-format">
                {t('menu.format')}
              </label>
              <select
                id="match-format"
                className={field}
                value={p.format}
                disabled={busy || p.tournament}
                onChange={(e) => p.onFormat(e.target.value as MatchFormat)}
              >
                <option value="solo">{t('format.solo')}</option>
                <option value="squad" disabled={(p.selected === 'knockout' || ['wallduel','battleship'].includes(p.selected)) && !p.randomMode}>{t('format.squad')}</option>
              </select>
              </>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={p.privateRoom || p.tournament}
              disabled={busy || p.tournament}
              onChange={(e) => p.onPrivateRoom(e.target.checked)}
              className="!min-h-0 size-5 accent-fir"
            />
            {t('room.private')}
          </label>
          {(p.privateRoom || p.tournament) && (
            <>
              <label className="block text-xs text-ink/80" htmlFor="create-password">
                {t('room.newPassword')}
              </label>
              <input
                id="create-password"
                type="password"
                autoComplete="new-password"
                className={field}
                value={p.createPassword}
                maxLength={64}
                disabled={busy}
                onChange={(e) => p.onCreatePassword(e.target.value)}
              />
            </>
          )}
          <button type="submit" className={`${primary} w-full`} disabled={busy || !p.ready}>
            {busy ? t('menu.connecting') : t('menu.create')} ↗
          </button>
          <label className="block text-xs font-semibold text-ink/80" htmlFor="room-code">
            {t('menu.code')}
          </label>
          <label className="block text-xs text-ink/80" htmlFor="join-password">
            {t('room.joinPassword')}
          </label>
          <input
            id="join-password"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                p.onconnect(true);
              }
            }}
            type="password"
            autoComplete="off"
            className={field}
            value={p.joinPassword}
            maxLength={64}
            disabled={busy}
            onChange={(e) => p.onJoinPassword(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              id="room-code"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  p.onconnect(true);
                }
              }}
              className={`${field} min-w-0`}
              value={p.code}
              maxLength={64}
              onChange={(e) => p.onCodeChange(e.target.value)}
              placeholder={t('menu.codePlaceholder')}
              disabled={busy}
            />
            <button
              type="button"
              className={secondary}
              disabled={busy || !p.ready}
              onClick={() => p.onconnect(true)}
            >
              {t('menu.join')}
            </button>
          </div>
          {p.error && (
            <p role="alert" className="text-sm text-berry">
              {p.error}
            </p>
          )}
          <p className="text-xs text-ink/65">{t('help.desktop')}</p>
        </form>
      </section>
    </main>
  );
}
