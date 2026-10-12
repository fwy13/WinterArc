import type Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import type { FundConfig, FundEntry, FundReport } from 'winterarc-profile';
import { AccountError } from './errors.js';

interface BankTransaction {
  id: string;
  type: string;
  source: string;
  amount: string;
  counterName?: string | null;
  transferContent: string;
  transactionTime: string;
  bankAccount: {
    accountNumber: string;
  };
}

interface BankResponse {
  statusCode: number;
  data: {
    data: BankTransaction[];
    meta: {
      page: number;
      totalPages: number;
    };
  };
}

const normalizeContent = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const text = (v: unknown, max: number) => {
  if (typeof v !== 'string' || v.length > max || /[\u0000-\u001f]/.test(v))
    throw new AccountError(400, 'FUND_INVALID');
  return v.trim();
};

const url = (v: unknown) => {
  const s = text(v, 500);
  if (s) {
    try {
      const u = new URL(s);
      if (u.protocol !== 'https:' || u.username || u.password) throw 0;
    } catch {
      throw new AccountError(400, 'FUND_URL');
    }
  }
  return s;
};

export class FundStore {
  constructor(private readonly db: Database.Database) {
    db.exec(`CREATE TABLE IF NOT EXISTS fund_config (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS fund_entries (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('income','expense')), amount INTEGER NOT NULL CHECK(amount>0), title TEXT NOT NULL, date TEXT NOT NULL, receipt TEXT NOT NULL, created INTEGER NOT NULL, voided INTEGER NOT NULL DEFAULT 0, voidReason TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS fund_date ON fund_entries(date DESC,created DESC);`);
    db.prepare('INSERT OR IGNORE INTO fund_config(id,data) VALUES(1,?)').run(
      JSON.stringify({
        bank: '',
        accountNumber: '',
        accountName: '',
        paymentUrl: '',
        note: '',
        goal: 0,
      }),
    );
  }

  private bankSync: Promise<void> | null = null;
  private nextBankSync = 0;

  async syncBankIncome(): Promise<void> {
    if (this.bankSync) return this.bankSync;
    if (Date.now() < this.nextBankSync) return;

    const base = process.env.FUND_BANK_API_URL?.trim();
    const token = process.env.FUND_BANK_API_TOKEN?.trim();
    const account = process.env.FUND_BANK_ACCOUNT?.trim();
    const keyword = normalizeContent(process.env.FUND_BANK_KEYWORD || 'WinterArc');

    if (!base || !token || !account || !keyword) return;

    this.bankSync = this.importBankIncome(base, token, account, keyword)
      .then(() => {
        this.nextBankSync = Date.now() + 60_000;
      })
      .catch(() => {
        this.nextBankSync = Date.now() + 15_000;
        throw new AccountError(502, 'FUND_BANK_UNAVAILABLE');
      })
      .finally(() => {
        this.bankSync = null;
      });

    return this.bankSync;
  }

  private async importBankIncome(
    base: string,
    token: string,
    account: string,
    keyword: string,
  ): Promise<void> {
    const endpoint = new URL(`${base.replace(/\/+$/, '')}/transactions`);

    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) {
      throw new Error('Invalid bank API URL');
    }

    const pending = new Map<string, { id: string; amount: number; date: string; title: string }>();
    let page = 1;

    const signal = AbortSignal.timeout(30_000);

