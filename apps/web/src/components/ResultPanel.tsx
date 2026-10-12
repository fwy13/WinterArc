import { useState } from 'react';
import { useEnabledGames } from '../config/gameAvailability';
import TournamentBoard from './TournamentBoard';
import ProfileName from '../account/ProfileName';
import AvatarPhoto from '../account/AvatarPhoto';
import { type ModeSelection, type MatchFormat } from 'winterarc-core';
import { type Snapshot } from 'winterarc-protocol';
import { useI18n } from '../i18n';
import './results.css';

interface Props {
  state: Snapshot;
  onstart(): void;
  onleave(): void;
  onready(): void;
  onMode(mode: ModeSelection): void;
  onFormat(format: MatchFormat): void;
}

export default function ResultPanel({ state: s, onstart, onleave, onready, onMode, onFormat }: Props) {
  const enabledModes = useEnabledGames();
  const { t, locale } = useI18n();
  const vi = locale === 'vi';
  const [view, setView] = useState<'ranking' | 'room'>('ranking');
  const me = s.players.find(p => p.id === s.selfId);
  const host = s.hostId === s.selfId;
  const players = s.players.filter(p => p.connected && !p.observer);
  const results = s.players.filter(p => p.rank > 0).sort((a, b) => a.rank - b.rank);
  const winners = results.filter(p => s.winnerIds.includes(p.id));
  const won = !!me && s.winnerIds.includes(me.id);
  const ranked = !!me && !me.observer && me.rank > 0;
  const ready = players.filter(p => p.ready).length;
  const complete = !!s.tournamentId && s.tournamentCompleted >= s.tournamentRounds;
  const canStart = (!['wallduel','battleship'].includes(s.modeSelection) || players.length === 2) && players.length >= (s.tournamentId ? 2 : 1) && ready === players.length && !complete;
  const personalTitle = won ? (vi ? 'Chiến thắng!' : 'Victory!')
    : ranked ? (vi ? 'Hẹn lượt phục thù!' : 'Time for a rematch!')
    : (vi ? 'Trận đấu khép lại' : 'Match complete');
  // Match-only titles derived from reported results; these grant no account rewards.
  const badges: { icon: string; title: string; detail: string }[] = [];
  if (ranked) {
    if (won) badges.push({ icon: '♛', title: vi ? 'Ngôi sao trận đấu' : 'Match star', detail: vi ? 'Thắng trận này' : 'Won this match' });
    else if (me.rank <= 3) badges.push({ icon: '◆', title: vi ? 'Bục vinh danh' : 'Podium finish', detail: vi ? 'Kết thúc trong top 3' : 'Finished in the top 3' });
    if (['hunt', 'giftrace'].includes(s.resultMode) && me.deaths === 0)
      badges.push({ icon: '✦', title: vi ? 'Bước chân vững vàng' : 'Sure-footed', detail: vi ? 'Không ngã lần nào' : 'No falls this match' });
    if (['hunt', 'crab'].includes(s.resultMode) && me.score > 0 && me.score === Math.max(...results.map(p => p.score)))
      badges.push({ icon: 'ϟ', title: s.resultMode === 'hunt' ? (vi ? 'Thợ săn tuyết' : 'Snow seeker') : (vi ? 'Khắc tinh cua' : 'Crab challenger'), detail: vi ? 'Điểm cao nhất trận (kể cả đồng hạng)' : 'Highest match score (including ties)' });
    if (['knockout', 'icebreak', 'colorfall'].includes(s.resultMode) && won)
      badges.push({ icon: '❄', title: vi ? 'Trụ vững đến cuối' : 'Last one standing', detail: vi ? 'Có mặt trong nhóm chiến thắng' : 'Among the match winners' });
  }
  return <div className="result-screen">
    <main className={`result-shell ${won ? 'result-shell--victory' : ''}`}>
      <header className="result-hero">
        <div className="result-kicker">{t(`games.${s.resultMode}.title`)} <span>·</span> {vi ? 'KẾT QUẢ TRẬN' : 'MATCH RESULTS'}</div>
        <h1>{personalTitle}</h1>
        <p>{s.winnerIds.length ? (winners.length ? winners.map(p => p.name).join(' · ') : s.winnerName) : t('cup.empty')}</p>
        {results.length > 0 && <ol className="result-podium" aria-label={vi ? 'Top 3 trận đấu' : 'Match top three'}>
          {results.slice(0, 3).map(p => <li key={p.id} className={`result-podium-player result-place-${p.rank} ${s.winnerIds.includes(p.id) ? 'is-winner' : ''}`}>
            <span className="result-crown" aria-hidden="true">{s.winnerIds.includes(p.id) ? '♛' : '✦'}</span>
            <AvatarPhoto player={p} size={64} />
            <strong title={p.name}>{p.name}</strong>
            <span className="result-podium-rank">#{p.rank}</span>
          </li>)}
        </ol>}
      </header>

      {ranked && <section className="result-personal" aria-label={vi ? 'Kết quả của bạn' : 'Your result'}>
        <div className="result-personal-stats">
          <div><span>{vi ? 'Hạng của bạn' : 'Your rank'}</span><strong>#{me.rank}<small> / {s.entrants}</small></strong></div>
          <div><span>{t('common.score')}</span><strong>{me.score}</strong></div>
          <div><span>{vi ? 'Số lần ngã' : 'Falls'}</span><strong>{me.deaths}</strong></div>
        </div>
        {!!badges.length && <div className="result-badges" aria-label={vi ? 'Danh hiệu trận này' : 'Match titles'}>{badges.map(b => <div key={b.title} className="result-badge" title={b.detail}><span aria-hidden="true">{b.icon}</span><div><strong>{b.title}</strong><small>{b.detail}</small></div></div>)}</div>}
      </section>}

      <nav className="result-tabs" aria-label={vi ? 'Thông tin sau trận' : 'Post-match information'}>
        <button type="button" aria-pressed={view === 'ranking'} onClick={() => setView('ranking')}>{vi ? 'Bảng xếp hạng' : 'Leaderboard'}</button>
        <button type="button" aria-pressed={view === 'room'} onClick={() => setView('room')}>{vi ? 'Trận tiếp theo' : 'Next match'} <span>{ready}/{players.length}</span></button>
      </nav>
      <section className="result-content">
        {view === 'ranking' ? <>
          {results.length ? <ol className="result-ranking">{results.map(p => <li key={p.id} className={p.id === s.selfId ? 'is-self' : ''}>
            <span className="result-rank">#{p.rank}</span>
            <div className="result-player-name"><ProfileName player={p} showRoles={false} />{s.winnerIds.includes(p.id) && <small className="result-winner-label">{vi ? 'Chiến thắng' : 'Winner'}</small>}</div>
            <div className="result-player-score"><strong>{p.score}</strong><small>{t('common.score')}</small></div>
          </li>)}</ol> : <p className="result-empty">{vi ? 'Chưa có kết quả để hiển thị.' : 'No results to display.'}</p>}
          {s.tournamentId && <TournamentBoard state={s} />}
        </> : <div className="result-room">
          <div><h2>{s.tournamentTitle || t('post.room', { code: s.roomId })}</h2>
            {s.tournamentId && <p>{t('account.tournamentProgress', { done: s.tournamentCompleted, total: s.tournamentRounds })}</p>}
            <div className="result-options">
              <label>{t('match.mode')}<select disabled={!host || !!s.tournamentId} value={s.modeSelection} onChange={e => onMode(e.target.value as ModeSelection)}>
                <option value="random">{t('room.random')}</option>
                {!enabledModes.includes(s.modeSelection as typeof enabledModes[number]) && s.modeSelection !== 'random' && <option value={s.modeSelection} disabled>{t(`games.${s.modeSelection}.title`)}</option>}
                {enabledModes.map(id => <option key={id} value={id}>{t(`games.${id}.title`)}</option>)}
              </select></label>
              <label>{t('menu.format')}<select disabled={!host || !!s.tournamentId} value={s.format} onChange={e => onFormat(e.target.value as MatchFormat)}>
                <option value="solo">{t('format.solo')}</option><option value="squad" disabled={(s.mode === 'knockout' || ['wallduel','battleship'].includes(s.mode))}>{t('format.squad')}</option>
              </select></label>
            </div>
          </div>
          <ul className="result-roster">{players.map(p => <li key={p.id}><ProfileName player={p} showRoles={false} /><span className={p.ready ? 'is-ready' : ''}>{t(p.ready ? 'lobby.ready' : 'lobby.notReady')}{p.id === s.hostId ? ' ♛' : ''}</span></li>)}</ul>
        </div>}
      </section>
      <footer className="result-actions">
        <div className="result-ready-status" role="status"><span className={canStart ? 'is-ready' : ''}>{complete ? (vi ? 'Giải đấu đã hoàn tất' : 'Tournament complete') : t('post.readyCount', { ready, total: players.length })}</span>
          {!complete && <progress aria-label={vi ? 'Người chơi sẵn sàng' : 'Players ready'} value={ready} max={players.length || 1} />}
        </div>
        <div className="result-buttons">
          <button type="button" className="result-leave" onClick={onleave}>{vi ? 'Rời phòng' : 'Leave room'}</button>
          {!complete && me && !me.observer && <button type="button" className={me.ready ? 'result-secondary' : 'result-primary'} onClick={onready}>{me.ready ? (vi ? '✓ Đã sẵn sàng' : '✓ Ready') : (vi ? 'Sẵn sàng chơi lại' : 'Ready for rematch')}</button>}
          {!complete && host && <button type="button" className="result-primary" disabled={!canStart} onClick={onstart}>{t('result.again')} <span aria-hidden="true">→</span></button>}
        </div>
      </footer>
    </main>
  </div>;
}
