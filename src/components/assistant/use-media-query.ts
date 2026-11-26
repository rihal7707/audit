// src/components/assistant/use-media-query.ts
'use client';

import * as React from 'react';

export function useMediaQuery(query: string, serverFallback = false): boolean {
  const subscribe = React.useCallback(
    (cb: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    [query],
  );

  const getSnapshot = React.useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return serverFallback;
    return window.matchMedia(query).matches;
  }, [query, serverFallback]);

  return React.useSyncExternalStore(subscribe, getSnapshot, () => serverFallback);
}
