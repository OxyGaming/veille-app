import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

/**
 * Upsert d'une observation pour une visite.
 *  - PER_ITEM   : (visitId, sectionId, itemId) ; status = OUI | NON | SANS_OBJET
 *  - PER_SECTION: (visitId, sectionId, itemId=null) ; status = CONFORME | NON_CONFORME | SANS_OBJET
 */
const schema = z.object({
  sectionId: z.string().min(1),
  itemId: z.string().nullable().optional(),
  status: z.enum([
    "OUI",
    "NON",
    "CONFORME",
    "NON_CONFORME",
    "SANS_OBJET",
    "PENDING",
  ]),
  comment: z.string().nullable().optional(),
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
  const scope = teamScope(u);
  const visit = await prisma.siteVisit.findFirst({
    where: { id: visitId, ...scope },
    select: { id: true, status: true },
  });
  if (!visit) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  if (visit.status === "completed" || visit.status === "archived") {
    return NextResponse.json(
      { error: "Visite clôturée — saisie verrouillée." },
      { status: 400 }
    );
  }

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
  const { sectionId, itemId, status, comment } = parsed.data;

  // Recherche d'une observation existante (clé composite : itemId NULL géré
  // explicitement car SQLite considère NULL ≠ NULL pour @@unique).
  const existing = await prisma.siteVisitObservation.findFirst({
    where: { visitId, sectionId, itemId: itemId ?? null },
  });

  const upserted = existing
    ? await prisma.siteVisitObservation.update({
        where: { id: existing.id },
        data: {
          status,
          comment: comment === undefined ? undefined : comment,
          recordedAt: new Date(),
          recordedById: u.id,
        },
      })
    : await prisma.siteVisitObservation.create({
        data: {
          visitId,
          sectionId,
          itemId: itemId ?? null,
          status,
          comment: comment ?? null,
          recordedById: u.id,
        },
      });

  return NextResponse.json(upserted);
}
