import { createHash } from 'node:crypto';

export interface BankIncome {
  id: string;
  amount: number;
  date: string;
  senderName: string;
  message: string;
  reference: string;
  transactionAt: string;
}
interface BankRow {
  id: string;
  type: string;
  source: string;
  amount: string;
  counterName?: string | null;
  counterAccount?: string | null;
  referenceCode?: string | null;
  transferContent: string;
  transactionTime: string;
  bankAccount?: { accountNumber?: string };
}
const clean = (value: unknown, max = 2000): string => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
  : '';
export const normalizeBankContent = (value: string): string => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Recognize the provided MB/VCB transfer format; don't guess names in arbitrary messages. */
export function bankPresentation(row: Pick<BankRow, 'counterName' | 'counterAccount' | 'bankAccount' | 'transferContent'>) {
  const content = clean(row.transferContent);
  const metadata = /(?:^|[.\s])CT\s+(?:tu|từ)\s+(\d{6,30})\s+([\p{L}\p{M} .'-]{2,100}?)\s+(?:toi|tới|đến)\s+\d{6,30}\b/iu.exec(content);
  let senderName = clean(row.counterName, 100);
  if (!senderName && metadata) senderName = clean(metadata[2], 100);
  let message = metadata ? content.slice(0, metadata.index) : content;
  message = message.replace(/^MBVCB\.\d+\.\d+\./i, '').replace(/[.\s]+$/, '').trim();
  // Remove known account numbers from the public message, retaining the donor's words.
  for (const account of [row.counterAccount, row.bankAccount?.accountNumber]) {
    if (typeof account === 'string' && account.length >= 6) message = message.split(account).join('[ẩn STK]');
  }
  return { senderName, message: message.slice(0, 1000) };
}

export async function fetchBankIncome(base: string, token: string, account: string, keyword: string): Promise<BankIncome[]> {
  const endpoint = new URL(`${base.replace(/\/+$/, '')}/transactions`);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('BANK_CONFIG');
  const pending = new Map<string, BankIncome>();
  const signal = AbortSignal.timeout(8000);
  for (let page = 1; ; page++) {
    const url = new URL(endpoint);
    url.searchParams.set('type', 'IN'); url.searchParams.set('limit', '10'); url.searchParams.set('page', String(page));
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, redirect: 'error', signal });
    if (!response.ok) throw new Error('BANK_HTTP');
    const result = await response.json() as { statusCode: number; data?: { data?: BankRow[]; meta?: { page: number; totalPages: number } } };
    const rows = result?.data?.data, meta = result?.data?.meta;
    if (result?.statusCode !== 200 || !Array.isArray(rows) || !meta || meta.page !== page || !Number.isInteger(meta.totalPages) || meta.totalPages < 0 || meta.totalPages > 1000 || (meta.totalPages < page && !(page === 1 && rows.length === 0))) throw new Error('BANK_RESPONSE');
    for (const row of rows) {
      if (!row || row.type !== 'IN' || row.source !== 'REAL' || row.bankAccount?.accountNumber !== account) continue;
      if (typeof row.transferContent !== 'string') throw new Error('BANK_CONTENT');
      if (keyword && !normalizeBankContent(row.transferContent).includes(keyword)) continue;
      if (typeof row.id !== 'string' || !row.id || row.id.length > 500 || typeof row.amount !== 'string' || !/^\d+$/.test(row.amount) || typeof row.transactionTime !== 'string') throw new Error('BANK_TRANSACTION');
      const amount = Number(row.amount), timestamp = Date.parse(row.transactionTime);
      if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1e9 || !Number.isFinite(timestamp)) throw new Error('BANK_AMOUNT_TIME');
      const transactionAt = new Date(timestamp).toISOString();
      const date = new Date(timestamp + 7 * 3600000).toISOString().slice(0, 10);
      // Same identity formula as the previous integration, preserving existing imports.
      const id = `bank:${createHash('sha256').update(JSON.stringify([endpoint.href, account, row.id])).digest('hex')}`;
      const entry = { id, amount, date, ...bankPresentation(row), reference: clean(row.referenceCode || row.id, 160), transactionAt };
      const previous = pending.get(id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(entry)) throw new Error('BANK_DUPLICATE_CONFLICT');
      pending.set(id, entry);
    }
    if (page >= meta.totalPages) break;
  }
  return [...pending.values()];
}
