import { useEffect, useState } from 'react';
import { AVATAR_FRAMES } from 'winterarc-profile';

interface Props {
  player: { name: string; avatarUrl?: string; frameId?: string };
  size?: number;
}
/** All frame assets use a 100x100 canvas; scale the composite as one unit. */
export default function AvatarPhoto({ player, size = 40 }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [player.avatarUrl]);
  const frame = AVATAR_FRAMES.find((f) => f.id === player.frameId) || AVATAR_FRAMES[0];
  const inset = `${frame.inset}%`;
  return (
    <span
      className="relative inline-block shrink-0 align-middle"
      style={{ width: size, height: size }}
    >
      <span
        className="absolute grid overflow-hidden bg-fir/15 text-fir place-items-center font-bold"
        style={{ inset, borderRadius: frame.rounded ? '50%' : '8%', fontSize: size * 0.35 }}
      >
        {player.avatarUrl && !failed ? (
          <img
            src={player.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          player.name.slice(0, 1).toLocaleUpperCase()
        )}
      </span>
      {frame.src && (
        <img
          src={frame.src}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
      )}
    </span>
  );
}
