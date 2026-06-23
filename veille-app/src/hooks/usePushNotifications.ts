"use client";

/**
 * Hook `usePushNotifications` (Sprint Push V1 — C4).
 *
 * Pilote le cycle de vie d'un abonnement push côté browser :
 *   - probe le support + la permission au mount ;
 *   - expose `enable()` / `disable()` ;
 *   - synchronise l'état avec `/api/push/subscribe` (POST + DELETE) ;
 *   - rapatrie un statut discriminant pour piloter l'UI.
 *
 * IMPORTANT — pré-requis runtime :
 *   - Service worker enregistré (Serwist en prod). En dev `next dev`,
 *     Serwist est désactivé (cf. next.config.ts) → l'état tombera sur
 *     `unsupported`. Pour la recette navigateur, utiliser `npm run build
 *     && npm start`.
 *   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` non vide.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { postSubscribe, postUnsubscribe } from "@/lib/push/client-api";
import {
  buildSubscribePayload,
  detectPlatform,
  probePushSupport,
  urlBase64ToUint8Array,
  type PushPlatform,
} from "@/lib/push/client-utils";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushNotificationsStatus =
  | "loading"
  | "unsupported"
  | "insecure"
  | "vapid-missing"
  | "default"
  | "denied"
  | "subscribed";

export type PushNotificationsState = {
  status: PushNotificationsStatus;
  platform: PushPlatform;
  endpoint: string | null;
};

export type UsePushNotificationsReturn = {
  state: PushNotificationsState;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  error: string | null;
  busy: boolean;
};

/** Évite les setState après unmount (probe asynchrone au mount). */
function useMounted() {
  const ref = useRef(true);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}

function currentPlatform(): PushPlatform {
  if (typeof navigator === "undefined") return "other";
  const base = detectPlatform(navigator.userAgent);
  // iPadOS 13+ s'identifie comme Mac : on bascule en "ios" si touch.
  if (base === "desktop" && navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.userAgent)) {
    return "ios";
  }
  return base;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const mounted = useMounted();
  const [state, setState] = useState<PushNotificationsState>({
    status: "loading",
    platform: "other",
    endpoint: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      const platform = currentPlatform();
      const verdict = probePushSupport({
        hasPushManager:
          typeof window !== "undefined" && "PushManager" in window,
        hasNotification:
          typeof window !== "undefined" && "Notification" in window,
        hasServiceWorker:
          typeof navigator !== "undefined" && "serviceWorker" in navigator,
        isSecureContext:
          typeof window !== "undefined" && window.isSecureContext === true,
        hasVapidKey: VAPID_PUBLIC_KEY.length > 0,
      });

      if (verdict.status !== "supported") {
        if (!cancelled && mounted.current) {
          setState({ status: verdict.status, platform, endpoint: null });
        }
        return;
      }

      const perm = Notification.permission as
        | "default"
        | "granted"
        | "denied";

      if (perm === "denied") {
        if (!cancelled && mounted.current) {
          setState({ status: "denied", platform, endpoint: null });
        }
        return;
      }

      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (perm === "granted" && sub) {
          if (!cancelled && mounted.current) {
            setState({
              status: "subscribed",
              platform,
              endpoint: sub.endpoint,
            });
          }
          return;
        }
      } catch {
        // Probe non bloquante — on retombe sur `default`.
      }
      if (!cancelled && mounted.current) {
        setState({ status: "default", platform, endpoint: null });
      }
    }
    probe();
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  const enable = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const platform = currentPlatform();

      const perm = await Notification.requestPermission();
      if (perm === "denied") {
        if (mounted.current) {
          setState({ status: "denied", platform, endpoint: null });
        }
        setError("Permission refusée");
        return;
      }
      if (perm !== "granted") {
        setError("Permission non accordée");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      // Cast BufferSource — TS 5.7 distingue Uint8Array<ArrayBuffer> et
      // Uint8Array<ArrayBufferLike>. La DOM lib attend le premier ;
      // notre helper renvoie le second (compatible runtime).
      const applicationServerKey = urlBase64ToUint8Array(
        VAPID_PUBLIC_KEY,
      ) as unknown as BufferSource;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const payload = buildSubscribePayload(
        sub.toJSON() as Parameters<typeof buildSubscribePayload>[0],
        { userAgent: navigator.userAgent, platform },
      );
      if (!payload) {
        setError("Souscription invalide (clés manquantes).");
        await sub.unsubscribe().catch(() => {});
        return;
      }

      const res = await postSubscribe(payload);
      if (!res.ok) {
        if (res.reason === "disabled") {
          setError(
            "Notifications push désactivées côté serveur (ENABLE_PUSH=false).",
          );
        } else if (res.reason === "auth") {
          setError("Session expirée — reconnectez-vous.");
        } else {
          setError("Échec d'enregistrement côté serveur.");
        }
        // Pas de subscription orpheline côté browser si le serveur refuse.
        await sub.unsubscribe().catch(() => {});
        return;
      }

      if (mounted.current) {
        setState({
          status: "subscribed",
          platform,
          endpoint: payload.endpoint,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [mounted]);

  const disable = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const platform = currentPlatform();
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      await sub?.unsubscribe().catch(() => {});
      if (endpoint) {
        await postUnsubscribe({ endpoint }).catch(() => ({ ok: false }));
      }
      if (mounted.current) {
        setState({ status: "default", platform, endpoint: null });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [mounted]);

  return { state, enable, disable, error, busy };
}
