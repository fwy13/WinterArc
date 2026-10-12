import { useEffect, useRef, type PointerEvent } from 'react';
import nipplejs from 'nipplejs';
import type { GameId } from 'winterarc-core';
import { clearTouchInput, touchInput } from '../engine/TouchInput';
import { useI18n } from '../i18n';

interface Props {
  mode: GameId;
  candidate: boolean;
  duelHunter?: boolean;
}

function HoldButton({ label, action }: { label: string; action: 'jump' | 'attack' }) {
  const pointer = useRef<number | null>(null);
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== pointer.current) return;
    pointer.current = null;
    touchInput[action] = false;
  };
  useEffect(
    () => () => {
      touchInput[action] = false;
    },
    [action],
  );
  return (
    <button
      type="button"
      aria-label={label}
      className={`hud-touch-button ${action === 'jump' ? 'hud-touch-button--jump' : ''}`}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (pointer.current !== null) return;
        event.preventDefault();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        touchInput[action] = true;
        if (action === 'jump') touchInput.jumpQueued = true;
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {label}
    </button>
  );
}

export default function MobileControls({ mode, candidate, duelHunter = false }: Props) {
  const { t } = useI18n();
  const zone = useRef<HTMLDivElement>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!zone.current) return;
    clearTouchInput();
    const joystick = nipplejs.create({
      zone: zone.current,
      mode: 'dynamic',
      multitouch: false,
      size: 96,
      color: '#fff8e8',
      restOpacity: 0.3,
      dynamicPage: true,
    });
    joystick.on('move', (_event, data) => {
      // nipplejs vector.y is positive when pushing up. Preserve analog strength.
      const length = Math.hypot(data.vector.x, data.vector.y);
      const strength = Math.max(0, Math.min(1, (length - 0.12) / 0.88));
      touchInput.side = length ? (data.vector.x / length) * strength : 0;
      touchInput.forward = length ? (data.vector.y / length) * strength : 0;
    });
    joystick.on('end', () => {
      touchInput.forward = 0;
      touchInput.side = 0;
    });
    const reset = () => {
      look.current = null;
      clearTouchInput();
    };
    const visibility = () => {
      if (document.hidden) reset();
    };
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      joystick.destroy();
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', visibility);
      reset();
    };
  }, [mode, duelHunter]);
  const endLook = (event: PointerEvent<HTMLDivElement>) => {
    if (look.current?.id === event.pointerId) look.current = null;
  };
  return (
    <div className="mobile-controls pointer-events-none fixed inset-0 select-none">
      <div
        className="pointer-events-auto absolute bottom-0 right-0 top-[calc(max(0.5rem,env(safe-area-inset-top))+3rem)] w-1/2 touch-none"
        style={mode === 'wallduel' && !duelHunter ? { display: 'none' } : undefined}
        aria-label={t('mobile.look')}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (look.current) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          look.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          const previous = look.current;
          if (!previous || previous.id !== event.pointerId) return;
          touchInput.lookX += event.clientX - previous.x;
          touchInput.lookY += event.clientY - previous.y;
          previous.x = event.clientX;
          previous.y = event.clientY;
        }}
        onPointerUp={endLook}
        onPointerCancel={endLook}
        onLostPointerCapture={endLook}
      />
      <div
        ref={zone}
        style={mode === 'knockout' || (mode === 'wallduel' && duelHunter) ? { display: 'none' } : undefined}
        aria-label={t('mobile.move')}
        className="pointer-events-auto absolute left-0 bottom-0 top-[calc(max(0.5rem,env(safe-area-inset-top))+3rem)] w-1/2 touch-none"
      />
      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] flex items-end gap-2">
        {(mode === 'crab' || mode === 'icebreak') && (
          <HoldButton action="attack" label={t('mobile.attack')} />
        )}
        {(mode === 'hunt' || mode === 'giftrace') && (
          <button
            type="button"
            disabled={!candidate}
            className={`hud-touch-button ${candidate ? 'hud-touch-button--ready' : ''}`}
            onPointerDown={(event) => {
              event.preventDefault();
              touchInput.interact = true;
            }}
          >
            {t('mobile.interact')}
          </button>
        )}
        {mode !== 'knockout' && mode !== 'wallduel' && <HoldButton action="jump" label={t('mobile.jump')} />}
      </div>
    </div>
  );
}
