import { CODE_HUNT } from './codeHunt.js';
export const MAX_PLAYERS = 32;
export const HUNT_GOAL = 6;
export const GAME_DEFINITIONS = {
  codehunt: { id: 'codehunt', duration: CODE_HUNT.rounds * CODE_HUNT.roundSeconds + (CODE_HUNT.rounds - 1) * CODE_HUNT.breakSeconds, accent: '#74e0ce' },
  wallduel: { id: 'wallduel', duration: 0, accent: '#ff879b' },
  knockout: { id: 'knockout', duration: 180, accent: '#aeefff' },
  hunt: { id: 'hunt', duration: 240, accent: '#bbebd2' },
  colorfall: { id: 'colorfall', duration: 140, accent: '#eac4fb' },
  giftrace: { id: 'giftrace', duration: 210, accent: '#f9c780' },
  crab: { id: 'crab', duration: 210, accent: '#f2b59c' },
  icebreak: { id: 'icebreak', duration: 150, accent: '#9cf2f2' },
  boomgift: { id: 'boomgift', duration: 150, accent: '#ff9b73' },
  meltdown: { id: 'meltdown', duration: 165, accent: '#7ce8ff' },
  frosty: { id: 'frosty', duration: 150, accent: '#a8f5b8' },
  snowfort: { id: 'snowfort', duration: 180, accent: '#ffd479' },
  avalanche: { id: 'avalanche', duration: 150, accent: '#b8d8ff' },
} as const;
