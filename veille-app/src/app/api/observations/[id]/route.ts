import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { addMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";
import { encodeTags, normalizeTag } from "@/lib/tags";

const STATUSES = [
  "CONFORME",
  "NON_CONFORME",
  "NON_OBSERVE",
  "NON_APPLICABLE",
  "A_REVOIR",
] as const;

const schema = z.object({
  status: z.enum(STATUSES).optional(),
  comment: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const obs = await prisma.observationItem.findUnique({
    where: { id },
    include: {
      procedureObservation: {
        include: {
          session: { select: { id: true, teamId: true, agentId: true } },
          procedure: { select: { id: true, title: true, gravity: true } },
        },
      },
      checklistItem: true,
    },
  });
  if (!obs) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  const scope = teamScope(u);
  if (
    "teamId" in scope &&
    scope.teamId !== obs.procedureObservation.session.teamId
  ) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const data = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.observationHistory.create({
      data: {
        observationId: id,
        previousStatus: obs.status,
        newStatus: data.status ?? obs.status,
        previousComment: obs.comment,
        newComment: data.comment === undefined ? obs.comment : data.comment,
        changedById: u.id,
      },
    });
    const row = await tx.observationItem.update({
      where: { id },
      data: {
        status: data.status,
        comment: data.comment === undefined ? undefined : data.comment,
        recordedAt: new Date(),
        recordedById: u.id,
      },
    });

    // Génération automatique d'une action quand on passe en "Non conforme"
    // ou "À revoir". Une NC est plus prioritaire (échéance plus courte)
    // qu'un "À revoir" (suivi pédagogique). Idempotent : externalId unique
    // par observation, un re-clic ne crée pas de doublon.
    const isNc = data.status === "NON_CONFORME";
    const isAr = data.status === "A_REVOIR";
    const wasNcOrAr =
      obs.status === "NON_CONFORME" || obs.status === "A_REVOIR";
    if (
      (isNc || isAr) &&
      !wasNcOrAr &&
      obs.procedureObservation.session.agentId
    ) {
      const agentId = obs.procedureObservation.session.agentId;
      const teamId = obs.procedureObservation.session.teamId;
      const proc = obs.procedureObservation.procedure;
      const item = obs.checklistItem;
      // Préfixe + tag + échéance distincts selon le statut.
      const statusLabel = isNc ? "Non conforme" : "À revoir";
      const statusTag = isNc ? "non conforme" : "à revoir";
      const monthsAhead = isNc ? 3 : 7;
      const title = `[${statusLabel}] ${proc.title} — ${item.label}`;
      const dueAt = addMonths(new Date(), monthsAhead);
      const tags = ["veille", statusTag];
      if (item.gravity ?? proc.gravity)
        tags.push(`G${item.gravity ?? proc.gravity}`);
      const externalId = `obs-${id}`;
      const dedupHash = createHash("sha1")
        .update(
          [
            title.toLowerCase().trim(),
            "",
            "",
            dueAt.toISOString().slice(0, 10),
            tags.map(normalizeTag).sort().join(","),
            "",
          ].join("|")
        )
        .digest("hex");
      const already = await tx.importedAction.findFirst({
        where: { externalId, agentId },
        select: { id: true },
      });
      if (!already) {
        await tx.importedAction.create({
          data: {
            externalId,
            teamId,
            agentId,
            localStatus: "ACTIVE",
            dedupHash,
            originalStatus: "Planifiée",
            keyPoint: title,
            veilleType: "Agent",
            dueAt,
            tags: encodeTags(tags),
            lastSeenAt: new Date(),
          },
        });
      }
    }

    return row;
  });

  return NextResponse.json(updated);
}
