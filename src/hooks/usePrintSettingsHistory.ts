import { useState, useCallback, useRef } from "react";
import type { PrintSettings } from "./usePrintSettings";

const MAX_HISTORY = 30;

export const usePrintSettingsHistory = (
  currentSettings: PrintSettings,
  setSettings: (settings: PrintSettings) => void
) => {
  const [past, setPast] = useState<PrintSettings[]>([]);
  const [future, setFuture] = useState<PrintSettings[]>([]);
  const skipRef = useRef(false);

  const pushHistory = useCallback((prev: PrintSettings) => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    setPast(p => [...p.slice(-MAX_HISTORY), prev]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast(p => p.slice(0, -1));
    setFuture(f => [currentSettings, ...f]);
    skipRef.current = true;
    setSettings(previous);
  }, [past, currentSettings, setSettings]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(f => f.slice(1));
    setPast(p => [...p, currentSettings]);
    skipRef.current = true;
    setSettings(next);
  }, [future, currentSettings, setSettings]);

  return {
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    pushHistory,
  };
};
