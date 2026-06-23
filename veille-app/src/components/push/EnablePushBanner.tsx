"use client";

/**
 * Bannière d'activation des notifications push (Sprint Push V1 — C4).
 *
 * Pure UI : toute la logique est dans `usePushNotifications`. Chaque
 * statut renvoyé par le hook a sa propre branche d'affichage — pas de
 * fallback générique pour éviter qu'un nouvel état échappe au design.
 */

import { usePushNotifications } from "@/hooks/usePushNotifications";

const CARD =
  "rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm";

export function EnablePushBanner() {
  const { state, enable, disable, error, busy } = usePushNotifications();

  // Tant que le probe initial n'a pas fini, on n'affiche rien (évite un
  // flash "Activer" qui basculerait aussitôt sur "Activées").
  if (state.status === "loading") return null;

  return (
    <section className={CARD} aria-live="polite">
      <h2 className="font-semibold text-slate-900">
        Notifications push sur cet appareil
      </h2>
      <div className="mt-2 space-y-2">
        {state.status === "unsupported" && (
          <>
            <p>Les notifications push ne sont pas supportées sur ce navigateur.</p>
            {state.platform === "ios" && (
              <p className="text-slate-600">
                Sur iPhone, les notifications push nécessitent l&apos;installation
                de l&apos;application sur l&apos;écran d&apos;accueil
                (Safari ≥ iOS 16.4).
              </p>
            )}
          </>
        )}

        {state.status === "insecure" && (
          <p>Les notifications push nécessitent HTTPS.</p>
        )}

        {state.status === "vapid-missing" && (
          <p>
            Configuration push manquante côté serveur — contactez votre
            administrateur (NEXT_PUBLIC_VAPID_PUBLIC_KEY absente).
          </p>
        )}

        {state.status === "denied" && (
          <>
            <p>Notifications bloquées dans les réglages du navigateur.</p>
            <p className="text-slate-600">
              Réactivez-les depuis les paramètres de site puis rechargez la page.
            </p>
          </>
        )}

        {state.status === "default" && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={enable}
                disabled={busy}
                className="rounded bg-slate-900 px-3 py-1.5 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                {busy ? "Activation…" : "Activer les notifications"}
              </button>
              {state.platform === "ios" && (
                <span className="text-slate-600">
                  Sur iPhone, installez d&apos;abord l&apos;application sur
                  l&apos;écran d&apos;accueil.
                </span>
              )}
            </div>
          </>
        )}

        {state.status === "subscribed" && (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-slate-900">
              Notifications activées sur cet appareil.
            </p>
            <button
              type="button"
              onClick={disable}
              disabled={busy}
              className="rounded border border-slate-300 px-3 py-1.5 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              {busy ? "Désactivation…" : "Désactiver cet appareil"}
            </button>
          </div>
        )}

        {error && (
          <p className="text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
