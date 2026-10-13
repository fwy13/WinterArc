import type { GameId } from 'winterarc-core';
export type HudIconName = GameId | 'clock' | 'players' | 'check' | 'heart';
const paths: Record<HudIconName, string> = {
  hunt: 'M9 5h6M10 5V2h4v3M8 9a4 4 0 1 0 8 0 4 4 0 0 0-8 0M6 18a6 4 0 1 0 12 0 6 4 0 0 0-12 0M4 13l3 3M20 13l-3 3M11 9h.01M13 9h.01M12 17h.01M12 20h.01',
  crab: 'M5 13c0-5 14-5 14 0v3c0 6-14 6-14 0zM8 10V8M16 10V8M5 14l-3-3V6l3 2 2-3v5l-2 2M19 14l3-3V6l-3 2-2-3v5l2 2M5 17l-3 3M19 17l3 3',
  codehunt: 'M8 3 6 21M18 3l-2 18M3 9h18M2 15h18',
  wallduel: 'M12 2v5M12 17v5M2 12h5M17 12h5M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  knockout: 'M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0M6 17a6 5 0 1 0 12 0 6 5 0 0 0-12 0M2 12l5 3M22 12l-5 3M12 15v4',
  icebreak: 'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M17 19l-1-4 4-1M4 14l4 1-1 4M17 5l-1 4 4 1',
  colorfall: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  giftrace: 'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8C4 8 5 1 9 3c2 1 3 5 3 5s1-4 3-5c4-2 5 5-3 5',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  players: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-2a7 7 0 0 1 14 0v2M17 4a4 4 0 0 1 0 8M19 15a5 5 0 0 1 3 4v2',
  check: 'm5 12 4 4L19 6',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8',
};
export default function HudIcon({ name }: { name: HudIconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
