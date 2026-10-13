import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { FundEntry, FundReport } from 'winterarc-profile';
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
  report(page=0):FundReport {
    page=Math.max(0,Math.min(100000,Math.floor(Number(page)||0)));
    const c=this.db.prepare('SELECT data,revision FROM fund_config WHERE id=1').get() as {data:string;revision:number};
    const visible = '1=1';
    const sum=this.db.prepare("SELECT COALESCE(SUM(CASE WHEN kind='income' THEN amount ELSE 0 END),0) income, COALESCE(SUM(CASE WHEN kind='expense' THEN amount ELSE 0 END),0) expense FROM fund_entries WHERE voided=0").get() as {income:number;expense:number};
    return {config:{...JSON.parse(c.data),revision:c.revision},entries:this.db.prepare(`SELECT * FROM fund_entries WHERE ${visible} ORDER BY date DESC,transactionAt DESC,created DESC,id LIMIT 25 OFFSET ?`).all(page*25) as FundEntry[],total:(this.db.prepare(`SELECT COUNT(*) n FROM fund_entries WHERE ${visible}`).get() as {n:number}).n,page,...sum,balance:sum.income-sum.expense};
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
    const e={id:text(value.id,36),kind:value.kind,amount:value.amount,title:text(value.title,160),date:text(value.date,10),receipt:url(value.receipt),senderName:text(value.senderName ?? '',100),message:text(value.message ?? '',400)};
    if(!/^[0-9a-f-]{36}$/i.test(e.id)||!['income','expense'].includes(String(e.kind))||!Number.isSafeInteger(e.amount)||Number(e.amount)<=0||Number(e.amount)>1e9||!e.title||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date))||new Date(e.date).toISOString().slice(0,10)!==e.date)throw new AccountError(400,'FUND_INVALID');
    this.db.transaction(()=>{
      const old=this.db.prepare('SELECT * FROM fund_entries WHERE id=?').get(e.id) as FundEntry|undefined;
      if(old){if(old.kind!==e.kind||old.amount!==e.amount||old.title!==e.title||old.date!==e.date||old.receipt!==e.receipt||old.source!=='manual'||(old.senderName||'')!==e.senderName||(old.message||'')!==e.message)throw new AccountError(409,'FUND_CONFLICT');return;}
      this.db.prepare(`INSERT INTO fund_entries(id,kind,amount,title,date,receipt,created,senderName,message,source) VALUES(?,?,?,?,?,?,?,?,?,'manual')`).run(e.id,e.kind,e.amount,e.title,e.date,e.receipt,Date.now(),e.senderName,e.message);
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
    if (typeof scope !== 'string' || !['income', 'manual', 'all'].includes(scope) || confirmation !== 'XOA THU CHI') {
      throw new AccountError(400, 'FUND_RESET_CONFIRM');
    }
    const predicate = scope === 'income'
      ? "kind='income'"
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
    return { deleted };
  }

  private audit(actor:string,action:string,target:string){this.db.prepare('INSERT INTO admin_audit VALUES(?,?,?,?,?)').run(randomUUID(),actor,action,target,Date.now());}
}
