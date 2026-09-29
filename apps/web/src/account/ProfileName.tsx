import { PROFILE_ROLES, type ProfileRole } from 'winterarc-profile';
import { useI18n } from '../i18n';
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
      <span className="min-w-0 flex-1 flex gap-2">
        <span
          className={`block whitespace-normal wrap-anywhere leading-snug ${player.premium ? 'font-bold text-amber-700' : ''}`}
          title={player.name}
        >
          {player.name}
          {player.premium ? ' ★' : ''}
        </span>
        {showRoles && (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {(player.roles || [])
              .filter((r): r is ProfileRole => PROFILE_ROLES.includes(r as ProfileRole))
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
