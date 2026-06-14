/**
 * POST /api/actions/batch-obsolete (Sprint 7 C3).
 *
 * Batch partiel — D8 PO : HTTP 200 même si partiel, payload détaillé.
 * Logique métier centralisée dans `batchObsoleteActions()`.
 *
 * Payload :
 *   { actionIds: string[] }   // dédupé, plafonné à BATCH_OBSOLETE_MAX
 *
 * Réponse 200 :
 *   { ok, requested, updated, skipped, forbidden, alreadyObsolete }
 *
 * Sécurité : USER 403, EDITOR/ADMIN scopé via `actionScope` (Sprint 6 C5).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  BATCH_OBSOLETE_MAX,
  batchObsoleteActions,
} from "@/lib/action-obsolete";

const schema = z.object({
  actionIds: z
    .array(z.string().min(1))
    .max(BATCH_OBSOLETE_MAX * 4), // tolère 4× la limite, dédup interne
});

export async function POST(req: Request) {
  let user;
  try {
    user = await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Requête invalide" },
      { status: 400 },
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Données invalides",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const result = await batchObsoleteActions(user, parsed.data.actionIds);
  return NextResponse.json(result);
}
