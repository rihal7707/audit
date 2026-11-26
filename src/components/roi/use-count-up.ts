// src/components/roi/use-count-up.ts
'use client';

import * as React from 'react';

function subscribeReducedMotion(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
}

export function useCountUp(target: number | null, durationMs = 320): number | null {
  const reduced = useReducedMotion();
  const [animated, setAnimated] = React.useState<{ forTarget: number | null; val: number | null }>({
    forTarget: target,
    val: target,
  });
  const lastCompletedRef = React.useRef<number | null>(target);

  React.useEffect(() => {
    if (target === null || reduced) {
      lastCompletedRef.current = target;
      return;
    }
    const startVal = lastCompletedRef.current ?? 0;
    if (startVal === target) return;

    let rafId = 0;
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated({ forTarget: target, val: startVal + (target - startVal) * eased });
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        lastCompletedRef.current = target;
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs, reduced]);

  if (target === null || reduced) return target;
  return animated.forTarget === target ? animated.val : target;
}
