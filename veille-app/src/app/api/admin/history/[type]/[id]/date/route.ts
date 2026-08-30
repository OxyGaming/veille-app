import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  editHistoryEntryDate,
  isHistoryEditDateType,
} from "@/lib/history-edit-date";

const bodySchema = z.object({
  // Date ISO 8601 (le client envoie `new Date(datetime-local).toISOString()`).
  date: z.string().min(1),
});

/**
 * Édition de la date d'une entrée d'historique.
 *
 * - ADMIN **ou** EDITOR (`requireRole` + revérif dans le helper).
 * - Body : `{ date: string ISO }`. Le helper valide la plausibilité (2000‑2100,
 *   pas au-delà d'un an dans le futur).
 * - Type validé contre `HISTORY_EDIT_DATE_TYPES` ; inconnu → 400.
 * - Entité introuvable → 404 ; hors périmètre équipe → 403.
 * - Le helper met à jour le champ de date du bon modèle + écrit un AuditLog
 *   `HISTORY_DATE_EDITED` (voir `src/lib/history-edit-date.ts`).
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ type: string; id: string }> },
) {
  let u;
  try {
    u = await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }

  const { type, id } = await ctx.params;
  if (!isHistoryEditDateType(type)) {
    return NextResponse.json(
      { error: "Type d'historique inconnu", type },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const outcome = await editHistoryEntryDate(u, type, id, parsed.data.date);

  switch (outcome.kind) {
    case "ok":
      return NextResponse.json({
        ok: true,
        type: outcome.type,
        entityId: outcome.entityId,
        at: outcome.at,
      });
    case "not_found":
      return NextResponse.json({ error: "Entrée introuvable" }, { status: 404 });
    case "forbidden_role":
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    case "forbidden_scope":
      return NextResponse.json(
        { error: "Hors de votre périmètre." },
        { status: 403 },
      );
    case "invalid_date":
      return NextResponse.json(
        { error: "Date invalide (attendu : entre 2000 et 2100, pas trop loin dans le futur)." },
        { status: 400 },
      );
  }
}
