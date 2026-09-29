import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useI18n } from '../i18n';
export const panel = 'paper-sheet p-5 sm:p-7';
export const primary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border-2 border-ink bg-berry px-5 py-3 text-sm font-bold text-paper shadow-[3px_3px_0_var(--color-ink)] transition-[transform,box-shadow] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fir disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none';
export const secondary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border-2 border-ink/80 bg-paper px-4 py-2.5 text-sm font-semibold text-ink shadow-[2px_2px_0_var(--color-ink)] transition-colors hover:bg-paper-dark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fir disabled:cursor-not-allowed disabled:opacity-40';
export const field =
  'w-full rounded-sm border border-ink/50 border-b-2 bg-paper-light px-3 py-3 text-sm text-ink outline-none placeholder:text-ink/50 focus:border-fir focus:ring-2 focus:ring-fir/20';
export const eyebrow = 'text-xs font-bold tracking-[0.14em] text-fir';

/** Decorative holly drawn as SVG, no texture downloads or game-engine resources. */
export function PaperHolly() {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 44" className="h-9 w-14 shrink-0" fill="none">
      <path
        d="M30 29C9 33 17 16 5 13C18 15 16 1 25 8C26 0 39 8 35 24Z"
        fill="#35634c"
        stroke="#303b38"
        strokeWidth="1.5"
      />
      <path
        d="M34 27C37 9 47 18 56 8C53 20 64 22 55 27C63 32 47 40 38 31Z"
        fill="#567849"
        stroke="#303b38"
        strokeWidth="1.5"
      />
      <path d="M20 13L34 30L50 22" stroke="#e5dfb9" strokeWidth="1.5" />
      <circle cx="29" cy="30" r="5" fill="#ad3c3e" stroke="#303b38" />
      <circle cx="38" cy="29" r="5" fill="#c24e47" stroke="#303b38" />
      <circle cx="34" cy="37" r="5" fill="#ad3c3e" stroke="#303b38" />
    </svg>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null),
    id = useId();
  const { t } = useI18n();
  useEffect(() => {
    const previous = document.activeElement,
      node = ref.current;
    const controls = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input,select,[tabindex="0"]',
        ) ?? [],
      );
    controls()[0]?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const items = controls(),
        first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => {
      document.removeEventListener('keydown', handler, true);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-fir/35 p-4 "
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`${panel} relative my-6 max-h-[85dvh] w-full max-w-xl overflow-y-auto`}
      >
        <button
          className={`${secondary} absolute right-4 top-4 px-3 py-1 text-xl`}
          onClick={onClose}
          aria-label={t('common.close')}
        >
          ×
        </button>
        <h2 id={id} className="font-note mb-6 pr-10 text-2xl font-bold tracking-tight">
          {title}
        </h2>
        {children}
      </section>
    </div>
  );
}
