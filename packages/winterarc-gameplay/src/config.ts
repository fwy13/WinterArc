export const MAX_PLAYERS = 32;
export const HUNT_GOAL = 6;
export const GAME_DEFINITIONS = {
  codehunt: { id: 'codehunt', duration: 180, accent: '#74e0ce' },
  wallduel: { id: 'wallduel', duration: 0, accent: '#ff879b' },
  knockout: { id: 'knockout', duration: 180, accent: '#aeefff' },
  hunt: { id: 'hunt', duration: 240, accent: '#bbebd2' },
  colorfall: { id: 'colorfall', duration: 140, accent: '#eac4fb' },
  giftrace: { id: 'giftrace', duration: 180, accent: '#f9c780' },
  crab: { id: 'crab', duration: 210, accent: '#f2b59c' },
  icebreak: { id: 'icebreak', duration: 150, accent: '#9cf2f2' },
} as const;
