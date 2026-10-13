import FundPanel from '../fund/FundPanel';
import './admin.css';
import AdminGameControls from './AdminGameControls';
import { useCallback, useEffect, useState } from 'react';
import type { AdminPlayer, ProfileRole } from 'winterarc-profile';
import { api, ApiError } from '../account/service';
import ProfileName from '../account/ProfileName';
import { useI18n, type TranslationKey } from '../i18n';
import { field, primary, secondary, panel } from '../components/ui';

type Session = { username: string; expires: number };
type Directory = { users: AdminPlayer[]; total: number };
export default function AdminPage() {
  const { t, locale, setLocale } = useI18n();
  const [tab, setTab] = useState<'players' | 'games' | 'fund'>('players');
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true),
    [busy, setBusy] = useState(false);
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState('');
  const [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  const [query, setQuery] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(0);
  const [data, setData] = useState<Directory>({ users: [], total: 0 });
  const [selected, setSelected] = useState<AdminPlayer | null>(null);
  const [premium, setPremium] = useState(false),
    [student, setStudent] = useState(false);
  const [sponsor, setSponsor] = useState<'' | ProfileRole>('');
  const [tokens, setTokens] = useState(0),
    [bonusSpins, setBonusSpins] = useState(0),
    [reason, setReason] = useState('');
  const [refresh, setRefresh] = useState(0);
  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        setSession(null);
        setSelected(null);
        setData({ users: [], total: 0 });
      }
      const key =
        `account.error.${e instanceof Error ? e.message : 'SERVER_ERROR'}` as TranslationKey;
      setError(t(key) === key ? t('account.error.SERVER_ERROR') : t(key));
    },
    [t],
  );
  useEffect(() => {
    let active = true;
    void api<Session>('/admin/me')
      .then((value) => {
        if (active) setSession(value);
      })
      .catch((e) => {
        if (active && !(e instanceof ApiError && e.status === 401)) fail(e);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [fail]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    void api<Directory>(`/admin/users?q=${encodeURIComponent(search)}&page=${page}`)
      .then((value) => {
        if (active) {
          setData(value);
        }
      })
      .catch((e) => {
        if (active) fail(e);
      });
    return () => {
      active = false;
    };
  }, [session, search, page, refresh, fail]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await action();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const choose = (user: AdminPlayer) => {
    setTokens(user.tokens);
    setBonusSpins(user.bonusSpins);
    setReason('');
    setSelected(user);
    setPremium(user.premium);
    setStudent(user.roles.includes('student'));
    setSponsor(user.roles.find((role) => role.startsWith('sponsor_')) || '');
    setSaved(false);
    setError('');
  };
  return (
    <main className="admin-app min-h-dvh bg-paper px-3 py-6 text-ink sm:p-8">
      <header className="mx-auto mb-6 flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <h1 className="font-note text-3xl font-bold">{t('admin.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <select
            className={field}
            aria-label={t('common.language')}
            value={locale}
            onChange={(e) => setLocale(e.target.value as 'vi' | 'en')}
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
          <a href="/" className={secondary}>
            {t('admin.back')}
          </a>
          {session && (
            <button
              className={secondary}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api('/admin/logout', {});
                  setSession(null);
                  setSelected(null);
                  setData({ users: [], total: 0 });
                })
              }
            >
              {t('account.logout')}
            </button>
          )}
        </div>
      </header>
      {error && (
        <p role="alert" className="mx-auto mb-4 max-w-6xl text-berry">
          {error}
        </p>
      )}
      {checking ? (
        <p>{t('common.loading')}</p>
      ) : !session ? (
        <form
          className={`${panel} mx-auto max-w-md space-y-4`}
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              try {
                setSession(await api<Session>('/admin/login', { username, password }));
              } finally {
                setPassword('');
              }
            });
          }}
        >
          <p>{t('admin.loginHint')}</p>
          <label className="block">
            {t('admin.username')}
            <input
              autoComplete="username"
              className={field}
              value={username}
              required
              maxLength={100}
              disabled={busy}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className="block">
            {t('admin.password')}
            <input
              type="password"
              autoComplete="current-password"
              className={field}
              value={password}
              required
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className={`${primary} w-full`} disabled={busy}>
            {t('account.login')}
          </button>
        </form>
      ) : (
        <>
          <nav className="admin-tabs">
            {(
              [
                ['players', 'Người chơi'],
                ['games', 'Minigame & CLB'],
                ['fund', 'Donate & Thu chi'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
            <a href="/credits" target="_blank" rel="noopener noreferrer">
              Trang công khai ↗
            </a>
          </nav>
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-[1fr_1fr]">
            <section hidden={tab !== 'players'} className={`${panel} min-w-0 !p-4`}>
              <p className="mb-3 text-sm">{t('admin.signedIn', { name: session.username })}</p>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearch(query.trim());
                  setPage(0);
                  setRefresh((n) => n + 1);
                }}
              >
                <input
                  className={`${field} min-w-0`}
                  value={query}
                  maxLength={80}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('admin.search')}
                  aria-label={t('admin.search')}
                />
                <button className={secondary}>{t('admin.find')}</button>
              </form>
              <ul className="mt-4 max-h-[55dvh] space-y-2 overflow-y-auto">
                {data.users.map((user) => (
                  <li key={user.id}>
                    <button
                      disabled={busy}
                      className={`w-full rounded border p-3 text-left ${selected?.id === user.id ? 'border-fir bg-fir/10' : 'border-fir/20'}`}
                      onClick={() => choose(user)}
                    >
                      <ProfileName player={user} />
                      <span className="mt-1 block break-all font-mono text-[10px] text-ink/60">
                        {user.id}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {!data.users.length && <p className="my-4">{t('account.empty')}</p>}
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  className={secondary}
                  disabled={busy || page === 0}
                  onClick={() => setPage((n) => n - 1)}
                >
                  ←
                </button>
                <span>
                  {page + 1} / {Math.max(1, Math.ceil(data.total / 25))}
                </span>
                <button
                  className={secondary}
                  disabled={busy || (page + 1) * 25 >= data.total}
                  onClick={() => setPage((n) => n + 1)}
                >
                  →
                </button>
              </div>
            </section>
            <section hidden={tab !== 'players'} className={`${panel} min-w-0 !p-4`}>
              {!selected ? (
                <p>{t('admin.choose')}</p>
              ) : (
                <fieldset disabled={busy} className="space-y-4">
                  <ProfileName player={selected} />
                  <p className="break-all font-mono text-xs">{selected.email || selected.id}</p>
                  <form
                    className="space-y-3 rounded-lg border border-fir/20 p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        const result = await api<{ user: AdminPlayer }>('/admin/economy', {
                          userId: selected.id,
                          tokens,
                          bonusSpins,
                          revision: selected.revision,
                          reason,
                        });
                        choose(result.user);
                        setRefresh((n) => n + 1);
                        setSaved(true);
                      });
                    }}
                  >
                    <h2 className="font-bold">
                      {locale === 'vi' ? 'Thông số người chơi' : 'Player economy'}
                    </h2>
                    <label className="block">
                      Token
                      <input
                        className={field}
                        type="number"
                        min="0"
                        max="1000000000"
                        step="1"
                        required
                        value={tokens}
                        onChange={(e) => setTokens(e.target.valueAsNumber)}
                      />
                    </label>
                    <label className="block">
                      {locale === 'vi' ? 'Lượt quay thưởng' : 'Bonus spins'}
                      <input
                        className={field}
                        type="number"
                        min="0"
                        max="10000"
                        step="1"
                        required
                        value={bonusSpins}
                        onChange={(e) => setBonusSpins(e.target.valueAsNumber)}
                      />
                    </label>
                    <label className="block">
                      {locale === 'vi' ? 'Lý do chỉnh sửa' : 'Adjustment reason'}
                      <input
                        className={field}
                        required
                        minLength={3}
                        maxLength={160}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button className={primary}>
                        {locale === 'vi' ? 'Lưu thông số' : 'Save economy'}
                      </button>
                      <button
                        type="button"
                        className={secondary}
                        onClick={() =>
                          void run(async () => {
                            const fresh = await api<Directory>(
                              `/admin/users?q=${encodeURIComponent(selected.id)}&page=0`,
                            );
                            const user = fresh.users.find((u) => u.id === selected.id);
                            if (user) choose(user);
                            setRefresh((n) => n + 1);
                          })
                        }
                      >
                        {locale === 'vi' ? 'Tải lại số dư' : 'Reload balance'}
                      </button>
                    </div>
                  </form>
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={premium}
                      onChange={(e) => setPremium(e.target.checked)}
                    />
                    Premium
                  </label>
                  <button
                    className={primary}
                    onClick={() =>
                      void run(async () => {
                        await api('/admin/premium', { userId: selected.id, enabled: premium });
                        setSelected(null);
                        setRefresh((n) => n + 1);
                        setSaved(true);
                      })
                    }
                  >
                    {t('social.savePremium')}
                  </button>
                  <hr className="border-fir/20" />
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={student}
                      onChange={(e) => setStudent(e.target.checked)}
                    />
                    {t('social.role.student')}
                  </label>
                  <label className="block">
                    {t('social.sponsorTier')}
                    <select
                      className={field}
                      value={sponsor}
                      onChange={(e) => setSponsor(e.target.value as '' | ProfileRole)}
                    >
                      <option value="">{t('social.noSponsor')}</option>
                      {(['sponsor_bronze', 'sponsor_silver', 'sponsor_gold'] as const).map(
                        (role) => (
                          <option key={role} value={role}>
                            {t(`social.role.${role}`)}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <p className="text-xs">{t('social.rolesHint')}</p>
                  <button
                    className={primary}
                    onClick={() =>
                      void run(async () => {
                        const roles: ProfileRole[] = [
                          ...(student ? ['student' as const] : []),
                          ...(sponsor ? [sponsor] : []),
                        ];
                        await api('/admin/roles', { userId: selected.id, roles });
                        setSelected(null);
                        setRefresh((n) => n + 1);
                        setSaved(true);
                      })
                    }
                  >
                    {t('social.saveRoles')}
                  </button>
                  {saved && (
                    <p role="status" className="text-fir">
                      {t('admin.saved')}
                    </p>
                  )}
                  <p className="text-xs text-ink/60">{t('admin.schoolHint')}</p>
                </fieldset>
              )}
            </section>
            {tab === 'games' && <AdminGameControls onError={fail} />}
            {tab === 'fund' && (
              <div className="md:col-span-2">
                <FundPanel admin onError={fail} />
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
