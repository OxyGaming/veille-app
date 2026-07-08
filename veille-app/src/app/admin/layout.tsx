import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { Icon } from "@/components/icons";

type Role = "ADMIN" | "EDITOR" | "USER";

type Section = {
  href: string;
  label: string;
  icon: (typeof Icon)[keyof typeof Icon];
  /** Si défini, lien visible uniquement pour ces rôles. */
  roles?: Role[];
};

/**
 * Pages du back-office ouvertes aux USER (gestion des actions : création,
 * remplacement, suppression/obsolescence). Toutes les autres pages /admin
 * restent réservées ADMIN/EDITOR. Le cloisonnement par équipe s'applique.
 */
const USER_ALLOWED_PATHS = ["/admin/actions", "/admin/imports"];

const SECTIONS: Section[] = [
  { href: "/admin", label: "Tableau de bord", icon: Icon.Home, roles: ["ADMIN", "EDITOR"] },
  { href: "/admin/procedures", label: "Procédures", icon: Icon.ClipboardCheck, roles: ["ADMIN", "EDITOR"] },
  { href: "/admin/imports", label: "Imports actions", icon: Icon.Upload },
  { href: "/admin/planning", label: "Planning agents", icon: Icon.Calendar, roles: ["ADMIN", "EDITOR"] },
  { href: "/admin/actions", label: "Actions (obsolescence)", icon: Icon.Trash },
  { href: "/admin/teams", label: "Équipes", icon: Icon.Building, roles: ["ADMIN", "EDITOR"] },
  { href: "/admin/users", label: "Utilisateurs", icon: Icon.Users, roles: ["ADMIN", "EDITOR"] },
  { href: "/admin/agents", label: "Agents", icon: Icon.User, roles: ["ADMIN", "EDITOR"] },
  { href: "/admin/sites", label: "Sites", icon: Icon.Building, roles: ["ADMIN", "EDITOR"] },
  { href: "/admin/vehicles", label: "Véhicules", icon: Icon.Truck, roles: ["ADMIN", "EDITOR"] },
  { href: "/admin/vehicle-round-templates", label: "Grille tournée VS", icon: Icon.FileEdit, roles: ["ADMIN", "EDITOR"] },
  { href: "/admin/visit-templates", label: "Modèles de visite", icon: Icon.FileText, roles: ["ADMIN", "EDITOR"] },
  { href: "/admin/links", label: "Liens utiles", icon: Icon.Link, roles: ["ADMIN", "EDITOR"] },
  { href: "/admin/contacts", label: "Contacts", icon: Icon.Phone, roles: ["ADMIN", "EDITOR"] },
  { href: "/admin/audit", label: "Audit", icon: Icon.Shield, roles: ["ADMIN"] },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  // USER : accès limité aux pages back-office "actions" (cf. USER_ALLOWED_PATHS).
  // ADMIN/EDITOR : accès complet. Le chemin courant est fourni par le proxy.
  const path = (await headers()).get("x-veille-path") ?? "";
  const isUserAllowedPath = USER_ALLOWED_PATHS.some(
    (p) => path === p || path.startsWith(p + "/"),
  );
  if (u.role !== "ADMIN" && u.role !== "EDITOR" && !isUserAllowedPath) {
    redirect("/procedures");
  }
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      <aside className="lg:w-64 bg-slate-900 text-slate-100 lg:min-h-screen lg:sticky lg:top-0">
        <div className="px-5 py-5 border-b border-white/10">
          <Link
            href="/procedures"
            className="text-[11px] font-mono text-slate-400 hover:text-white inline-flex items-center gap-1"
          >
            <Icon.ChevronLeft className="w-3 h-3" /> Application
          </Link>
          <div className="flex items-center gap-2.5 mt-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 grid place-items-center">
              <Icon.Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-base font-bold leading-none">Back-office</div>
              <div className="text-[10px] font-mono tracking-wider text-slate-400 mt-1">
                {u.role}
              </div>
            </div>
          </div>
        </div>
        <nav className="p-3 grid grid-cols-2 lg:block gap-1">
          {SECTIONS.filter(
            (s) => !s.roles || s.roles.includes(u.role as Role),
          ).map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <s.icon className="w-4 h-4" />
              <span className="truncate">{s.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-4 lg:p-8 max-w-full overflow-x-auto">{children}</main>
    </div>
  );
}
