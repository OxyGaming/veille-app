import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";
import {
  encodeTags,
  normalizeTag,
  TAG_OBLIGATOIRE,
  TAG_VEILLE_LEGALE,
} from "@/lib/tags";

const schema = z.object({
  description: z.string().min(1).max(500),
  riskIdentified: z.string().nullable().optional(),
  evrpCotation: z.string().nullable().optional(),
  proposedMeasures: z.string().nullable().optional(),
  responsible: z.string().nullable().optional(),
  plannedDate: z.string().datetime().nullable().optional(),
  redressedDate: z.string().datetime().nullable().optional(),
  closedDate: z.string().datetime().nullable().optional(),
  /** Si true (défaut), crée une ImportedAction associée au Site. */
  generateAction: z.boolean().default(true),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id: visitId } = await ctx.params;
  const visit = await prisma.siteVisit.findFirst({
    where: { id: visitId, ...teamScope(u) },
    include: { template: true, site: true },
  });
  if (!visit) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

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
  const data = parsed.data;
  const lastOrder = await prisma.siteVisitNonConformity.findFirst({
    where: { visitId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    // Génère l'ImportedAction côté site si demandé.
    let generatedActionId: string | null = null;
    if (data.generateAction) {
      const title = data.description;
      // Échéance : date de redressement saisie, sinon date prévue, sinon J+30.
      const dueAt = data.redressedDate
        ? new Date(data.redressedDate)
        : data.plannedDate
        ? new Date(data.plannedDate)
        : addDays(new Date(), 30);
      const tags = [
        TAG_VEILLE_LEGALE,
        TAG_OBLIGATOIRE,
        "site",
        visit.template.name.toLowerCase(),
      ];
      const externalId = `nc-${randomUUID()}`;
      const dedupHash = createHash("sha1")
        .update(
          [
            title.toLowerCase().trim(),
            (data.proposedMeasures ?? "").toLowerCase().trim(),
            "",
            dueAt.toISOString().slice(0, 10),
            tags.map(normalizeTag).sort().join(","),
            "",
          ].join("|")
        )
        .digest("hex");
      const created = await tx.importedAction.create({
        data: {
          externalId,
          teamId: visit.teamId,
          siteId: visit.siteId,
          localStatus: "ACTIVE",
          dedupHash,
          originalStatus: "Planifiée",
          keyPoint: title,
          comment: data.proposedMeasures,
          veilleType: "Site",
          dueAt,
          tags: encodeTags(tags),
        },
      });
      generatedActionId = created.id;
    }

    return tx.siteVisitNonConformity.create({
      data: {
        visitId,
        sortOrder: (lastOrder?.sortOrder ?? 0) + 1,
        description: data.description,
        riskIdentified: data.riskIdentified ?? null,
        evrpCotation: data.evrpCotation ?? null,
        proposedMeasures: data.proposedMeasures ?? null,
        responsible: data.responsible ?? null,
        plannedDate: data.plannedDate ? new Date(data.plannedDate) : null,
        redressedDate: data.redressedDate ? new Date(data.redressedDate) : null,
        closedDate: data.closedDate ? new Date(data.closedDate) : null,
        generatedActionId,
      },
    });
  });

  return NextResponse.json(result);
}
