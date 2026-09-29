import { lazy, Suspense, useEffect, useState } from 'react';
import { account, accountLoading, loadAccount } from './service';
import GoogleSignIn from './GoogleSignIn';
import { useStore } from '../hooks/useStore';
import { useI18n } from '../i18n';
import { secondary } from '../components/ui';

const Game = lazy(() => import('../App'));
export default function GameGate() {
  const me = useStore(account), loading = useStore(accountLoading);
  const { t, locale, setLocale } = useI18n();
  const [error, setError] = useState(false), [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false); accountLoading.set(true);
    void loadAccount().catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);
  if (me) return <Suspense fallback={<p className="grid min-h-dvh place-items-center bg-paper">{t('common.loading')}</p>}><Game /></Suspense>;
  return <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#153e35] px-4 py-10">
    <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#fff 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
    <section className="relative w-full max-w-md rotate-[-1deg] rounded-sm border-2 border-[#e8d9b9] bg-paper p-6 shadow-[9px_10px_0_#0c2c25] sm:p-9">
      <div className="mb-5 flex items-center justify-between"><span className="text-4xl">❄</span>
        <select className="rounded border border-fir/20 bg-transparent px-2 py-1 text-sm" aria-label={t('common.language')} value={locale} onChange={e => setLocale(e.target.value as 'vi' | 'en')}><option value="vi">Tiếng Việt</option><option value="en">English</option></select>
      </div>
      <p className="text-xs uppercase tracking-[.25em] text-fir">Winter Arc</p>
      <h1 className="my-3 font-note text-4xl font-bold text-ink">{t('shop.loginTitle')}</h1>
      <p className="mb-7 text-sm leading-6 text-ink/70">{t('shop.loginHint')}</p>
      {loading ? <p role="status">{t('common.loading')}</p> : error ? <div className="space-y-3"><p role="alert">{t('account.error.SERVER_ERROR')}</p><button className={secondary} onClick={() => retry(n => n + 1)}>{t('common.retry')}</button></div> : <GoogleSignIn />}
      <p className="mt-7 border-t border-dashed border-fir/25 pt-4 text-xs text-ink/60">{t('shop.loginFoot')}</p>
    </section>
  </main>;
}
