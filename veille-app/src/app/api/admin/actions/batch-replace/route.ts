/**
 * POST /api/admin/actions/batch-replace — remplacement en lot.
 *
 * Pour chaque action sélectionnée : crée un clone avec le nouveau contenu
 * (mêmes liens agentId/siteId/teamId) puis marque l'originale REPLACED.
 *
 * ADMIN ou EDITOR. Au moins un champ de contenu doit être fourni
 * (sinon ça n'a pas de sens de "remplacer").
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  BATCH_REPLACE_MAX,
  batchReplaceActions,
} from "@/lib/action-batch-replace";

const schema = z
  .object({
    actionIds: z.array(z.string().min(1)).max(BATCH_REPLACE_MAX * 4),
    content: z.object({
      comment: z.string().trim().max(2000).nullable(),
      keyPoint: z.string().trim().max(500).nullable(),
      theme: z.string().trim().max(200).nullable(),
      domain: z.string().trim().max(200).nullable(),
      dueAt: z.string().datetime().nullable().optional(),
      tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    }),
  })
  .refine(
    (v) => {
      const textual = [
        v.content.comment,
        v.content.keyPoint,
        v.content.theme,
        v.content.domain,
      ].some((s) => s !== null && s !== "");
      // Les tags seuls comptent aussi : on peut vouloir remplacer juste la
      // taxonomie sans toucher au libellé (cas « retire le tag obligatoire »).
      const tagsTouched = v.content.tags !== undefined;
      return textual || tagsTouched;
    },
    {
      message:
        "Au moins un champ (commentaire, keyPoint, theme, domain ou tags) doit être renseigné.",
      path: ["content"],
    },
  );

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
  const result = await batchReplaceActions(
    user,
    parsed.data.actionIds,
    parsed.data.content,
  );
  return NextResponse.json(result);
}
