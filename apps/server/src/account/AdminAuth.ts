import type Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { AccountError } from './errors.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export class AdminAuth {
  private readonly username = process.env.ADMIN_USERNAME?.trim() || '';
  private readonly passwordHash = process.env.ADMIN_PASSWORD_HASH || '';
  private readonly version = digest(this.passwordHash);
  private readonly attempts = new Map<string, { count: number; until: number }>();
  private comparisons = 0;
  constructor(private readonly db: Database.Database) {
    db.exec(`CREATE TABLE IF NOT EXISTS admin_sessions (
      hash TEXT PRIMARY KEY, username TEXT NOT NULL, password_version TEXT NOT NULL, expires INTEGER NOT NULL
    )`);
  }
  private configured(): boolean {
    return !!this.username && /^\$2[aby]\$(1[0-4])\$[./A-Za-z0-9]{53}$/.test(this.passwordHash);
  }
  currentHash(hash: string): { username: string; expires: number } | null {
    if (!hash || !this.configured()) return null;
    const session = this.db.prepare(`SELECT username,expires FROM admin_sessions
      WHERE hash=? AND username=? AND password_version=? AND expires>?`)
      .get(hash, this.username, this.version, Date.now()) as { username: string; expires: number } | undefined;
    return session || null;
  }
  cookieHash(cookie: string): string {
    if (cookie.length > 128 || !cookie) return '';
    const hash = digest(cookie);
    return this.currentHash(hash) ? hash : '';
  }
  requireHash(hash: string): string {
    const session = this.currentHash(hash);
    if (!session) throw new AccountError(401, 'ADMIN_LOGIN_REQUIRED');
    return `admin:${session.username}`;
  }
  logout(cookie: string): void {
    if (cookie && cookie.length <= 128) this.db.prepare('DELETE FROM admin_sessions WHERE hash=?').run(digest(cookie));
  }
  async login(username: unknown, password: unknown, ip: string): Promise<{ token: string; username: string; expires: number }> {
    if (!this.configured()) throw new AccountError(503, 'ADMIN_NOT_CONFIGURED');
    const now = Date.now();
    for (const [key, value] of this.attempts) if (value.until <= now) this.attempts.delete(key);
    if (this.attempts.size > 5000 || this.comparisons >= 2) throw new AccountError(429, 'RATE_LIMITED');
    const bucket = this.attempts.get(ip) || { count: 0, until: now + 15 * 60000 };
    bucket.count++;
    this.attempts.set(ip, bucket);
    if (bucket.count > 5) throw new AccountError(429, 'RATE_LIMITED');
    if (typeof username !== 'string' || username.length > 100 || typeof password !== 'string' || !password.length || Buffer.byteLength(password, 'utf8') > 72) {
      throw new AccountError(401, 'ADMIN_LOGIN_FAILED');
    }
    this.comparisons++;
    let valid = false;
    try { valid = await bcrypt.compare(password, this.passwordHash); }
    finally { this.comparisons--; }
    if (!valid || username !== this.username) throw new AccountError(401, 'ADMIN_LOGIN_FAILED');
    this.attempts.delete(ip);
    const token = randomBytes(32).toString('base64url');
    const expires = now + 8 * 3600000;
    this.db.prepare('DELETE FROM admin_sessions WHERE expires<? OR password_version<>? OR username<>?').run(now, this.version, this.username);
    this.db.prepare('INSERT INTO admin_sessions VALUES (?,?,?,?)').run(digest(token), this.username, this.version, expires);
    return { token, username: this.username, expires };
  }
}
