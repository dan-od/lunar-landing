// The one dropdown. Every dropdown in the app uses this, so all of them follow
// rule B: no browser arrow, our own square chevron 12 px from the right edge,
// vertically centred, in the muted colour, with matching right padding and a
// capped width. A test fails if a plain <select> appears anywhere else.
import { forwardRef, type SelectHTMLAttributes } from 'react';

type Width = 'place' | 'short' | 'full';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  /** place: up to 420 px; short (date parts, hour, small choices): up to 220 px; full: the field's width. */
  width?: Width;
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { width = 'full', className = '', children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={`sel sel-${width} ${className}`.trim()} {...rest}>
      {children}
    </select>
  );
});
