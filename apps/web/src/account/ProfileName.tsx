import { PROFILE_ROLES, type ProfileRole } from 'winterarc-profile';
import { useI18n } from '../i18n';
import { CLUB } from '../config/club';
import AvatarPhoto from './AvatarPhoto';

export default function ProfileName({
  player,
  showRoles = true,
}: {
  showRoles?: boolean;
  player: {
    school?: string;
    name: string;
    premium?: boolean;
    avatarUrl?: string;
    frameId?: string;
    roles?: readonly string[];
  };
}) {
  const { t } = useI18n();
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2 align-middle text-left">
      <AvatarPhoto player={player} />
      <span className="min-w-0 flex-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span
          className={`block whitespace-normal wrap-anywhere leading-snug ${player.premium ? 'font-bold text-amber-700' : ''}`}
          title={player.name}
        >
          {player.name}
          {player.premium ? ' ★' : ''}
        </span>
        {player.roles?.includes('club') && <img src={CLUB.mark} alt="CLB" title={t('social.role.club')} className="inline-block h-[1.1em] w-[1.1em] shrink-0 self-center rounded-full bg-[#07314c] p-[2px] align-middle" />}
        {showRoles && (
          <span className="flex flex-wrap items-center gap-1">
            {(player.roles || [])
              .filter((r): r is ProfileRole => r !== 'club' && PROFILE_ROLES.includes(r as ProfileRole))
              .map((role) => (
                <small
                  key={role}
                  className={`rounded border px-1 text-[9px] leading-4 ${role === 'student' ? 'border-sky-600/40 text-sky-800' : 'border-amber-600/40 text-amber-800'}`}
                >
                  {t(`social.role.${role}`)}
                </small>
              ))}
          </span>
        )}
      </span>
    </span>
  );
}
