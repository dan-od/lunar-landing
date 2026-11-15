// A small "?" beside a term. Pressing it shows a one-sentence definition next to
// it; pressing it again, Escape, or moving focus away hides it, and focus stays
// on the "?" button. The definition is also the button's description, so a
// screen reader hears it without opening anything.
import { useEffect, useId, useRef, useState } from 'react';
import { TERMS, type TermId } from './content';

export function Term({ id }: { id: TermId }) {
  const term = TERMS[id];
  const [open, setOpen] = useState(false);
  const uid = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <span
      ref={wrap}
      className="term"
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        className="term-q"
        aria-expanded={open}
        aria-describedby={`${uid}-def`}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">?</span>
        <span className="sr">What does {term.word.toLowerCase()} mean?</span>
      </button>
      <span id={`${uid}-def`} role="note" className={open ? 'term-pop' : 'sr'}>
        <b>{term.word}:</b> {term.text}
      </span>
    </span>
  );
}
