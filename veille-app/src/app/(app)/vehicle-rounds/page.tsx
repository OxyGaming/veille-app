import { redirect } from "next/navigation";

/**
 * La liste des tournées VS a été fusionnée avec celle des visites de site
 * sous `/visits`. Cette route reste valide pour les liens internes mais
 * redirige vers la vue unifiée. Les sous-routes (/new, /[id], /[id]/report)
 * conservent leur sémantique propre.
 */
export default function VehicleRoundsListRedirect() {
  redirect("/visits");
}
