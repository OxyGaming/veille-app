"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminScopeSelector } from "@/components/AdminScopeSelector";
import { Icon } from "@/components/icons";
import { NotificationsBell } from "@/components/NotificationsBell";
import type { ResolvedAdminScope } from "@/lib/admin-scope";

type Props = {
  user: { id: string; name: string; role: string; teamId: string | null };
  children: React.ReactNode;
  todayEnabled?: boolean;
  echeancesEnabled?: boolean;
  /** Sprint 6 C4 — null pour USER/EDITOR, scope résolu pour ADMIN. */
  adminScope?: ResolvedAdminScope | null;
  /** Sprint 6 C4 — liste des équipes pour le dropdown TEAM (ADMIN). */
  adminTeams?: { id: string; name: string }[];
  /** Sprint 6 C4 — true si l'ADMIN a au moins une membership. */
  adminHasMemberships?: boolean;
};

const TODAY_ITEM = { href: "/today", label: "Aujourd'hui", icon: Icon.Home };
const ECHEANCES_ITEM = {
  href: "/echeances",
  label: "Échéances",
  icon: Icon.Calendar,
};

const BASE_NAV_MOBILE = [
  { href: "/procedures", label: "Veilles", icon: Icon.ClipboardCheck },
  { href: "/visits", label: "Visites", icon: Icon.FileText },
  { href: "/agents", label: "Agents", icon: Icon.Users },
  { href: "/sites", label: "Sites", icon: Icon.Building },
  { href: "/history", label: "Histo.", icon: Icon.Clipboard },
];
const BASE_NAV_DESKTOP = [
  { href: "/procedures", label: "Veilles", icon: Icon.ClipboardCheck },
  { href: "/visits", label: "Visites & Tournées", icon: Icon.FileText },
  { href: "/sessions", label: "Sessions", icon: Icon.ClipboardCheck },
  { href: "/agents", label: "Agents", icon: Icon.Users },
  { href: "/sites", label: "Sites", icon: Icon.Building },
  { href: "/history", label: "Historique", icon: Icon.Clipboard },
  { href: "/stats", label: "Statistiques", icon: Icon.Filter },
  { href: "/links", label: "Liens utiles", icon: Icon.Link },
  { href: "/contacts", label: "Contacts", icon: Icon.Phone },
  { href: "/rci", label: "RCI", icon: Icon.AlertTriangle },
];

const PILOTAGE_ITEM = {
  href: "/dashboard",
  label: "Pilotage",
  icon: Icon.Filter,
};

