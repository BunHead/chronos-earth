import { useEffect, useRef, useState } from 'react';

/**
 * Follow `value`, but update at most once every `ms` (trailing edge) — the
 * final value always lands. The play loop changes the timeline ~60×/second;
 * the globe's heavy per-tick work (Cesium re-render, border cross-fade, marker
 * reassignment) doesn't need to run that often. Feeding it a throttled value
 * runs it ~10×/second instead: 6× less work, no visible difference.
 *
 * The playhead/readout keep the raw value, so the timeline itself stays smooth.
 */
export function useThrottledValue<T>(value: T, ms: number): T {
  const [throttled, setThrottled] = useState(value);
  const valueRef = useRef(value);
  valueRef.current = value;
  const lastRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const now = performance.now();
    const since = now - lastRef.current;
    if (since >= ms) {
      lastRef.current = now;
      setThrottled(value);
    } else if (timerRef.current === null) {
      // Schedule the trailing update at the window boundary; it reads the
      // latest value at fire time, so nothing is lost.
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        lastRef.current = performance.now();
        setThrottled(valueRef.current);
      }, ms - since);
    }
  }, [value, ms]);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  return throttled;
}
