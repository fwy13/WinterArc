import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (command === 'build') {
    const raw = process.env.VITE_SERVER_URL || env.VITE_SERVER_URL;
    if (!raw) throw new Error('Set VITE_SERVER_URL to your public HTTPS backend origin before building.');
    const url = new URL(raw);
    if (!['https:', 'wss:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
      throw new Error('VITE_SERVER_URL must be an HTTPS/WSS origin, e.g. https://api.example.com (no path or credentials).');
    }
  }
  return { plugins: [react(), tailwindcss()], server: { host: true } };
});
