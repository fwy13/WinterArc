import { useState } from 'react';
import type { ProfileRole } from 'winterarc-profile';
import { useI18n } from '../i18n';
import { field, primary, secondary } from '../components/ui';
import { api, refreshAccount } from './service';

export default function AdminTools({ busy, inRoom, run, onJoin }: {
  busy: boolean; inRoom: boolean; run(action: () => Promise<void>): Promise<void>;
  onJoin(room: string, observer?: boolean, password?: string): Promise<void>;
}) {
  const { t } = useI18n();
  const [id, setId] = useState(''), [premium, setPremium] = useState(true);
  const [student, setStudent] = useState(false);
  const [sponsor, setSponsor] = useState<'' | ProfileRole>('');
  const [room, setRoom] = useState('');
  const [password, setPassword] = useState('');
  return <div className="grid gap-5 min-[700px]:grid-cols-2">
    <section className="space-y-3">
      <p className="text-sm">{t('social.tournamentMoved')}</p>
      <label className="block">{t('account.targetId')}
        <input className={field} value={id} onChange={e => setId(e.target.value)} disabled={busy} />
      </label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={premium} onChange={e => setPremium(e.target.checked)} disabled={busy} />Premium</label>
      <button className={secondary} disabled={busy || !id.trim()} onClick={() => void run(async () => {
        await api('/admin/premium', { userId: id.trim(), enabled: premium }); await refreshAccount();
      })}>{t('social.savePremium')}</button>
      <fieldset disabled={busy} className="space-y-2 border-t border-fir/20 pt-3">
        <legend className="pt-3 font-bold">{t('social.roles')}</legend>
        <label className="flex items-center gap-2"><input type="checkbox" checked={student} onChange={e => setStudent(e.target.checked)} />{t('social.role.student')}</label>
        <label className="block">{t('social.sponsorTier')}
          <select className={field} value={sponsor} onChange={e => setSponsor(e.target.value as '' | ProfileRole)}>
            <option value="">{t('social.noSponsor')}</option>
            {(['sponsor_bronze', 'sponsor_silver', 'sponsor_gold'] as const).map(role => <option key={role} value={role}>{t(`social.role.${role}`)}</option>)}
          </select>
        </label>
        <p className="text-xs">{t('social.rolesHint')}</p>
        <button className={primary} disabled={!id.trim()} onClick={() => void run(async () => {
          const roles: ProfileRole[] = [...(student ? ['student' as const] : []), ...(sponsor ? [sponsor] : [])];
          await api('/admin/roles', { userId: id.trim(), roles }); await refreshAccount();
        })}>{t('social.saveRoles')}</button>
      </fieldset>
    </section>
    <form className="space-y-3" onSubmit={e => {
      e.preventDefault(); void run(async () => onJoin(room.trim(), true, password));
    }}>
      <label className="block">{t('account.observeRoom')}
        <input className={field} value={room} onChange={e => setRoom(e.target.value)} required />
      </label>
      <label className="block">{t('room.joinPassword')}
        <input type="password" autoComplete="off" className={field} value={password} maxLength={64} onChange={e => setPassword(e.target.value)} />
      </label>
      <button className={secondary} disabled={busy || inRoom}>{t('account.observe')}</button>
    </form>
  </div>;
}
