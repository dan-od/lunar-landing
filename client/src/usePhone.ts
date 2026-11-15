// Phone layout: under 600 px wide the Console, Watch and Compare switch to the
// phone design. Wider screens keep the desktop (and stacked tablet) layout.
import { useEffect, useState } from 'react';

export const PHONE_QUERY = '(max-width: 599px)';

export function isPhone(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
}

export function usePhone(): boolean {
  const [phone, setPhone] = useState(isPhone);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(PHONE_QUERY);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}
