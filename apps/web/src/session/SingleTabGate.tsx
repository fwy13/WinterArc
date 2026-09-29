import { lazy, Suspense, useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { primary } from '../components/ui';

const GameGate = lazy(() => import('../account/GameGate'));

/** Acquire before mounting auth, network or engine. Never steal a live tab's lock. */
export default function SingleTabGate() {
  const { t } = useI18n();
  const [state, setState] = useState<'checking' | 'owner' | 'blocked' | 'unsupported'>('checking');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let release: (() => void) | undefined;
    setState('checking');
    if (!navigator.locks) {
      setState('unsupported');
      return;
    }
    void navigator.locks.request('winterarc:game-tab', { ifAvailable: true }, async lock => {
      if (!active) return;
      if (!lock) {
        setState('blocked');
        return;
      }
      await new Promise<void>(resolve => {
        release = resolve;
        setState('owner');
      });
    }).catch(() => { if (active) setState('unsupported'); });
    return () => { active = false; release?.(); };
  }, [attempt]);

  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) location.reload();
    };
    window.addEventListener('pageshow', restored);
    return () => window.removeEventListener('pageshow', restored);
  }, []);

  if (state === 'owner') return (
    <Suspense fallback={<p className="p-8">{t('common.loading')}</p>}>
      <GameGate />
    </Suspense>
  );
  return (
    <main className="grid min-h-dvh place-items-center bg-paper p-5">
      <section className="paper-sheet w-full max-w-md space-y-4 p-6" role="status">
        <h1 className="font-note text-3xl font-bold">{t('session.singleTitle')}</h1>
        <p className="text-sm leading-7 text-ink/75">
          {t(state === 'checking' ? 'common.loading' : state === 'blocked' ? 'session.singleHint' : 'session.unsupported')}
        </p>
        {state !== 'checking' && <button className={primary} onClick={() => setAttempt(n => n + 1)}>{t('common.retry')}</button>}
      </section>
    </main>
  );
}
