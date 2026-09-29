import { useState } from 'react';
import { useI18n } from '../i18n';
import { panel, primary, secondary } from '../components/ui';

/** Legacy route only: exports the old origin's draft without loading the editor engine. */
export default function EditorMoved() {
  const { locale } = useI18n();
  const vi = locale === 'vi';
  const [message, setMessage] = useState('');
  const url = import.meta.env.VITE_EDITOR_URL
    || (import.meta.env.DEV ? `${location.protocol}//${location.hostname}:5174/` : '');

  async function exportDraft(): Promise<void> {
    let db: IDBDatabase | undefined;
    try {
      db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('winterarc-editor');
        request.onupgradeneeded = () => request.transaction?.abort();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error(vi ? 'Không tìm thấy bản nháp ở địa chỉ này.' : 'No draft database at this origin.'));
        request.onblocked = () => reject(new Error(vi ? 'Hãy đóng tab editor cũ rồi thử lại.' : 'Close the old editor tab and retry.'));
      });
      const draft = await new Promise<{ document?: unknown } | undefined>((resolve, reject) => {
        const tx = db!.transaction('drafts', 'readonly');
        const request = tx.objectStore('drafts').get('current');
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
      if (!draft?.document) throw new Error(vi ? 'Chưa có bản nháp.' : 'No saved draft.');
      const href = URL.createObjectURL(new Blob([JSON.stringify(draft.document)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = href;
      link.download = 'winterarc-old-draft.map.json';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setMessage(vi ? 'Đã xuất. Mở editor mới và chọn Nhập JSON.' : 'Exported. Open the new editor and import this JSON.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      db?.close();
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <section className={`${panel} max-w-xl space-y-4`}>
        <h1 className="font-note text-3xl">{vi ? 'Xưởng xây map đã có ứng dụng riêng' : 'The map editor has moved'}</h1>
        <p>{vi
          ? 'Bản nháp cũ vẫn được giữ ở trình duyệt này. Xuất file bên dưới rồi nhập vào editor mới để tiếp tục.'
          : 'Your old draft remains in this browser. Export it below and import it into the new editor.'}</p>
        <button className={primary} onClick={() => { void exportDraft(); }}>
          {vi ? 'Xuất bản nháp cũ' : 'Export old draft'}
        </button>
        <div className="flex flex-wrap gap-3">
          {url && <a className={secondary} href={url}>{vi ? 'Mở editor mới' : 'Open new editor'}</a>}
          <a className={secondary} href="/">{vi ? 'Về game' : 'Back to game'}</a>
        </div>
        <p role="status" className="text-sm">{message}</p>
      </section>
    </main>
  );
}
