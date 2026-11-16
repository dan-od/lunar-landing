// Polls GET /v1/terrain/status for a site: while terrain is being prepared it
// checks again every few seconds, so the Miss page turns from "Preparing
// terrain…" into the real map on its own. Returns null until the first reply.
import { useEffect, useState } from 'react';
import { getTerrainStatus, type TerrainStatusReply } from '../api';

const POLL_MS = 4000;

export function useTerrainStatus(siteId: string | undefined, enabled: boolean): TerrainStatusReply | null {
  const [status, setStatus] = useState<TerrainStatusReply | null>(null);

  useEffect(() => {
    if (!enabled || !siteId) {
      setStatus(null);
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    const tick = () => {
      getTerrainStatus(siteId, controller.signal)
        .then((s) => {
          if (!active) return;
          setStatus(s);
          if (s.state === 'preparing') timer = setTimeout(tick, POLL_MS);
        })
        .catch(() => {
          // A failed poll just stops; the page keeps its last state.
        });
    };
    tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      controller.abort();
    };
  }, [siteId, enabled]);

  return status;
}
