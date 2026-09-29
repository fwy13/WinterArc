import { useState } from 'react';
import { maintainers, support } from '../config/maintainers';
import { useI18n } from '../i18n';
import { Modal, eyebrow, secondary } from './ui';
export default function InformationPanel({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n(),
    [showQr, setShowQr] = useState(false);
  return (
    <Modal title={t('about.title')} onClose={onClose}>
      <p className={eyebrow}>{t('about.eyebrow')}</p>
      <p className="my-4 text-sm leading-7 text-ink/80">{t('about.intro')}</p>
      <div className="space-y-3">
        {maintainers.map((person) => (
          <article key={person.handle} className="rounded-sm border border-ink/15 bg-ink/5 p-5">
            <div className="flex items-center gap-4">
              {person.avatarUrl ? (
                <img src={person.avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer"
                  className="size-16 shrink-0 rounded-full border-2 border-fir object-cover"
                  onError={event => { event.currentTarget.hidden = true; }} />
              ) : (
                <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-full border-2 border-fir bg-paper font-note text-2xl font-bold">
                  {person.initials}
                </span>
              )}
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-fir">
                  {t(person.kind === 'ai' ? 'about.ai' : 'about.maintainer')}
                </p>
                <h3 className="font-note text-lg font-bold">{person.name}</h3>
                <p className="text-xs text-ink/65">@{person.handle}</p>
              </div>
            </div>
            <p className="my-4 text-sm text-ink/80">{person.description?.[locale] || t(person.kind === 'ai' ? 'about.aiRole' : 'about.role')}</p>
            <a
              className="text-sm font-semibold text-fir underline underline-offset-4"
              href={person.profile}
              target="_blank"
              rel="noreferrer"
            >
              {t('about.profile')} ↗
            </a>
          </article>
        ))}
      </div>
      {support.enabled && (
        <section className="mt-6 border-t border-ink/15 pt-6">
          <h3 className="font-note font-bold">{t('about.support')}</h3>
          <p className="my-3 text-sm leading-7 text-ink/80">{t('about.supportText')}.</p>
          <button className={secondary} onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
            {showQr ? t('common.close') : t('about.showQr')}
          </button>
          {showQr && (
            <img
              className="mx-auto mt-4 w-full max-w-72 rounded-sm bg-white p-2"
              src={support.qrUrl}
              alt={t('about.qrAlt')}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          )}
        </section>
      )}
      <p className="mt-6 text-sm leading-6 text-ink/65">{t('about.thanks')}</p>
    </Modal>
  );
}