export default function AppShell({
  user,
  children,
  todayEnabled = false,
  echeancesEnabled = false,
  adminScope = null,
  adminTeams = [],
  adminHasMemberships = false,
}: Props) {
  const isAdmin = user.role === "ADMIN";
  const isEditor = isAdmin || user.role === "EDITOR";
  const showEcheances = echeancesEnabled && isEditor;

  // C18 — Mobile : Pilotage remplace Échéances (l'accès aux échéances
  // reste dispo via le menu desktop + lien depuis le dashboard).
  const navMobile = [
    ...(todayEnabled ? [TODAY_ITEM] : []),
    ...(isEditor ? [PILOTAGE_ITEM] : []),
    ...BASE_NAV_MOBILE,
  ];
  const navDesktop = [
    ...(todayEnabled ? [TODAY_ITEM] : []),
    ...(showEcheances ? [ECHEANCES_ITEM] : []),
    ...(isEditor ? [PILOTAGE_ITEM] : []),
    ...BASE_NAV_DESKTOP,
  ];
  const NAV = navMobile;
  const NAV_DESKTOP = navDesktop;
  // grid-cols varie selon le nombre d'entrées mobile (5 → 7).
  const mobileGridClass =
    navMobile.length === 7
      ? "grid-cols-7"
      : navMobile.length === 6
        ? "grid-cols-6"
        : "grid-cols-5";

  const pathname = usePathname();
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => {
      try {
        const { countPending } = await import("@/lib/syncQueue");
        setPendingCount(await countPending());
      } catch {
        setPendingCount(0);
      }
    })();
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-slate-50 lg:flex">
      {/* ===== Sidebar desktop ===== */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-slate-900 text-slate-100 sticky top-0 h-screen no-print">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 grid place-items-center">
              <Icon.ClipboardCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-base font-bold leading-none">Veille</div>
              <div className="text-[10px] font-mono tracking-wider text-slate-400 mt-1">
                TERRAIN
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_DESKTOP.map((n) => {
            const active =
              pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <n.icon className="w-4 h-4" />
                {n.label}
              </Link>
            );
          })}
          {isEditor && (
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mt-4 border-t border-white/10 pt-4 transition-colors ${
                pathname.startsWith("/admin")
                  ? "text-white bg-white/5"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon.Settings className="w-4 h-4" />
              Back-office
            </Link>
          )}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
            <div
              className={`flex items-center gap-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                online
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-amber-500/20 text-amber-300"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  online ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {online ? "EN LIGNE" : "HORS LIGNE"}
            </div>
            {pendingCount > 0 && (
              <span className="text-[10px] font-mono bg-white/10 text-slate-200 px-1.5 py-0.5 rounded">
                {pendingCount} en file
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-white text-xs font-semibold grid place-items-center shrink-0">
              {user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user.name}</div>
              <div className="text-[10px] font-mono text-slate-400 truncate">
                {user.role}
              </div>
              {isAdmin && adminScope && (
                <div className="mt-1.5">
                  <AdminScopeSelector
                    scope={adminScope}
                    teams={adminTeams}
                    hasMemberships={adminHasMemberships}
                    appearance="sidebar"
                  />
                </div>
              )}
            </div>
            <NotificationsBell appearance="sidebar" />
            <button
              onClick={logout}
              className="text-slate-400 hover:text-white p-1.5 rounded-md hover:bg-white/5"
              title="Se déconnecter"
            >
              <Icon.LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ===== Contenu principal ===== */}
      {/*
        - min-h-dvh : hauteur dynamique iOS (s'adapte à la barre URL).
        - pb mobile = hauteur de la bottom-nav + safe-area iOS (zone gestures).
          Sans, la dernière carte passe partiellement sous la nav fixed.
      */}
      <div className="flex-1 flex flex-col min-h-dvh lg:min-h-screen pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">
        {/* Top bar mobile */}
        <header className="lg:hidden sticky top-0 z-30 bg-slate-900 text-white no-print">
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 grid place-items-center shrink-0">
              <Icon.ClipboardCheck className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono tracking-wider text-slate-400">
                VEILLE
              </div>
              <div className="text-sm font-semibold truncate">{user.name}</div>
            </div>
            <div
              className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded ${
                online
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-amber-500/20 text-amber-300"
              }`}
            >
              {online ? <Icon.Wifi className="w-3 h-3" /> : <Icon.WifiOff className="w-3 h-3" />}
              {online ? "ONLINE" : "OFFLINE"}
              {pendingCount > 0 && (
                <span className="bg-white/20 px-1 rounded">{pendingCount}</span>
              )}
            </div>
            {isAdmin && adminScope && (
              <AdminScopeSelector
                scope={adminScope}
                teams={adminTeams}
                hasMemberships={adminHasMemberships}
                appearance="header"
              />
            )}
            {isEditor && (
              <Link
                href="/admin"
                className="text-[10px] font-mono px-2 py-1 rounded border border-white/20 text-slate-200"
              >
                {isAdmin ? "ADMIN" : "EDIT"}
              </Link>
            )}
            <NotificationsBell appearance="header" />
            <button
              onClick={logout}
              className="text-slate-300 hover:text-white p-1.5 rounded-md hover:bg-white/5"
              title="Se déconnecter"
            >
              <Icon.LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/*
          min-w-0 + overflow-x-clip : empêche un contenu très large (texte
          long sans wrap, table débordante) de pousser le main au-delà du
          viewport, ce qui masquait la bottom-nav et créait un scroll
          horizontal parasite sur les fiches denses (/agents/[id], /sites/[id]).
        */}
        <main className="flex-1 min-w-0 overflow-x-clip">{children}</main>

        {/*
          Bottom nav mobile — fixée au viewport.
          pb-[env(safe-area-inset-bottom)] pousse le contenu au-dessus de la
          zone de gestures iOS (~34 px sur iPhone X+) sans réduire la cible
          tactile.
        */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 no-print z-30 pb-[env(safe-area-inset-bottom)]">
          <div className={`grid ${mobileGridClass}`}>
            {NAV.map((n) => {
              const active =
                pathname === n.href || pathname.startsWith(n.href + "/");
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex flex-col items-center justify-center py-2.5 text-[10px] font-medium transition-colors ${
                    active ? "text-indigo-600" : "text-slate-500"
                  }`}
                >
                  <n.icon className="w-5 h-5 mb-0.5" />
                  {n.label}
                  {active && (
                    <span className="absolute top-0 w-12 h-0.5 bg-indigo-600 rounded-b" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
