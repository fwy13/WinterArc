import { useEffect, useState } from 'react';
import { ECONOMY, THEMES, type AccountProfile } from 'winterarc-profile';
import { useI18n } from '../i18n';
import { useStore } from '../hooks/useStore';
import { field, secondary } from '../components/ui';
import { account, api, presentProfile } from './service';
import ProfileName from './ProfileName';
import AvatarPhoto from './AvatarPhoto';

export default function ProfileEditor({
  inRoom,
  busy,
  run,
}: {
  inRoom: boolean;
  busy: boolean;
  run(action: () => Promise<void>): Promise<void>;
}) {
  const me = useStore(account);
  const { t } = useI18n();
  const [name, setName] = useState(me?.name || '');
  const [color, setColor] = useState(me?.color || 0);
  useEffect(() => {
    if (me) {
      setName(me.name);
      setColor(me.color);
    }
  }, [me?.id, me?.name, me?.color]);
  if (!me) return null;
  const disabled = busy || inRoom;
  return (
    <section className="space-y-4">
      <div
        className="rounded-lg border border-fir/20 p-4"
        style={{ backgroundColor: THEMES.find((value) => value.id === me.theme)?.color }}
      >
        <div className="flex flex-wrap justify-center gap-4 flex-col">
          <ProfileName player={me} showRoles={true} />
          <div className="min-w-0">
            <p>
              💵 {me.tokens} · 🏆 {me.points}
            </p>
          </div>
        </div>
        <p className="mt-3 break-all font-mono text-xs">ID: {me.id}</p>
      </div>
      <p className="text-xs text-ink/70">{t('social.googleAvatarHint')}</p>
      {inRoom && <p className="text-sm text-berry">{t('account.leaveToEdit')}</p>}
      <label className="block">
        {t('account.name')}
        <input
          className={field}
          maxLength={20}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={disabled}
        />
      </label>
      <button
        className={secondary}
        disabled={disabled || name.trim() === me.name}
        onClick={() =>
          void run(async () => {
            presentProfile(
              (await api<{ profile: AccountProfile }>('/profile/name', { name })).profile,
            );
          })
        }
      >
        {t('account.rename', { cost: me.nameChanges ? ECONOMY.renameCost : 0 })}
      </button>
      <label className="block">
        {t('account.coat')}
        <select
          className={field}
          value={color}
          onChange={(e) => setColor(Number(e.target.value))}
          disabled={disabled}
        >
          {['🟥', '🟩', '🟪', '🟨', '🟦', '🩷'].map((icon, i) => (
            <option key={i} value={i}>
              {icon}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-ink/65">{t('shop.coatHint')}</p>
      <button
        className={secondary}
        disabled={disabled || color === me.color}
        onClick={() =>
          void run(async () => {
            presentProfile(
              (
                await api<{ profile: AccountProfile }>('/profile/style', {
                  frameId: me.frameId,
                  theme: me.theme,
                  color,
                })
              ).profile,
            );
          })
        }
      >
        {t('account.saveStyle', { cost: 0 })}
      </button>
    </section>
  );
}
