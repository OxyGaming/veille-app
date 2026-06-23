/**
 * Mon compte → Notifications (Sprint Push V1 — C7).
 *
 * Server Component : lit la session, les préférences (création lazy
 * incluse) et le flag `ENABLE_PUSH`. Passe le tout à un Client Component
 * `PreferencesForm` qui gère les toggles + l'envoi PATCH au changement.
 *
 * Accès : USER + EDITOR + ADMIN (D2). Aucun userId dans l'URL.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { isPushEnabled } from "@/lib/featureFlags";
import { getOrCreatePreference } from "@/lib/push/preferences";
import { EnablePushBanner } from "@/components/push/EnablePushBanner";
import { PreferencesForm } from "./components/PreferencesForm";

export const dynamic = "force-dynamic";

export default async function AccountNotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const initialPref = await getOrCreatePreference(user.id);
  const pushEnabled = isPushEnabled();

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <header className="px-4 lg:px-8 pt-4">
        <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Mon compte
        </p>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">
          Notifications
        </h1>
        <p className="text-sm text-slate-600 mt-3 max-w-2xl">
          Les notifications push permettent de recevoir des alertes même
          lorsque l&apos;application est fermée, si elle est installée comme
          PWA ou ouverte dans un navigateur compatible. Sur iPhone, les
          notifications nécessitent l&apos;installation de l&apos;application
          sur l&apos;écran d&apos;accueil.
        </p>
      </header>

      <div className="px-4 lg:px-8 mt-6 space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Cet appareil
          </h2>
          <div className="mt-2">
            <EnablePushBanner />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Mes préférences
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Ces préférences s&apos;appliquent à tous vos appareils connectés.
          </p>
          {!pushEnabled && (
            <p
              className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
              role="status"
            >
              Les notifications push sont temporairement désactivées côté
              serveur (ENABLE_PUSH=false). Vos préférences restent
              modifiables.
            </p>
          )}
          <div className="mt-3">
            <PreferencesForm
              initial={initialPref}
              serverPushEnabled={pushEnabled}
            />
          </div>
        </section>

        <p className="text-xs text-slate-500">
          <Link
            href="/notifications"
            className="underline underline-offset-2 hover:text-slate-700"
          >
            Retour au centre de notifications
          </Link>
        </p>
      </div>
    </div>
  );
}
