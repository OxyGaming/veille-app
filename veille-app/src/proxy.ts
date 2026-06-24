/**
 * Proxy Next.js — protection des routes par authentification et rôle.
 *
 * - Route unique de login : /login. /admin/login redirige vers /login.
 * - Pages publiques : /login, /api/auth/*, manifest/SW.
 * - Admin only : /admin/* et /api/admin/*. EDITOR a accès en lecture/écriture
 *   au paramétrage des procédures (cf. handlers), mais pas à /admin.
 * - Cookie veille-auth (base64 secret:userId) compatible Edge (atob).
 */
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeToken } from "@/lib/auth-edge";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  // Sprint Push V1 C8 — routes cron protégées par header x-cron-secret
  // côté route handler. Le proxy doit les bypasser (pas de cookie session
  // côté curl). La sécurité réelle est dans le handler.
  "/api/cron",
];

const ADMIN_PATHS = ["/admin", "/api/admin"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bypass PWA shell + Next assets.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/sw.js" ||
    pathname === "/sw.js.map" ||
    pathname.startsWith("/swe-worker-") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/offline" ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/uploads/")
  ) {
    return NextResponse.next();
  }

  // /admin/login → /login (spec).
  if (pathname === "/admin/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isPublic(pathname)) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const userId = decodeToken(token);
  if (!userId) return redirectToLogin(request, pathname);

  // Note : le rôle est revérifié côté handler. Ici on bloque seulement les
  // paths admin évidents pour éviter l'affichage public des pages.
  // Pour cela on consulte le header injecté par /api/auth/me ? Non, en Edge
  // on ne peut pas requêter Prisma : on délègue la vérif fine côté handler.

  if (isAdminPath(pathname)) {
    // On laisse passer ; le handler / layout fera un requireRole("ADMIN").
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.headers.set("x-user-id", userId);
  return response;
}

function redirectToLogin(request: NextRequest, from: string): NextResponse {
  if (from.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Non authentifié" },
      { status: 401 }
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  if (from && from !== "/") url.searchParams.set("from", from);
  return NextResponse.redirect(url);
}

export { proxy as middleware };

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
