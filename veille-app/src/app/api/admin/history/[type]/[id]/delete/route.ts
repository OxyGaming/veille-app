import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  deleteHistoryEntry,
  isHistoryDeleteType,
} from "@/lib/history-delete";

const bodySchema = z.object({
  reason: z.string().trim().min(REASON_MIN_LENGTH).max(REASON_MAX_LENGTH),
});

/**
 * Hard-delete d'une entrée d'historique (Sprint historique C1).
 *
 * - ADMIN-only (`requireRole("ADMIN")` + check redondant dans le helper).
 * - Body : `{ reason: string ≥ 3 char }`.
 * - Le type est validé contre `HISTORY_DELETE_TYPES`. Tout type inconnu
 *   renvoie 400.
 * - Entité introuvable → 404 (pas de fuite d'existence).
 *
 * Le helper `deleteHistoryEntry` gère le snapshot AuditLog + la cascade
 * Prisma + le revert ImportedAction pour le type `validation`. Voir
 * `src/lib/history-delete.ts` pour la matrice de comportement.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ type: string; id: string }> },
) {
  let u;
  try {
    u = await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }

  const { type, id } = await ctx.params;
  if (!isHistoryDeleteType(type)) {
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

  const outcome = await deleteHistoryEntry(u, type, id, parsed.data.reason);

  switch (outcome.kind) {
    case "ok":
      return NextResponse.json({
        ok: true,
        type: outcome.type,
        entityId: outcome.entityId,
        revertedAction: outcome.revertedAction ?? null,
      });
    case "not_found":
      return NextResponse.json(
        { error: "Entrée introuvable" },
        { status: 404 },
      );
    case "forbidden_role":
      // En théorie inaccessible (requireRole(ADMIN) au-dessus) — fail-safe.
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    case "forbidden_scope":
      // ADMIN scopé tentant de supprimer hors de son périmètre.
      return NextResponse.json(
        { error: "Hors de votre périmètre." },
        { status: 403 },
      );
    case "invalid_reason":
      return NextResponse.json(
        {
          error: `Le motif doit faire entre ${REASON_MIN_LENGTH} et ${REASON_MAX_LENGTH} caractères.`,
        },
        { status: 400 },
      );
  }
}
