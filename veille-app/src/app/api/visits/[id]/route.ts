import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";
import {
  encodeTags,
  normalizeTag,
  TAG_OBLIGATOIRE,
  TAG_VEILLE_LEGALE,
} from "@/lib/tags";

async function loadScoped(
  id: string,
  u: Awaited<ReturnType<typeof requireUser>>
) {
  return prisma.siteVisit.findFirst({
    where: { id, ...teamScope(u) },
    include: {
      template: {
        include: {
          sections: {
            include: {
              items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
            },
            orderBy: { sortOrder: "asc" },
            where: { isActive: true },
          },
        },
      },
      site: true,
      observer: { select: { id: true, name: true } },
      participants: { orderBy: { sortOrder: "asc" } },
      observations: true,
      nonConformities: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const v = await loadScoped(id, u);
  if (!v) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  return NextResponse.json(v);
}

const patchSchema = z.object({
  status: z.enum(["draft", "active", "completed", "archived"]).optional(),
  generalComment: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
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
  const existing = await loadScoped(id, u);
  if (!existing) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const finishedAt = data.status === "completed" ? new Date() : undefined;
  const updated = await prisma.siteVisit.update({
    where: { id },
    data: {
      status: data.status,
      generalComment:
        data.generalComment === undefined ? undefined : data.generalComment,
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      finishedAt,
    },
  });

  // Génération auto des NC + actions à la clôture d'une visite INVENTORY.
  // Idempotent : on saute les observations qui ont déjà généré une NC
  // (clé externalRef nc-inv-{observationId}).
  if (
    data.status === "completed" &&
    existing.template.kind === "INVENTORY" &&
    existing.status !== "completed"
  ) {
    await generateInventoryNonConformities(updated.id, existing.teamId);
  }

  return NextResponse.json(updated);
}

/**
 * Génère une NC + ImportedAction pour chaque observation INVENTORY en écart.
 *  - Type d'écart → tag déduit (manquant, périmé, quantité, détérioré)
 *  - Échéance par défaut : J+30
 *  - externalId stable `nc-inv-{observationId}` → idempotent
 */
async function generateInventoryNonConformities(visitId: string, teamId: string) {
  const obs = await prisma.siteVisitObservation.findMany({
    where: {
      visitId,
      discrepancyType: { not: null },
      equipmentId: { not: null },
    },
    include: {
      equipment: {
        select: { id: true, label: true, category: true },
      },
    },
  });
  if (!obs.length) return;
  const visit = await prisma.siteVisit.findUnique({
    where: { id: visitId },
    select: { siteId: true },
  });
  if (!visit) return;

  const lastOrder = await prisma.siteVisitNonConformity.findFirst({
    where: { visitId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let order = lastOrder?.sortOrder ?? 0;

  for (const o of obs) {
    if (!o.equipment) continue;
    const eqLabel = o.equipment.label;
    const description = describeDiscrepancy(o.discrepancyType, eqLabel, o);
    const externalId = `nc-inv-${o.id}`;
    // Skip si une action a déjà été générée pour cette observation
    // (idempotence sur clôture multiple).
    const alreadyAction = await prisma.importedAction.findFirst({
      where: { externalId },
      select: { id: true },
    });
    if (alreadyAction) continue;

    order += 1;
    const dueAt = addDays(new Date(), 30);
    const tags = [
      TAG_VEILLE_LEGALE,
      TAG_OBLIGATOIRE,
      "site",
      "veille de site",
      tagForDiscrepancy(o.discrepancyType),
    ].filter(Boolean) as string[];
    const dedupHash = createHash("sha1")
      .update(
        [
          description.toLowerCase().trim(),
          "",
          "",
          dueAt.toISOString().slice(0, 10),
          tags.map(normalizeTag).sort().join(","),
          "",
        ].join("|")
      )
      .digest("hex");
    await prisma.$transaction(async (tx) => {
      const action = await tx.importedAction.create({
        data: {
          externalId,
          teamId,
          siteId: visit.siteId,
          localStatus: "ACTIVE",
          dedupHash,
          originalStatus: "Planifiée",
          keyPoint: description,
          veilleType: "Site",
          dueAt,
          tags: encodeTags(tags),
        },
      });
      await tx.siteVisitNonConformity.create({
        data: {
          visitId,
          sortOrder: order,
          description,
          generatedActionId: action.id,
        },
      });
    });
  }
}

function describeDiscrepancy(
  type: string | null,
  label: string,
  o: { quantityObserved: number | null; expirationDateObserved: Date | null }
): string {
  switch (type) {
    case "MISSING":
      return `Élément manquant : ${label}`;
    case "EXPIRED":
      return `Équipement périmé : ${label}${
        o.expirationDateObserved
          ? ` (DLC ${o.expirationDateObserved
              .toISOString()
              .slice(0, 10)})`
          : ""
      }`;
    case "QUANTITY_LOW":
      return `Quantité insuffisante : ${label}${
        o.quantityObserved != null ? ` (${o.quantityObserved} sur place)` : ""
      }`;
    case "DAMAGED":
      return `Équipement détérioré : ${label}`;
    default:
      return `Écart constaté : ${label}`;
  }
}

function tagForDiscrepancy(type: string | null): string {
  switch (type) {
    case "MISSING":
      return "manquant";
    case "EXPIRED":
      return "péremption";
    case "QUANTITY_LOW":
      return "quantité";
    case "DAMAGED":
      return "détérioré";
    default:
      return "écart";
  }
}


/**
 * Suppression d'une visite de site (couvre planifiée EIC RA et trimestrielle
 * incendie — c'est la même entité, distinguée par `template.slug`).
 *
 *  - ?mode=soft (défaut) : status="archived". Reste consultable.
 *  - ?mode=hard : supprime la visite ET ses observations + NCs (cascade
 *    Prisma). Les `ImportedAction` générées par auto-création depuis les NCs
 *    sont **détachées** (siteId=null) puis marquées OBSOLETE — on ne supprime
 *    pas les actions car elles peuvent avoir été assignées et tracées.
 *    Bloqué sur visite `completed` pour préserver l'audit ; sauf admin.
 */
export async function DELETE(
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
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "soft";
  const visit = await loadScoped(id, u);
  if (!visit) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  const isOwner = visit.observerId === u.id;
  const isAdmin = u.role === "ADMIN" || u.role === "EDITOR";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (mode === "soft") {
    await prisma.siteVisit.update({
      where: { id },
      data: { status: "archived" },
    });
    return NextResponse.json({ ok: true });
  }

  if (visit.status === "completed" && !isAdmin) {
    return NextResponse.json(
      {
        error:
          "Visite clôturée — seul un admin peut la supprimer définitivement. Préférez l'archivage.",
      },
      { status: 409 }
    );
  }

  // Détache + obsolète les actions auto-générées par les NCs avant de cascade
  // la visite. Les NCs elles-mêmes seront cascade-deleted.
  const ncs = await prisma.siteVisitNonConformity.findMany({
    where: { visitId: id },
    select: { generatedActionId: true },
  });
  const generatedIds = ncs
    .map((n) => n.generatedActionId)
    .filter((x): x is string => !!x);

  await prisma.$transaction(async (tx) => {
    if (generatedIds.length > 0) {
      await tx.importedAction.updateMany({
        where: { id: { in: generatedIds } },
        data: { localStatus: "OBSOLETE" },
      });
    }
    // Cascade Prisma : SiteVisitObservation, SiteVisitNonConformity,
    // SiteVisitParticipant, SiteVisitReport partent avec.
    await tx.siteVisit.delete({ where: { id } });
  });
  return NextResponse.json({ ok: true });
}
