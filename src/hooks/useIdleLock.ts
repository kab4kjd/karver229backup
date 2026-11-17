import { useEffect, useRef, useState, useCallback } from "react";

interface Opts {
  enabled: boolean;
  timeoutMinutes: number;
}

export function useIdleLock({ enabled, timeoutMinutes }: Opts) {
  const [locked, setLocked] = useState(false);
  const timerRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleLock = useCallback(() => {
    clearTimer();
    if (!enabled || locked) return;
    const ms = Math.max(10, timeoutMinutes * 60) * 1000;
    timerRef.current = window.setTimeout(() => setLocked(true), ms);
  }, [enabled, timeoutMinutes, locked]);

  const onActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (!locked) scheduleLock();
  }, [locked, scheduleLock]);

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      setLocked(false);
      return;
    }
    const events: (keyof WindowEventMap)[] = [
      "mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel",
    ];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    scheduleLock();
    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      clearTimer();
    };
  }, [enabled, onActivity, scheduleLock]);

  const unlock = () => {
    setLocked(false);
    lastActivityRef.current = Date.now();
    scheduleLock();
  };

  const lockNow = () => setLocked(true);

  return { locked, unlock, lockNow };
}
