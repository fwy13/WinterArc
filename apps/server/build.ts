import { build } from 'esbuild';
await build({
  entryPoints: ['src/index.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  external: ['@colyseus/*', 'express', 'better-sqlite3', 'bcryptjs', 'google-auth-library', 'dotenv/config'],
});
