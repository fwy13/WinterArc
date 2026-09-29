import { useStore, createStore } from '../hooks/useStore';
import { vi, type TranslationKey } from './vi';
import { en } from './en';
export type Locale = 'vi' | 'en';
const dictionaries: Record<Locale, Record<TranslationKey, string>> = { vi, en };
function initialLocale(): Locale {
  try {
    return localStorage.getItem('winterarc-locale') === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}
const localeStore = createStore<Locale>(initialLocale());
document.documentElement.lang = localeStore.get();
export function setLocale(locale: Locale): void {
  localeStore.set(locale);
  document.documentElement.lang = locale;
  try {
    localStorage.setItem('winterarc-locale', locale);
  } catch {
    /* optional */
  }
}
export function t(key: TranslationKey, values: Record<string, string | number> = {}): string {
  return (dictionaries[localeStore.get()][key] ?? vi[key] ?? key).replace(
    /\{(\w+)\}/g,
    (match, name: string) => String(values[name] ?? match),
  );
}
export function translateNotice(message: string): string {
  if (!message.startsWith('@')) return message;
  const key = message.slice(1);
  return key in vi ? t(key as TranslationKey) : t('notice.connectionError');
}
export function useI18n() {
  const locale = useStore(localeStore);
  return { locale, setLocale, t };
}
export type { TranslationKey };
