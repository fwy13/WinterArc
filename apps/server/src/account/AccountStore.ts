import Database from 'better-sqlite3';
import { AdminAuth } from './AdminAuth.js';
import { AccountError } from './errors.js';
export { AccountError } from './errors.js';
import { normalizeGameSettings, type GameSettings } from 'winterarc-profile';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { PLAYER_SKINS, AVATAR_FRAMES, PROFILE_ROLES, THEMES, ECONOMY, SPIN_REWARDS, type AdminPlayer, type AccountProfile, type PublicProfile, type TournamentStanding, type ProfileRole } from 'winterarc-profile';
import { GAME_DEFINITIONS } from 'winterarc-gameplay';
import { type GameId } from 'winterarc-core';

interface UserRow {
  id: string; google_sub: string; name: string; avatar: string; theme: string;
  color: number; premium: number; points: number; wins: number; matches: number;
  revision: number;
  verified_email: string;
  school: '' | 'ctu';
  skin_id: string; avatar_url: string; frame_id: string; bonus_spins: number;
  tokens: number; name_changes: number; next_spin_at: number;
}
interface EventRow {
  id: string; title: string; mode: GameId; status: 'open' | 'live' | 'finished';
  room_id: string | null; max_players: number; rounds: number; completed_rounds: number;
}
export interface MatchResult {
  id: string;
  participants: string[];
  winners: string[];
  elapsed: number;
  tournamentId: string;
}
export const secret = () => randomBytes(32).toString('base64url');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export class AccountStore {
  private readonly db: Database.Database;
  readonly adminAuth: AdminAuth;
  // One authoritative game process. Prevent the same account farming concurrent rooms.
  private readonly playing = new Map<string, string>();

  constructor() {
    const path = resolve(process.env.ACCOUNT_DB_PATH || './data/accounts.sqlite');
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, google_sub TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL, avatar TEXT NOT NULL DEFAULT 'snowman',
        theme TEXT NOT NULL DEFAULT 'paper', color INTEGER NOT NULL DEFAULT 0,
        premium INTEGER NOT NULL DEFAULT 0,
        tokens INTEGER NOT NULL DEFAULT 0 CHECK(tokens >= 0),
        name_changes INTEGER NOT NULL DEFAULT 0, next_spin_at INTEGER NOT NULL DEFAULT 0,
        points INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0,
        matches INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS sessions (
        hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tickets (
        hash TEXT PRIMARY KEY, session_hash TEXT NOT NULL REFERENCES sessions(hash) ON DELETE CASCADE,
        expires INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cosmetics (
        user_id TEXT NOT NULL REFERENCES users(id), item TEXT NOT NULL,
        PRIMARY KEY(user_id, item)
      );
      CREATE TABLE IF NOT EXISTS ledger (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
        delta INTEGER NOT NULL, reason TEXT NOT NULL, created INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ledger_user ON ledger(user_id, created);
      CREATE INDEX IF NOT EXISTS ranking ON users(points DESC, wins DESC, id);
      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY, created INTEGER NOT NULL, result TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, mode TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open', room_id TEXT,
        max_players INTEGER NOT NULL, rounds INTEGER NOT NULL,
        completed_rounds INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS entries (
        event_id TEXT NOT NULL REFERENCES events(id), user_id TEXT NOT NULL REFERENCES users(id),
        points INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(event_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS admin_audit (
        id TEXT PRIMARY KEY, admin_id TEXT NOT NULL, action TEXT NOT NULL,
        target TEXT NOT NULL, created INTEGER NOT NULL
      );
    `);
    this.db.transaction(() => {
      const columns = new Set((this.db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map(c => c.name));
      if (!columns.has('verified_email')) this.db.exec("ALTER TABLE users ADD COLUMN verified_email TEXT NOT NULL DEFAULT ''");
      this.db.exec(`CREATE TABLE IF NOT EXISTS club_emails (email TEXT PRIMARY KEY, created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS game_availability (mode TEXT PRIMARY KEY, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)));`);
      if (!columns.has('skin_id')) this.db.exec("ALTER TABLE users ADD COLUMN skin_id TEXT NOT NULL DEFAULT 'explorer'");
      if (!columns.has('school')) this.db.exec("ALTER TABLE users ADD COLUMN school TEXT NOT NULL DEFAULT ''");
      const ticketColumns = new Set((this.db.prepare('PRAGMA table_info(tickets)').all() as { name: string }[]).map(c => c.name));
      if (!ticketColumns.has('admin_hash')) this.db.exec("ALTER TABLE tickets ADD COLUMN admin_hash TEXT NOT NULL DEFAULT ''");
      this.db.exec(`CREATE TABLE IF NOT EXISTS player_settings (user_id TEXT PRIMARY KEY REFERENCES users(id), data TEXT NOT NULL, revision INTEGER NOT NULL);`);
      if (!columns.has('revision')) this.db.exec('ALTER TABLE users ADD COLUMN revision INTEGER NOT NULL DEFAULT 0');
      this.db.exec(`CREATE TRIGGER IF NOT EXISTS users_revision AFTER UPDATE ON users
        WHEN NEW.revision=OLD.revision BEGIN UPDATE users SET revision=OLD.revision+1 WHERE id=NEW.id; END;`);
      if (!columns.has('avatar_url')) this.db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''");
      if (!columns.has('frame_id')) this.db.exec("ALTER TABLE users ADD COLUMN frame_id TEXT NOT NULL DEFAULT 'none'");
      if (!columns.has('bonus_spins')) this.db.exec('ALTER TABLE users ADD COLUMN bonus_spins INTEGER NOT NULL DEFAULT 0 CHECK(bonus_spins >= 0)');
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS user_roles (
          user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL,
          PRIMARY KEY(user_id, role)
        );
      `);
    })();
    this.adminAuth = new AdminAuth(this.db);
  }
  private row(id: string): UserRow {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    if (!row) throw new AccountError(404, 'ACCOUNT_NOT_FOUND');
    return row;
  }
  publicProfile(id: string): PublicProfile {
    const u = this.row(id);
    return { id: u.id, name: u.name, avatar: u.avatar, theme: u.theme, color: u.color,
      skinId: u.skin_id, school: u.school, avatarUrl: u.avatar_url, frameId: u.frame_id, roles: this.roles(id),
      premium: !!u.premium, points: u.points, wins: u.wins, matches: u.matches };
  }
  profile(id: string): AccountProfile {
    const u = this.row(id);
    return { ...this.publicProfile(id), admin: false, revision: u.revision, tokens: u.tokens, bonusSpins: u.bonus_spins,
      nameChanges: u.name_changes, nextSpinAt: u.next_spin_at,
      owned: (this.db.prepare('SELECT item FROM cosmetics WHERE user_id = ?').all(id) as { item: string }[]).map(r => r.item) };
  }
  login(sub: string, suggestedName: string, picture: unknown, email: unknown, emailVerified: unknown): { session: string; profile: AccountProfile } {
    return this.db.transaction(() => {
      let user = this.db.prepare('SELECT id FROM users WHERE google_sub = ?').get(sub) as { id: string } | undefined;
      if (!user) {
        user = { id: randomUUID() };
        const name = suggestedName.normalize('NFC').replace(/[\p{C}<>]/gu, '').trim().slice(0, 20) || 'Snowfriend';
        this.db.prepare('INSERT INTO users(id, google_sub, name) VALUES (?, ?, ?)').run(user.id, sub, name);
      }
      // Only Google's verified ID-token picture is accepted; no client profile URL input.
      let avatarUrl = '';
      try {
        const url = new URL(typeof picture === 'string' ? picture : '');
        if (url.protocol === 'https:' && !url.username && !url.password && !url.port &&
          (url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com'))) avatarUrl = url.href;
      } catch { /* Empty/missing picture renders account initials. */ }
      const school = emailVerified === true && typeof email === 'string' &&
        /^[^@\s]+@student\.ctu\.edu\.vn$/i.test(email) ? 'ctu' : '';
      const verifiedEmail = emailVerified === true && typeof email === 'string' ? email.trim().toLowerCase() : '';
      this.db.prepare('UPDATE users SET avatar_url=?, school=?, verified_email=? WHERE id=?').run(avatarUrl, school, verifiedEmail, user.id);
      const session = secret();
      this.db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
      this.db.prepare('DELETE FROM tickets WHERE expires < ?').run(Date.now());
      this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hash(session), user.id, Date.now() + 7 * 86400000);
      return { session, profile: this.profile(user.id) };
    })();
  }
  session(value: unknown): string {
    if (typeof value !== 'string' || value.length > 128) throw new AccountError(401, 'LOGIN_REQUIRED');
    const r = this.db.prepare('SELECT user_id FROM sessions WHERE hash = ? AND expires > ?').get(hash(value), Date.now()) as { user_id: string } | undefined;
    if (!r) throw new AccountError(401, 'LOGIN_REQUIRED');
    return r.user_id;
  }
  logout(value: string): void { this.db.prepare('DELETE FROM sessions WHERE hash = ?').run(hash(value)); }
  issueTicket(session: string, adminCookie = ''): string {
    this.session(session);
    const token = secret();
    this.db.prepare('DELETE FROM tickets WHERE expires < ?').run(Date.now());
    this.db.prepare('INSERT INTO tickets(hash,session_hash,expires,admin_hash) VALUES (?,?,?,?)')
      .run(hash(token), hash(session), Date.now() + 60000, this.adminAuth.cookieHash(adminCookie));
    return token;
  }
  ticket(value: unknown, consume = false): AccountProfile & { adminSessionHash: string } {
    if (typeof value !== 'string' || value.length > 128) throw new AccountError(401, 'LOGIN_REQUIRED');
    return this.db.transaction(() => {
      const r = this.db.prepare(`SELECT s.user_id,t.admin_hash FROM tickets t JOIN sessions s ON s.hash=t.session_hash
        WHERE t.hash=? AND t.expires>? AND s.expires>?`).get(hash(value), Date.now(), Date.now()) as { user_id: string; admin_hash: string } | undefined;
      if (!r) throw new AccountError(401, 'LOGIN_REQUIRED');
      if (consume) this.db.prepare('DELETE FROM tickets WHERE hash=?').run(hash(value));
      return { ...this.profile(r.user_id), admin: !!this.adminAuth.currentHash(r.admin_hash), adminSessionHash: r.admin_hash };
    })();
  }
  claim(id: string, roomId: string): void {
    if (this.playing.has(id)) throw new AccountError(409, 'ALREADY_IN_ROOM');
    this.playing.set(id, roomId);
  }
  release(id: string, roomId: string): void {
    if (this.playing.get(id) === roomId) this.playing.delete(id);
  }
  private changeTokens(id: string, amount: number, reason: string): void {
    const r = this.db.prepare('UPDATE users SET tokens=tokens+? WHERE id=? AND tokens+? >= 0').run(amount, id, amount);
    if (r.changes !== 1) throw new AccountError(409, 'NOT_ENOUGH_TOKENS');
    this.db.prepare('INSERT INTO ledger VALUES (?, ?, ?, ?, ?)').run(randomUUID(), id, amount, reason, Date.now());
  }
  rename(id: string, value: unknown): AccountProfile {
    if (this.playing.has(id)) throw new AccountError(409, 'LEAVE_ROOM_FIRST');
    if (typeof value !== 'string') throw new AccountError(400, 'NAME_INVALID');
    const name = value.normalize('NFC').trim();
    if ([...name].length < 2 || name.length > 20 || /[\p{C}<>]/u.test(name)) throw new AccountError(400, 'NAME_INVALID');
    return this.db.transaction(() => {
      const u = this.row(id);
      if (u.name === name) return this.profile(id);
      if (u.name_changes > 0) this.changeTokens(id, -ECONOMY.renameCost, 'rename');
      this.db.prepare('UPDATE users SET name=?, name_changes=name_changes+1 WHERE id=?').run(name, id);
      return this.profile(id);
    })();
  }
  customize(id: string, frameId: unknown, theme: unknown, color: unknown): AccountProfile {
    if (this.playing.has(id)) throw new AccountError(409, 'LEAVE_ROOM_FIRST');
    const frame = AVATAR_FRAMES.find(x => x.id === frameId);
    const background = THEMES.find(x => x.id === theme);
    if (!frame || !background || !Number.isInteger(color) || Number(color) < 0 || Number(color) > 5) {
      throw new AccountError(400, 'COSMETIC_INVALID');
    }
    return this.db.transaction(() => {
      for (const [kind, item] of [['frame', frame], ['theme', background]] as const) {
        const key = `${kind}:${item.id}`;
        if (item.cost && !this.db.prepare('SELECT 1 FROM cosmetics WHERE user_id=? AND item=?').get(id, key)) {
          this.changeTokens(id, -item.cost, key);
          this.db.prepare('INSERT INTO cosmetics VALUES (?, ?)').run(id, key);
        }
      }
      this.db.prepare('UPDATE users SET frame_id=?, theme=?, color=? WHERE id=?').run(frame.id, background.id, color, id);
      return this.profile(id);
    })();
  }
  shopItem(id: string, kind: unknown, itemId: unknown, action: unknown): AccountProfile {
    if (kind !== 'frame' && kind !== 'skin' && kind !== 'theme') throw new AccountError(400, 'COSMETIC_INVALID');
    if (action !== 'buy' && action !== 'equip') throw new AccountError(400, 'COSMETIC_INVALID');
    const catalog = kind === 'frame' ? AVATAR_FRAMES : kind === 'skin' ? PLAYER_SKINS : THEMES;
    const item = catalog.find(value => value.id === itemId);
    if (!item) throw new AccountError(400, 'COSMETIC_INVALID');
    if (action === 'equip' && this.playing.has(id)) throw new AccountError(409, 'LEAVE_ROOM_FIRST');
    return this.db.transaction(() => {
      const key = `${kind}:${item.id}`;
      const owned = item.cost === 0 || !!this.db.prepare('SELECT 1 FROM cosmetics WHERE user_id=? AND item=?').get(id, key);
      if (action === 'buy' && !owned) {
        this.changeTokens(id, -item.cost, key);
        this.db.prepare('INSERT INTO cosmetics(user_id,item) VALUES (?,?)').run(id, key);
      }
      if (action === 'equip') {
        if (!owned) throw new AccountError(409, 'ITEM_NOT_OWNED');
        // Column comes only from the server's fixed allowlist above.
        const column = kind === 'frame' ? 'frame_id' : kind === 'skin' ? 'skin_id' : 'theme';
        this.db.prepare(`UPDATE users SET ${column}=? WHERE id=?`).run(item.id, id);
      }
      return this.profile(id);
    })();
  }
  spin(id: string, source: unknown = 'free'): { tokens: number; index: number; profile: AccountProfile } {
    return this.db.transaction(() => {
      const now = Date.now();
      const u = this.row(id);
      if (source !== 'free' && source !== 'bonus') throw new AccountError(400, 'SPIN_SOURCE_INVALID');
      if (source === 'free' && u.next_spin_at > now) throw new AccountError(409, 'SPIN_COOLDOWN');
      if (source === 'bonus' && u.bonus_spins < 1) throw new AccountError(409, 'NO_BONUS_SPINS');
      let roll = randomInt(100), index = 0;
      for (; index < SPIN_REWARDS.length - 1; index++) {
        if (roll < SPIN_REWARDS[index].weight) break;
        roll -= SPIN_REWARDS[index].weight;
      }
      const tokens = SPIN_REWARDS[index].tokens;
      if (source === 'free') this.db.prepare('UPDATE users SET next_spin_at=? WHERE id=?').run(now + ECONOMY.spinCooldownMs, id);
      else this.db.prepare('UPDATE users SET bonus_spins=bonus_spins-1 WHERE id=?').run(id);
      this.changeTokens(id, tokens, 'spin');
      return { tokens, index, profile: this.profile(id) };
    })();
  }
  settings(id: string): { settings: GameSettings | null; revision: number } {
    const row = this.db.prepare('SELECT data,revision FROM player_settings WHERE user_id=?').get(id) as { data: string; revision: number } | undefined;
    return row ? { settings: normalizeGameSettings(JSON.parse(row.data)), revision: row.revision } : { settings: null, revision: 0 };
  }
  saveSettings(id: string, input: unknown, revision: unknown): { settings: GameSettings; revision: number } {
    if (!input || typeof input !== 'object' || Array.isArray(input) || !Number.isInteger(revision) || Number(revision) < 0) {
      throw new AccountError(400, 'SETTINGS_INVALID');
    }
    const settings = normalizeGameSettings(input as Partial<GameSettings>);
    return this.db.transaction(() => {
      const previous = this.settings(id);
      if (previous.revision !== revision) throw new AccountError(409, 'SETTINGS_CONFLICT');
      this.db.prepare(`INSERT INTO player_settings(user_id,data,revision) VALUES (?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,revision=excluded.revision`)
        .run(id, JSON.stringify(settings), previous.revision + 1);
      return { settings, revision: previous.revision + 1 };
    })();
  }
  adminUsers(adminHash: string, search: string, page: number): { users: AdminPlayer[]; total: number } {
    this.adminAuth.requireHash(adminHash);
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    const where = "WHERE name LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\' OR verified_email LIKE ? ESCAPE '\\'";
    const rows = this.db.prepare(`SELECT id FROM users ${where} ORDER BY name,id LIMIT 25 OFFSET ?`).all(pattern, pattern, pattern, page * 25) as { id: string }[];
    const count = this.db.prepare(`SELECT COUNT(*) AS n FROM users ${where}`).get(pattern, pattern, pattern) as { n: number };
    return { users: rows.map(row => this.adminPlayer(row.id)), total: count.n };
  }
  private adminPlayer(id: string): AdminPlayer {
    const u = this.row(id);
    return { ...this.publicProfile(id), email: u.verified_email, tokens: u.tokens, bonusSpins: u.bonus_spins, revision: u.revision };
  }
  setEconomy(adminHash: string, id: string, tokens: unknown, bonusSpins: unknown, revision: unknown, reason: unknown): AdminPlayer {
    const actor = this.adminAuth.requireHash(adminHash);
    if (!Number.isSafeInteger(tokens) || Number(tokens) < 0 || Number(tokens) > 1_000_000_000 ||
        !Number.isSafeInteger(bonusSpins) || Number(bonusSpins) < 0 || Number(bonusSpins) > 10000 ||
        !Number.isSafeInteger(revision) || typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 160)
      throw new AccountError(400, 'ECONOMY_INVALID');
    return this.db.transaction(() => {
      const before = this.row(id);
      if (before.revision !== revision) throw new AccountError(409, 'PLAYER_CONFLICT');
      this.changeTokens(id, Number(tokens) - before.tokens, 'admin-adjustment');
      this.db.prepare('UPDATE users SET bonus_spins=? WHERE id=?').run(bonusSpins, id);
      this.db.prepare('INSERT INTO admin_audit VALUES (?,?,?,?,?)').run(randomUUID(), actor,
        JSON.stringify({ type: 'economy', before: [before.tokens, before.bonus_spins], after: [tokens, bonusSpins], reason: reason.trim() }), id, Date.now());
      return this.adminPlayer(id);
    })();
  }
  clubEmails(adminHash: string): string[] {
    this.adminAuth.requireHash(adminHash);
    return (this.db.prepare('SELECT email FROM club_emails ORDER BY email').all() as { email: string }[]).map(r => r.email);
  }
  editClubEmails(adminHash: string, input: unknown, remove: unknown): string[] {
    const actor = this.adminAuth.requireHash(adminHash);
    if (!Array.isArray(input) || input.length < 1 || input.length > 100 || typeof remove !== 'boolean' ||
        input.some(v => typeof v !== 'string' || v.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())))
      throw new AccountError(400, 'EMAILS_INVALID');
    const emails = [...new Set(input.map(v => String(v).trim().toLowerCase()))];
    return this.db.transaction(() => {
      for (const email of emails) {
        if (remove) this.db.prepare('DELETE FROM club_emails WHERE email=?').run(email);
        else this.db.prepare('INSERT OR IGNORE INTO club_emails VALUES (?,?)').run(email, Date.now());
        this.db.prepare('UPDATE users SET revision=revision+1 WHERE verified_email=?').run(email);
      }
      const count = this.db.prepare('SELECT COUNT(*) AS n FROM club_emails').get() as { n: number };
      if (count.n > 1000) throw new AccountError(400, 'EMAILS_LIMIT');
      this.db.prepare('INSERT INTO admin_audit VALUES (?,?,?,?,?)').run(randomUUID(), actor,
        remove ? 'club-remove' : 'club-add', JSON.stringify(emails), Date.now());
      return this.clubEmails(adminHash);
    })();
  }
  enabledModes(): GameId[] {
    const disabled = new Set((this.db.prepare('SELECT mode FROM game_availability WHERE enabled=0').all() as {mode:string}[]).map(r => r.mode));
    return (Object.keys(GAME_DEFINITIONS) as GameId[]).filter(id => !disabled.has(id));
  }
  setModeEnabled(adminHash: string, mode: unknown, enabled: unknown): GameId[] {
    const actor = this.adminAuth.requireHash(adminHash);
    if (typeof mode !== 'string' || !Object.hasOwn(GAME_DEFINITIONS, mode) || typeof enabled !== 'boolean')
      throw new AccountError(400, 'MODE_INVALID');
    return this.db.transaction(() => {
      this.db.prepare('INSERT INTO game_availability VALUES (?,?) ON CONFLICT(mode) DO UPDATE SET enabled=excluded.enabled').run(mode, Number(enabled));
      const modes = this.enabledModes();
      if (!modes.length) throw new AccountError(400, 'LAST_GAME');
      this.db.prepare('INSERT INTO admin_audit VALUES (?,?,?,?,?)').run(randomUUID(), actor, `game-enabled:${enabled}`, mode, Date.now());
      return modes;
    })();
  }
  leaderboard(): PublicProfile[] {
    return (this.db.prepare('SELECT id FROM users WHERE matches>0 ORDER BY points DESC, wins DESC, id LIMIT 100').all() as { id: string }[])
      .map(r => this.publicProfile(r.id));
  }
  settle(result: MatchResult): void {
    this.db.transaction(() => {
      if (this.db.prepare('SELECT 1 FROM matches WHERE id=?').get(result.id)) return;
      this.db.prepare('INSERT INTO matches VALUES (?, ?, ?)').run(result.id, Date.now(), JSON.stringify(result));
      const ids = [...new Set(result.participants)];
      const eligible = ids.length >= 2 && result.elapsed >= ECONOMY.minimumMatchSeconds;
      const midnight = Math.floor(Date.now() / 86400000) * 86400000;
      for (const id of ids) {
        const won = result.winners.includes(id);
        if (eligible) {
          this.db.prepare('UPDATE users SET matches=matches+1, wins=wins+? WHERE id=?').run(Number(won), id);
          const rewards = this.db.prepare("SELECT COUNT(*) AS n FROM ledger WHERE user_id=? AND reason='win' AND created>=?").get(id, midnight) as { n: number };
          if (won && rewards.n < ECONOMY.dailyWinRewards) {
            this.changeTokens(id, ECONOMY.winTokens, 'win');
            this.db.prepare('UPDATE users SET points=points+? WHERE id=?').run(ECONOMY.winPoints, id);
          }
        }
        if (result.tournamentId) this.db.prepare('UPDATE entries SET points=points+?, wins=wins+? WHERE event_id=? AND user_id=?')
          .run(won ? 3 : 0, Number(won), result.tournamentId, id);
      }
      if (result.tournamentId) this.db.prepare(`UPDATE events SET completed_rounds=completed_rounds+1,
        status=CASE WHEN completed_rounds+1>=rounds THEN 'finished' ELSE status END WHERE id=?`).run(result.tournamentId);
    })();
  }
  setPremium(adminId: string, id: string, enabled: unknown): void {
    const actor = this.adminAuth.requireHash(adminId);
    if (typeof enabled !== 'boolean') throw new AccountError(400, 'PREMIUM_INVALID');
    this.db.transaction(() => {
      this.row(id);
      this.db.prepare('UPDATE users SET premium=? WHERE id=?').run(Number(enabled), id);
      this.db.prepare('INSERT INTO admin_audit VALUES (?, ?, ?, ?, ?)').run(randomUUID(), actor, `premium:${enabled}`, id, Date.now());
    })();
  }
  roles(id: string): ProfileRole[] {
    const roles = (this.db.prepare('SELECT role FROM user_roles WHERE user_id=? ORDER BY role').all(id) as { role: string }[])
      .map(r => r.role).filter((role): role is ProfileRole => role !== 'club' && PROFILE_ROLES.includes(role as ProfileRole));
    if (this.db.prepare('SELECT 1 FROM users u JOIN club_emails c ON c.email=u.verified_email WHERE u.id=?').get(id)) roles.push('club');
    return roles;
  }
  setRoles(adminId: string, userId: string, value: unknown): void {
    const actor = this.adminAuth.requireHash(adminId);
    if (!Array.isArray(value) || value.length > 2 || value.some(role => role === 'club' || !PROFILE_ROLES.includes(role)) ||
      value.filter(role => String(role).startsWith('sponsor_')).length > 1 || new Set(value).size !== value.length) {
      throw new AccountError(400, 'ROLES_INVALID');
    }
    this.db.transaction(() => {
      this.row(userId);
      this.db.prepare('DELETE FROM user_roles WHERE user_id=?').run(userId);
      for (const role of value) this.db.prepare('INSERT INTO user_roles VALUES (?,?)').run(userId,role);
      this.db.prepare('UPDATE users SET revision=revision+1 WHERE id=?').run(userId);
      this.db.prepare('INSERT INTO admin_audit VALUES (?,?,?,?,?)').run(randomUUID(),actor,`roles:${value.join(',')}`,userId,Date.now());
    })();
  }
  event(id: string): EventRow {
    const row = this.db.prepare('SELECT * FROM events WHERE id=?').get(id) as EventRow | undefined;
    if (!row) throw new AccountError(404, 'TOURNAMENT_NOT_FOUND');
    return row;
  }
  createRoomTournament(adminId: string, roomId: string, title: unknown, mode: unknown, rounds: unknown, maxPlayers: unknown): string {
    const actor = this.adminAuth.requireHash(adminId);
    if (typeof title !== 'string' || title.trim().length < 3 || title.length > 80 || /[\p{C}<>]/u.test(title) ||
      typeof mode !== 'string' || !Object.hasOwn(GAME_DEFINITIONS, mode) || !Number.isInteger(rounds) || Number(rounds)<1 || Number(rounds)>20 ||
      !Number.isInteger(maxPlayers) || Number(maxPlayers)<2 || Number(maxPlayers)>32) throw new AccountError(400, 'TOURNAMENT_INVALID');
    return this.db.transaction(() => {
      const id = randomUUID();
      this.db.prepare('INSERT INTO events(id,title,mode,max_players,rounds,room_id) VALUES (?,?,?,?,?,?)')
        .run(id,title.trim(),mode,maxPlayers,rounds,roomId);
      this.db.prepare('INSERT INTO admin_audit VALUES (?, ?, ?, ?, ?)')
        .run(randomUUID(), actor, 'create-tournament-room', id, Date.now());
      return id;
    })();
  }
  beginHeat(eventId: string, ids: string[], mode?: GameId): void {
    this.db.transaction(() => {
      const e = this.event(eventId);
      const unique = [...new Set(ids)];
      if (e.status === 'finished' || e.completed_rounds >= e.rounds || unique.length < 2 || unique.length > e.max_players) {
        throw new AccountError(409, 'TOURNAMENT_NOT_READY');
      }
      for (const id of unique) {
        this.db.prepare('INSERT OR IGNORE INTO entries(event_id,user_id) VALUES (?,?)').run(eventId,id);
      }
      this.db.prepare("UPDATE events SET status='live', mode=? WHERE id=?").run(mode ?? e.mode, eventId);
    })();
  }
  releaseEventRoom(eventId: string, roomId: string): void {
    // Empty/disposed rooms end their event. Preserve standings; a new room creates a new event.
    this.db.prepare("UPDATE events SET room_id=NULL, status='finished' WHERE id=? AND room_id=?").run(eventId,roomId);
  }
  recoverRooms(): void {
    this.db.prepare("UPDATE events SET room_id=NULL, status='finished'").run();
  }
  standings(eventId: string): TournamentStanding[] {
    this.event(eventId);
    return (this.db.prepare('SELECT user_id, points, wins FROM entries WHERE event_id=? ORDER BY points DESC, wins DESC, user_id').all(eventId) as {user_id:string;points:number;wins:number}[])
      .map(r => ({ ...this.publicProfile(r.user_id), tournamentPoints:r.points, tournamentWins:r.wins }));
  }
}
let singleton: AccountStore | undefined;
export function accounts(): AccountStore { return singleton ??= new AccountStore(); }
