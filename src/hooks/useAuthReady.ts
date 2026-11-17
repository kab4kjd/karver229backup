import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cachedReady = false;
let cachedHasSession = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

let initialized = false;
function init() {
  if (initialized) return;
  initialized = true;

  supabase.auth.getSession().then(({ data: { session } }) => {
    cachedHasSession = !!session;
    cachedReady = true;
    notify();
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    cachedHasSession = !!session;
    cachedReady = true;
    notify();
  });
}

/**
 * Returns whether the Supabase auth session has been restored from storage.
 * Use to gate authenticated queries so they don't run before auth is ready
 * (which would cause RLS to block them on first page load).
 */
export function useAuthReady() {
  init();
  const [, setTick] = useState(0);

  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  return { isReady: cachedReady, hasSession: cachedHasSession };
}