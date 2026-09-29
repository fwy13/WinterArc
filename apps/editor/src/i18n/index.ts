import { createStore, useStore } from '../hooks/useStore';
export type Locale = 'vi' | 'en';
function load(): Locale {
  try { return localStorage.getItem('winterarc-editor-locale') === 'en' ? 'en' : 'vi'; }
  catch { return 'vi'; }
}
const localeStore = createStore<Locale>(load());
document.documentElement.lang = localeStore.get();
function setLocale(locale: Locale): void {
  localeStore.set(locale);
  document.documentElement.lang = locale;
  try { localStorage.setItem('winterarc-editor-locale', locale); } catch { /* Optional cache. */ }
}
export function useI18n() { return { locale: useStore(localeStore), setLocale }; }
