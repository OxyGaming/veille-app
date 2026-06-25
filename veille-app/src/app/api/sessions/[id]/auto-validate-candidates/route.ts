import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";
import { findAutoValidableActionsForSession } from "@/lib/sessions/auto-validate";

/**
 * Liste les actions de l'agent ciblé par une veille dont le `keyPoint`
 * commence par un point clé observé dans la session
 * (cf. `lib/sessions/auto-validate.ts`).
 *
 * Utilisé par la modale de confirmation à la clôture d'une veille. La
 * validation effective se fait via la route existante
 * `POST /api/actions/[id]/validate` — aucune logique métier n'est dupliquée.
 *
 * Auth : `requireUser` + `assertTeamAccess` sur la session. Pas de scope
 * supplémentaire sur les actions car elles sont rattachées à l'agent de
 * la session déjà filtrée.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const session = await prisma.veilleSession.findUnique({
    where: { id },
    select: { teamId: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  }
  if (!assertTeamAccess(u, session.teamId)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }
  const items = await findAutoValidableActionsForSession(id);
  return NextResponse.json({
    items: items.map((a) => ({
      id: a.id,
      externalId: a.externalId,
      keyPoint: a.keyPoint,
      comment: a.comment,
      dueAt: a.dueAt?.toISOString() ?? null,
      matchedBy: a.matchedBy,
    })),
  });
}