    while (true) {
      const url = new URL(endpoint);
      url.searchParams.set('type', 'IN');
      url.searchParams.set('limit', '10');
      url.searchParams.set('page', String(page));

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        redirect: 'error',
        signal,
      });

      if (!response.ok) throw new Error('Bank request failed');

      const result = (await response.json()) as BankResponse;
      const rows = result?.data?.data;
      const meta = result?.data?.meta;

      if (
        result?.statusCode !== 200 ||
        !Array.isArray(rows) ||
        !meta ||
        meta.page !== page ||
        !Number.isInteger(meta.totalPages) ||
        meta.totalPages < 0 ||
        meta.totalPages > 100 ||
        (meta.totalPages < page && !(page === 1 && rows.length === 0))
      ) {
        throw new Error('Invalid bank response');
      }

      for (const row of rows) {
        if (
          row.type !== 'IN' ||
          row.source !== 'REAL' ||
          row.bankAccount?.accountNumber !== account ||
          typeof row.transferContent !== 'string' ||
          !normalizeContent(row.transferContent).includes(keyword)
        ) {
          continue;
        }

        if (
          typeof row.id !== 'string' ||
          !row.id ||
          typeof row.amount !== 'string' ||
          !/^\d+\$/.test(row.amount) ||
          typeof row.transactionTime !== 'string'
        ) {
          throw new Error('Invalid bank transaction');
        }

        const amount = Number(row.amount);
        const timestamp = Date.parse(row.transactionTime);

        if (
          !Number.isSafeInteger(amount) ||
          amount <= 0 ||
          amount > 1e9 ||
          !Number.isFinite(timestamp)
        ) {
          throw new Error('Invalid transaction amount or time');
        }

        const id = `bank:${createHash('sha256')
          .update(JSON.stringify([endpoint.href, account, row.id]))
          .digest('hex')}`;

        const date = new Date(timestamp + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

        let senderName = '';

        if (typeof row.counterName === 'string' && row.counterName.trim()) {
          senderName = row.counterName.replace(/[\u0000-\u001f\u007f]/g, '').trim();
        }

        if (!senderName && typeof row.transferContent === 'string') {
          const content = row.transferContent.replace(/\s+/g, ' ');
          const match = content.match(/(?:tu|từ)\s+(.*?)\s+(?:toi|tới)/i);
          
          if (match && match[1]) {
            let extracted = match[1].trim();
            // Nếu từ đầu tiên chứa chữ số (số tài khoản), cắt bỏ nó
            extracted = extracted.replace(/^([a-zA-Z0-9-]+\s+)/, (firstWord) => {
              return /\d/.test(firstWord) ? '' : firstWord;
            });
            // Loại bỏ các ký tự đặc biệt, chỉ giữ lại chữ cái và khoảng trắng
            senderName = extracted.replace(/[^a-zA-Z\s]/g, '').trim();
          }
        }

        // Bọc khoảng trắng thừa
        senderName = senderName.replace(/\s+/g, ' ');

        if (senderName.length > 50) {
          senderName = senderName.slice(0, 50).trim();
        }

        pending.set(id, {
          id,
          amount,
          date,
          title: senderName ? `${senderName} ủng hộ Winter Arc` : 'Ủng hộ Winter Arc',
        });
      }

      if (page >= meta.totalPages) break;
      page++;
    }

    this.db.transaction(() => {
      const find = this.db.prepare('SELECT id FROM fund_entries WHERE id = ?');

      const insert = this.db.prepare(`
        INSERT INTO fund_entries
          (id, kind, amount, title, date, receipt, created)
        VALUES (?, 'income', ?, ?, ?, '', ?)
      `);

      for (const entry of pending.values()) {
        if (find.get(entry.id)) {
          if (entry.title !== 'Ủng hộ Winter Arc') {
            const updated = this.db
              .prepare(
                `
                UPDATE fund_entries
                SET title = ?
                WHERE id = ?
                  AND title = 'Ủng hộ Winter Arc'
                  AND voided = 0
              `,
              )
              .run(entry.title, entry.id);

            if (updated.changes) {
              this.audit('bank-sync', 'fund-bank-name-update', entry.id);
            }
          }
          continue;
        }

        insert.run(entry.id, entry.amount, entry.title, entry.date, Date.now());
        this.audit('bank-sync', 'fund-bank-import', entry.id);
      }
    })();
  }

  report(page = 0): FundReport {
    page = Math.max(0, Math.min(100000, Math.floor(Number(page) || 0)));
    const c = this.db.prepare('SELECT data,revision FROM fund_config WHERE id=1').get() as {
      data: string;
      revision: number;
    };
    const sum = this.db
      .prepare(
        "SELECT COALESCE(SUM(CASE WHEN kind='income' THEN amount ELSE 0 END),0) income, COALESCE(SUM(CASE WHEN kind='expense' THEN amount ELSE 0 END),0) expense FROM fund_entries WHERE voided=0",
      )
      .get() as { income: number; expense: number };
    return {
      config: { ...JSON.parse(c.data), revision: c.revision },
      entries: this.db
        .prepare('SELECT * FROM fund_entries ORDER BY date DESC,created DESC,id LIMIT 25 OFFSET ?')
        .all(page * 25) as FundEntry[],
      total: (this.db.prepare('SELECT COUNT(*) n FROM fund_entries').get() as { n: number }).n,
      page,
      ...sum,
      balance: sum.income - sum.expense,
    };
  }

  configure(actor: string, value: Record<string, unknown>): void {
    const c = {
      bank: text(value.bank, 80),
      accountNumber: text(value.accountNumber, 80),
      accountName: text(value.accountName, 100),
      paymentUrl: url(value.paymentUrl),
      note: text(value.note, 400),
      goal: value.goal,
    };
    if (
      !Number.isSafeInteger(c.goal) ||
      Number(c.goal) < 0 ||
      Number(c.goal) > 1e12 ||
      !Number.isSafeInteger(value.revision)
    )
      throw new AccountError(400, 'FUND_INVALID');
    this.db.transaction(() => {
      if (
        !this.db
          .prepare('UPDATE fund_config SET data=?,revision=revision+1 WHERE id=1 AND revision=?')
          .run(JSON.stringify(c), value.revision).changes
      )
        throw new AccountError(409, 'FUND_CONFLICT');
      this.audit(actor, 'fund-config', JSON.stringify(c));
    })();
  }

  add(actor: string, value: Record<string, unknown>): void {
    const e = {
      id: text(value.id, 36),
      kind: value.kind,
      amount: value.amount,
      title: text(value.title, 160),
      date: text(value.date, 10),
      receipt: url(value.receipt),
    };
    if (
      !/^[0-9a-f-]{36}\$/i.test(e.id) ||
      !['income', 'expense'].includes(String(e.kind)) ||
      !Number.isSafeInteger(e.amount) ||
      Number(e.amount) <= 0 ||
      Number(e.amount) > 1e9 ||
      !e.title ||
      !/^\d{4}-\d{2}-\d{2}\$/.test(e.date) ||
      !Number.isFinite(Date.parse(e.date)) ||
      new Date(e.date).toISOString().slice(0, 10) !== e.date
    )
      throw new AccountError(400, 'FUND_INVALID');
    this.db.transaction(() => {
      const old = this.db.prepare('SELECT * FROM fund_entries WHERE id=?').get(e.id) as
        | FundEntry
        | undefined;
      if (old) {
        if (
          old.kind !== e.kind ||
          old.amount !== e.amount ||
          old.title !== e.title ||
          old.date !== e.date ||
          old.receipt !== e.receipt
        )
          throw new AccountError(409, 'FUND_CONFLICT');
        return;
      }
      this.db
        .prepare(
          'INSERT INTO fund_entries(id,kind,amount,title,date,receipt,created) VALUES(?,?,?,?,?,?,?)',
        )
        .run(e.id, e.kind, e.amount, e.title, e.date, e.receipt, Date.now());
      this.audit(actor, 'fund-add', e.id);
    })();
  }

  void(actor: string, id: unknown, reason: unknown): void {
    const key = text(id, 36),
      why = text(reason, 240);
    if (why.length < 3) throw new AccountError(400, 'FUND_INVALID');
    this.db.transaction(() => {
      if (
        !this.db
          .prepare('UPDATE fund_entries SET voided=?,voidReason=? WHERE id=? AND voided=0')
          .run(Date.now(), why, key).changes
      )
        throw new AccountError(409, 'FUND_CONFLICT');
      this.audit(actor, 'fund-void', JSON.stringify({ id: key, reason: why }));
    })();
  }

  private audit(actor: string, action: string, target: string) {
    this.db
      .prepare('INSERT INTO admin_audit VALUES(?,?,?,?,?)')
      .run(randomUUID(), actor, action, target, Date.now());
  }
}