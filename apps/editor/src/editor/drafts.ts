import type { MapDocument } from 'winterarc-world';

export interface Draft { document: MapDocument; savedAt: number }
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('winterarc-editor', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close the other editor tab and retry.'));
    request.onsuccess = () => resolve(request.result);
  });
}
export async function writeDraft(draft: Draft): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      tx.objectStore('drafts').put(draft, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Draft transaction failed'));
    });
  } finally { db.close(); }
}
export async function readDraft(): Promise<Draft | undefined> {
  const db = await open();
  try {
    return await new Promise<Draft | undefined>((resolve, reject) => {
      const tx = db.transaction('drafts', 'readonly'), request = tx.objectStore('drafts').get('current');
      tx.oncomplete = () => resolve(request.result as Draft | undefined);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Draft read failed'));
    });
  } finally { db.close(); }
}
export function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
