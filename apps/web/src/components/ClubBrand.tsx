import { CLUB } from '../config/club';
import { useI18n } from '../i18n';
export function ClubLogo() {
  return <div className="club-logo-plate"><picture><source media="(max-width: 480px)" srcSet={CLUB.mark} /><img src={CLUB.logo} width={578} height={131} alt={CLUB.name} /></picture></div>;
}
export function ClubSocials() {
  const { t } = useI18n();
  return <nav className="club-socials" aria-label={t('club.socials')}>
    <a href={CLUB.facebook} target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 22v-9h3l.5-4H14V7c0-1 .3-2 2-2h2V1.5A20 20 0 0 0 15 1c-3 0-5 2-5 5v3H7v4h3v9z" /></svg>Facebook<span aria-hidden="true">↗</span></a>
    <a href={CLUB.github} target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1a11 11 0 0 0-3.5 21.4c.5.1.7-.2.7-.5v-2c-3 .6-3.6-1.3-3.6-1.3-.5-1.3-1.3-1.6-1.3-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.6 2.5 1.2 3.1.9.1-.7.4-1.2.7-1.5-2.4-.3-5-1.2-5-5.4 0-1.2.4-2.2 1.1-3-.1-.3-.5-1.4.1-3 0 0 .9-.3 3.1 1.1a10.8 10.8 0 0 1 5.6 0C17 5.1 18 5.4 18 5.4c.6 1.6.2 2.7.1 3 .7.8 1.1 1.8 1.1 3 0 4.2-2.6 5.1-5 5.4.4.3.7 1 .7 2v3.1c0 .3.2.6.7.5A11 11 0 0 0 12 1z" /></svg>GitHub<span aria-hidden="true">↗</span></a>
  </nav>;
}
