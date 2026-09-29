import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { primary } from './ui';

export default function LandscapeGate({ active, onBlocked }: { active: boolean; onBlocked(value: boolean): void }) {
  const { t } = useI18n();
  const [portrait, setPortrait] = useState(() => matchMedia('(orientation: portrait) and (pointer: coarse)').matches);
  useEffect(() => {
    const query = matchMedia('(orientation: portrait) and (pointer: coarse)');
    const update = () => setPortrait(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => { onBlocked(active && portrait); }, [active, portrait, onBlocked]);
  if (!active || !portrait) return null;
  const rotate = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      const orientation = screen.orientation as ScreenOrientation & { lock?: (value: string) => Promise<void> };
      await orientation.lock?.('landscape');
    } catch { /* iOS and unsupported browsers keep the manual rotation prompt. */ }
  };
  return <div className="fixed inset-0 z-[100] grid place-content-center gap-4 bg-paper p-8 text-center" role="dialog" aria-modal="true" aria-label={t('account.rotate')}>
    <span className="text-6xl" aria-hidden="true">↪ 📱</span>
    <h2 className="font-note text-3xl font-bold">{t('account.rotate')}</h2>
    <p>{t('account.rotateHint')}</p>
    <button className={primary} onClick={()=>void rotate()}>{t('account.fullscreen')}</button>
  </div>;
}
