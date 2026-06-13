import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Configuration Vitest minimale — Sprint 1 commit 4.
 * Couvre seulement les helpers de `src/lib/` pour l'instant.
 * À étendre progressivement (cf. BACKLOG-V2.md MT-08 / Sprint 5 E12).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Désactive PostCSS — les tests Node pur n'utilisent pas Tailwind v4.
  css: {
    postcss: { plugins: [] },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
