import { useEffect, useState } from 'react';
import type { FundEntry, FundReport } from 'winterarc-profile';
import { api } from '../account/service';
import { CLUB } from '../config/club';
import './credits.css';
import './bank-fund.css';

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
const dateLabel = (value: string) => value.split('-').reverse().join('/');

export default function CreditsPage() {
  const [report, setReport] = useState<FundReport | null>(null);
  const [entries, setEntries] = useState<FundEntry[]>([]);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transfer, setTransfer] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void api<FundReport>(`/fund?page=${page}`)
      .then((data) => {
        if (!active) return;
        setReport(data);
        setEntries((previous) =>
          page === 0
            ? data.entries
            : [
                ...new Map(
                  [...previous, ...data.entries].map((entry) => [entry.id, entry]),
                ).values(),
              ],
        );
      })
      .catch(() => {
        if (active) setError('Chưa tải được thu chi. Bạn thử lại nhé.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, revision]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Đã sao chép.');
    } catch {
      setMessage('Chưa sao chép được. Bạn có thể chọn và sao chép trực tiếp.');
    }
  };
  const config = report?.config;
  return (
    <main className="support-page">
      <div className="support-container">
        <nav className="support-nav" aria-label="Điều hướng">
          <a href="/">← Quay về</a>
        </nav>
        <div className="support-layout">
          <aside className="support-intro">
            <div className="support-title">
              <span aria-hidden="true">♥</span>
              <h1>Đồng hành cùng CLB</h1>
            </div>
            <p className="support-description">
              Cảm ơn bạn đã cùng {CLUB.name} giữ Winter Arc hoạt động. Mọi khoản ủng hộ và chi phí
              đều được ghi lại tại đây.
            </p>
            <button
              className="support-transfer"
              type="button"
              aria-expanded={transfer}
              aria-controls="bank-details"
              onClick={() => setTransfer((value) => !value)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <path d="M3 10h18L12 4 3 10ZM5 20h14M7 12v6m5-6v6m5-6v6" />
              </svg>
              Chuyển khoản ngân hàng <span aria-hidden="true">{transfer ? '−' : '+'}</span>
            </button>
            {transfer && (
              <section id="bank-details" className="support-bank">
                {!report ? (
                  <p>{loading ? 'Đang tải thông tin…' : 'Chưa tải được thông tin nhận ủng hộ.'}</p>
                ) : config?.accountNumber ? (
                  <>
                    <span>{config.bank}</span>
                    <strong className="support-account">{config.accountNumber}</strong>
                    <span>{config.accountName}</span>
                    <img
                      src="https://img.vietqr.io/image/MB-130907240407-print.png"
                      alt="Mã QR chuyển khoản"
                    />
                    <button type="button" onClick={() => void copy(config.accountNumber)}>
                      Sao chép số tài khoản
                    </button>
                  </>
                ) : (
                  <p>CLB chưa công bố tài khoản nhận ủng hộ.</p>
                )}
                {config?.paymentUrl && (
                  <a href={config.paymentUrl} target="_blank" rel="noopener noreferrer">
                    Mở trang donate ↗
                  </a>
                )}
              </section>
            )}
            <section className="support-purpose">
              <h2>Khoản ủng hộ được dùng vào đâu?</h2>
              <p>
                {config?.note ||
                  'Duy trì máy chủ và phát triển Winter Arc. Chi tiết từng khoản đã chi được cập nhật trong bảng thu chi.'}
              </p>
              {!!config?.goal && (
                <div className="support-goal">
                  <span>Mục tiêu: {money(config.goal)} ₫</span>
                  <progress
                    aria-label="Tiến độ ủng hộ"
                    value={Math.min(report?.income || 0, config.goal)}
                    max={config.goal}
                  />
                </div>
              )}
            </section>
            <footer className="support-credit">
              <small>THỰC HIỆN BỞI</small>
              <strong>{CLUB.name}</strong>
              <div>
                <a href={CLUB.facebook} target="_blank" rel="noopener noreferrer">
                  Facebook ↗
                </a>
                <a href={CLUB.github} target="_blank" rel="noopener noreferrer">
                  GitHub ↗
                </a>
                <a href={`mailto:${CLUB.email}`}>Email</a>
              </div>
            </footer>
            <p className="support-message" role="status">
              {message}
            </p>
          </aside>
          <section className="support-finance" aria-label="Thu chi công khai">
            <div className="support-summary">
              {(
                [
                  ['Tổng ủng hộ', report?.income, 'income'],
                  ['Tổng chi', report?.expense, 'expense'],
                  ['Số dư', report?.balance, 'balance'],
                ] as const
              ).map(([label, amount, kind]) => (
                <div key={kind}>
                  <h2>{label}</h2>
                  <strong className={`support-${kind}`}>
                    {amount === undefined ? '—' : `${money(amount)} ₫`}
                  </strong>
                </div>
              ))}
            </div>
            <div className="support-sync" role="status">
              {report?.bankSync?.status === 'error' &&
                'Chưa đồng bộ được ngân hàng. Đang hiển thị dữ liệu đã lưu.'}
              {report?.bankSync?.status === 'not_configured' && 'Chưa kết nối API ngân hàng.'}
              {!!report?.bankSync?.lastSyncedAt && (
                <span>
                  Cập nhật ngân hàng:{' '}
                  {new Date(report.bankSync.lastSyncedAt).toLocaleString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                  })}
                </span>
              )}
            </div>
            <div className="support-ledger">
              <div className="support-table-scroll">
                <table>
                  <caption className="support-sr-only">
                    Lịch sử ủng hộ và chi phí của CLB, đơn vị VND
                  </caption>
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Người gửi / Nội dung</th>
                      <th>Tham chiếu</th>
                      <th>Thu</th>
                      <th>Chi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className={entry.voided ? 'support-voided' : ''}>
                        <td>
                          <time dateTime={entry.date}>{dateLabel(entry.date)}</time>
                        </td>
                        <td className="support-entry-title">
                          {entry.kind === 'income' && entry.source === 'bank' ? (
                            <>
                              <strong>{entry.senderName || 'Người ủng hộ'}</strong>
                              <p className="support-donor-message">
                                {entry.message || 'Không có lời nhắn'}
                              </p>
                            </>
                          ) : (
                            entry.title
                          )}
                          {!!entry.voided && <small>Đã hủy: {entry.voidReason}</small>}
                        </td>
                        <td>
                          <div className="support-reference">
                            <span title={entry.reference || entry.id}>
                              {(entry.reference || entry.id).slice(0, 8)}…
                            </span>
                            <button
                              type="button"
                              aria-label={`Sao chép mã: ${entry.title}`}
                              onClick={() => void copy(entry.reference || entry.id)}
                            >
                              Copy
                            </button>
                          </div>
                          {entry.receipt && (
                            <a
                              className="support-receipt"
                              href={entry.receipt}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Minh chứng ↗
                            </a>
                          )}
                        </td>
                        <td className="support-income">
                          {entry.kind === 'income' ? `+${money(entry.amount)} ₫` : '—'}
                        </td>
                        <td className="support-expense">
                          {entry.kind === 'expense' ? `−${money(entry.amount)} ₫` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!entries.length && !loading && !error && (
                <p className="support-empty">Chưa có khoản thu chi.</p>
              )}
              {loading && (
                <p className="support-empty" role="status">
                  Đang tải…
                </p>
              )}
              {error && (
                <div className="support-error" role="alert">
                  <p>{error}</p>
                  <button type="button" onClick={() => setRevision((value) => value + 1)}>
                    Thử lại
                  </button>
                </div>
              )}
              <div className="support-ledger-footer">
                {!error && report && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      if ((page + 1) * 25 < report.total) setPage((value) => value + 1);
                      else {
                        setPage(0);
                        setRevision((value) => value + 1);
                      }
                    }}
                  >
                    {(page + 1) * 25 < report.total ? '⌄  Xem thêm' : '↻  Cập nhật'}
                  </button>
                )}
                {report && (
                  <small>
                    Đang hiển thị {entries.length} / {report.total} khoản
                  </small>
                )}
              </div>
            </div>
            <p className="support-note">
              Tiền vào từ ngân hàng; tiền chi do CLB ghi nhận. Số tiền tính bằng VND. Khoản đã hủy
              được giữ để đối chiếu và không tính vào số dư.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
