import { useState } from 'react';
import { useI18n } from '../i18n';

// Official CTU branding asset. Replace with /schools/ctu.png if self-hosting it.
const CTU_LOGO = 'https://inkythuatso.com/uploads/images/2021/11/logo-ctu-inkythuatso-01-09-14-23-02.jpg';
export default function SchoolBadge() {
  const [failed, setFailed] = useState(false);
  const { t } = useI18n();
  return <span className="ml-1 inline-flex shrink-0 items-center rounded bg-white p-0.5 align-middle" title={t('school.ctu')}>
    {failed ? <span className="text-[9px] font-bold text-blue-800" aria-label={t('school.ctu')}>CTU</span> :
      <img src={CTU_LOGO} width={24} height={24} className="size-6 object-contain" loading="lazy" decoding="async" referrerPolicy="no-referrer" alt={t('school.ctu')} onError={() => setFailed(true)} />}
  </span>;
}
