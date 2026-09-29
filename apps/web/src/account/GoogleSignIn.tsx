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
  if (window.google) return Promise.resolve();
  return loader ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { loader = undefined; script.remove(); reject(new Error('GOOGLE_LOAD_FAILED')); };
    document.head.appendChild(script);
  });
}
export default function GoogleSignIn() {
  const ref = useRef<HTMLDivElement>(null);
  const config = useStore(accountConfig);
  const { locale, t } = useI18n();
  const [error, setError] = useState(false);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    if (!config?.googleClientId) return;
    setError(false);
    void (async () => {
      await loadGoogle();
      if (!active) return;
      const { nonce } = await api<{ nonce: string }>('/auth/challenge', {});
      if (!active || !ref.current) return;
      window.google!.accounts.id.initialize({
        client_id: config.googleClientId,
        nonce,
        callback: ({ credential }) => {
          if (!active) return;
          void api<{ profile: AccountProfile }>('/auth/google', { credential })
            .then(data => { presentProfile(data.profile); })
            .catch(() => { if (active) setError(true); });
        },
      });
      ref.current.replaceChildren();
      window.google!.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', locale });
    })().catch(() => { if (active) setError(true); });
    return () => { active = false; window.google?.accounts.id.cancel(); };
  }, [config, locale, attempt]);
  if (!config?.googleClientId) return <p role="status">{t('account.googleMissing')}</p>;
  return <div className="space-y-3">
    <div ref={ref} />
    {error && <button className="underline text-berry" onClick={() => retry(n => n + 1)}>{t('account.loginRetry')}</button>}
  </div>;
}
