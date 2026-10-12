import { CLUB } from '../config/club';
import { useI18n } from '../i18n';
import { Modal } from './ui';
import { ClubLogo, ClubSocials } from './ClubBrand';
export default function InformationPanel({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return <Modal title={t('club.credits')} onClose={onClose}>
    <section className="club-credit-card">
      <ClubLogo />
      <p className="club-kicker">{t('club.presented')}</p>
      <h3>{CLUB.name}</h3>
      <p>{t('club.fullName')}</p>
      <div className="club-credit-divider" />
      <h4>Winter Arc</h4>
      <p>{t('club.gameIntro')}</p>
      <p className="club-credit-role">{t('club.role')}</p>
      <ClubSocials />
      <a href="/credits" target="_blank" rel="noopener noreferrer" className="club-email">Donate · Thu chi công khai ↗</a>
      <a className="club-email" href={`mailto:${CLUB.email}`}>{CLUB.email}</a>
    </section>
    <p className="mt-5 text-sm leading-6 text-ink/70">{t('about.thanks')}</p>
  </Modal>;
}
