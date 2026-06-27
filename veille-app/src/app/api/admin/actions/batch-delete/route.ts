/**
 * POST /api/admin/actions/batch-delete — suppression définitive en lot.
 *
 * ADMIN-only. Motif obligatoire (3–500 caractères), audit log unique.
 * Refuse les actions ayant au moins une validation rattachée.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  BATCH_DELETE_MAX,
  batchHardDeleteActions,
} from "@/lib/action-batch-delete";

const schema = z.object({
  actionIds: z.array(z.string().min(1)).max(BATCH_DELETE_MAX * 4),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
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
  const result = await batchHardDeleteActions(
    user,
    parsed.data.actionIds,
    parsed.data.reason,
  );
  return NextResponse.json(result);
}
