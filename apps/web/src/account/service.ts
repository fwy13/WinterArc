import { createStore } from '../hooks/useStore';
import type { AccountConfig, AccountProfile } from 'winterarc-profile';

export { apiBaseUrl as apiBase } from '../config/endpoints';
import { apiBaseUrl as apiBase } from '../config/endpoints';
export const account = createStore<AccountProfile | null>(null);
export const rewardPresentationBusy = createStore(false);
let queuedProfile: AccountProfile | null = null;

/** Gate ALL incoming account updates, including room broadcasts, until the wheel reveals. */
export function presentProfile(profile: AccountProfile): void {
  const current = queuedProfile || account.get();
  if (current?.id === profile.id && current.revision > profile.revision) return;
  if (rewardPresentationBusy.get() && account.get()?.id === profile.id) queuedProfile = profile;
  else account.set(profile);
}
export function holdRewardPresentation(): () => void {
  if (rewardPresentationBusy.get()) throw new Error('SPIN_BUSY');
  queuedProfile = null;
  rewardPresentationBusy.set(true);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const pending = queuedProfile;
    queuedProfile = null;
    rewardPresentationBusy.set(false);
    if (pending && account.get()?.id === pending.id) account.set(pending);
  };
}
export const accountConfig = createStore<AccountConfig | null>(null);
export const accountLoading = createStore(true);
export const googleSubject = createStore('');
export let serverClockOffset = 0;
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-WinterArc': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/admin/')) { queuedProfile = null; account.set(null); }
    throw new ApiError(response.status, data.error || 'SERVER_ERROR');
  }
  if (typeof data.serverNow === 'number') serverClockOffset = data.serverNow - Date.now();
  return data as T;
}
export async function refreshAccount(): Promise<void> {
  try { presentProfile((await api<{ profile: AccountProfile }>('/me')).profile); }
  catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error; }
}
export async function loadAccount(): Promise<void> {
  try {
    accountConfig.set(await api<AccountConfig>('/config'));
    await refreshAccount();
  } finally { accountLoading.set(false); }
}
export async function signOut(): Promise<void> {
  await api('/auth/logout', {});
  queuedProfile = null;
  account.set(null);
  googleSubject.set('');
}
export async function accessTicket(): Promise<string> {
  return (await api<{ ticket: string }>('/auth/ticket', {})).ticket;
}
