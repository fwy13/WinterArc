import { useEffect, useRef, useState } from 'react';
import type { FundConfig, FundReport } from 'winterarc-profile';
import { api } from '../account/service';
import './fund.css';
import './bank-fund.css';
const money=(n:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(n);
const blank:FundConfig={bank:'',accountNumber:'',accountName:'',paymentUrl:'',note:'',goal:0,revision:0};
export default function FundPanel({admin=false,onError}:{admin?:boolean;onError?:(e:unknown)=>void}) {
  const [data,setData]=useState<FundReport|null>(null),[config,setConfig]=useState(blank),[page,setPage]=useState(0),[refresh,setRefresh]=useState(0);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState('');
  const [kind,setKind]=useState<'income'|'expense'>('income'),[senderName,setSenderName]=useState(''),[message,setMessage]=useState('');
  const [amount,setAmount]=useState(''),[title,setTitle]=useState(''),[receipt,setReceipt]=useState('');
  const [date,setDate]=useState(()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10));
  const [voidId,setVoidId]=useState(''),[voidReason,setVoidReason]=useState('');
  const requestId=useRef('');
  const [resetScope,setResetScope]=useState('income'),[resetConfirm,setResetConfirm]=useState('');
  useEffect(()=>{let active=true;void api<FundReport>(`${admin ? '/admin/fund' : '/fund'}?page=${page}`).then(d=>{if(active){setData(d);setConfig(d.config);setError('');}}).catch(()=>{if(active)setError('Không tải được thu chi. Hãy thử lại.');});return()=>{active=false;};},[page,refresh,admin]);
  useEffect(()=>{if(admin)return;const timer=setInterval(()=>setRefresh(n=>n+1),30000);return()=>clearInterval(timer);},[admin]);
  const run=async(action:()=>Promise<void|string>)=>{if(busy)return;setBusy(true);setError('');setSaved('');try{const message=await action();setSaved(typeof message==='string'?message:'Đã lưu.');setRefresh(n=>n+1);}catch(e){onError?.(e);setError(e instanceof Error && e.message==='FUND_CONFLICT'?'Dữ liệu đã thay đổi. Tải lại trước khi lưu.':'Không lưu được. Kiểm tra số tiền, ngày và đường dẫn HTTPS.');}finally{setBusy(false);}};
  return <section className="fund-panel">
    <div className="fund-heading"><div><small>CAN THO ITCLUB</small><h2>{admin?'Quản lý quỹ':'Đồng hành cùng Winter Arc'}</h2></div><button type="button" onClick={()=>setRefresh(n=>n+1)} disabled={busy}>Tải lại</button></div>
    {error && <p role="alert" className="fund-error">{error}</p>}{saved && <p role="status">{saved}</p>}
    {!data && !error && <p role="status">Đang tải…</p>}
    {data && <>
      <div className="fund-totals">{[['Tổng thu',data.income],['Tổng chi',data.expense],['Số dư',data.balance]].map(([label,n])=><div key={label}><span>{label}</span><strong>{money(Number(n))}</strong></div>)}</div>
      {!admin && <div className="fund-donate">
        {data.config.note && <p>{data.config.note}</p>}
        {data.config.accountNumber && <dl><dt>Ngân hàng</dt><dd>{data.config.bank}</dd><dt>Số tài khoản</dt><dd className="select-all">{data.config.accountNumber}</dd><dt>Chủ tài khoản</dt><dd>{data.config.accountName}</dd></dl>}
        {data.config.paymentUrl && <a href={data.config.paymentUrl} target="_blank" rel="noopener noreferrer">Ủng hộ CLB ↗</a>}
        {!data.config.accountNumber && !data.config.paymentUrl && <p>CLB chưa công bố thông tin nhận ủng hộ.</p>}
        {data.config.goal>0 && <div><p>Mục tiêu: {money(data.config.goal)}</p><progress value={Math.min(data.income,data.config.goal)} max={data.config.goal}/></div>}
      </div>}
      {admin && <div className="fund-forms">
        <form onSubmit={e=>{e.preventDefault();void run(async()=>{await api('/admin/fund/config',config);});}}><fieldset disabled={busy}><legend>Thông tin donate công khai</legend>
          {([['bank','Ngân hàng'],['accountNumber','Số tài khoản'],['accountName','Tên chủ tài khoản'],['paymentUrl','Link donate (HTTPS)'],['note','Lời nhắn']] as const).map(([key,label])=><label key={key}>{label}<input value={config[key]} maxLength={key==='note'?400:key==='paymentUrl'?500:80} onChange={e=>setConfig({...config,[key]:e.target.value})}/></label>)}
          <label>Mục tiêu thu (VND, 0 = ẩn)<input type="number" min="0" max="1000000000000" step="1" required value={config.goal} onChange={e=>setConfig({...config,goal:e.target.valueAsNumber})}/></label><button>Lưu thông tin</button></fieldset></form>
        <form onSubmit={e=>{e.preventDefault();void run(async()=>{requestId.current ||= crypto.randomUUID();await api('/admin/fund/entry',{id:requestId.current,kind,amount:Number(amount),title,date,receipt,senderName:kind==='income'?senderName:'',message:kind==='income'?message:''});requestId.current='';setAmount('');setTitle('');setReceipt('');setSenderName('');setMessage('');setPage(0);});}}><fieldset disabled={busy}><legend>Ghi khoản thu / chi</legend>
          <label>Loại khoản<select value={kind} onChange={e=>{setKind(e.target.value as 'income'|'expense');requestId.current='';}}><option value="income">Thu / Ủng hộ</option><option value="expense">Chi</option></select></label>
          {kind==='income' && <><label>Tên người ủng hộ<input maxLength={100} value={senderName} onChange={e=>setSenderName(e.target.value)}/></label><label>Lời nhắn công khai<input maxLength={400} value={message} onChange={e=>setMessage(e.target.value)}/></label></>}
          <label>Số tiền VND<input type="number" min="1" max="1000000000" step="1" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
          <label>Nội dung công khai<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label>
          <label>Ngày<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
          <label>Link minh chứng công khai (HTTPS)<input type="url" maxLength={500} value={receipt} onChange={e=>setReceipt(e.target.value)}/></label><button>Ghi sổ</button></fieldset></form>
      </div>}
      {admin && <details className="fund-reset">
        <summary>Dọn dữ liệu thu chi thử nghiệm</summary>
        <form onSubmit={event => {
          event.preventDefault();
          void run(async () => {
            const result = await api<{deleted:number}>('/admin/fund/reset', {scope:resetScope,confirmation:resetConfirm});
            setResetConfirm(''); setPage(0); setVoidId(''); requestId.current='';
            return `Đã xóa ${result.deleted} khoản.`;
          });
        }}><fieldset disabled={busy}>
          <label>Phạm vi xóa<select value={resetScope} onChange={event=>{setResetScope(event.target.value);setResetConfirm('');}}>
            <option value="income">Toàn bộ khoản thu / ủng hộ</option>
            <option value="manual">Toàn bộ khoản nhập tay (thu và chi)</option>
            <option value="all">Toàn bộ sổ thu chi</option>
          </select></label>
          <p>Xóa vĩnh viễn các khoản thuộc phạm vi đã chọn, gồm cả khoản đã hủy. Giữ thông tin donate, tài khoản người chơi, token và nhật ký quản trị.</p>
          <label>Nhập XOA THU CHI để xác nhận<input value={resetConfirm} onChange={event=>setResetConfirm(event.target.value)} autoComplete="off" spellCheck={false} maxLength={30} required /></label>
          <button type="submit" disabled={busy || resetConfirm!=='XOA THU CHI'}>Xóa dữ liệu đã chọn</button>
        </fieldset></form>
      </details>}
      <h3>Thu chi công khai</h3><p className="fund-caption">CLB ghi nhận các khoản thu và chi. Khoản hủy vẫn hiển thị lịch sử và không tính vào số dư.</p>
      <div className="fund-table"><table><thead><tr><th>Ngày / Nội dung</th><th>Số tiền</th><th>Minh chứng</th>{admin && <th>Thao tác</th>}</tr></thead><tbody>{data.entries.map(e=><tr key={e.id} className={e.voided?'is-void':''}><td><small>{e.date}</small><strong>{e.kind==='income' ? (e.senderName || e.title || 'Người ủng hộ') : e.title}</strong>{e.kind==='income' && <span className="fund-donor-message">{e.message || 'Không có lời nhắn'}</span>}{!!e.voided && <em>Đã hủy: {e.voidReason}</em>}</td><td className={e.kind==='income'?'fund-income':'fund-expense'}>{e.kind==='income'?'+':'−'}{money(e.amount)}</td><td>{e.receipt?<a target="_blank" rel="noopener noreferrer" href={e.receipt}>Xem ↗</a>:'—'}</td>{admin && <td>{!e.voided && <button disabled={busy} onClick={()=>{setVoidId(e.id);setVoidReason('');}}>Hủy</button>}</td>}</tr>)}</tbody></table></div>
      {!data.entries.length && <p>Chưa có khoản thu chi.</p>}
      {admin && voidId && <form className="fund-void" onSubmit={e=>{e.preventDefault();void run(async()=>{await api('/admin/fund/void',{id:voidId,reason:voidReason});setVoidId('');});}}><label>Lý do hủy công khai<input required minLength={3} maxLength={240} value={voidReason} onChange={e=>setVoidReason(e.target.value)}/></label><button disabled={busy}>Xác nhận hủy khoản</button><button type="button" onClick={()=>setVoidId('')}>Quay lại</button></form>}
      <div className="fund-pages"><button disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}>←</button><span>{page+1} / {Math.max(1,Math.ceil(data.total/25))}</span><button disabled={busy||(page+1)*25>=data.total} onClick={()=>setPage(p=>p+1)}>→</button></div>
    </>}
  </section>;
}
