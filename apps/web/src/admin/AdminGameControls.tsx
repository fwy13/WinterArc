import { useEffect, useState } from 'react';
import type { GameId } from 'winterarc-core';
import { GAME_DEFINITIONS } from 'winterarc-gameplay';
import { api } from '../account/service';
import { useI18n } from '../i18n';
import { setEnabledGames, useEnabledGames } from '../config/gameAvailability';
import { field, panel, primary, secondary } from '../components/ui';
import { CLUB } from '../config/club';
export default function AdminGameControls({ onError }: { onError(error: unknown): void }) {
  const { t, locale } = useI18n();
  const vi = locale === 'vi', modes = useEnabledGames();
  const [emails, setEmails] = useState<string[]>([]), [draft, setDraft] = useState('');
  const [filter, setFilter] = useState(''), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void api<{ emails: string[] }>('/admin/club-emails').then(r => { if (active) { setEmails(r.emails); setLoaded(true); } }).catch(e => { if (active) onError(e); });
    return () => { active = false; };
  }, [onError]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); try { await action(); } catch (e) { onError(e); } finally { setBusy(false); }
  };
  const updateEmails = async (values: string[], remove: boolean) => {
    const r = await api<{ emails: string[] }>('/admin/club-emails', { emails: values, remove });
    setEmails(r.emails); if (!remove) setDraft('');
  };
  return <>
    <section className={`${panel} !p-4`}>
      <h2 className="mb-4 text-xl font-bold">{vi ? 'Minigame đang mở' : 'Available minigames'}</h2>
      <div className="grid gap-2 sm:grid-cols-2">{(Object.keys(GAME_DEFINITIONS) as GameId[]).map(mode =>
        <label key={mode} className="flex items-center justify-between gap-3 rounded-lg border border-fir/20 p-3">
          <span>{t(`games.${mode}.title`)}</span>
          <input type="checkbox" role="switch" checked={modes.includes(mode)} disabled={busy} onChange={e => {
            const enabled = e.target.checked;
            void run(async () => { const r = await api<{ enabledModes: GameId[] }>('/admin/games', { mode, enabled }); setEnabledGames(r.enabledModes); });
          }} />
        </label>)}</div>
      <p className="mt-3 text-xs text-ink/60">{vi ? 'Trận đang chơi vẫn được hoàn thành.' : 'Games already in progress can finish.'}</p>
    </section>
    <section className={`${panel} !p-4`}>
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><img src={CLUB.mark} alt="" className="h-8 w-8 rounded-full bg-[#07314c] p-1" />{vi ? 'Thành viên CLB' : 'Club members'} <span className="text-sm font-normal">({emails.length})</span></h2>
      <form onSubmit={e => { e.preventDefault(); void run(() => updateEmails(draft.split(/[\s,;]+/).filter(Boolean), false)); }}>
        <label className="block text-sm">Email<textarea className={`${field} mt-2 min-h-24`} value={draft} onChange={e => setDraft(e.target.value)} maxLength={12000} required placeholder={'member@example.com\nmember2@example.com'} disabled={busy || !loaded} /></label>
        <button className={`${primary} mt-2`} disabled={busy || !loaded}>{vi ? 'Thêm thành viên' : 'Add members'}</button>
      </form>
      <input className={`${field} my-3`} value={filter} onChange={e => setFilter(e.target.value)} placeholder={vi ? 'Tìm email' : 'Search emails'} aria-label={vi ? 'Tìm email' : 'Search emails'} />
      {!loaded && <p>{t('common.loading')}</p>}
      <ul className="max-h-72 space-y-2 overflow-y-auto">{emails.filter(email => email.includes(filter.trim().toLowerCase())).map(email => <li key={email} className="flex items-center justify-between gap-2 rounded border border-fir/10 p-2">
        <span className="break-all text-sm">{email}</span><button className={secondary} disabled={busy} aria-label={`${vi ? 'Xóa' : 'Remove'} ${email}`} onClick={() => void run(() => updateEmails([email], true))}>{vi ? 'Xóa' : 'Remove'}</button>
      </li>)}</ul>
    </section>
  </>;
}
