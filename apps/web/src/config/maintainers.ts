import type { Locale } from '../i18n';

export interface Maintainer {
  name: string;
  handle: string;
  profile: string;
  initials: string;
  avatarUrl?: string;
  kind: 'human' | 'ai';
  description?: Record<Locale, string>;
}

/** Add one object per real contributor; no UI changes required. */
export const maintainers: Maintainer[] = [
  {
    name: 'Huỳnh Quý', handle: 'fwy13', profile: 'https://github.com/fwy13',
    initials: 'HQ', kind: 'human',
    avatarUrl: 'https://scontent.fvca1-4.fna.fbcdn.net/v/t39.30808-6/797744786_1940316736665822_8471579512640775555_n.jpg?stp=dst-jpg_tt6&cstp=mx736x739&ctp=s736x739&_nc_cat=108&ccb=1-7&_nc_sid=6ee11a&_nc_eui2=AeGhz7AhwHeQwGcopA3y-q_DxMQkUdU2ZdvExCRR1TZl2_gnSG6idsW9mhVhL2Sl_UGepteaAFIJBOPyBG1HuJJc&_nc_ohc=2UBVr0vR688Q7kNvwEmxSwl&_nc_oc=Adp20-_VsLBQrPmwUdgfncw2TjrCLkhP-f9ZqNQc8oxRmrhh3aC2QOr2TNQER7BFGNs&_nc_zt=23&_nc_ht=scontent.fvca1-4.fna&_nc_gid=9yTneRWp91bsD67BGX7iSg&_nc_ss=7b2a8&oh=00_AQIQm9NLcLbiiN2m896rkPVbM1UNYIGOuOqbCjMQidu4-A&oe=6AB6B56A',
  },
];
/** Existing optional donation destination, preserved from the supplied project. */
export const support = {
  enabled: true,
  qrUrl: 'https://img.vietqr.io/image/970436-9963723143-print.png?accountName=HUYNH+QUY',
};
