// A yes/no setting kept in this browser (localStorage), e.g. "show all sites".
import { useCallback, useState } from 'react';

export function useStoredFlag(key: string, fallback: boolean): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : raw === '1';
    } catch {
      return fallback;
    }
  });
  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, next ? '1' : '0');
      } catch {
        // Storage blocked: the choice lasts for this visit only.
      }
    },
    [key],
  );
  return [value, set];
}
