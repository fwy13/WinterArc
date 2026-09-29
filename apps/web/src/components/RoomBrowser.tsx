import { useEffect, useState } from 'react';
import type { PublicRoom } from 'winterarc-protocol';
import { useI18n } from '../i18n';
import { panel, secondary } from './ui';

interface Props {
  listRooms(signal?: AbortSignal): Promise<PublicRoom[]>;
  onJoin(roomId: string): void;
  disabled: boolean;
}

export default function RoomBrowser({ listRooms, onJoin, disabled }: Props) {
  const { t } = useI18n();
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      if (document.hidden) {
        timer = setTimeout(() => void refresh(), 5000);
        return;
      }
      setLoading(true);
      try {
        const result = await listRooms(abort.signal);
        if (abort.signal.aborted) return;
        setRooms(result);
        setFailed(false);
      } catch {
        if (!abort.signal.aborted) setFailed(true);
      } finally {
        if (!abort.signal.aborted) {
          setLoading(false);
          // Schedule after completion so slow requests never overlap.
          timer = setTimeout(() => void refresh(), 5000);
        }
      }
    };
    void refresh();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [listRooms, revision]);

  return (
    <section className={`${panel} space-y-4`} aria-busy={loading}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-note text-xl font-bold">{t('rooms.title')}</h2>
        <button
          type="button"
          className={secondary}
          disabled={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          {t('rooms.refresh')}
        </button>
      </div>
      <p className="text-xs text-ink/65">{t('rooms.autoRefresh')}</p>
      {failed && (
        <p role="alert" className="text-sm text-berry">
          {t('rooms.error')}
        </p>
      )}
      {loading && !rooms.length && <p className="text-sm">{t('rooms.loading')}</p>}
      {!loading && !failed && !rooms.length && (
        <p className="text-sm text-ink/80">{t('rooms.empty')}</p>
      )}
      <ul className="max-h-96 space-y-3 overflow-auto">
        {rooms.map((room) => {
          const full = room.clients >= room.maxClients;
          const running = room.phase !== 'lobby' && room.phase !== 'finished';
          const joinable = !room.locked && !full && !running;
          return (
            <li
              key={room.roomId}
              className="flex items-center justify-between gap-3 border-b border-dashed border-ink/30 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-sm text-fir">{room.roomId}</p>
                <p className="mt-1 text-xs text-ink/80">
                  {room.clients}/{room.maxClients} · {room.modeSelection === 'random' && !running ? t('room.random') : t(`games.${room.mode}.title`)} ·{' '}
                  {t(`format.${room.format}`)}
                </p>
                <p className="mt-1 text-xs text-ink/65">
                  {running
                    ? t('rooms.running')
                    : full
                      ? t('rooms.full')
                      : room.locked
                        ? t('rooms.locked')
                        : t('rooms.waiting')}
                </p>
              </div>
              <button
                type="button"
                className={secondary}
                disabled={disabled || failed || !joinable}
                onClick={() => onJoin(room.roomId)}
              >
                {t('menu.join')}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
