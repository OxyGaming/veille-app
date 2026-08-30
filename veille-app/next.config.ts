import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const isProd = process.env.NODE_ENV === "production";

const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

// CSP paramétrée : `frameAncestors` pilote l'anti-framing ; `googleFonts`
// autorise fonts.googleapis.com / fonts.gstatic.com (nécessaire au seul viewer
// synoptique statique, qui charge ses polices via <link>).
const cspHeader = (opts: { frameAncestors: string; googleFonts?: boolean }) => ({
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    scriptSrc,
    `style-src 'self' 'unsafe-inline'${
      opts.googleFonts ? " https://fonts.googleapis.com" : ""
    }`,
    "img-src 'self' data: blob:",
    `font-src 'self'${opts.googleFonts ? " https://fonts.gstatic.com" : ""}`,
    "connect-src 'self'",
    opts.frameAncestors,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; "),
});

// En-têtes communs à toutes les réponses (hors anti-framing, géré par chemin).
const commonHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

// Anti-framing : SAMEORIGIN / frame-ancestors 'self' (et non DENY / 'none').
// La page /synoptique embarque le viewer statique en iframe MÊME ORIGINE : il
// faut donc autoriser le framing par soi-même. Le cross-origin reste bloqué →
// la protection anti-clickjacking est conservée (SAMEORIGIN est le défaut sûr
// habituel). Polices Google autorisées (le viewer les charge via <link>).
const securityHeaders = [
  ...commonHeaders,
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  cspHeader({ frameAncestors: "frame-ancestors 'self'", googleFonts: true }),
];

const nextConfig: NextConfig = {
  // Pas de `output: "standalone"` — cela force `node .next/standalone/server.js`
  // et casse `next start` utilisé par PM2 (npm start → next start -p 3002).
  // Standalone n'est utile que pour Docker. Symptôme en cas de régression :
  // page servie sans CSS + erreur webpack "Cannot read properties of
  // undefined" + warning "next start does not work with output: standalone".
  serverExternalPackages: [
    "better-sqlite3",
    "docxtemplater",
    "pizzip",
    "docxtemplater-image-module-free",
  ],
  turbopack: {},

  experimental: {
    serverActions: {
      // @ts-expect-error — clé stable entre builds, voir Point RH
      encryptionKey: process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,
    },
  },

  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Mitigation tactique US-1.5 — empêche l'indexation par moteurs de
      // recherche et le suivi des URL d'uploads en attendant le refactor
      // complet (route streaming + auth + stockage hors `public/`) prévu
      // Sprint 3. Cf. AUDIT.md §C1 / DECISIONS-SPRINT1.md commit 8.
      {
        source: "/uploads/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
