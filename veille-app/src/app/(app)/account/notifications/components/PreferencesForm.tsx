"use client";

/**
 * Formulaire de préférences notifications (Sprint Push V1 — C7).
 *
 * Sauvegarde immédiate au changement (pas de bouton Enregistrer) :
 *  - Optimistic update local pour un feedback instantané.
 *  - PATCH `/api/me/notification-preferences` en arrière-plan.
 *  - Rollback à l'état serveur si la réponse échoue.
 *
 * Quand `serverPushEnabled` (ENABLE_PUSH côté serveur) est `false`,
 * les toggles restent éditables (les préférences sont conservées) mais
 * le toggle master `pushEnabled` est marqué en lecture-seule pour
 * éviter d'inviter à un changement qui n'aura aucun effet côté push
 * tant que l'ops n'a pas réactivé.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";

export type Preferences = {
  pushEnabled: boolean;
  catEcheances: boolean;
  catEquipes: boolean;
};

type ToggleKey = keyof Preferences;

const TOGGLES: {
  key: ToggleKey;
  label: string;
  hint: string;
  master?: boolean;
}[] = [
  {
    key: "pushEnabled",
    label: "Notifications push",
    hint: "Activer ou désactiver tous les push sur ce compte. Désactive aussi les catégories ci-dessous.",
    master: true,
  },
  {
    key: "catEcheances",
    label: "Échéances critiques",
    hint: "Visites en retard, équipements périmés, actions critiques.",
  },
  {
    key: "catEquipes",
    label: "Équipes",
    hint: "Ajout dans une équipe.",
  },
];

export function PreferencesForm({
  initial,
  serverPushEnabled,
}: {
  initial: Preferences;
  serverPushEnabled: boolean;
}) {
  const [pref, setPref] = useState<Preferences>(initial);
  const [pending, startTransition] = useTransition();

  function applyPatch(patch: Partial<Preferences>) {
    const next = { ...pref, ...patch };
    setPref(next);
    startTransition(async () => {
      try {
        const r = await fetch("/api/me/notification-preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify(patch),
        });
        if (!r.ok) {
          // Rollback à l'état serveur.
          const fresh = await fetch("/api/me/notification-preferences", {
            credentials: "include",
            cache: "no-store",
          });
          if (fresh.ok) {
            const data = (await fresh.json()) as Preferences;
            setPref(data);
          } else {
            // Pire cas — rollback à `pref` antérieur (avant l'optimistic).
            setPref(pref);
          }
          toast.error("Préférences non enregistrées.");
          return;
        }
        const data = (await r.json()) as Preferences;
        setPref(data);
      } catch {
        setPref(pref);
        toast.error("Préférences non enregistrées.");
      }
    });
  }

  const masterDisabled = !pref.pushEnabled;

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {TOGGLES.map((t) => {
        const checked = pref[t.key];
        // Une catégorie est désactivée visuellement si pushEnabled=false.
        // Sa valeur reste éditable (on sauvegarde) mais l'effet pratique
        // est nul tant que le master n'est pas réactivé.
        const dimmed = !t.master && masterDisabled;
        const isMasterAndServerOff = t.master && !serverPushEnabled;
        return (
          <li
            key={t.key}
            className={`flex items-start gap-3 p-3 ${
              dimmed ? "opacity-60" : ""
            }`}
          >
            <div className="flex-1">
              <label
                htmlFor={`pref-${t.key}`}
                className="font-medium text-slate-900 cursor-pointer"
              >
                {t.label}
              </label>
              <p className="text-xs text-slate-500 mt-0.5">{t.hint}</p>
              {isMasterAndServerOff && (
                <p className="text-[11px] text-amber-700 mt-1">
                  Réactivez côté serveur (ENABLE_PUSH=true) pour que ce
                  réglage prenne effet.
                </p>
              )}
            </div>
            <input
              id={`pref-${t.key}`}
              type="checkbox"
              role="switch"
              aria-checked={checked}
              checked={checked}
              disabled={pending}
              onChange={(e) => applyPatch({ [t.key]: e.target.checked })}
              className="mt-1 h-5 w-9 cursor-pointer appearance-none rounded-full bg-slate-300 transition-colors checked:bg-slate-900 relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform checked:after:translate-x-4 disabled:opacity-50"
            />
          </li>
        );
      })}
    </ul>
  );
}
