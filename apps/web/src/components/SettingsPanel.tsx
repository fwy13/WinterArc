import { settingsSyncStatus, retrySettingsSync } from '../account/SettingsSync';
import { DEFAULT_SETTINGS, settings, updateSettings, type GameSettings } from '../config/settings';
import { useStore } from '../hooks/useStore';
import { useI18n, type Locale, type TranslationKey } from '../i18n';
import { Modal, secondary, primary } from './ui';

const sliders: { key: keyof GameSettings; min: number; max: number; step: number }[] = [
  { key: 'volume', min: 0, max: 1, step: 0.05 },
  { key: 'effectsVolume', min: 0, max: 1, step: 0.05 },
  { key: 'footstepsVolume', min: 0, max: 1, step: 0.05 },
  { key: 'mouseSensitivity', min: 1, max: 20, step: 0.5 },
  { key: 'touchSensitivity', min: 0.25, max: 3, step: 0.05 },
  { key: 'fov', min: 55, max: 100, step: 1 },
  { key: 'renderScale', min: 0.5, max: 2, step: 0.05 },
];
export default function SettingsPanel({
  onClose,
  onPreview,
  onHelp,
  onCredits,
  inMatch = false,
}: {
  onClose(): void;
  onPreview(): void;
  onHelp(): void;
  onCredits(): void;
  inMatch?: boolean;
}) {
  const value = useStore(settings);
  const sync = useStore(settingsSyncStatus);
  const { t, locale, setLocale } = useI18n();
  return (
    <Modal title={t('settings.title')} onClose={onClose}>
      <div className="mb-5 space-y-4 border-b border-ink/20 pb-5">
        <label className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>{t('common.language')}</span>
          <select
            value={locale}
            onChange={event => setLocale(event.target.value as Locale)}
            className="min-h-11 rounded-sm border border-ink/50 bg-paper-light px-3 py-2 text-ink outline-none focus:border-fir focus:ring-2 focus:ring-fir/20"
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <button className={secondary} onClick={onHelp}>
            <span aria-hidden="true">?</span> {t('common.help')}
          </button>
          <button className={secondary} onClick={onCredits}>
            <span aria-hidden="true">♡</span> {t('common.about')}
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs" role="status">{t(`settings.sync.${sync}`)}</p>
      {(sync === 'error' || sync === 'conflict') && <button className={secondary} onClick={retrySettingsSync}>{t('settings.sync.retry')}</button>}
      <fieldset disabled={sync === 'loading'} className="space-y-4">
        <label className="block text-sm">
          {t('settings.skyQuality')}
          <select
            className="mt-2 w-full rounded-sm border border-ink/50 bg-paper-light p-3"
            value={value.skyQuality}
            onChange={event => updateSettings({ skyQuality: event.target.value as GameSettings['skyQuality'] })}
          >
            {(['auto', 'off', 'low', 'high'] as const).map(quality => (
              <option key={quality} value={quality}>{t(`settings.sky.${quality}`)}</option>
            ))}
          </select>
        </label>
        {sliders.map(({ key, min, max, step }) => (
          <label key={key} className="block text-sm">
            <span className="flex justify-between gap-3">{key === 'renderScale' ? (locale === 'vi' ? 'Độ nét (100% = gốc)' : 'Resolution (100% = native)') : t(`settings.${key}` as TranslationKey)}<output className="font-mono">{key === 'renderScale' ? `${Math.round(value.renderScale * 100)}%` : (value[key] as number).toFixed(key === 'fov' ? 0 : 2)}</output></span>
            <input className="mt-2 w-full accent-fir" type="range" min={min} max={max} step={step} value={value[key] as number} onChange={event => updateSettings({ [key]: Number(event.target.value) })} />
          </label>
        ))}
        {(['cameraBob', 'cameraShake', 'showStats'] as const).filter(key => !inMatch || key !== 'showStats').map(key => (
          <label key={key} className="flex items-center justify-between gap-3 text-sm">{t(`settings.${key}`)}<input type="checkbox" className="size-5 accent-fir" checked={value[key]} onChange={event => updateSettings({ [key]: event.target.checked })} /></label>
        ))}
      </fieldset>
      <div className="mt-6 flex flex-wrap gap-2">
        <button className={secondary} onClick={onPreview}>{t('common.soundTest')}</button>
        <button className={secondary} disabled={sync === 'loading'} onClick={() => updateSettings(DEFAULT_SETTINGS)}>{t('settings.reset')}</button>
        <button className={primary} onClick={onClose}>{t('common.close')}</button>
      </div>
    </Modal>
  );
}
