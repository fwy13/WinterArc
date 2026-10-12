/** One public backend origin for account HTTP, matchmaking and WebSocket. */
const endpoint = new URL(import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : location.origin));
endpoint.protocol = ['https:', 'wss:'].includes(endpoint.protocol) ? 'https:' : 'http:';
export const backendOrigin = endpoint.origin;
export const apiBaseUrl = `${backendOrigin}/api`;
export const websocketUrl = backendOrigin.replace(/^http/, 'ws');
