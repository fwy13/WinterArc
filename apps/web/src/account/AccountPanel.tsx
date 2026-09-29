import { useCallback, useEffect, useState } from 'react';
import type { PublicProfile } from 'winterarc-profile';
import { account, api, refreshAccount, rewardPresentationBusy, signOut } from './service';
import GoogleSignIn from './GoogleSignIn';
import ProfileName from './ProfileName';
import ProfileEditor from './ProfileEditor';
import ObserverJoin from './ObserverJoin';
import { useStore } from '../hooks/useStore';
import { useI18n, t, type TranslationKey } from '../i18n';
import { panel, primary, secondary } from '../components/ui';

type Tab = 'profile' | 'rank' | 'admin';
interface Props {
  onClose(): void;
  onShop(): void;
  inRoom: boolean;
  onJoin(roomId: string, observer?: boolean, password?: string): Promise<void>;
}
export default function AccountPanel({ onClose, onShop, inRoom, onJoin }: Props) {
  const me = useStore(account),
    revealing = useStore(rewardPresentationBusy);
  useI18n();
  const [tab, setTab] = useState<Tab>('profile');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [rank, setRank] = useState<PublicProfile[]>([]);
  const locked = busy || revealing;
  const fail = useCallback((e: unknown) => {
    const code = e instanceof Error ? e.message : 'SERVER_ERROR';
    const key = `account.error.${code}` as TranslationKey;
    const message = t(key);
    setError(message === key ? t('account.error.SERVER_ERROR') : message);
  }, []);
  const run = async (fn: () => Promise<void>) => {
    if (locked) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let active = true;
    if (tab === 'rank')
      void api<PublicProfile[]>('/rank')
        .then((r) => {
          if (active) setRank(r);
        })
        .catch((e) => {
          if (active) fail(e);
        });
    return () => {
      active = false;
    };
  }, [tab, fail]);
  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-fir/45 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t('account.title')}
    >
      <section className={`${panel} mx-auto w-full max-w-4xl !p-4 sm:!p-6`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-note text-2xl font-bold">{t('account.title')}</h2>
          <button className={secondary} disabled={locked} onClick={onClose}>
            {t('account.close')}
          </button>
        </div>
        <nav className="my-4 flex flex-wrap gap-2">
          {(['profile', 'rank', ...(me?.admin ? ['admin'] : [])] as Tab[]).map((value) => (
            <button
              key={value}
              disabled={locked}
              className={tab === value ? primary : secondary}
              onClick={() => {
                setTab(value);
                setError('');
              }}
            >
              {t(`account.${value}`)}
            </button>
          ))}
        </nav>
        {error && (
          <p className="mb-3 text-berry" role="alert">
            {error}
          </p>
        )}
        {!me && tab !== 'rank' && (
          <div className="space-y-4">
            <p>{t('account.loginHint')}</p>
            <GoogleSignIn />
          </div>
        )}
        {me && tab === 'profile' && (
          <>
            <div className="mx-auto max-w-xl">
              <ProfileEditor inRoom={inRoom} busy={locked} run={run} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className={primary} disabled={locked} onClick={onShop}>
                💵 {t('shop.title')}
              </button>
              <button
                className={secondary}
                disabled={locked}
                onClick={() => void run(refreshAccount)}
              >
                {t('account.refresh')}
              </button>
              <button
                className={secondary}
                disabled={locked || inRoom}
                onClick={() => void run(signOut)}
              >
                {t('account.logout')}
              </button>
            </div>
          </>
        )}
        {tab === 'rank' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('account.name')}</th>
                  <th>{t('account.points')}</th>
                  <th>{t('account.wins')}</th>
                  <th>{t('account.matches')}</th>
                </tr>
              </thead>
              <tbody>
                {rank.map((p, i) => (
                  <tr key={p.id} className="border-t border-fir/20">
                    <td className="py-3">{i + 1}</td>
                    <td>
                      <ProfileName player={p} />
                    </td>
                    <td>{p.points}</td>
                    <td>{p.wins}</td>
                    <td>{p.matches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rank.length && <p className="mt-4">{t('account.empty')}</p>}
          </div>
        )}
        {me?.admin && tab === 'admin' && (
          <ObserverJoin
            busy={locked}
            inRoom={inRoom}
            run={run}
            onJoin={async (id, observer, password) => {
              await onJoin(id, observer, password);
              onClose();
            }}
          />
        )}
      </section>
    </div>
  );
}
