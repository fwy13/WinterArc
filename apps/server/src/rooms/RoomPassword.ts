import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { ServerError } from '@colyseus/core';

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** Server-only: never put the password, salt or hash in Schema or room metadata. */
export class RoomPassword {
  private tokens = 12;
  private updatedAt = Date.now();
  private pending = 0;
  private constructor(
    private readonly salt: Buffer,
    private readonly hash: Buffer,
  ) {}

  static async create(value: unknown): Promise<RoomPassword> {
    if (typeof value !== 'string' || value.length < 6 || value.length > 64 || !value.trim()) {
      throw new ServerError(400, 'PASSWORD_INVALID');
    }
    const salt = randomBytes(16);
    return new RoomPassword(salt, await derive(value, salt));
  }

  async verify(value: unknown): Promise<void> {
    const now = Date.now();
    this.tokens = Math.min(12, this.tokens + (now - this.updatedAt) / 2000);
    this.updatedAt = now;
    // Bound expensive authentication work and repeated guesses per room.
    if (this.tokens < 1 || this.pending >= 4) throw new ServerError(429, 'PASSWORD_RATE_LIMIT');
    this.tokens--;
    if (typeof value !== 'string' || value.length < 6 || value.length > 64) {
      throw new ServerError(401, 'PASSWORD_REQUIRED_OR_INVALID');
    }
    this.pending++;
    try {
      const candidate = await derive(value, this.salt);
      const valid = timingSafeEqual(candidate, this.hash);
      candidate.fill(0);
      if (!valid) throw new ServerError(401, 'PASSWORD_REQUIRED_OR_INVALID');
    } finally {
      this.pending--;
    }
  }
}
