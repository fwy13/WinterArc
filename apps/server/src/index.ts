import 'dotenv/config';
import { accountRoutes } from './account/routes.js';
import { accounts } from './account/AccountStore.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';
import { Server, matchMaker } from '@colyseus/core';
import { TOURNAMENT_ROOM } from 'winterarc-protocol';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RoomRegistry } from './rooms/RoomRegistry.js';
export async function startServer(port = Number(process.env.PORT || 2567)): Promise<{
  gameServer: Server;
  http: ReturnType<typeof createServer>;
  port: number;
}> {
  const app = express();
  app.disable('x-powered-by');
  // Enabled only behind the single Nginx hop; do not expose port 2567 publicly.
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  const http = createServer(app);
  const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:2567')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const checkOrigin = (origin: string | undefined): boolean =>
    !origin || allowed.includes(origin);
  app.use((req, res, next) => {
    if (!checkOrigin(req.headers.origin)) {
      res.status(403).json({ error: 'Origin is not allowed.' });
      return;
    }
    if (req.headers.origin) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-WinterArc');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  accounts().recoverRooms();
  app.use('/api', accountRoutes(allowed));
  app.get('/health', (_req, res) => {
    res.json({ ok: true, game: 'winter-arc', version: '6.2.0' });
  });
  class OriginCheckedServer extends Server {
    protected async handleMatchMakeRequest(
      req: IncomingMessage,
      res: ServerResponse,
    ): Promise<void> {
      if (!checkOrigin(req.headers.origin)) {
        res.writeHead(403);
        res.end('Origin is not allowed');
        return;
      }
      await super.handleMatchMakeRequest(req, res);
    }
  }
  const gameServer = new OriginCheckedServer({
    greet: false,
    gracefullyShutdown: false,
    transport: new WebSocketTransport({
      server: http,
      maxPayload: 4096,
      verifyClient: ({ origin }, done) => done(checkOrigin(origin), 403, 'Origin is not allowed'),
    }),
  });
  RoomRegistry.register(gameServer);
  app.get('/api/rooms', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const rooms = await matchMaker.query({ name: TOURNAMENT_ROOM, private: false });
      res.json(
        rooms.slice(0, 100).map((room) => ({
          roomId: room.roomId,
          clients: room.clients,
          maxClients: room.maxClients,
          locked: room.locked,
          format: room.metadata?.format === 'squad' ? 'squad' : 'solo',
          phase: room.metadata?.phase ?? 'lobby',
          modeSelection: room.metadata?.modeSelection ?? room.metadata?.mode ?? 'hunt',
          mode: room.metadata?.mode ?? 'hunt',
        })),
      );
    } catch (error) {
      console.error('Cannot list tournament rooms', error);
      res.status(503).json({ error: 'Room list unavailable' });
    }
  });
  const here = dirname(fileURLToPath(import.meta.url));
  const dist = resolve(here, '../../web/dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get(['/', '/admin', '/admin/', '/editor', '/editor/'], (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  }
  await gameServer.listen(port, '0.0.0.0');
  const address = http.address() as AddressInfo;
  console.log(`❄ Server WinterArc: http://localhost:${address.port}`);
  return { gameServer, http, port: address.port };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { gameServer } = await startServer();
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      void gameServer.gracefullyShutdown();
    });
}
