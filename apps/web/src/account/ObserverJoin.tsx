import { useState } from 'react';
import { useI18n } from '../i18n';
import { field, primary, secondary } from '../components/ui';
export default function ObserverJoin({ busy, inRoom, run, onJoin }: {
  busy: boolean; inRoom: boolean; run(action: () => Promise<void>): Promise<void>;
  onJoin(room: string, observer?: boolean, password?: string): Promise<void>;
}) {
  const { t } = useI18n();
  const [room, setRoom] = useState(''), [password, setPassword] = useState('');
  return <section className="space-y-4">
    <a className={`${secondary} inline-block`} href="/admin" target="_blank" rel="noopener noreferrer">{t('admin.open')}</a>
    <p className="text-sm">{t('social.tournamentMoved')}</p>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); void run(() => onJoin(room.trim(), true, password)); }}>
      <label className="block">{t('account.observeRoom')}<input className={field} value={room} onChange={e => setRoom(e.target.value)} required disabled={busy || inRoom} /></label>
      <label className="block">{t('room.joinPassword')}<input type="password" className={field} value={password} onChange={e => setPassword(e.target.value)} disabled={busy || inRoom} /></label>
      <button className={primary} disabled={busy || inRoom}>{t('account.observe')}</button>
    </form>
  </section>;
}
