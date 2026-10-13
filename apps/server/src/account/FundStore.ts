import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { FundConfig, FundEntry, FundReport } from 'winterarc-profile';
import { fetchBankIncome, normalizeBankContent } from './BankTransactions.js';
import { AccountError } from './errors.js';
const text=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max||/[\u0000-\u001f]/.test(v))throw new AccountError(400,'FUND_INVALID');return v.trim();};
const url=(v:unknown)=>{const s=text(v,500);if(s){try{const u=new URL(s);if(u.protocol!=='https:'||u.username||u.password)throw 0;}catch{throw new AccountError(400,'FUND_URL');}}return s;};
export class FundStore {
  constructor(private readonly db:Database.Database) {
    db.exec(`CREATE TABLE IF NOT EXISTS fund_config (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS fund_entries (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('income','expense')), amount INTEGER NOT NULL CHECK(amount>0), title TEXT NOT NULL, date TEXT NOT NULL, receipt TEXT NOT NULL, created INTEGER NOT NULL, voided INTEGER NOT NULL DEFAULT 0, voidReason TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS fund_date ON fund_entries(date DESC,created DESC);`);
    db.transaction(() => {
      const columns = new Set((db.prepare('PRAGMA table_info(fund_entries)').all() as {name:string}[]).map(c => c.name));
      const additions = { source: "TEXT NOT NULL DEFAULT 'manual'", senderName: "TEXT NOT NULL DEFAULT ''", message: "TEXT NOT NULL DEFAULT ''", reference: "TEXT NOT NULL DEFAULT ''", transactionAt: "TEXT NOT NULL DEFAULT ''" };
      for (const [name, definition] of Object.entries(additions)) {
        if (!columns.has(name)) db.exec(`ALTER TABLE fund_entries ADD COLUMN ${name} ${definition}`);
      }
      db.prepare("UPDATE fund_entries SET source='bank' WHERE kind='income' AND id GLOB 'bank:*' AND source='manual'").run();
    })();
    db.prepare('INSERT OR IGNORE INTO fund_config(id,data) VALUES(1,?)').run(JSON.stringify({bank:'',accountNumber:'',accountName:'',paymentUrl:'',note:'',goal:0}));
  }
  private bankSync: Promise<void> | null = null;
  private nextBankSync = 0;
  private lastSyncedAt: number | null = null;
  private bankStatus: 'not_configured' | 'syncing' | 'ok' | 'error' = 'not_configured';

  async syncBankIncome(): Promise<void> {
    if (this.bankSync) return this.bankSync;
    if (Date.now() < this.nextBankSync) return;
    const base = process.env.FUND_BANK_API_URL?.trim();
    const token = process.env.FUND_BANK_API_TOKEN?.trim();
    const account = process.env.FUND_BANK_ACCOUNT?.trim();
    const rawKeyword = process.env.FUND_BANK_KEYWORD ?? 'WinterArc';
    const keyword = normalizeBankContent(rawKeyword);
    if (!base || !token || !account || (rawKeyword.trim() && !keyword)) {
      this.bankStatus = 'not_configured'; return;
    }
    this.bankStatus = 'syncing';
    this.bankSync = fetchBankIncome(base, token, account, keyword).then(entries => {
      this.db.transaction(() => {
        const find = this.db.prepare('SELECT * FROM fund_entries WHERE id=?');
        const insert = this.db.prepare(`INSERT INTO fund_entries
          (id,kind,amount,title,date,receipt,created,source,senderName,message,reference,transactionAt)
          VALUES (?,'income',?,?,?,'',?,'bank',?,?,?,?)`);
        const update = this.db.prepare(`UPDATE fund_entries SET amount=?,title=?,date=?,source='bank',senderName=?,message=?,reference=?,transactionAt=? WHERE id=?`);
        for (const e of entries) {
          const old = find.get(e.id) as FundEntry | undefined;
          const title = e.message || 'Ủng hộ Winter Arc';
          if (!old) {
            insert.run(e.id,e.amount,title,e.date,Date.now(),e.senderName,e.message,e.reference,e.transactionAt);
            this.audit('bank-sync','fund-bank-import',e.id);
          } else {
            if (old.kind !== 'income' || old.source !== 'bank') throw new Error('BANK_ID_CONFLICT');
            // Enrich older imported rows, including rows already named by the previous version.
            // Updating metadata never resets voided/voidReason.
            if (old.amount!==e.amount || old.title!==title || old.date!==e.date || old.senderName!==e.senderName || old.message!==e.message || old.reference!==e.reference || old.transactionAt!==e.transactionAt) {
              update.run(e.amount,title,e.date,e.senderName,e.message,e.reference,e.transactionAt,e.id);
              this.audit('bank-sync','fund-bank-update',JSON.stringify({id:e.id,previousAmount:old.amount,amount:e.amount}));
            }
          }
        }
      })();
      this.lastSyncedAt = Date.now(); this.bankStatus = 'ok';
      this.nextBankSync = Date.now() + 60000;
    }).catch(() => {
      this.bankStatus = 'error'; this.nextBankSync = Date.now() + 15000;
      throw new AccountError(502,'FUND_BANK_UNAVAILABLE');
    }).finally(() => { this.bankSync = null; });
    return this.bankSync;
  }

