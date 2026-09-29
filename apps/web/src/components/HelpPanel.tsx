import { GAME_DEFINITIONS } from 'winterarc-gameplay';
import { type GameId } from 'winterarc-core';
import { useI18n } from '../i18n';
import { Modal } from './ui';
export default function HelpPanel({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal title={t('common.help')} onClose={onClose}>
      <p className="mb-4 text-sm leading-7 text-fir">{t('cup.rules')}</p>
      <div className="mb-6 grid grid-cols-2 gap-2 text-xs text-ink/85">
        {(['move', 'jump', 'run', 'look', 'pause'] as const).map((key) => (
          <p key={key} className="rounded-sm bg-ink/5 p-3">
            {t(`help.${key}`)}
          </p>
        ))}
      </div>
      <div className="space-y-6">
        {(Object.keys(GAME_DEFINITIONS) as GameId[]).map((id) => (
          <section key={id}>
            <h3 className="font-note mb-2 font-bold text-fir">{t(`games.${id}.title`)}</h3>
            <p className="text-sm leading-7 text-ink/80">{t(`games.${id}.help`)}</p>
          </section>
        ))}
      </div>
    </Modal>
  );
}
