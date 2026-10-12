import type { SkyQuality } from 'winterarc-core';
export interface GameSettings {
  skyQuality: SkyQuality;
  volume: number;
  effectsVolume: number;
  footstepsVolume: number;
  mouseSensitivity: number;
  touchSensitivity: number;
  fov: number;
  renderScale: number;
  cameraBob: boolean;
  cameraShake: boolean;
  showStats: boolean;
}
export const BASE_SETTINGS: GameSettings = {
  skyQuality: 'auto',
  volume: 0.65, effectsVolume: 1, footstepsVolume: 0.7,
  mouseSensitivity: 7, touchSensitivity: 1, fov: 70, renderScale: 1,
  cameraBob: true, cameraShake: true, showStats: false,
};
/** Shared allowlist: clients cannot persist arbitrary JSON fields. */
export function normalizeGameSettings(value: Partial<GameSettings>): GameSettings {
  const number = (key: keyof GameSettings, min: number, max: number) => {
    const n = value[key];
    return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : BASE_SETTINGS[key] as number;
  };
  const boolean = (key: 'cameraBob' | 'cameraShake' | 'showStats') => typeof value[key] === 'boolean' ? value[key] : BASE_SETTINGS[key];
  return {
    skyQuality: value.skyQuality === 'off' || value.skyQuality === 'low' || value.skyQuality === 'high' ? value.skyQuality : 'auto',
    volume: number('volume', 0, 1), effectsVolume: number('effectsVolume', 0, 1), footstepsVolume: number('footstepsVolume', 0, 1),
    mouseSensitivity: number('mouseSensitivity', 1, 20), touchSensitivity: number('touchSensitivity', 0.25, 3),
    fov: number('fov', 55, 100), renderScale: typeof value.renderScale === 'number' && value.renderScale > 2 ? 1 : number('renderScale', 0.5, 2),
    cameraBob: boolean('cameraBob'), cameraShake: boolean('cameraShake'), showStats: boolean('showStats'),
  };
}
