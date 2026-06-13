"use client";

import { Toaster } from "sonner";

/**
 * Wrapper Client Component pour le `<Toaster />` global de sonner.
 *
 * sonner 2.0.7 ne marque pas `"use client"` dans son bundle ESM,
 * ce qui empêche Next.js de le rendre quand on l'importe directement
 * depuis un Server Component (layout.tsx). Ce wrapper isole la frontière
 * RSC / Client.
 *
 * Cf. BACKLOG-V2.md US-1.11 / DECISIONS-SPRINT1.md commit 5.
 */
export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      // Reste au-dessus du bottom-nav mobile (z-30) sans le superposer.
      toastOptions={{ className: "!font-sans" }}
    />
  );
}
