"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ intervalMs = 60000, enabled = true }: { intervalMs?: number; enabled?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    let timer: number | undefined;

    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const start = () => {
      stop();
      if (document.visibilityState !== "visible") return;
      timer = window.setInterval(() => {
        if (document.visibilityState === "visible") router.refresh();
      }, intervalMs);
    };

    start();
    document.addEventListener("visibilitychange", start);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", start);
    };
  }, [router, intervalMs, enabled]);

  return null;
}
