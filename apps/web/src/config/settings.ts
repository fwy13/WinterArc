import { BASE_SETTINGS, normalizeGameSettings, type GameSettings } from 'winterarc-profile';
import { createStore } from '../hooks/useStore';
export type { GameSettings } from 'winterarc-profile';
export const DEFAULT_SETTINGS: GameSettings = {
  ...BASE_SETTINGS,
  cameraBob: !matchMedia('(prefers-reduced-motion: reduce)').matches,
  cameraShake: !matchMedia('(prefers-reduced-motion: reduce)').matches,
};
function load(): GameSettings {
  try {
    const saved = JSON.parse(localStorage.getItem('winterarc-settings-v1') || '{}');
    return normalizeGameSettings({ ...DEFAULT_SETTINGS, ...saved });
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export const settings = createStore<GameSettings>(load());
export function updateSettings(change: Partial<GameSettings>): void {
  const next = normalizeGameSettings({ ...settings.get(), ...change });
  settings.set(next);
  try {
    localStorage.setItem('winterarc-settings-v1', JSON.stringify(next));
    localStorage.setItem('winterarc-volume', String(next.volume));
  } catch { /* Device cache is optional; authenticated users also save to server. */ }
}
