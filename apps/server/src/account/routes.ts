import { Router, json, type Request, type Response, type NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { ECONOMY, type AccountProfile } from 'winterarc-profile';
import { accounts, AccountError, secret } from './AccountStore.js';

export function accountRoutes(allowedOrigins: string[]): Router {
  const router = Router();
  const store = accounts();
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const google = new OAuth2Client(clientId);
  const secure = process.env.NODE_ENV === 'production';
  const sameSite = process.env.COOKIE_SAME_SITE === 'none' ? ('none' as const) : ('lax' as const);
  if (sameSite === 'none' && !secure) {
    throw new Error('COOKIE_SAME_SITE=none requires production HTTPS with Secure cookies.');
  }
  const cookieOptions = { httpOnly: true, secure, sameSite, path: '/' };
  const limits = new Map<string, { count: number; until: number }>();
  const challenges = new Map<string, number>();
  const cookie = (req: Request, name: string): string => {
    const value = req.headers.cookie
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${name}=`));
    return value?.slice(name.length + 1) || '';
  };
  const user = (req: Request) => store.session(cookie(req, 'winter_session'));
  const adminHash = (req: Request) => store.adminAuth.cookieHash(cookie(req, 'winter_admin'));
  const admin = (req: Request) => {
    const hash = adminHash(req);
    store.adminAuth.requireHash(hash);
    return hash;
  };
  const withAdmin = (req: Request, profile: AccountProfile): AccountProfile => ({
    ...profile,
    admin: !!adminHash(req),
  });
  // SameSite cookie + exact Origin + custom header. No permissive fallback for writes.
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (
      req.method !== 'GET' &&
      (!allowedOrigins.includes(req.headers.origin || '') || req.headers['x-winterarc'] !== '1')
    ) {
      res.status(403).json({ error: 'ORIGIN_REJECTED' });
      return;
    }
    const now = Date.now();
    for (const [key, value] of limits) if (value.until <= now) limits.delete(key);
    for (const [key, until] of challenges) if (until <= now) challenges.delete(key);
    const key = `${req.ip || req.socket.remoteAddress}:${req.path.startsWith('/auth') ? 'auth' : 'api'}`;
    const bucket = limits.get(key) || { count: 0, until: now + 60000 };
    bucket.count++;
    limits.set(key, bucket);
    if (bucket.count > (req.path.startsWith('/auth') ? 60 : 240)) {
      res.status(429).json({ error: 'RATE_LIMITED' });
      return;
    }
    next();
  });
  router.use(json({ limit: '16kb' }));
  const route =
    (fn: (req: Request, res: Response) => unknown) =>
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve()
        .then(() => fn(req, res))
        .catch(next);
    };

  router.get(
    '/config',
    route((_req, res) =>
      res.json({ googleClientId: clientId, economy: ECONOMY, serverNow: Date.now() }),
    ),
  );
  router.post(
    '/auth/challenge',
    route((req, res) => {
      if (!clientId) throw new AccountError(503, 'GOOGLE_NOT_CONFIGURED');
      if (challenges.size >= 5000) throw new AccountError(429, 'RATE_LIMITED');
      const previous = cookie(req, 'winter_nonce');
      if ((challenges.get(previous) || 0) > Date.now() + 60000) {
        res.json({ nonce: previous });
        return;
      }
      const nonce = secret();
      challenges.set(nonce, Date.now() + 1800000);
      res.cookie('winter_nonce', nonce, { ...cookieOptions, maxAge: 1800000 });
      res.json({ nonce });
    }),
  );
  router.post(
    '/auth/google',
    route(async (req, res) => {
      const nonce = cookie(req, 'winter_nonce');
      const expires = challenges.get(nonce) || 0;
      challenges.delete(nonce);
      res.clearCookie('winter_nonce', cookieOptions);
      if (expires < Date.now() || typeof req.body?.credential !== 'string')
        throw new AccountError(401, 'LOGIN_FAILED');
      let payload;
      try {
        payload = (
          await google.verifyIdToken({ idToken: req.body.credential, audience: clientId })
        ).getPayload();
      } catch {
        throw new AccountError(401, 'LOGIN_FAILED');
      }
      if (!payload?.sub || (payload as { nonce?: string }).nonce !== nonce)
        throw new AccountError(401, 'LOGIN_FAILED');
      const result = store.login(
        payload.sub,
        payload.name || 'Snowfriend',
        payload.picture,
        payload.email,
        payload.email_verified,
      );
      res.cookie('winter_session', result.session, { ...cookieOptions, maxAge: 7 * 86400000 });
      // Google identity never grants admin rights; the separate admin session does.
      res.json({ profile: withAdmin(req, result.profile) });
    }),
  );
  router.get(
    '/me',
    route((req, res) =>
      res.json({ profile: withAdmin(req, store.profile(user(req))), serverNow: Date.now() }),
    ),
  );
  router.post(
    '/auth/logout',
    route((req, res) => {
      store.logout(cookie(req, 'winter_session'));
      res.clearCookie('winter_session', cookieOptions);
      res.json({ ok: true });
    }),
  );
  router.post(
    '/auth/ticket',
    route((req, res) =>
      res.json({
        ticket: store.issueTicket(cookie(req, 'winter_session'), cookie(req, 'winter_admin')),
      }),
    ),
  );
  router.post(
    '/profile/name',
    route((req, res) =>
      res.json({ profile: withAdmin(req, store.rename(user(req), req.body?.name)) }),
    ),
  );
  router.post(
    '/profile/style',
    route((req, res) =>
      res.json({
        profile: withAdmin(
          req,
          store.customize(user(req), req.body?.frameId, req.body?.theme, req.body?.color),
        ),
      }),
    ),
  );
  router.post(
    '/shop/item',
    route((req, res) =>
      res.json({
        profile: withAdmin(
          req,
          store.shopItem(user(req), req.body?.kind, req.body?.itemId, req.body?.action),
        ),
      }),
    ),
  );
  router.post(
    '/economy/spin',
    route((req, res) => {
      const result = store.spin(user(req), req.body?.source);
      res.json({ ...result, profile: withAdmin(req, result.profile), serverNow: Date.now() });
    }),
  );
  router.get(
    '/rank',
    route((_req, res) => res.json(store.leaderboard())),
  );
  router.get(
    '/tournaments/:id',
    route((req, res) => {
      user(req);
      res.json(store.standings(req.params.id));
    }),
  );
  router.get(
    '/settings',
    route((req, res) => res.json(store.settings(user(req)))),
  );
  router.post(
    '/settings',
    route((req, res) => {
      const id = user(req);
      if (req.body?.accountId !== id) throw new AccountError(409, 'ACCOUNT_CHANGED');
      res.json(store.saveSettings(id, req.body?.settings, req.body?.revision));
    }),
  );
  router.post(
    '/admin/login',
    route(async (req, res) => {
      const session = await store.adminAuth.login(
        req.body?.username,
        req.body?.password,
        req.ip || req.socket.remoteAddress || 'unknown',
      );
      store.adminAuth.logout(cookie(req, 'winter_admin'));
      res.cookie('winter_admin', session.token, { ...cookieOptions, maxAge: 8 * 3600000 });
      res.json({ username: session.username, expires: session.expires });
    }),
  );
  router.post(
    '/admin/logout',
    route((req, res) => {
      store.adminAuth.logout(cookie(req, 'winter_admin'));
      res.clearCookie('winter_admin', cookieOptions);
      res.json({ ok: true });
    }),
  );
  router.get(
    '/admin/me',
    route((req, res) => res.json(store.adminAuth.currentHash(admin(req)))),
  );
  router.get(
    '/admin/users',
    route((req, res) => {
      const hash = admin(req);
      const search = typeof req.query.q === 'string' ? req.query.q.slice(0, 80) : '';
      const page = Math.max(0, Math.min(100000, Math.floor(Number(req.query.page) || 0)));
      res.json(store.adminUsers(hash, search, page));
    }),
  );
  router.get(
    '/fund',
    route(async (req, res) => {
      try {
        await store.funds.syncBankIncome();
      } catch {
        // Keep serving the persisted ledger; report() includes bankSync.status='error'.
      }
      res.json(store.funds.report(Number(req.query.page)));
    }),
  );
  router.get(
    '/admin/fund',
    route(async (req, res) => {
      admin(req);
      try {
        await store.funds.syncBankIncome();
      } catch {
        // The admin can still record expenses while the bank API is unavailable.
      }
      res.json(store.funds.report(Number(req.query.page), true));
    }),
  );
  router.post(
    '/admin/fund/reset',
    route(async (req, res) => {
      const actor = store.adminAuth.requireHash(admin(req));
      const result = await store.funds.resetEntries(actor, req.body?.scope, req.body?.confirmation);
      res.json(result);
    }),
  );
  router.post(
    '/admin/fund/config',
    route((req, res) => {
      store.funds.configure(store.adminAuth.requireHash(admin(req)), req.body || {});
      res.json({ ok: true });
    }),
  );
  router.post(
    '/admin/fund/entry',
    route((req, res) => {
      store.funds.add(store.adminAuth.requireHash(admin(req)), req.body || {});
      res.json({ ok: true });
    }),
  );
  router.post(
    '/admin/fund/void',
    route((req, res) => {
      store.funds.void(store.adminAuth.requireHash(admin(req)), req.body?.id, req.body?.reason);
      res.json({ ok: true });
    }),
  );
  router.get(
    '/games',
    route((_req, res) => res.json({ enabledModes: store.enabledModes() })),
  );
  router.post(
    '/admin/economy',
    route((req, res) => {
      const hash = admin(req);
      if (typeof req.body?.userId !== 'string') throw new AccountError(400, 'ACCOUNT_NOT_FOUND');
      res.json({
        user: store.setEconomy(
          hash,
          req.body.userId,
          req.body.tokens,
          req.body.bonusSpins,
          req.body.revision,
          req.body.reason,
        ),
      });
    }),
  );
  router.get(
    '/admin/club-emails',
    route((req, res) => res.json({ emails: store.clubEmails(admin(req)) })),
  );
  router.post(
    '/admin/club-emails',
    route((req, res) =>
      res.json({ emails: store.editClubEmails(admin(req), req.body?.emails, req.body?.remove) }),
    ),
  );
  router.post(
    '/admin/games',
    route((req, res) =>
      res.json({
        enabledModes: store.setModeEnabled(admin(req), req.body?.mode, req.body?.enabled),
      }),
    ),
  );
  router.post(
    '/admin/premium',
    route((req, res) => {
      const id = admin(req);
      if (typeof req.body?.userId !== 'string') throw new AccountError(400, 'ACCOUNT_NOT_FOUND');
      store.setPremium(id, req.body.userId, req.body.enabled);
      res.json({ ok: true });
    }),
  );
  router.post(
    '/admin/roles',
    route((req, res) => {
      const actor = admin(req);
      if (typeof req.body?.userId !== 'string') throw new AccountError(400, 'ACCOUNT_NOT_FOUND');
      store.setRoles(actor, req.body.userId, req.body.roles);
      res.json({ ok: true });
    }),
  );
  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AccountError) res.status(error.status).json({ error: error.message });
    else {
      console.error('Account request failed', error);
      res.status(500).json({ error: 'SERVER_ERROR' });
    }
  });
  return router;
}
