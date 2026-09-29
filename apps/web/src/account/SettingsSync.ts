import { account, api, ApiError } from './service';
import { createStore } from '../hooks/useStore';
import { DEFAULT_SETTINGS, settings, updateSettings, type GameSettings } from '../config/settings';

type Status = 'local' | 'loading' | 'saving' | 'saved' | 'error' | 'conflict';
type Response = { settings: GameSettings | null; revision: number };
export const settingsSyncStatus = createStore<Status>('local');
let retry = () => {};
export const retrySettingsSync = () => retry();

/** One controller per game app. Serial writes + revision checks across tabs/devices. */
export function startSettingsSync(): () => void {
  let userId = '', generation = 0, revision = 0, applying = false;
  let ready = false, saving = false, dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cacheKey = (id: string) => `winterarc-settings-user:${id}`;
  const apply = (value: GameSettings) => {
    applying = true;
    updateSettings(value);
    applying = false;
  };
  const save = async () => {
    if (!userId || !ready || saving || !dirty) return;
    const id = userId, version = generation;
    const value = { ...settings.get() };
    saving = true; dirty = false; settingsSyncStatus.set('saving');
    try {
      const data = await api<Response>('/settings', { accountId: id, settings: value, revision });
      if (generation !== version || userId !== id) return;
      revision = data.revision;
      settingsSyncStatus.set(dirty ? 'saving' : 'saved');
    } catch (error) {
      if (generation !== version) return;
      dirty = true; ready = false;
      settingsSyncStatus.set(error instanceof ApiError && error.message === 'SETTINGS_CONFLICT' ? 'conflict' : 'error');
    } finally {
      if (generation === version) {
        saving = false;
        if (ready && dirty) void save();
      }
    }
  };
  const load = async (keepLocal = false) => {
    const id = userId, version = generation;
    if (!id) return;
    ready = false;
    settingsSyncStatus.set('loading');
    try {
      const data = await api<Response>('/settings');
      if (version !== generation || account.get()?.id !== id) return;
      revision = data.revision;
      if (!keepLocal && !dirty && data.settings) apply(data.settings);
      ready = true;
      dirty = dirty || keepLocal || !data.settings;
      try { localStorage.setItem(cacheKey(id), JSON.stringify(settings.get())); } catch { /* Optional. */ }
      settingsSyncStatus.set(dirty ? 'saving' : 'saved');
      if (dirty) void save();
    } catch {
      if (version === generation) settingsSyncStatus.set('error');
    }
  };
  retry = () => { void load(dirty); };
  const onAccount = () => {
    const id = account.get()?.id || '';
    if (id === userId) return;
    userId = id; generation++;
    clearTimeout(timer); ready = false; saving = false; dirty = false;
    if (!id) { apply({ ...DEFAULT_SETTINGS }); settingsSyncStatus.set('local'); return; }
    let cached = { ...DEFAULT_SETTINGS };
    try { cached = JSON.parse(localStorage.getItem(cacheKey(id)) || 'null') || cached; } catch { /* Optional. */ }
    apply(cached);
    void load();
  };
  const unsubscribeAccount = account.subscribe(onAccount);
  const unsubscribeSettings = settings.subscribe(() => {
    if (applying || !userId) return;
    dirty = true;
    try { localStorage.setItem(cacheKey(userId), JSON.stringify(settings.get())); } catch { /* Optional. */ }
    if (!ready) return;
    settingsSyncStatus.set('saving');
    clearTimeout(timer);
    timer = setTimeout(() => void save(), 600);
  });
  const flush = () => { if (document.visibilityState === 'hidden') { clearTimeout(timer); void save(); } };
  document.addEventListener('visibilitychange', flush);
  onAccount();
  return () => {
    generation++; clearTimeout(timer); retry = () => {};
    unsubscribeAccount(); unsubscribeSettings();
    document.removeEventListener('visibilitychange', flush);
  };
}
