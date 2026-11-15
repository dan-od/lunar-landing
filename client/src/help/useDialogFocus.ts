// Focus handling shared by the Help panel and the tour: focus moves into the
// dialog when it opens, Escape closes it, Tab stays inside (when trapped), and
// focus goes back to the control that opened it when it closes.
import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]';

export function useDialogFocus(
  open: boolean,
  onClose: () => void,
  ref: RefObject<HTMLElement | null>,
  opts: { trap?: boolean; returnTo?: () => HTMLElement | null } = {},
): void {
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const returnTo = useRef(opts.returnTo);
  returnTo.current = opts.returnTo;

  useEffect(() => {
    if (open && !wasOpen.current) {
      opener.current = document.activeElement as HTMLElement | null;
      // The first focusable item, or the dialog itself.
      const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current;
      first?.focus();
    } else if (!open && wasOpen.current) {
      const back = returnTo.current?.() ?? opener.current;
      if (back && document.contains(back)) back.focus();
    }
    wasOpen.current = open;
  }, [open, ref]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !opts.trap) return;
      const items = ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!items || items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, ref, opts.trap]);
}

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
