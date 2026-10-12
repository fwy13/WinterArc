/** Public account data only. Google subjects, sessions and email never enter snapshots. */
export interface PublicProfile {
  id: string;
  name: string;
  avatar: string; // Legacy icon retained for old data only.
  avatarUrl: string;
  school: '' | 'ctu';
  frameId: string;
  skinId: string;
  roles: ProfileRole[];
  theme: string;
  color: number;
  premium: boolean;
  points: number;
  wins: number;
  matches: number;
}
export interface AccountProfile extends PublicProfile {
  admin: boolean;
  revision: number;
  tokens: number;
  bonusSpins: number;
  nameChanges: number;
  nextSpinAt: number;
  owned: string[];
}
export const ECONOMY = {
  spinCooldownMs: 6 * 60 * 60 * 1000,
  renameCost: 100,
  winTokens: 20,
  winPoints: 100,
  dailyWinRewards: 10,
  minimumMatchSeconds: 20,
} as const;
export const SPIN_REWARDS = [
  { tokens: 5, weight: 40 },
  { tokens: 10, weight: 30 },
  { tokens: 20, weight: 20 },
  { tokens: 50, weight: 9 },
  { tokens: 100, weight: 1 },
] as const;
export const THEMES = [
  { id: 'paper', color: '#fff9e8', cost: 0 },
  { id: 'pine', color: '#d6eee0', cost: 60 },
  { id: 'berry', color: '#f8dce4', cost: 60 },
  { id: 'ice', color: '#d9edf9', cost: 60 },
] as const;
export interface TournamentStanding extends PublicProfile {
  tournamentPoints: number;
  tournamentWins: number;
}
export type ProfileRole = 'club' | 'student' | 'sponsor_bronze' | 'sponsor_silver' | 'sponsor_gold' | 'sponsor_platinum' | 'sponsor_diamond';
export const PROFILE_ROLES: readonly ProfileRole[] = [
  'club',
  'student',
  'sponsor_bronze',
  'sponsor_silver',
  'sponsor_gold',
  'sponsor_platinum',
  'sponsor_diamond',
];
export interface AvatarFrame {
  id: string;
  cost: number;
  src: string;
  inset: number;
  rounded: boolean;
}
export const AVATAR_FRAMES: readonly AvatarFrame[] = [
  { id: 'none', cost: 0, src: '', inset: 0, rounded: true },
  { id: 'snow', cost: 80, src: '/frames/snow.svg', inset: 14, rounded: true },
  { id: 'holly', cost: 120, src: '/frames/holly.svg', inset: 14, rounded: true },
  { id: 'gold', cost: 200, src: '/frames/gold.svg', inset: 14, rounded: true },
  { id: 'candy', cost: 100, src: '/frames/candy.svg', inset: 16, rounded: true },
  { id: 'aurora', cost: 180, src: '/frames/aurora.svg', inset: 16, rounded: true },
  { id: 'gingerbread', cost: 110, src: '/frames/gingerbread.svg', inset: 16, rounded: true },
  { id: 'starlight', cost: 200, src: '/frames/starlight.svg', inset: 16, rounded: true },
  { id: 'mistletoe', cost: 150, src: '/frames/mistletoe.svg', inset: 16, rounded: true },
  { id: 'royal', cost: 300, src: '/frames/royal.svg', inset: 16, rounded: true },
  { id: 'lantern', cost: 170, src: '/frames/lantern.svg', inset: 16, rounded: true },
  { id: 'icecrystal', cost: 190, src: '/frames/icecrystal.svg', inset: 16, rounded: true },
  { id: 'peppermint', cost: 130, src: '/frames/peppermint.svg', inset: 16, rounded: true },
  { id: 'midnight', cost: 240, src: '/frames/midnight.svg', inset: 16, rounded: true },
];
export interface AccountConfig {
  googleClientId: string;
  economy: typeof ECONOMY;
  serverNow: number;
}

/** Admin-only fields. Never send this object into public room snapshots. */
export interface AdminPlayer extends PublicProfile { email: string; tokens: number; bonusSpins: number; revision: number }
