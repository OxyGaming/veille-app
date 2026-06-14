"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 60_000;

/**
 * Refresh intelligent du Server Component /today.
 *
 * Stratégie sans WebSocket, sans SWR/React Query :
 *  - `router.refresh()` re-déclenche le rendu serveur (SSR + cache 30 s
 *    de l'agrégateur restent en place côté Next.js).
 *  - Aucune navigation côté URL, aucun flash : React diff le DOM.
 *
 * Cycle de vie :
 *  - mount + onglet visible    → refresh implicite (SSR initial) + timer 60 s
 *  - onglet visible → caché    → arrêt du timer (zéro polling tab cachée)
 *  - onglet caché → visible    → refresh immédiat + redémarrage du timer
 *  - retour réseau (`online`)  → refresh immédiat
 *  - unmount                   → cleanup complet (timer + 2 listeners)
 *
 * Le composant ne rend aucun DOM.
 */
export function TodayAutoRefresh() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stopTimer = () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    const startTimer = () => {
      stopTimer();
      timerRef.current = setInterval(() => router.refresh(), INTERVAL_MS);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        startTimer();
      } else {
        stopTimer();
      }
    };
    const onOnline = () => router.refresh();

    if (document.visibilityState === "visible") startTimer();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);

    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  return null;
}