  report(page=0, includeLegacy=false):FundReport {
    page=Math.max(0,Math.min(100000,Math.floor(Number(page)||0)));
    const c=this.db.prepare('SELECT data,revision FROM fund_config WHERE id=1').get() as {data:string;revision:number};
    const visible = includeLegacy ? '1=1' : "((kind='income' AND source='bank') OR (kind='expense' AND source='manual'))";
    const sum=this.db.prepare("SELECT COALESCE(SUM(CASE WHEN kind='income' THEN amount ELSE 0 END),0) income, COALESCE(SUM(CASE WHEN kind='expense' THEN amount ELSE 0 END),0) expense FROM fund_entries WHERE voided=0 AND ((kind='income' AND source='bank') OR (kind='expense' AND source='manual'))").get() as {income:number;expense:number};
    return {config:{...JSON.parse(c.data),revision:c.revision},entries:this.db.prepare(`SELECT * FROM fund_entries WHERE ${visible} ORDER BY date DESC,transactionAt DESC,created DESC,id LIMIT 25 OFFSET ?`).all(page*25) as FundEntry[],total:(this.db.prepare(`SELECT COUNT(*) n FROM fund_entries WHERE ${visible}`).get() as {n:number}).n,page,...sum,balance:sum.income-sum.expense,bankSync:{status:this.bankStatus,lastSyncedAt:this.lastSyncedAt}};
  }
  configure(actor:string,value:Record<string,unknown>):void {
    const c={bank:text(value.bank,80),accountNumber:text(value.accountNumber,80),accountName:text(value.accountName,100),paymentUrl:url(value.paymentUrl),note:text(value.note,400),goal:value.goal};
    if(!Number.isSafeInteger(c.goal)||Number(c.goal)<0||Number(c.goal)>1e12||!Number.isSafeInteger(value.revision))throw new AccountError(400,'FUND_INVALID');
    this.db.transaction(()=>{
      if(!this.db.prepare('UPDATE fund_config SET data=?,revision=revision+1 WHERE id=1 AND revision=?').run(JSON.stringify(c),value.revision).changes)throw new AccountError(409,'FUND_CONFLICT');
      this.audit(actor,'fund-config',JSON.stringify(c));
    })();
  }
  add(actor:string,value:Record<string,unknown>):void {
    if(value.kind !== 'expense') throw new AccountError(400,'FUND_EXPENSE_ONLY');
    const e={id:text(value.id,36),kind:value.kind,amount:value.amount,title:text(value.title,160),date:text(value.date,10),receipt:url(value.receipt)};
    if(!/^[0-9a-f-]{36}$/i.test(e.id)||!['income','expense'].includes(String(e.kind))||!Number.isSafeInteger(e.amount)||Number(e.amount)<=0||Number(e.amount)>1e9||!e.title||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date))||new Date(e.date).toISOString().slice(0,10)!==e.date)throw new AccountError(400,'FUND_INVALID');
    this.db.transaction(()=>{
      const old=this.db.prepare('SELECT * FROM fund_entries WHERE id=?').get(e.id) as FundEntry|undefined;
      if(old){if(old.kind!==e.kind||old.amount!==e.amount||old.title!==e.title||old.date!==e.date||old.receipt!==e.receipt)throw new AccountError(409,'FUND_CONFLICT');return;}
      this.db.prepare('INSERT INTO fund_entries(id,kind,amount,title,date,receipt,created) VALUES(?,?,?,?,?,?,?)').run(e.id,e.kind,e.amount,e.title,e.date,e.receipt,Date.now());
      this.audit(actor,'fund-add',e.id);
    })();
  }
  void(actor:string,id:unknown,reason:unknown):void {
    const key=text(id,80),why=text(reason,240);if(why.length<3)throw new AccountError(400,'FUND_INVALID');
    this.db.transaction(()=>{
      if(!this.db.prepare('UPDATE fund_entries SET voided=?,voidReason=? WHERE id=? AND voided=0').run(Date.now(),why,key).changes)throw new AccountError(409,'FUND_CONFLICT');
      this.audit(actor,'fund-void',JSON.stringify({id:key,reason:why}));
    })();
  }
  async resetEntries(actor: string, scope: unknown, confirmation: unknown): Promise<{ deleted: number }> {
    if (typeof scope !== 'string' || !['legacy', 'manual', 'all'].includes(scope) || confirmation !== 'XOA THU CHI') {
      throw new AccountError(400, 'FUND_RESET_CONFIRM');
    }
    // Let an in-flight import finish before deleting; it must not restore rows after reset.
    if (this.bankSync) {
      try { await this.bankSync; } catch { /* Cached rows can still be reset. */ }
    }
    const predicate = scope === 'legacy'
      ? "source='manual' AND kind='income'"
      : scope === 'manual' ? "source='manual'" : '1=1';
    const deleted = this.db.transaction(() => {
      const counts = this.db.prepare(`SELECT COUNT(*) count,
        COALESCE(SUM(CASE WHEN kind='income' AND voided=0 THEN amount ELSE 0 END),0) income,
        COALESCE(SUM(CASE WHEN kind='expense' AND voided=0 THEN amount ELSE 0 END),0) expense
        FROM fund_entries WHERE ${predicate}`).get();
      const result = this.db.prepare(`DELETE FROM fund_entries WHERE ${predicate}`).run();
      this.audit(actor, 'fund-reset', JSON.stringify({ scope, deleted: result.changes, totals: counts }));
      return Number(result.changes);
    })();
    if (scope === 'all') {
      this.lastSyncedAt = null;
      this.nextBankSync = 0;
    }
    return { deleted };
  }

  private audit(actor:string,action:string,target:string){this.db.prepare('INSERT INTO admin_audit VALUES(?,?,?,?,?)').run(randomUUID(),actor,action,target,Date.now());}
}
