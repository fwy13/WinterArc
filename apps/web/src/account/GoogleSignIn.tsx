import { useEffect, useRef, useState } from 'react';
import type { AccountProfile } from 'winterarc-profile';
import { useStore } from '../hooks/useStore';
import { useI18n } from '../i18n';
import { accountConfig, api, presentProfile } from './service';

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize(options: { client_id: string; nonce: string; callback: (result: { credential: string }) => void }): void;
      renderButton(element: HTMLElement, options: { theme: string; size: string; locale: string }): void;
      cancel(): void;
    } } };
  }
}
let loader: Promise<void> | undefined;
function loadGoogle(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  return loader ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timeout = window.setTimeout(() => { loader = undefined; script.remove(); reject(new Error('GOOGLE_LOAD_FAILED')); }, 15000);
    script.onload = () => { clearTimeout(timeout); if (window.google?.accounts?.id) resolve(); else { loader = undefined; reject(new Error('GOOGLE_LOAD_FAILED')); } };
    script.onerror = () => { clearTimeout(timeout); loader = undefined; script.remove(); reject(new Error('GOOGLE_LOAD_FAILED')); };
    document.head.appendChild(script);
  });
}
export default function GoogleSignIn() {
  const ref = useRef<HTMLDivElement>(null);
  const config = useStore(accountConfig);
  const { locale, t } = useI18n();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const clientId = config?.googleClientId;
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    if (!clientId) return;
    setError(false); setReady(false); setBusy(false);
    void (async () => {
      await loadGoogle();
      if (!active) return;
      const { nonce } = await api<{ nonce: string }>('/auth/challenge', {});
      if (!active || !ref.current) return;
      window.google!.accounts.id.initialize({
        client_id: clientId,
        nonce,
        callback: ({ credential }) => {
          if (!active) return;
          setBusy(true);
          void api<{ profile: AccountProfile }>('/auth/google', { credential })
            .then(() => api<{ profile: AccountProfile }>('/me'))
            .then(data => { if (active) presentProfile(data.profile); })
            .catch(() => { if (active) setError(true); })
            .finally(() => { if (active) setBusy(false); });
        },
      });
      ref.current.replaceChildren();
      window.google!.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', locale });
      setReady(true);
    })().catch(() => { if (active) setError(true); })
            .finally(() => { if (active) setBusy(false); });
    return () => { active = false; window.google?.accounts.id.cancel(); };
  }, [clientId, locale, attempt]);
  if (!config?.googleClientId) return <p role="status">{t('account.googleMissing')}</p>;
  return <div className="space-y-3">
    {(!ready || busy) && !error && <p role="status">{t('common.loading')}</p>}
    <div ref={ref} className={busy ? 'pointer-events-none opacity-50' : ''} />
    {error && <p role="alert" className="text-sm text-berry">{locale === 'vi' ? 'Chưa đăng nhập được. Thử lại; nếu lặp lại, kiểm tra cookie của trình duyệt.' : 'Sign-in failed. Retry; if this persists, check browser cookies.'}</p>}
    {error && <button className="underline text-berry" onClick={() => retry(n => n + 1)}>{t('account.loginRetry')}</button>}
  </div>;
}
