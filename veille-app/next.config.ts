import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const isProd = process.env.NODE_ENV === "production";

const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      ...(isProd ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
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
