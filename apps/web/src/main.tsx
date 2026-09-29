import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { t } from './i18n';
import './style.css';

// Admin does not mount the game session. The editor is a separate application.
const Screen = lazy(() => /^\/editor\/?$/.test(location.pathname)
  ? import('./tools/EditorMoved')
  : /^\/admin\/?$/.test(location.pathname)
  ? import('./admin/AdminPage')
  : import('./session/SingleTabGate'));
const root = document.getElementById('app');
document.body.className = 'min-h-dvh font-sans text-ink antialiased';
createRoot(root!).render(<Suspense fallback={<p className="p-8">{t('common.loading')}</p>}><Screen /></Suspense>);
