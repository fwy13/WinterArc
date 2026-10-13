import { useEffect, useRef, useState } from 'react';
import type { Snapshot } from 'winterarc-protocol';
import { CODE_HUNT, codeEpoch } from 'winterarc-gameplay';
import { useI18n } from '../i18n';
export default function CodeHuntHud({ state, touch, onGuess }: {
  state: Snapshot; touch: boolean; onGuess?: (code: string) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [readyAt, setReadyAt] = useState(0);
  const epoch = codeEpoch(state.elapsed);
  const hidden = epoch < 0;
  const remaining = hidden ? CODE_HUNT.hideSeconds - state.elapsed
    : CODE_HUNT.rotateSeconds - ((state.elapsed - CODE_HUNT.hideSeconds) % CODE_HUNT.rotateSeconds);
  const canSend = !hidden && state.elapsed >= readyAt && /^\d{4}$/.test(code) && !!onGuess;
  const submit = () => {
    if (!canSend) return;
    onGuess?.(code); inputRef.current?.blur(); setCode(''); setReadyAt(state.elapsed + CODE_HUNT.cooldown);
  };
  const submitRef = useRef(submit); submitRef.current = submit;
  useEffect(() => { setCode(''); }, [epoch]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (touch || !document.pointerLockElement || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); if (!e.repeat) setCode(old => (old + e.key).slice(0, 4)); }
      else if (e.key === 'Backspace') { e.preventDefault(); setCode(old => old.slice(0, -1)); }
      else if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); submitRef.current(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [touch]);
  return <section className="hud-objective hud-surface codehunt-hud" style={{ pointerEvents: 'auto' }}
    onPointerDown={e => e.stopPropagation()}>
    <div className="hud-objective-heading"><strong>{t('games.codehunt.title')}</strong><span>{Math.max(0, Math.ceil(remaining))}s</span></div>
    <p className="hud-description codehunt-status">{t(hidden ? 'codehunt.hide' : 'codehunt.reveal')}</p>
    <form onSubmit={e => { e.preventDefault(); submit(); }}>
      <label htmlFor="code-guess">{t('codehunt.input')}</label>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input ref={inputRef} id="code-guess" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
          autoComplete="off" value={code} disabled={hidden} readOnly={!touch}
          onChange={e => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
          placeholder="0000" style={{ minWidth: 0, width: '7em', padding: 8, color: '#b8fff0', background: '#092b3a', font: 'bold 22px monospace', letterSpacing: '.15em' }} />
        <button type="submit" disabled={!canSend} style={{ padding: 8, opacity: canSend ? 1 : .5 }}>{t('codehunt.send')}</button>
      </div>
    </form>
    <p className="hud-description">{t(touch ? 'codehunt.touch' : 'codehunt.keyboard')}</p>
    <p className="hud-description">{t('codehunt.rules')}</p>
  </section>;
}
