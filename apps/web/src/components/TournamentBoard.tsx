import { useEffect, useState } from 'react';
import type { Snapshot } from 'winterarc-protocol';
import type { TournamentStanding } from 'winterarc-profile';
import { api } from '../account/service';
import ProfileName from '../account/ProfileName';
import { useI18n } from '../i18n';

/** Room-local standings. Joining the room is enough; there is no registration flow. */
export default function TournamentBoard({ state }: { state: Snapshot }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<TournamentStanding[]>([]);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    setFailed(false);
    void api<TournamentStanding[]>(`/tournaments/${encodeURIComponent(state.tournamentId)}`)
      .then(data => { if (current) setRows(data); })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [state.tournamentId, state.tournamentCompleted, state.phase, refresh]);

  return <details className="mt-3 rounded border border-fir/20 bg-white/40 p-3" open>
    <summary className="cursor-pointer font-bold">{t('social.standings')}</summary>
    {failed ? <p className="mt-2 text-sm text-berry">
      {t('social.standingsError')}{' '}
      <button className="underline" onClick={() => setRefresh(n => n + 1)}>{t('common.retry')}</button>
    </p> : rows.length ? <ol className="mt-2 max-h-48 space-y-2 overflow-y-auto">
      {rows.map((player, index) => {
        const rank = rows.findIndex(p => p.tournamentPoints === player.tournamentPoints && p.tournamentWins === player.tournamentWins) + 1;
        return <li key={player.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-6 shrink-0">#{rank || index + 1}</span>
          <ProfileName player={player} />
          <span className="ml-auto text-xs">{t('social.points', { points: player.tournamentPoints, wins: player.tournamentWins })}</span>
        </li>;
      })}
    </ol> : <p className="mt-2 text-xs">{t('social.noStandings')}</p>}
  </details>;
}
