import { useEffect } from 'react';
import type { GameId } from 'winterarc-core';
import { GAME_DEFINITIONS } from 'winterarc-gameplay';
import { api } from '../account/service';
import { createStore, useStore } from '../hooks/useStore';
export const enabledGames = createStore<GameId[]>(Object.keys(GAME_DEFINITIONS) as GameId[]);
export function setEnabledGames(modes: GameId[]): void {
  const safe = modes.filter(mode => Object.hasOwn(GAME_DEFINITIONS, mode));
  if (safe.length && safe.join() !== enabledGames.get().join()) enabledGames.set(safe);
}
let users = 0, timer: ReturnType<typeof setInterval> | undefined;
const refresh = () => { void api<{ enabledModes: GameId[] }>('/games').then(r => setEnabledGames(r.enabledModes)).catch(() => {}); };
export function useEnabledGames(): GameId[] {
  const modes = useStore(enabledGames);
  useEffect(() => {
    if (users++ === 0) { refresh(); timer = setInterval(refresh, 15000); window.addEventListener('focus', refresh); }
    return () => { if (--users === 0) { clearInterval(timer); window.removeEventListener('focus', refresh); } };
  }, []);
  return modes;
}
