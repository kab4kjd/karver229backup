import { useEffect, useState, useRef } from "react";

/**
 * Enforce single-tab usage. When another tab of this app is opened,
 * the older tab locks itself and displays a message.
 * The newest tab wins.
 */
export const useSingleTab = () => {
  const [locked, setLocked] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const myIdRef = useRef<string>(Math.random().toString(36).slice(2) + Date.now());

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("karaoke-app-tabs");
    channelRef.current = channel;
    const myId = myIdRef.current;

    // Announce presence — any older tab receiving this will lock itself
    channel.postMessage({ type: "hello", id: myId, ts: Date.now() });

    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || data.id === myId) return;
      if (data.type === "hello") {
        // A newer tab arrived → lock this (older) one
        setLocked(true);
      }
    };
    channel.addEventListener("message", onMessage);

    return () => {
      channel.removeEventListener("message", onMessage);
      channel.close();
      channelRef.current = null;
    };
  }, []);

  return { locked };
};
